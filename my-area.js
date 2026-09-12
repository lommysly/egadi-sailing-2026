import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { auth, crewAccessErrorMessage, crewAccessUrl, db, profileUrl, signOutCrew, startCrewAreaSession } from './crew-session.js?v=20260911-live';
import { roleConfirmationText } from './crew-roles.js?v=20260911-role1';

let activeInvite = null;
let activeBriefing = null;
let activeRuleAcceptance = null;
let stopPaymentSubscription = null;
let stopAnnouncementSubscription = null;
const PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal' },
  { id: 'satispay', label: 'Satispay' },
  { id: 'revolut', label: 'Revolut' },
  { id: 'bankTransfer', label: 'Bonifico' },
];

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('it-IT').format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

function paymentAmount(payment) {
  if (Number.isInteger(payment.amountCents)) return payment.amountCents / 100;
  return Number(payment.amount) || 0;
}

function paymentMethodTags(payment) {
  const selectedMethods = payment.paymentMethods || payment.methods || {};
  const methods = PAYMENT_METHODS.filter((method) => selectedMethods[method.id] === true);
  if (!methods.length) return '';
  return `<div class="payment-method-tags">${methods.map((method) => `<span class="payment-method-tag">${method.label}</span>`).join('')}</div>`;
}

function paymentStatusLabel(payment) {
  if (payment.status === 'verified') return 'Accredito verificato dallo skipper';
  if (payment.status === 'cancelled') return 'Richiesta annullata';
  return 'In attesa di verifica';
}

function showOpening(message = '', isError = false) {
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#boardingRulesGate').hidden = true;
  document.querySelector('#participantDashboard').hidden = true;
  document.querySelector('#signInSection').hidden = false;
  setMessage(document.querySelector('#participantAuthMessage'), message, isError);
}

function showInvalid(error) {
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#boardingRulesGate').hidden = true;
  document.querySelector('#participantDashboard').hidden = true;
  document.querySelector('#invalidLink').hidden = false;
  const message = document.querySelector('#invalidAccessMessage');
  if (message) setMessage(message, crewAccessErrorMessage(error));
  const loginLink = document.querySelector('#crewLoginLink');
  if (loginLink) loginLink.href = crewAccessUrl();
}

function clearPersonalDashboard() {
  stopPaymentSubscription?.();
  stopAnnouncementSubscription?.();
  stopPaymentSubscription = null;
  stopAnnouncementSubscription = null;
  activeInvite = null;
  activeBriefing = null;
  activeRuleAcceptance = null;
  ['#participantProfileSummary', '#participantPaymentList', '#boardingSchedule', '#participantSchedule', '#boardingRulesText', '#participantRulesText', '#participantAnnouncementList'].forEach((selector) => {
    document.querySelector(selector).replaceChildren();
  });
  document.querySelector('#boardingRulesGate').hidden = true;
  document.querySelector('#boardingBriefing').hidden = true;
  document.querySelector('#boardingGateWaiting').hidden = true;
  document.querySelector('#participantBriefing').hidden = true;
  document.querySelector('#rulesAcknowledgement').checked = false;
  document.querySelector('#acceptRulesButton').disabled = true;
}

function handlePrivateReadError(error, messageElement, fallbackMessage) {
  if (error?.code === 'permission-denied') {
    clearPersonalDashboard();
    showOpening('Questo accesso non è più attivo. Accedi di nuovo con numero e codice personale oppure chiedi allo skipper un nuovo invito.', true);
    return;
  }
  setMessage(messageElement, fallbackMessage, true);
}

function renderProfile(member) {
  const documentTail = member.documentNumber ? `•••• ${escapeHtml(member.documentNumber.slice(-4))}` : 'Non indicato';
  document.querySelector('#participantProfileSummary').innerHTML = `<dl><div><dt>Nome</dt><dd>${escapeHtml(member.displayName || `${member.firstName || ''} ${member.lastName || ''}`)}</dd></div><div><dt>Nascita</dt><dd>${escapeHtml([formatDate(member.birthDate), member.birthPlace].filter(Boolean).join(' · '))}</dd></div><div><dt>Documento</dt><dd>${escapeHtml(member.documentType || 'Documento')} · ${documentTail}</dd></div><div><dt>Ruolo a bordo</dt><dd>${escapeHtml(roleConfirmationText(member))}</dd></div></dl>`;
}

function renderPayments(snapshot) {
  const list = document.querySelector('#participantPaymentList');
  if (snapshot.empty) {
    list.innerHTML = '<p class="empty-state">Nessuna richiesta al momento. Lo skipper può aggiungerne altre anche in seguito.</p>';
    return;
  }
  list.innerHTML = snapshot.docs.map((item) => {
    const payment = item.data();
    const dueDate = payment.dueDate ? ` · Entro ${formatDate(payment.dueDate)}` : '';
    const reason = `${payment.reason || 'Contributo weekend'}${payment.isOptional ? ' · Facoltativo' : ''}`;
    const status = paymentStatusLabel(payment);
    const methods = paymentMethodTags(payment) || '<span>Metodo da concordare con lo skipper.</span>';
    const legacyInstructions = payment.instructions ? `<span>${escapeHtml(payment.instructions)}</span>` : '';
    return `<article class="payment-row"><div><strong>${formatCurrency(paymentAmount(payment))} · ${escapeHtml(reason)}</strong><span>${escapeHtml(dueDate)}</span>${methods}${legacyInstructions}<span class="payment-detail-note">I dettagli del pagamento sono nel messaggio WhatsApp dello skipper.</span></div><div class="payment-action"><span class="payment-status">${escapeHtml(status)}</span></div></article>`;
  }).join('');
}

function hasPublishedBriefing() {
  return typeof activeBriefing?.rulesText === 'string' && activeBriefing.rulesText.trim().length > 0;
}

function currentBriefingVersion() {
  return Number.isInteger(activeBriefing?.rulesVersion) ? activeBriefing.rulesVersion : 1;
}

function hasAcceptedCurrentBriefing() {
  return activeRuleAcceptance?.rulesVersion === currentBriefingVersion()
    && activeRuleAcceptance?.acceptedBy === auth.currentUser?.uid;
}

function briefingSchedule() {
  return [
    ['Ritrovo', activeBriefing?.meetingPoint],
    ['Imbarco', formatDateTime(activeBriefing?.boardingAt)],
    ['Partenza', formatDateTime(activeBriefing?.departureAt)],
    ['Rientro', formatDateTime(activeBriefing?.returnAt)],
    ['Nota operativa', activeBriefing?.scheduleNote],
  ].filter(([, value]) => value);
}

function renderSchedule(selector) {
  const target = document.querySelector(selector);
  target.innerHTML = briefingSchedule().map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function stopDashboardSubscriptions() {
  stopPaymentSubscription?.();
  stopAnnouncementSubscription?.();
  stopPaymentSubscription = null;
  stopAnnouncementSubscription = null;
}

function startDashboardSubscriptions() {
  if (!activeInvite || stopPaymentSubscription || stopAnnouncementSubscription) return;
  stopPaymentSubscription = onSnapshot(
    query(collection(db, 'boats', activeInvite.boatId, 'paymentRequests'), where('recipientId', '==', activeInvite.id)),
    renderPayments,
    (error) => handlePrivateReadError(error, document.querySelector('#accessLinkMessage'), 'Non riesco a leggere le richieste personali.'),
  );
  stopAnnouncementSubscription = onSnapshot(
    query(collection(db, 'boats', activeInvite.boatId, 'announcements'), orderBy('createdAt', 'desc')),
    renderAnnouncements,
    (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), 'Non riesco a leggere le comunicazioni.'),
  );
}

function renderDashboardBriefing() {
  const empty = document.querySelector('#participantBriefingEmpty');
  const briefing = document.querySelector('#participantBriefing');
  if (!hasPublishedBriefing()) {
    empty.hidden = false;
    briefing.hidden = true;
    return;
  }
  empty.hidden = true;
  briefing.hidden = false;
  renderSchedule('#participantSchedule');
  document.querySelector('#participantRulesTitle').textContent = activeBriefing.rulesTitle || 'Briefing di sicurezza';
  document.querySelector('#participantRulesText').textContent = activeBriefing.rulesText;
  const acceptedAt = formatDateTime(activeRuleAcceptance?.acceptedAt);
  document.querySelector('#participantRulesStatus').textContent = `Briefing di sicurezza versione ${currentBriefingVersion()} accettato${acceptedAt ? ` il ${acceptedAt}` : ''}.`;
}

function renderBoardingGate() {
  if (!activeInvite || !auth.currentUser) return;
  const gate = document.querySelector('#boardingRulesGate');
  const dashboard = document.querySelector('#participantDashboard');
  const briefing = document.querySelector('#boardingBriefing');
  const waiting = document.querySelector('#boardingGateWaiting');
  const status = document.querySelector('#boardingGateStatus');
  const acknowledgement = document.querySelector('#rulesAcknowledgement');
  const acceptButton = document.querySelector('#acceptRulesButton');

  if (!hasPublishedBriefing()) {
    stopDashboardSubscriptions();
    dashboard.hidden = true;
    gate.hidden = false;
    briefing.hidden = true;
    waiting.hidden = false;
    acknowledgement.checked = false;
    acceptButton.disabled = true;
    gate.dataset.rulesVersion = '';
    status.textContent = 'Il briefing di sicurezza è obbligatorio prima di accedere alla tua area di bordo.';
    return;
  }

  renderSchedule('#boardingSchedule');
  document.querySelector('#boardingRulesTitle').textContent = activeBriefing.rulesTitle || 'Briefing di sicurezza';
  document.querySelector('#boardingRulesText').textContent = activeBriefing.rulesText;
  const version = String(currentBriefingVersion());
  if (gate.dataset.rulesVersion !== version) {
    acknowledgement.checked = false;
    gate.dataset.rulesVersion = version;
  }

  if (hasAcceptedCurrentBriefing()) {
    gate.hidden = true;
    dashboard.hidden = false;
    renderDashboardBriefing();
    startDashboardSubscriptions();
    return;
  }

  stopDashboardSubscriptions();
  dashboard.hidden = true;
  gate.hidden = false;
  waiting.hidden = true;
  briefing.hidden = false;
  status.textContent = `Leggi il briefing di sicurezza e accetta la versione ${version} per entrare nella tua area di bordo.`;
  acceptButton.disabled = !acknowledgement.checked;
}

function renderAnnouncements(snapshot) {
  const list = document.querySelector('#participantAnnouncementList');
  if (snapshot.empty) {
    list.innerHTML = '<p class="empty-state">Nessuna comunicazione al momento.</p>';
    return;
  }
  list.innerHTML = snapshot.docs.map((item) => {
    const announcement = item.data();
    const important = announcement.isImportant ? '<span class="announcement-important">Importante</span>' : '';
    return `<article class="announcement-row"><strong>${escapeHtml(announcement.title || 'Comunicazione dello skipper')}</strong><span>${escapeHtml(announcement.message || '')}</span><span class="announcement-meta">${important}${escapeHtml(formatDateTime(announcement.createdAt) || 'Appena pubblicato')}</span></article>`;
  }).join('');
}

document.querySelector('#participantSignOutButton').addEventListener('click', async () => {
  try {
    await signOutCrew();
  } finally {
    window.location.assign('index.html');
  }
});

document.querySelector('#rulesAcknowledgement').addEventListener('change', (event) => {
  const canAccept = hasPublishedBriefing() && !hasAcceptedCurrentBriefing() && event.currentTarget.checked;
  document.querySelector('#acceptRulesButton').disabled = !canAccept;
});

document.querySelector('#acceptRulesButton').addEventListener('click', async () => {
  if (!hasPublishedBriefing() || !activeInvite || !auth.currentUser) return;
  if (!document.querySelector('#rulesAcknowledgement').checked) {
    setMessage(document.querySelector('#participantRulesMessage'), 'Conferma di aver letto briefing e regole prima di proseguire.', true);
    return;
  }
  const button = document.querySelector('#acceptRulesButton');
  button.disabled = true;
  try {
    const rulesVersion = currentBriefingVersion();
    const acceptance = { inviteId: activeInvite.id, acceptedBy: auth.currentUser.uid, rulesVersion, acceptedAt: serverTimestamp() };
    const batch = writeBatch(db);
    batch.set(doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id), acceptance, { merge: true });
    const historyId = `${rulesVersion}-${auth.currentUser.uid}`;
    batch.create(doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id, 'history', historyId), acceptance);
    await batch.commit();
    setMessage(document.querySelector('#participantRulesMessage'), 'Briefing confermato. Apro la tua area di bordo…');
  } catch (error) {
    setMessage(document.querySelector('#participantRulesMessage'), 'Non riesco a confermare le regole. Riprova tra poco.', true);
    button.disabled = false;
  }
});

startCrewAreaSession({
  onOpening: showOpening,
  onInvalid: showInvalid,
  onReady: async ({ invite }) => {
    activeInvite = invite;
    const member = await getDoc(doc(db, 'boats', invite.boatId, 'members', invite.id));
    if (!member.exists()) {
      window.location.replace(profileUrl({ edit: true }));
      return;
    }
    document.querySelector('#signInSection').hidden = true;
    document.querySelector('#participantDashboard').hidden = true;
    document.querySelector('#participantTitle').textContent = member.data().displayName || invite.displayName || 'La mia area';
    document.querySelector('#editProfileButton').href = profileUrl({ edit: true });
    renderProfile(member.data());
    onSnapshot(doc(db, 'boats', invite.boatId, 'briefing', 'board'), (snapshot) => {
      activeBriefing = snapshot.exists() ? snapshot.data() : null;
      renderBoardingGate();
    }, (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), 'Non riesco a leggere il briefing di sicurezza.'));
    onSnapshot(doc(db, 'boats', invite.boatId, 'ruleAcceptances', invite.id), (snapshot) => {
      activeRuleAcceptance = snapshot.exists() ? snapshot.data() : null;
      renderBoardingGate();
    }, (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), 'Non riesco a leggere la conferma del briefing.'));
  },
});

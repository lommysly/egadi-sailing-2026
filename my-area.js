import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { auth, crewAccessErrorMessage, crewAccessUrl, db, profileUrl, signOutCrew, startCrewAreaSession } from './crew-session.js?v=20260911-live';
import { roleConfirmationText } from './crew-roles.js?v=20260911-role1';

let activeInvite = null;
let activeBriefing = null;
let activeRuleAcceptance = null;
let activeContributionPlan = null;
let stopPaymentSubscription = null;
let stopAnnouncementSubscription = null;
let stopContributionPlanSubscription = null;
const PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal' },
  { id: 'satispay', label: 'Satispay' },
  { id: 'revolut', label: 'Revolut' },
  { id: 'bankTransfer', label: 'Bonifico' },
];
const CONTRIBUTION_ITEM_STATES = new Map([
  ['to_define', 'Da confermare con lo skipper'],
  ['included', 'Compreso nella quota'],
  ['extra', 'Da richiedere a parte'],
  ['local', 'Da regolare in loco / da dividere'],
  ['not_applicable', 'Non previsto'],
]);
const CONTRIBUTION_ITEMS = [
  { id: 'berth', label: 'Quota posto in barca' },
  { id: 'starter_pack', label: 'Starter Pack · pulizie finali, fuoribordo e tender' },
  { id: 'linen_towels', label: 'Lenzuola e asciugamani' },
  { id: 'protection_insurance', label: 'Assicurazione cauzione' },
  { id: 'provisions', label: 'Cambusa' },
  { id: 'fuel', label: 'Gasolio per la navigazione' },
  { id: 'transfer', label: 'Transfer da/per il porto' },
  { id: 'refundable_deposit', label: 'Cauzione rimborsabile' },
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
  clearPersonalDashboard();
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#boardingRulesGate').hidden = true;
  document.querySelector('#participantDashboard').hidden = true;
  document.querySelector('#signInSection').hidden = false;
  setMessage(document.querySelector('#participantAuthMessage'), message, isError);
}

function showInvalid(error) {
  clearPersonalDashboard();
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
  stopContributionPlanSubscription?.();
  stopPaymentSubscription = null;
  stopAnnouncementSubscription = null;
  stopContributionPlanSubscription = null;
  activeInvite = null;
  activeBriefing = null;
  activeRuleAcceptance = null;
  activeContributionPlan = null;
  ['#participantProfileSummary', '#participantPaymentList', '#boardingSchedule', '#participantSchedule', '#boardingRulesSummary', '#boardingRulesText', '#participantRulesSummary', '#participantRulesText', '#participantAnnouncementList', '#participantContributionIncluded', '#participantContributionSeparate'].forEach((selector) => {
    document.querySelector(selector).replaceChildren();
  });
  document.querySelector('#boardingRulesGate').hidden = true;
  document.querySelector('#boardingBriefing').hidden = true;
  document.querySelector('#boardingGateWaiting').hidden = true;
  document.querySelector('#participantBriefing').hidden = true;
  document.querySelector('#participantContributionPlan').hidden = true;
  document.querySelector('#participantContributionPlanEmpty').hidden = false;
  document.querySelector('#participantContributionNotApplicable')?.replaceChildren();
  clearBoardingRulesGateState();
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

function contributionAmountCents(item) {
  const amountCents = Number(item?.amountCents);
  return Number.isInteger(amountCents) && amountCents >= 0 ? amountCents : 0;
}

function contributionPlanItems(plan = activeContributionPlan) {
  const sourceItems = plan?.items && typeof plan.items === 'object' ? plan.items : {};
  return CONTRIBUTION_ITEMS.map((item) => {
    const source = sourceItems[item.id] || {};
    const state = CONTRIBUTION_ITEM_STATES.has(source.state) ? source.state : 'to_define';
    return { ...item, state, amountCents: contributionAmountCents(source) };
  });
}

function contributionItemMarkup(item) {
  const amount = item.amountCents > 0 ? ` · ${formatCurrency(item.amountCents / 100)} a persona` : '';
  return `<div><span>${escapeHtml(CONTRIBUTION_ITEM_STATES.get(item.state))}</span><strong>${escapeHtml(item.label)}${escapeHtml(amount)}</strong></div>`;
}

function contributionNotApplicableContainer(plan) {
  let container = document.querySelector('#participantContributionNotApplicable');
  if (container) return container;
  const heading = document.createElement('h4');
  heading.textContent = 'Non previsto per questa barca';
  container = document.createElement('div');
  container.id = 'participantContributionNotApplicable';
  container.className = 'schedule-list';
  plan.querySelector('.panel-lead')?.before(heading, container);
  return container;
}

function renderContributionPlan() {
  const empty = document.querySelector('#participantContributionPlanEmpty');
  const plan = document.querySelector('#participantContributionPlan');
  const included = document.querySelector('#participantContributionIncluded');
  const separate = document.querySelector('#participantContributionSeparate');
  if (!activeContributionPlan) {
    empty.hidden = false;
    plan.hidden = true;
    included.replaceChildren();
    separate.replaceChildren();
    document.querySelector('#participantContributionNotApplicable')?.replaceChildren();
    return;
  }

  const notApplicable = contributionNotApplicableContainer(plan);
  const items = contributionPlanItems();
  const includedItems = items.filter((item) => item.state === 'included');
  const separateItems = items.filter((item) => ['extra', 'local', 'to_define'].includes(item.state));
  const notApplicableItems = items.filter((item) => item.state === 'not_applicable');
  empty.hidden = true;
  plan.hidden = false;
  included.innerHTML = includedItems.length
    ? includedItems.map(contributionItemMarkup).join('')
    : '<p class="empty-state">Nessuna voce è stata ancora indicata come compresa nella quota.</p>';
  separate.innerHTML = separateItems.length
    ? separateItems.map(contributionItemMarkup).join('')
    : '<p class="empty-state">Nessuna spesa separata o da confermare al momento.</p>';
  notApplicable.innerHTML = notApplicableItems.length
    ? notApplicableItems.map(contributionItemMarkup).join('')
    : '<p class="empty-state">Nessuna voce è stata esclusa.</p>';
}

function hasPublishedBriefing() {
  return typeof activeBriefing?.rulesText === 'string' && activeBriefing.rulesText.trim().length > 0;
}

function briefingRequiresFullRulesRead() {
  return activeBriefing?.fullRulesRequired === true;
}

function briefingSummary() {
  const summary = activeBriefing?.rulesSummary;
  return typeof summary === 'string' && summary.trim()
    ? summary.trim()
    : 'Leggi integralmente il regolamento completo: questa sintesi non sostituisce il testo.';
}

function currentBriefingVersion() {
  return Number.isInteger(activeBriefing?.rulesVersion) ? activeBriefing.rulesVersion : 1;
}

function hasAcceptedCurrentBriefing() {
  return activeRuleAcceptance?.rulesVersion === currentBriefingVersion()
    && activeRuleAcceptance?.acceptedBy === auth.currentUser?.uid
    && (!briefingRequiresFullRulesRead() || activeRuleAcceptance?.fullRulesRead === true);
}

function hasReachedEnd(element) {
  return element.clientHeight > 0 && element.scrollHeight - element.scrollTop - element.clientHeight <= 8;
}

function isEntireRulesTextVisible(element) {
  return element.clientHeight > 0 && element.scrollHeight <= element.clientHeight + 8;
}

function clearBoardingRulesGateState() {
  const gate = document.querySelector('#boardingRulesGate');
  const scrollRegion = document.querySelector('#boardingRulesScroll');
  gate.dataset.rulesContext = '';
  gate.dataset.rulesVersion = '';
  gate.dataset.fullRulesRead = '';
  scrollRegion.scrollTop = 0;
  scrollRegion.classList.remove('is-complete');
  document.querySelector('#rulesAcknowledgement').checked = false;
  document.querySelector('#rulesAcknowledgement').disabled = true;
  document.querySelector('#acceptRulesButton').disabled = true;
  document.querySelector('#boardingFullRulesHint').textContent = 'Scorri fino alla fine del regolamento per sbloccare la conferma.';
}

function updateBoardingAcceptState() {
  const gate = document.querySelector('#boardingRulesGate');
  const acknowledgement = document.querySelector('#rulesAcknowledgement');
  const acceptButton = document.querySelector('#acceptRulesButton');
  const fullRulesRead = gate.dataset.fullRulesRead === 'true';
  acknowledgement.disabled = !fullRulesRead;
  if (!fullRulesRead) acknowledgement.checked = false;
  acceptButton.disabled = !(hasPublishedBriefing() && !hasAcceptedCurrentBriefing() && fullRulesRead && acknowledgement.checked);
}

function markBoardingRulesRead() {
  const gate = document.querySelector('#boardingRulesGate');
  const scrollRegion = document.querySelector('#boardingRulesScroll');
  const acknowledgement = document.querySelector('#rulesAcknowledgement');
  if (gate.dataset.fullRulesRead === 'true') return;
  gate.dataset.fullRulesRead = 'true';
  scrollRegion.classList.add('is-complete');
  document.querySelector('#boardingFullRulesHint').textContent = 'Regolamento completo visualizzato. Ora puoi confermare la lettura.';
  updateBoardingAcceptState();
  if (document.activeElement === scrollRegion) acknowledgement.focus();
}

function resetBoardingRulesRead() {
  const gate = document.querySelector('#boardingRulesGate');
  const scrollRegion = document.querySelector('#boardingRulesScroll');
  gate.dataset.fullRulesRead = '';
  scrollRegion.scrollTop = 0;
  scrollRegion.classList.remove('is-complete');
  document.querySelector('#boardingFullRulesHint').textContent = 'Scorri fino alla fine del regolamento per sbloccare la conferma.';
  updateBoardingAcceptState();
  requestAnimationFrame(() => {
    if (isEntireRulesTextVisible(scrollRegion)) markBoardingRulesRead();
  });
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
  stopContributionPlanSubscription?.();
  stopPaymentSubscription = null;
  stopAnnouncementSubscription = null;
  stopContributionPlanSubscription = null;
}

function startDashboardSubscriptions() {
  if (!activeInvite) return;
  if (!stopPaymentSubscription) {
    stopPaymentSubscription = onSnapshot(
      query(collection(db, 'boats', activeInvite.boatId, 'paymentRequests'), where('recipientId', '==', activeInvite.id)),
      renderPayments,
      (error) => handlePrivateReadError(error, document.querySelector('#accessLinkMessage'), 'Non riesco a leggere le richieste personali.'),
    );
  }
  if (!stopAnnouncementSubscription) {
    stopAnnouncementSubscription = onSnapshot(
      query(collection(db, 'boats', activeInvite.boatId, 'announcements'), orderBy('createdAt', 'desc')),
      renderAnnouncements,
      (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), 'Non riesco a leggere le comunicazioni.'),
    );
  }
  if (!stopContributionPlanSubscription) {
    stopContributionPlanSubscription = onSnapshot(
      doc(db, 'boats', activeInvite.boatId, 'contributionPlan', 'default'),
      (snapshot) => {
        activeContributionPlan = snapshot.exists() ? snapshot.data() : null;
        renderContributionPlan();
      },
      (error) => handlePrivateReadError(error, document.querySelector('#accessLinkMessage'), 'Non riesco a leggere la composizione delle quote.'),
    );
  }
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
  document.querySelector('#participantRulesTitle').textContent = activeBriefing.rulesTitle || 'Regolamento completo';
  document.querySelector('#participantRulesSummary').textContent = briefingSummary();
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
    acknowledgement.disabled = true;
    acceptButton.disabled = true;
    gate.dataset.rulesContext = '';
    gate.dataset.rulesVersion = '';
    gate.dataset.fullRulesRead = '';
    status.textContent = 'Il briefing di sicurezza è obbligatorio prima di accedere alla tua area di bordo.';
    return;
  }

  renderSchedule('#boardingSchedule');
  const version = String(currentBriefingVersion());
  const rulesContext = `${activeInvite.boatId}:${activeInvite.id}:${version}`;
  if (gate.dataset.rulesContext !== rulesContext) {
    document.querySelector('#boardingRulesTitle').textContent = activeBriefing.rulesTitle || 'Regolamento completo';
    document.querySelector('#boardingRulesSummary').textContent = briefingSummary();
    document.querySelector('#boardingRulesText').textContent = activeBriefing.rulesText;
    gate.dataset.rulesContext = rulesContext;
    gate.dataset.rulesVersion = version;
    resetBoardingRulesRead();
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
  status.textContent = `Leggi la sintesi e l’intero regolamento, poi accetta la versione ${version} per entrare nella tua area di bordo.`;
  updateBoardingAcceptState();
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
  if (!event.currentTarget.disabled) updateBoardingAcceptState();
});

document.querySelector('#boardingRulesScroll').addEventListener('scroll', (event) => {
  if (hasPublishedBriefing() && hasReachedEnd(event.currentTarget)) markBoardingRulesRead();
});

if ('ResizeObserver' in window) {
  new ResizeObserver(() => {
    const scrollRegion = document.querySelector('#boardingRulesScroll');
    if (hasPublishedBriefing() && scrollRegion && isEntireRulesTextVisible(scrollRegion)) markBoardingRulesRead();
  }).observe(document.querySelector('#boardingRulesScroll'));
}

document.querySelector('#boardingGateStatus').setAttribute('role', 'status');
document.querySelector('#boardingGateStatus').setAttribute('aria-live', 'polite');

document.querySelector('#acceptRulesButton').addEventListener('click', async () => {
  if (!hasPublishedBriefing() || !activeInvite || !auth.currentUser) return;
  if (!document.querySelector('#rulesAcknowledgement').checked) {
    setMessage(document.querySelector('#participantRulesMessage'), 'Scorri il regolamento completo e conferma di averlo letto prima di proseguire.', true);
    return;
  }
  if (document.querySelector('#boardingRulesGate').dataset.fullRulesRead !== 'true') return;
  const button = document.querySelector('#acceptRulesButton');
  button.disabled = true;
  try {
    const rulesVersion = currentBriefingVersion();
    const acceptance = {
      inviteId: activeInvite.id,
      acceptedBy: auth.currentUser.uid,
      rulesVersion,
      ...(briefingRequiresFullRulesRead() ? { fullRulesRead: true } : {}),
      acceptedAt: serverTimestamp(),
    };
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

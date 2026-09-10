import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { auth, boatId, db, inviteId, personalAreaUrl, profileUrl, startCrewSession } from './crew-session.js';

let activeInvite = null;
let activeBriefing = null;
let activeRuleAcceptance = null;

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

function showOpening(message = '', isError = false) {
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#participantDashboard').hidden = true;
  document.querySelector('#signInSection').hidden = false;
  setMessage(document.querySelector('#participantAuthMessage'), message, isError);
}

function showInvalid() {
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#participantDashboard').hidden = true;
  document.querySelector('#invalidLink').hidden = false;
}

function renderProfile(member) {
  const documentTail = member.documentNumber ? `•••• ${escapeHtml(member.documentNumber.slice(-4))}` : 'Non indicato';
  document.querySelector('#participantProfileSummary').innerHTML = `<dl><div><dt>Nome</dt><dd>${escapeHtml(member.displayName || `${member.firstName || ''} ${member.lastName || ''}`)}</dd></div><div><dt>Nascita</dt><dd>${escapeHtml([formatDate(member.birthDate), member.birthPlace].filter(Boolean).join(' · '))}</dd></div><div><dt>Documento</dt><dd>${escapeHtml(member.documentType || 'Documento')} · ${documentTail}</dd></div><div><dt>Cabina / ruolo</dt><dd>${escapeHtml(member.role || 'Da definire con lo skipper')}</dd></div></dl>`;
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
    const status = payment.status === 'verified' ? 'Accredito verificato dallo skipper' : 'In attesa di verifica';
    return `<article class="payment-row"><div><strong>${formatCurrency(payment.amount)} · ${escapeHtml(reason)}</strong><span>${escapeHtml(payment.instructions || '')}</span><span>${escapeHtml(dueDate)}</span></div><div class="payment-action"><span class="payment-status">${escapeHtml(status)}</span></div></article>`;
  }).join('');
}

function renderBriefing() {
  const empty = document.querySelector('#participantBriefingEmpty');
  const briefing = document.querySelector('#participantBriefing');
  if (!activeBriefing?.rulesText) {
    empty.hidden = false;
    briefing.hidden = true;
    return;
  }
  empty.hidden = true;
  briefing.hidden = false;
  const schedule = [['Ritrovo', activeBriefing.meetingPoint], ['Imbarco', formatDateTime(activeBriefing.boardingAt)], ['Partenza', formatDateTime(activeBriefing.departureAt)], ['Rientro', formatDateTime(activeBriefing.returnAt)], ['Nota operativa', activeBriefing.scheduleNote]].filter(([, value]) => value);
  document.querySelector('#participantSchedule').innerHTML = schedule.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  document.querySelector('#participantRulesTitle').textContent = activeBriefing.rulesTitle || 'Regole di bordo';
  document.querySelector('#participantRulesText').textContent = activeBriefing.rulesText;
  const version = activeBriefing.rulesVersion || 1;
  const accepted = activeRuleAcceptance?.rulesVersion === version;
  document.querySelector('#participantRulesStatus').textContent = accepted ? `Hai confermato la lettura delle regole, versione ${version}.` : `Leggi le regole e conferma la versione ${version} prima della partenza.`;
  document.querySelector('#acceptRulesButton').hidden = accepted;
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

document.querySelector('#participantSignOutButton').addEventListener('click', () => window.location.assign('index.html'));
document.querySelector('#copyAccessButton').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(personalAreaUrl());
    setMessage(document.querySelector('#accessLinkMessage'), 'Link copiato. Conservalo nei messaggi preferiti e non inoltrarlo.');
  } catch (error) {
    setMessage(document.querySelector('#accessLinkMessage'), 'Non riesco a copiare il link. Puoi chiedere allo skipper di reinviarlo.', true);
  }
});
document.querySelector('#acceptRulesButton').addEventListener('click', async () => {
  if (!activeBriefing || !activeInvite || !auth.currentUser) return;
  const button = document.querySelector('#acceptRulesButton');
  button.disabled = true;
  try {
    const rulesVersion = activeBriefing.rulesVersion || 1;
    const acceptance = { inviteId, acceptedBy: auth.currentUser.uid, rulesVersion, acceptedAt: serverTimestamp() };
    const batch = writeBatch(db);
    batch.set(doc(db, 'boats', boatId, 'ruleAcceptances', inviteId), acceptance, { merge: true });
    batch.set(doc(db, 'boats', boatId, 'ruleAcceptances', inviteId, 'history', String(rulesVersion)), acceptance, { merge: true });
    await batch.commit();
    setMessage(document.querySelector('#participantRulesMessage'), 'Regole confermate.');
  } catch (error) {
    setMessage(document.querySelector('#participantRulesMessage'), 'Non riesco a confermare le regole. Riprova tra poco.', true);
    button.disabled = false;
  }
});

startCrewSession({
  onOpening: showOpening,
  onInvalid: showInvalid,
  onReady: async ({ invite }) => {
    activeInvite = invite;
    const member = await getDoc(doc(db, 'boats', boatId, 'members', inviteId));
    if (!member.exists()) {
      window.location.replace(profileUrl());
      return;
    }
    document.querySelector('#signInSection').hidden = true;
    document.querySelector('#participantDashboard').hidden = false;
    document.querySelector('#participantTitle').textContent = member.data().displayName || invite.displayName || 'La mia area';
    document.querySelector('#editProfileButton').href = profileUrl({ edit: true });
    renderProfile(member.data());
    onSnapshot(query(collection(db, 'boats', boatId, 'paymentRequests'), where('recipientId', '==', inviteId)), renderPayments, () => setMessage(document.querySelector('#accessLinkMessage'), 'Non riesco a leggere le richieste personali.', true));
    onSnapshot(doc(db, 'boats', boatId, 'briefing', 'board'), (snapshot) => { activeBriefing = snapshot.exists() ? snapshot.data() : null; renderBriefing(); }, () => setMessage(document.querySelector('#participantRulesMessage'), 'Non riesco a leggere la bacheca di bordo.', true));
    onSnapshot(query(collection(db, 'boats', boatId, 'announcements'), orderBy('createdAt', 'desc')), renderAnnouncements, () => setMessage(document.querySelector('#participantRulesMessage'), 'Non riesco a leggere le comunicazioni.', true));
    onSnapshot(doc(db, 'boats', boatId, 'ruleAcceptances', inviteId), (snapshot) => { activeRuleAcceptance = snapshot.exists() ? snapshot.data() : null; renderBriefing(); }, () => setMessage(document.querySelector('#participantRulesMessage'), 'Non riesco a leggere la conferma delle regole.', true));
  },
});

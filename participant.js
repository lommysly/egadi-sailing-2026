import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail, signInWithEmailLink, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, doc, getDoc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const inviteId = new URLSearchParams(window.location.search).get('invite') || '';
const boatId = new URLSearchParams(window.location.search).get('boat') || '';
const isValidInviteId = /^[a-f0-9]{48}$/.test(inviteId) && /^[A-Za-z0-9_-]{1,128}$/.test(boatId);
const isEmailLink = isSignInWithEmailLink(auth, window.location.href);
let activeInvite = null;
let activeBriefing = null;
let activeRuleAcceptance = null;
let stopPaymentSubscription = null;
let stopBriefingSubscription = null;
let stopAnnouncementSubscription = null;
let stopAcceptanceSubscription = null;

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function getAuthErrorMessage(error) {
  if (error.code === 'auth/unauthorized-domain') return 'Questo indirizzo del sito non è ancora autorizzato in Firebase.';
  if (error.code === 'auth/operation-not-allowed') return 'L’accesso via email non è ancora abilitato nel progetto Firebase.';
  return 'Accesso non completato. Riprova tra poco.';
}

function participantEntryUrl() {
  const url = new URL('participant.html', window.location.href);
  url.searchParams.set('invite', inviteId);
  url.searchParams.set('boat', boatId);
  return url.toString();
}

function emailSettings() {
  return { url: participantEntryUrl(), handleCodeInApp: true };
}

function isEmailUser(user) {
  return user?.providerData?.some((provider) => provider.providerId === 'password');
}

function showEmailAccess(message = '') {
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#participantDashboard').hidden = true;
  document.querySelector('#signInSection').hidden = false;
  document.querySelector('#participantEmailForm').hidden = isEmailLink;
  document.querySelector('#participantEmailCompleteForm').hidden = !isEmailLink;
  document.querySelector('#participantChangeAccount').hidden = true;
  if (message) setMessage(document.querySelector('#participantAuthMessage'), message);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('it-IT').format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function fillProfile(member) {
  const form = document.querySelector('#participantForm');
  for (const [field, value] of Object.entries(member || {})) {
    const input = form.elements.namedItem(field);
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value || '';
  }
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
    const status = payment.status === 'verified' ? 'Accredito verificato dallo skipper' : 'In attesa di verifica';
    const reason = `${payment.reason || 'Contributo weekend'}${payment.isOptional ? ' · Facoltativo' : ''}`;
    return `<article class="payment-row"><div><strong>${formatCurrency(payment.amount)} · ${escapeHtml(reason)}</strong><span>${escapeHtml(payment.instructions)}</span><span>${escapeHtml(dueDate)}</span></div><div class="payment-action"><span class="payment-status">${escapeHtml(status)}</span></div></article>`;
  }).join('');
}

function renderBriefing() {
  const empty = document.querySelector('#participantBriefingEmpty');
  const briefing = document.querySelector('#participantBriefing');
  const announcements = document.querySelector('#participantAnnouncementList');
  if (!activeBriefing?.rulesText) {
    empty.hidden = false;
    briefing.hidden = true;
    announcements.innerHTML = '<p class="empty-state">Nessuna comunicazione al momento.</p>';
    return;
  }
  empty.hidden = true;
  briefing.hidden = false;
  const schedule = [
    ['Ritrovo', activeBriefing.meetingPoint],
    ['Imbarco', formatDateTime(activeBriefing.boardingAt)],
    ['Partenza', formatDateTime(activeBriefing.departureAt)],
    ['Rientro', formatDateTime(activeBriefing.returnAt)],
    ['Nota operativa', activeBriefing.scheduleNote],
  ].filter(([, value]) => value);
  document.querySelector('#participantSchedule').innerHTML = schedule.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  document.querySelector('#participantRulesTitle').textContent = activeBriefing.rulesTitle || 'Regole di bordo';
  document.querySelector('#participantRulesText').textContent = activeBriefing.rulesText;
  const version = activeBriefing.rulesVersion || 1;
  const accepted = activeRuleAcceptance?.rulesVersion === version;
  document.querySelector('#participantRulesStatus').textContent = accepted
    ? `Hai confermato la lettura delle regole, versione ${version}.`
    : `Leggi le regole e conferma la versione ${version} prima della partenza.`;
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
    const date = formatDateTime(announcement.createdAt);
    const important = announcement.isImportant ? '<span class="announcement-important">Importante</span>' : '';
    return `<article class="announcement-row"><strong>${escapeHtml(announcement.title || 'Comunicazione dello skipper')}</strong><span>${escapeHtml(announcement.message || '')}</span><span class="announcement-meta">${important}${escapeHtml(date || 'Appena pubblicato')}</span></article>`;
  }).join('');
}

function resetParticipantSubscriptions() {
  stopPaymentSubscription?.();
  stopBriefingSubscription?.();
  stopAnnouncementSubscription?.();
  stopAcceptanceSubscription?.();
  stopPaymentSubscription = null;
  stopBriefingSubscription = null;
  stopAnnouncementSubscription = null;
  stopAcceptanceSubscription = null;
  activeBriefing = null;
  activeRuleAcceptance = null;
}

async function openParticipantArea(user) {
  const signInSection = document.querySelector('#signInSection');
  const dashboard = document.querySelector('#participantDashboard');
  const inviteReference = doc(db, 'boats', boatId, 'invites', inviteId);
  if (!activeInvite.participantUid) {
    await updateDoc(inviteReference, { participantUid: user.uid, status: 'opened', acceptedAt: serverTimestamp() });
    activeInvite = { ...activeInvite, participantUid: user.uid, status: 'opened' };
  }
  if (activeInvite.participantUid !== user.uid) {
    signInSection.hidden = true;
    dashboard.hidden = true;
    document.querySelector('#invalidLink').hidden = false;
    return;
  }
  signInSection.hidden = true;
  dashboard.hidden = false;
  document.querySelector('#participantTitle').textContent = activeInvite.displayName || 'La mia scheda';
  document.querySelector('#participantStatus').textContent = `Accesso protetto per ${user.email || 'questo account'}.`;
  await setDoc(doc(db, 'boats', boatId, 'participantAccess', user.uid), {
    inviteId, boatId, userId: user.uid, updatedAt: serverTimestamp(),
  }, { merge: true });
  const memberReference = doc(db, 'boats', boatId, 'members', inviteId);
  const memberSnapshot = await getDoc(memberReference);
  if (memberSnapshot.exists()) fillProfile(memberSnapshot.data());
  else document.querySelector('#participantForm [name="email"]').value = user.email || '';
  resetParticipantSubscriptions();
  stopPaymentSubscription = onSnapshot(query(collection(db, 'boats', boatId, 'paymentRequests'), where('recipientId', '==', inviteId)), renderPayments, () => setMessage(document.querySelector('#participantFormMessage'), 'Non riesco a leggere le richieste personali.', true));
  stopBriefingSubscription = onSnapshot(doc(db, 'boats', boatId, 'briefing', 'board'), (snapshot) => {
    activeBriefing = snapshot.exists() ? snapshot.data() : null;
    renderBriefing();
  }, () => setMessage(document.querySelector('#participantRulesMessage'), 'Non riesco a leggere la bacheca di bordo.', true));
  stopAnnouncementSubscription = onSnapshot(query(collection(db, 'boats', boatId, 'announcements'), orderBy('createdAt', 'desc')), renderAnnouncements, () => setMessage(document.querySelector('#participantRulesMessage'), 'Non riesco a leggere le comunicazioni.', true));
  stopAcceptanceSubscription = onSnapshot(doc(db, 'boats', boatId, 'ruleAcceptances', inviteId), (snapshot) => {
    activeRuleAcceptance = snapshot.exists() ? snapshot.data() : null;
    renderBriefing();
  }, () => setMessage(document.querySelector('#participantRulesMessage'), 'Non riesco a leggere la conferma delle regole.', true));
}

document.querySelector('#participantEmailForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const email = new FormData(form).get('email').trim();
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await sendSignInLinkToEmail(auth, email, emailSettings());
    setMessage(document.querySelector('#participantAuthMessage'), 'Link inviato. Apri l’email e conferma di nuovo il tuo indirizzo per entrare.');
  } catch (error) {
    setMessage(document.querySelector('#participantAuthMessage'), getAuthErrorMessage(error), true);
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelector('#participantEmailCompleteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const email = new FormData(form).get('email').trim();
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await signInWithEmailLink(auth, email, window.location.href);
    window.history.replaceState({}, document.title, participantEntryUrl());
  } catch (error) {
    setMessage(document.querySelector('#participantAuthMessage'), 'Il link non è valido per questa email o è scaduto. Richiedine uno nuovo.', true);
    submitButton.disabled = false;
  }
});
document.querySelector('#participantChangeAccount').addEventListener('click', () => signOut(auth));
document.querySelector('#participantSignOutButton').addEventListener('click', () => signOut(auth));
document.querySelector('#acceptRulesButton').addEventListener('click', async () => {
  if (!activeBriefing || !activeInvite || !auth.currentUser) return;
  const button = document.querySelector('#acceptRulesButton');
  button.disabled = true;
  try {
    const rulesVersion = activeBriefing.rulesVersion || 1;
    const acceptanceReference = doc(db, 'boats', boatId, 'ruleAcceptances', inviteId);
    const historyReference = doc(db, 'boats', boatId, 'ruleAcceptances', inviteId, 'history', String(rulesVersion));
    const batch = writeBatch(db);
    const acceptance = { inviteId, acceptedBy: auth.currentUser.uid, rulesVersion, acceptedAt: serverTimestamp() };
    batch.set(acceptanceReference, acceptance, { merge: true });
    batch.set(historyReference, acceptance, { merge: true });
    await batch.commit();
    setMessage(document.querySelector('#participantRulesMessage'), 'Regole confermate.');
  } catch (error) {
    setMessage(document.querySelector('#participantRulesMessage'), 'Non riesco a confermare le regole. Riprova tra poco.', true);
    button.disabled = false;
  }
});
document.querySelector('#participantForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeInvite || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await setDoc(doc(db, 'boats', boatId, 'members', inviteId), {
      firstName: fields.get('firstName').trim(), lastName: fields.get('lastName').trim(), birthDate: fields.get('birthDate'),
      birthPlace: fields.get('birthPlace').trim(), nationality: fields.get('nationality').trim(), gender: fields.get('gender'),
      documentType: fields.get('documentType'), documentNumber: fields.get('documentNumber').trim(), documentExpiry: fields.get('documentExpiry'),
      role: fields.get('role').trim(), email: fields.get('email').trim().toLowerCase(), phone: fields.get('phone').trim(),
      charterConsent: fields.get('charterConsent') === 'on', displayName: `${fields.get('firstName').trim()} ${fields.get('lastName').trim()}`,
      updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid,
    }, { merge: true });
    setMessage(document.querySelector('#participantFormMessage'), 'Anagrafica salvata. Lo skipper può ora includerla nella Crew List.');
  } catch (error) {
    setMessage(document.querySelector('#participantFormMessage'), 'Non riesco a salvare l’anagrafica. Riprova tra poco.', true);
  } finally {
    submitButton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!isValidInviteId) {
    document.querySelector('#invalidLink').hidden = false;
    return;
  }
  if (!user) {
    resetParticipantSubscriptions();
    showEmailAccess(isEmailLink ? 'Conferma l’email a cui è arrivato il link.' : '');
    return;
  }
  if (!isEmailUser(user)) {
    resetParticipantSubscriptions();
    showEmailAccess();
    document.querySelector('#participantEmailForm').hidden = true;
    document.querySelector('#participantEmailCompleteForm').hidden = true;
    document.querySelector('#participantChangeAccount').hidden = false;
    setMessage(document.querySelector('#participantAuthMessage'), 'Per l’equipaggio usa l’accesso via email, non l’account skipper.', true);
    return;
  }
  try {
    const inviteSnapshot = await getDoc(doc(db, 'boats', boatId, 'invites', inviteId));
    if (!inviteSnapshot.exists() || inviteSnapshot.data().boatId !== boatId) throw new Error('Invito non disponibile.');
    activeInvite = { ...inviteSnapshot.data(), boatId };
    await openParticipantArea(user);
  } catch (error) {
    document.querySelector('#signInSection').hidden = true;
    document.querySelector('#participantDashboard').hidden = true;
    document.querySelector('#invalidLink').hidden = false;
  }
});

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { GoogleAuthProvider, getAuth, getRedirectResult, onAuthStateChanged, signInWithRedirect, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, doc, getDoc, getFirestore, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const inviteId = new URLSearchParams(window.location.search).get('invite') || '';
const boatId = new URLSearchParams(window.location.search).get('boat') || '';
const isValidInviteId = /^[a-f0-9]{48}$/.test(inviteId) && /^[A-Za-z0-9_-]{1,128}$/.test(boatId);
let activeInvite = null;

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function getAuthErrorMessage(error) {
  if (error.code === 'auth/unauthorized-domain') return 'Questo indirizzo del sito non è ancora autorizzato in Firebase.';
  if (error.code === 'auth/operation-not-allowed') return 'L’accesso con Google non è abilitato nel progetto Firebase.';
  return 'Accesso non completato. Riprova tra poco.';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('it-IT').format(new Date(`${value}T00:00:00`));
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
  const memberReference = doc(db, 'boats', boatId, 'members', inviteId);
  const memberSnapshot = await getDoc(memberReference);
  if (memberSnapshot.exists()) fillProfile(memberSnapshot.data());
  onSnapshot(query(collection(db, 'boats', boatId, 'paymentRequests'), where('recipientId', '==', inviteId)), renderPayments, () => setMessage(document.querySelector('#participantFormMessage'), 'Non riesco a leggere le richieste personali.', true));
}

document.querySelector('#participantSignInButton').addEventListener('click', () => signInWithRedirect(auth, provider));
document.querySelector('#participantSignOutButton').addEventListener('click', () => signOut(auth));

getRedirectResult(auth).catch((error) => {
  setMessage(document.querySelector('#participantAuthMessage'), getAuthErrorMessage(error), true);
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
    document.querySelector('#invalidLink').hidden = true;
    document.querySelector('#participantDashboard').hidden = true;
    document.querySelector('#signInSection').hidden = false;
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

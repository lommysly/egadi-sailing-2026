import { getAuth, isSignInWithEmailLink, onAuthStateChanged, sendSignInLinkToEmail, signInWithEmailLink, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collectionGroup, getDocs, getFirestore, limit, query, where } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const isEmailLink = isSignInWithEmailLink(auth, window.location.href);
const emailForm = document.querySelector('#crewEmailForm');
const completeForm = document.querySelector('#crewEmailCompleteForm');
const message = document.querySelector('#crewAuthMessage');
const areaList = document.querySelector('#crewAreaList');

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('is-error', isError);
}

function entryUrl() {
  return new URL('crew.html', window.location.href).toString();
}

function emailSettings() {
  return { url: entryUrl(), handleCodeInApp: true };
}

function isEmailUser(user) {
  return user?.providerData?.some((provider) => provider.providerId === 'password');
}

function participantUrl(access) {
  const url = new URL('participant.html', window.location.href);
  url.searchParams.set('invite', access.inviteId);
  url.searchParams.set('boat', access.boatId);
  return url.toString();
}

async function showAreas(user) {
  const accessQuery = query(collectionGroup(db, 'participantAccess'), where('userId', '==', user.uid), limit(5));
  const snapshot = await getDocs(accessQuery);
  const accesses = snapshot.docs.map((item) => item.data()).filter((access) => access.inviteId && access.boatId);
  if (!accesses.length) {
    setMessage('Non trovo un invito associato a questa email. Apri prima il link ricevuto su WhatsApp.', true);
    return;
  }
  if (accesses.length === 1) {
    window.location.replace(participantUrl(accesses[0]));
    return;
  }
  areaList.hidden = false;
  areaList.innerHTML = `<p class="panel-lead">Hai più inviti attivi: scegli la tua barca.</p>${accesses.map((access, index) => `<a class="button button-ghost" href="${participantUrl(access)}">Apri area equipaggio ${index + 1}</a>`).join('')}`;
}

emailForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = new FormData(emailForm).get('email').trim();
  const submitButton = emailForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage('Invio del link in corso…');
  try {
    await sendSignInLinkToEmail(auth, email, emailSettings());
    setMessage('Richiesta accettata. Rimani qui, apri l’email ricevuta (controlla anche Spam) e conferma di nuovo lo stesso indirizzo per entrare. Se non arriva entro qualche minuto, riprova o apri il link WhatsApp originale.');
  } catch (error) {
    setMessage('Non riesco a inviare il link. Verifica l’email e riprova.', true);
  } finally {
    submitButton.disabled = false;
  }
});

completeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = new FormData(completeForm).get('email').trim();
  const submitButton = completeForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await signInWithEmailLink(auth, email, window.location.href);
    window.history.replaceState({}, document.title, entryUrl());
  } catch (error) {
    setMessage('Il link non è valido per questa email o è scaduto. Richiedine uno nuovo.', true);
    submitButton.disabled = false;
  }
});

document.querySelector('#crewChangeAccount').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  areaList.hidden = true;
  areaList.innerHTML = '';
  if (!user) {
    emailForm.hidden = isEmailLink;
    completeForm.hidden = !isEmailLink;
    document.querySelector('#crewChangeAccount').hidden = true;
    if (isEmailLink) setMessage('Conferma l’email a cui è arrivato il link.');
    return;
  }
  if (!isEmailUser(user)) {
    emailForm.hidden = true;
    completeForm.hidden = true;
    document.querySelector('#crewChangeAccount').hidden = false;
    setMessage('Per l’area equipaggio usa l’accesso via email, non l’account skipper.', true);
    return;
  }
  emailForm.hidden = true;
  completeForm.hidden = true;
  document.querySelector('#crewChangeAccount').hidden = true;
  try {
    await showAreas(user);
  } catch (error) {
    setMessage('Non riesco a recuperare la tua area. Riprova tra poco.', true);
  }
});

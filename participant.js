import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { auth, boatId, db, inviteId, personalAreaUrl, startCrewSession } from './crew-session.js';

let activeInvite = null;
const isEditMode = new URLSearchParams(window.location.search).get('edit') === '1';

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function showOpening(message = '', isError = false) {
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#signInSection').hidden = false;
  setMessage(document.querySelector('#participantAuthMessage'), message, isError);
}

function showInvalid() {
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#invalidLink').hidden = false;
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

document.querySelector('#participantForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeInvite || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(document.querySelector('#participantFormMessage'), 'Salvo i tuoi dati…');
  try {
    const firstName = fields.get('firstName').trim();
    const lastName = fields.get('lastName').trim();
    await setDoc(doc(db, 'boats', boatId, 'members', inviteId), {
      firstName, lastName, birthDate: fields.get('birthDate'), birthPlace: fields.get('birthPlace').trim(),
      nationality: fields.get('nationality').trim(), gender: fields.get('gender'), documentType: fields.get('documentType'),
      documentNumber: fields.get('documentNumber').trim(), documentExpiry: fields.get('documentExpiry'), role: fields.get('role').trim(),
      email: fields.get('email').trim().toLowerCase(), phone: fields.get('phone').trim(), charterConsent: fields.get('charterConsent') === 'on',
      displayName: `${firstName} ${lastName}`, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid,
    }, { merge: true });
    setMessage(document.querySelector('#participantFormMessage'), 'Dati inviati con successo. Apro la tua area personale…');
    window.setTimeout(() => window.location.replace(personalAreaUrl()), 900);
  } catch (error) {
    setMessage(document.querySelector('#participantFormMessage'), 'I dati non sono stati inviati. Controlla la connessione e riprova dal tuo link WhatsApp.', true);
    submitButton.disabled = false;
  }
});

startCrewSession({
  onOpening: showOpening,
  onInvalid: showInvalid,
  onReady: async ({ invite }) => {
    activeInvite = invite;
    const member = await getDoc(doc(db, 'boats', boatId, 'members', inviteId));
    if (member.exists() && !isEditMode) {
      window.location.replace(personalAreaUrl());
      return;
    }
    document.querySelector('#signInSection').hidden = true;
    document.querySelector('#profileSection').hidden = false;
    document.querySelector('#participantTitle').textContent = invite.displayName || 'Dati per la Crew List';
    if (member.exists()) fillProfile(member.data());
  },
});

import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {
  activateCrewInvite,
  auth,
  boatId,
  crewAccessErrorMessage,
  db,
  inviteId,
  personalAreaUrl,
  startCrewAreaSession,
  startInviteActivation,
} from './crew-session.js';
import { canUsePrivateArea, privateAreaBlockMessage } from './private-area-access.js';

let activeInvite = null;
let activatedPhone = '';
const isEditMode = new URLSearchParams(window.location.search).get('edit') === '1';

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function showOpening(message = '', isError = false) {
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#signInSection').hidden = false;
  setMessage(document.querySelector('#participantAuthMessage'), message, isError);
}

function showActivation() {
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#activationSection').hidden = false;
  document.querySelector('#activationForm [name="phone"]').focus();
}

function showInvalid() {
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#invalidLink').hidden = false;
}

function showProfile({ invite, member, phone = '' }) {
  activeInvite = invite;
  activatedPhone = phone;
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#profileSection').hidden = false;
  document.querySelector('#participantTitle').textContent = invite.displayName || 'Dati per la Crew List';
  if (member) fillProfile(member);
  if (phone && !document.querySelector('#participantForm [name="phone"]').value) {
    document.querySelector('#participantForm [name="phone"]').value = phone;
  }
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

async function openProfile({ invite, phone = '', redirectWhenCompleted = true }) {
  const member = await getDoc(doc(db, 'boats', invite.boatId, 'members', invite.id));
  if (member.exists() && redirectWhenCompleted) {
    window.location.replace(personalAreaUrl());
    return;
  }
  showProfile({ invite, member: member.exists() ? member.data() : null, phone });
}

document.querySelector('#activationForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = new FormData(form);
  const phone = fields.get('phone').trim();
  const pin = fields.get('pin').trim();
  const pinConfirmation = fields.get('pinConfirmation').trim();
  const submitButton = form.querySelector('button[type="submit"]');
  if (pin !== pinConfirmation) {
    setMessage(document.querySelector('#activationMessage'), 'I due codici non coincidono.', true);
    return;
  }
  submitButton.disabled = true;
  setMessage(document.querySelector('#activationMessage'), 'Attivo il tuo accesso personale…');
  try {
    const session = await activateCrewInvite({ phone, pin });
    await openProfile({ invite: session.invite, phone: phone, redirectWhenCompleted: !isEditMode });
  } catch (error) {
    setMessage(document.querySelector('#activationMessage'), crewAccessErrorMessage(error, { activation: true }), true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#participantForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!canUsePrivateArea()) {
    showOpening(privateAreaBlockMessage(), true);
    return;
  }
  if (!activeInvite || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(document.querySelector('#participantFormMessage'), 'Salvo i tuoi dati…');
  try {
    const firstName = fields.get('firstName').trim();
    const lastName = fields.get('lastName').trim();
    await setDoc(doc(db, 'boats', activeInvite.boatId, 'members', activeInvite.id), {
      firstName, lastName, birthDate: fields.get('birthDate'), birthPlace: fields.get('birthPlace').trim(),
      nationality: fields.get('nationality').trim(), gender: fields.get('gender'), documentType: fields.get('documentType'),
      documentNumber: fields.get('documentNumber').trim(), documentExpiry: fields.get('documentExpiry'), role: fields.get('role').trim(),
      email: fields.get('email').trim().toLowerCase(), phone: fields.get('phone').trim() || activatedPhone, charterConsent: fields.get('charterConsent') === 'on',
      displayName: `${firstName} ${lastName}`, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid,
    }, { merge: true });
    setMessage(document.querySelector('#participantFormMessage'), 'Dati inviati con successo. Apro la tua area personale…');
    window.setTimeout(() => window.location.replace(personalAreaUrl()), 900);
  } catch (error) {
    setMessage(document.querySelector('#participantFormMessage'), 'I dati non sono stati inviati. Controlla la connessione e riprova.', true);
    submitButton.disabled = false;
  }
});

if (isEditMode) {
  startCrewAreaSession({
    onOpening: showOpening,
    onInvalid: showInvalid,
    onReady: async ({ invite }) => openProfile({ invite, redirectWhenCompleted: false }),
  });
} else {
  startInviteActivation({
    onOpening: showOpening,
    onInvalid: showInvalid,
    onReady: showActivation,
  });
}

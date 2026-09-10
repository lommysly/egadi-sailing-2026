import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithRedirect, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { getMissingCharterFields, isBoatReadyForPdf, isCharterReady, openCapitaneriaPdf } from './crew-pdf.js';

const eventId = 'egadi-2026';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const signInCard = document.querySelector('#signInCard');
const accountCard = document.querySelector('#accountCard');
const registerSection = document.querySelector('#registra-barca');
const dashboard = document.querySelector('#dashboard');
const signInButton = document.querySelector('#signInButton');
const authMessage = document.querySelector('#authMessage');
let activeBoat = null;
let activeMembers = [];
let stopBoatSubscription = null;
let stopMemberSubscription = null;
let stopPaymentSubscription = null;
let creatingBoat = false;
let editingMemberId = null;

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function resetPrivateView() {
  activeBoat = null;
  activeMembers = [];
  creatingBoat = false;
  editingMemberId = null;
  stopBoatSubscription?.();
  stopMemberSubscription?.();
  stopPaymentSubscription?.();
  stopBoatSubscription = null;
  stopMemberSubscription = null;
  stopPaymentSubscription = null;
  dashboard.hidden = true;
  registerSection.hidden = true;
}

function memberName(member) {
  return `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.displayName || 'Persona della crew';
}

function normalizeMember(id, member) {
  if (member.firstName || member.lastName) return { id, ...member };
  const [firstName = '', ...lastNameParts] = String(member.displayName || '').trim().split(/\s+/);
  return { id, ...member, firstName, lastName: lastNameParts.join(' ') };
}

function resetMemberForm() {
  const form = document.querySelector('#memberForm');
  form.reset();
  editingMemberId = null;
  document.querySelector('#memberSubmitButton').textContent = 'Aggiungi persona';
  document.querySelector('#cancelMemberEdit').hidden = true;
}

function setBoatFormDefaults(user) {
  const skipperField = document.querySelector('#boatForm [name="skipperName"]');
  if (skipperField && !skipperField.value) skipperField.value = user?.displayName || '';
}

function updateCharterReadiness() {
  const generatePdfButton = document.querySelector('#generatePdfButton');
  const readiness = document.querySelector('#charterReadiness');
  const incomplete = activeMembers.filter((member) => !isCharterReady(member));
  const boatMissing = !isBoatReadyForPdf(activeBoat);
  generatePdfButton.disabled = !activeBoat || activeMembers.length === 0 || incomplete.length > 0 || boatMissing;
  readiness.textContent = !activeBoat
    ? 'Registra prima la barca per preparare il PDF.'
    : boatMissing
      ? 'Completa bandiera, porto di iscrizione e comandante della barca per attivare il PDF.'
      : activeMembers.length === 0
        ? 'Aggiungi almeno una persona per preparare il PDF.'
    : incomplete.length
      ? `${incomplete.length} ${incomplete.length === 1 ? 'persona ha' : 'persone hanno'} dati mancanti o consenso da confermare.`
      : 'Crew List completa: il PDF è pronto per il charter.';
}

function renderMembers() {
  const list = document.querySelector('#memberList');
  const select = document.querySelector('#paymentMember');
  if (!activeMembers.length) {
    list.innerHTML = '<p class="empty-state">Nessuna persona ancora inserita.</p>';
    select.innerHTML = '<option value="">Prima aggiungi una persona</option>';
    updateCharterReadiness();
    return;
  }
  list.innerHTML = activeMembers.map((member) => {
    const missing = getMissingCharterFields(member);
    const status = missing.length ? `Mancano ${missing.length} dati` : 'Pronta per il charter';
    return `<article class="member-row"><div><strong>${escapeHtml(memberName(member))}</strong><span>${escapeHtml(member.role || 'Crew')} · ${escapeHtml(status)}</span></div><button class="text-button" type="button" data-edit-member="${escapeHtml(member.id)}">Modifica</button></article>`;
  }).join('');
  select.innerHTML = '<option value="">Seleziona una persona</option>' + activeMembers.map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(memberName(member))}</option>`).join('');
  updateCharterReadiness();
}

function renderPayments(snapshot) {
  const list = document.querySelector('#paymentList');
  if (snapshot.empty) {
    list.innerHTML = '<p class="empty-state">Nessuna richiesta preparata.</p>';
    return;
  }
  list.innerHTML = snapshot.docs.map((item) => {
    const payment = item.data();
    const member = activeMembers.find((candidate) => candidate.id === payment.memberId);
    const name = member ? memberName(member) : 'Persona della crew';
    const amount = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(payment.amount || 0);
    const isVerified = payment.status === 'verified';
    const status = isVerified ? 'Accredito verificato' : 'In attesa di verifica';
    const action = isVerified ? '' : `<button class="text-button" type="button" data-verify-payment="${escapeHtml(item.id)}">Conferma accredito</button>`;
    return `<article class="payment-row"><div><strong>${escapeHtml(name)} · ${amount}</strong><span>${escapeHtml(payment.instructions)}</span></div><div class="payment-action"><span class="payment-status">${status}</span>${action}</div></article>`;
  }).join('');
}

function subscribeToBoat(boat) {
  activeBoat = boat;
  registerSection.hidden = true;
  dashboard.hidden = false;
  document.querySelector('#boatTitle').textContent = boat.name;
  document.querySelector('#boatMeta').textContent = `${boat.model} · ${boat.capacity} posti · ${boat.homePort}`;
  stopMemberSubscription?.();
  stopPaymentSubscription?.();
  stopMemberSubscription = onSnapshot(collection(db, 'boats', boat.id, 'members'), (snapshot) => {
    activeMembers = snapshot.docs.map((item) => normalizeMember(item.id, item.data())).sort((first, second) => memberName(first).localeCompare(memberName(second), 'it'));
    renderMembers();
  }, () => setMessage(document.querySelector('#memberFormMessage'), 'Impossibile leggere la Crew List.', true));
  stopPaymentSubscription = onSnapshot(query(collection(db, 'boats', boat.id, 'paymentRequests'), orderBy('createdAt', 'desc')), renderPayments, () => setMessage(document.querySelector('#paymentFormMessage'), 'Impossibile leggere le richieste.', true));
}

function loadSkipperArea(user) {
  const boatQuery = query(collection(db, 'boats'), where('skipperId', '==', user.uid));
  stopBoatSubscription = onSnapshot(boatQuery, (snapshot) => {
    const boats = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    if (creatingBoat) {
      return;
    }
    if (activeBoat && boats.some((boat) => boat.id === activeBoat.id)) {
      subscribeToBoat(boats.find((boat) => boat.id === activeBoat.id));
    } else if (boats.length) {
      subscribeToBoat(boats[0]);
    } else {
      dashboard.hidden = true;
      registerSection.hidden = false;
    }
  }, () => {
    registerSection.hidden = false;
    setMessage(document.querySelector('#boatFormMessage'), 'Non riesco a leggere le tue barche. Riprova tra poco.', true);
  });
}

signInButton.addEventListener('click', async () => {
  signInButton.disabled = true;
  setMessage(authMessage, 'Apro l’accesso Google…');
  try {
    await signInWithRedirect(auth, provider);
  } catch (error) {
    setMessage(authMessage, error.code === 'auth/popup-closed-by-user' ? 'Accesso annullato.' : 'Accesso non completato. Controlla che Google sia abilitato e riprova.', true);
  } finally {
    signInButton.disabled = false;
  }
});

document.querySelector('#signOutButton').addEventListener('click', () => signOut(auth));
document.querySelector('#newBoatButton').addEventListener('click', () => {
  activeBoat = null;
  creatingBoat = true;
  dashboard.hidden = true;
  registerSection.hidden = false;
  setBoatFormDefaults(auth.currentUser);
  registerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelector('#boatForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(document.querySelector('#boatFormMessage'), 'Registro la barca…');
  try {
    const boatData = {
      name: fields.get('name').trim(), model: fields.get('model').trim(), capacity: Number(fields.get('capacity')),
      homePort: fields.get('homePort').trim(), flag: fields.get('flag').trim(), registrationPort: fields.get('registrationPort').trim(),
      skipperName: fields.get('skipperName').trim(), note: fields.get('note').trim(), skipperId: user.uid,
      eventId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    const boatReference = await addDoc(collection(db, 'boats'), boatData);
    activeBoat = { id: boatReference.id, ...boatData };
    creatingBoat = false;
    subscribeToBoat(activeBoat);
    form.reset();
    setBoatFormDefaults(user);
    setMessage(document.querySelector('#boatFormMessage'), 'Barca registrata.');
  } catch (error) {
    setMessage(document.querySelector('#boatFormMessage'), 'Non riesco a registrare la barca. Verifica le regole Firestore.', true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#memberForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeBoat) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const memberData = {
      firstName: fields.get('firstName').trim(), lastName: fields.get('lastName').trim(), birthDate: fields.get('birthDate'),
      birthPlace: fields.get('birthPlace').trim(), nationality: fields.get('nationality').trim(), gender: fields.get('gender'),
      documentType: fields.get('documentType'), documentNumber: fields.get('documentNumber').trim(), documentExpiry: fields.get('documentExpiry'),
      role: fields.get('role').trim(), email: fields.get('email').trim().toLowerCase(), phone: fields.get('phone').trim(),
      charterConsent: fields.get('charterConsent') === 'on', updatedAt: serverTimestamp(),
    };
    memberData.displayName = `${memberData.firstName} ${memberData.lastName}`;
    if (editingMemberId) {
      await updateDoc(doc(db, 'boats', activeBoat.id, 'members', editingMemberId), memberData);
      setMessage(document.querySelector('#memberFormMessage'), 'Dati della persona aggiornati.');
    } else {
      await addDoc(collection(db, 'boats', activeBoat.id, 'members'), { ...memberData, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid });
      setMessage(document.querySelector('#memberFormMessage'), 'Persona aggiunta alla Crew List.');
    }
    resetMemberForm();
  } catch (error) {
    setMessage(document.querySelector('#memberFormMessage'), 'Non riesco ad aggiungere la persona.', true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#memberList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-member]');
  if (!button) return;
  const member = activeMembers.find((candidate) => candidate.id === button.dataset.editMember);
  if (!member) return;
  const form = document.querySelector('#memberForm');
  for (const [field, value] of Object.entries(member)) {
    const input = form.elements.namedItem(field);
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value || '';
  }
  editingMemberId = member.id;
  document.querySelector('#memberSubmitButton').textContent = 'Salva modifiche';
  document.querySelector('#cancelMemberEdit').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.querySelector('#cancelMemberEdit').addEventListener('click', resetMemberForm);
document.querySelector('#generatePdfButton').addEventListener('click', () => {
  if (!activeBoat || !isBoatReadyForPdf(activeBoat) || activeMembers.some((member) => !isCharterReady(member))) return;
  try {
    openCapitaneriaPdf({ boat: activeBoat, members: activeMembers });
    setMessage(document.querySelector('#memberFormMessage'), 'Si apre la stampa: scegli “Salva come PDF” per scaricare il foglio.');
  } catch (error) {
    setMessage(document.querySelector('#memberFormMessage'), 'Impossibile aprire la stampa. Consenti le finestre popup e riprova.', true);
  }
});

document.querySelector('#paymentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeBoat) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await addDoc(collection(db, 'boats', activeBoat.id, 'paymentRequests'), {
      memberId: fields.get('memberId'), amount: Number(fields.get('amount')), instructions: fields.get('instructions').trim(),
      status: 'requested', createdAt: serverTimestamp(), createdBy: auth.currentUser.uid,
    });
    form.reset();
    setMessage(document.querySelector('#paymentFormMessage'), 'Richiesta preparata: da verificare fuori dal sito.');
  } catch (error) {
    setMessage(document.querySelector('#paymentFormMessage'), 'Non riesco a preparare la richiesta.', true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#paymentList').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-verify-payment]');
  if (!button || !activeBoat) return;
  button.disabled = true;
  try {
    await updateDoc(doc(db, 'boats', activeBoat.id, 'paymentRequests', button.dataset.verifyPayment), {
      status: 'verified', verifiedAt: serverTimestamp(), verifiedBy: auth.currentUser.uid,
    });
    setMessage(document.querySelector('#paymentFormMessage'), 'Accredito segnato come verificato manualmente.');
  } catch (error) {
    button.disabled = false;
    setMessage(document.querySelector('#paymentFormMessage'), 'Non riesco a confermare l’accredito.', true);
  }
});

onAuthStateChanged(auth, async (user) => {
  resetPrivateView();
  if (!user) {
    signInCard.hidden = false;
    accountCard.hidden = true;
    return;
  }
  signInCard.hidden = true;
  accountCard.hidden = false;
  document.querySelector('#accountName').textContent = user.displayName || 'Skipper';
  document.querySelector('#accountEmail').textContent = user.email || '';
  document.querySelector('#accountUid').textContent = user.uid;
  setBoatFormDefaults(user);
  try {
    const eventSnapshot = await getDoc(doc(db, 'events', eventId));
    const isOrganizer = eventSnapshot.exists() && (eventSnapshot.data().organizerIds || []).includes(user.uid);
    document.querySelector('#accountStatus').textContent = isOrganizer ? 'Organizzatore configurato.' : 'Accesso skipper attivo. Per l’organizzatore: completa il documento iniziale nel README usando questo identificativo.';
  } catch (error) {
    document.querySelector('#accountStatus').textContent = 'Accesso skipper attivo.';
  }
  loadSkipperArea(user);
});

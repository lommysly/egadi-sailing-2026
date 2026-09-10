import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
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
let activePayments = [];
let activeInvites = [];
let stopBoatSubscription = null;
let stopMemberSubscription = null;
let stopPaymentSubscription = null;
let stopInviteSubscription = null;
let creatingBoat = false;
let editingBoatId = null;
let editingMemberId = null;

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function getAuthErrorMessage(error) {
  if (error.code === 'auth/unauthorized-domain') return 'Questo indirizzo del sito non è ancora autorizzato in Firebase.';
  if (error.code === 'auth/operation-not-allowed') return 'L’accesso con Google non è abilitato nel progetto Firebase.';
  return 'Accesso non completato. Riprova tra poco.';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function resetPrivateView() {
  activeBoat = null;
  activeMembers = [];
  activePayments = [];
  activeInvites = [];
  creatingBoat = false;
  editingBoatId = null;
  editingMemberId = null;
  stopBoatSubscription?.();
  stopMemberSubscription?.();
  stopPaymentSubscription?.();
  stopInviteSubscription?.();
  stopBoatSubscription = null;
  stopMemberSubscription = null;
  stopPaymentSubscription = null;
  stopInviteSubscription = null;
  dashboard.hidden = true;
  registerSection.hidden = true;
}

function memberName(member) {
  return `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.displayName || 'Persona della crew';
}

function recipientName(recipientId) {
  const member = activeMembers.find((candidate) => candidate.id === recipientId);
  if (member) return memberName(member);
  return activeInvites.find((candidate) => candidate.id === recipientId)?.displayName || 'Persona della crew';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('it-IT').format(new Date(`${value}T00:00:00`));
}

function participantUrl(inviteId) {
  const url = new URL('participant.html', window.location.href);
  url.searchParams.set('invite', inviteId);
  url.searchParams.set('boat', activeBoat.id);
  return url.toString();
}

function whatsappUrl(invite) {
  const number = String(invite.whatsappNumber || '').replace(/\D/g, '');
  const message = `Ciao ${invite.displayName}, ecco il tuo spazio personale per completare i dati della Crew List e vedere le richieste dedicate: ${participantUrl(invite.id)}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function createInviteId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function renderPaymentRecipientOptions() {
  const select = document.querySelector('#paymentMember');
  const members = activeMembers.map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(memberName(member))} · Crew</option>`).join('');
  const pendingInvites = activeInvites.filter((invite) => !activeMembers.some((member) => member.id === invite.id));
  const invites = pendingInvites.map((invite) => `<option value="${escapeHtml(invite.id)}">${escapeHtml(invite.displayName)} · Invito da completare</option>`).join('');
  if (!members && !invites) {
    select.innerHTML = '<option value="">Prima invita o aggiungi una persona</option>';
    return;
  }
  select.innerHTML = '<option value="">Seleziona una persona</option>'
    + (invites ? `<optgroup label="Inviti personali">${invites}</optgroup>` : '')
    + (members ? `<optgroup label="Crew List">${members}</optgroup>` : '');
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

function resetBoatForm(user) {
  const form = document.querySelector('#boatForm');
  form.reset();
  editingBoatId = null;
  document.querySelector('#boatSubmitButton').textContent = 'Registra la barca';
  document.querySelector('#cancelBoatEdit').hidden = true;
  setBoatFormDefaults(user);
}

function openBoatEdit() {
  if (!activeBoat) return;
  const form = document.querySelector('#boatForm');
  for (const [field, value] of Object.entries(activeBoat)) {
    const input = form.elements.namedItem(field);
    if (input) input.value = value ?? '';
  }
  creatingBoat = true;
  editingBoatId = activeBoat.id;
  document.querySelector('#boatSubmitButton').textContent = 'Salva modifiche';
  document.querySelector('#cancelBoatEdit').hidden = false;
  dashboard.hidden = true;
  registerSection.hidden = false;
  registerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      ? 'Completa bandiera e comandante della barca per attivare il PDF.'
      : activeMembers.length === 0
        ? 'Aggiungi almeno una persona per preparare il PDF.'
    : incomplete.length
      ? `${incomplete.length} ${incomplete.length === 1 ? 'persona ha' : 'persone hanno'} dati mancanti o consenso da confermare.`
      : 'Crew List completa: il PDF è pronto per il charter.';
}

function renderMembers() {
  const list = document.querySelector('#memberList');
  if (!activeMembers.length) {
    list.innerHTML = '<p class="empty-state">Nessuna persona ancora inserita.</p>';
    renderPaymentRecipientOptions();
    updateCharterReadiness();
    return;
  }
  list.innerHTML = activeMembers.map((member) => {
    const missing = getMissingCharterFields(member);
    const status = missing.length ? `Mancano ${missing.length} dati` : 'Pronta per il charter';
    return `<article class="member-row"><div><strong>${escapeHtml(memberName(member))}</strong><span>${escapeHtml(member.role || 'Crew')} · ${escapeHtml(status)}</span></div><button class="text-button" type="button" data-edit-member="${escapeHtml(member.id)}">Modifica</button></article>`;
  }).join('');
  renderPaymentRecipientOptions();
  updateCharterReadiness();
}

function renderInvites() {
  const list = document.querySelector('#inviteList');
  if (!activeInvites.length) {
    list.innerHTML = '<p class="empty-state">Nessun link personale creato.</p>';
    renderPaymentRecipientOptions();
    return;
  }
  list.innerHTML = activeInvites.map((invite) => {
    const profileCompleted = activeMembers.some((member) => member.id === invite.id);
    const status = profileCompleted ? 'Anagrafica completata' : invite.participantUid ? 'Link aperto: dati da completare' : 'Pronto da inviare';
    return `<article class="invite-row"><div><strong>${escapeHtml(invite.displayName)}</strong><span>${escapeHtml(status)} · ${escapeHtml(invite.whatsappNumber)}</span></div><div class="payment-action"><button class="text-button" type="button" data-copy-invite="${escapeHtml(invite.id)}">Copia link</button><button class="text-button" type="button" data-whatsapp-invite="${escapeHtml(invite.id)}">Apri WhatsApp</button></div></article>`;
  }).join('');
  renderPaymentRecipientOptions();
}

function renderPayments(snapshot) {
  const list = document.querySelector('#paymentList');
  if (snapshot.empty) {
    activePayments = [];
    list.innerHTML = '<p class="empty-state">Nessuna richiesta preparata.</p>';
    return;
  }
  activePayments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  list.innerHTML = activePayments.map((payment) => {
    const recipientId = payment.recipientId || payment.memberId;
    const name = recipientName(recipientId);
    const amount = formatCurrency(payment.amount);
    const reason = `${payment.reason || 'Contributo weekend'}${payment.isOptional ? ' · Facoltativo' : ''}`;
    const dueDate = payment.dueDate ? ` · Entro ${formatDate(payment.dueDate)}` : '';
    const isVerified = payment.status === 'verified';
    const status = isVerified ? 'Accredito verificato' : 'In attesa di verifica';
    const action = isVerified ? '' : `<button class="text-button" type="button" data-verify-payment="${escapeHtml(payment.id)}">Conferma accredito</button>`;
    const inviteAction = activeInvites.some((invite) => invite.id === recipientId) ? `<button class="text-button" type="button" data-whatsapp-invite="${escapeHtml(recipientId)}">Invia su WhatsApp</button>` : '';
    return `<article class="payment-row"><div><strong>${escapeHtml(name)} · ${amount}</strong><span>${escapeHtml(reason)}${escapeHtml(dueDate)}</span><span>${escapeHtml(payment.instructions)}</span></div><div class="payment-action"><span class="payment-status">${status}</span><button class="text-button" type="button" data-copy-payment="${escapeHtml(payment.id)}">Copia messaggio</button>${inviteAction}${action}</div></article>`;
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
  stopInviteSubscription?.();
  stopMemberSubscription = onSnapshot(collection(db, 'boats', boat.id, 'members'), (snapshot) => {
    activeMembers = snapshot.docs.map((item) => normalizeMember(item.id, item.data())).sort((first, second) => memberName(first).localeCompare(memberName(second), 'it'));
    renderMembers();
  }, () => setMessage(document.querySelector('#memberFormMessage'), 'Impossibile leggere la Crew List.', true));
  stopPaymentSubscription = onSnapshot(query(collection(db, 'boats', boat.id, 'paymentRequests'), orderBy('createdAt', 'desc')), renderPayments, () => setMessage(document.querySelector('#paymentFormMessage'), 'Impossibile leggere le richieste.', true));
  stopInviteSubscription = onSnapshot(collection(db, 'boats', boat.id, 'invites'), (snapshot) => {
    activeInvites = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((first, second) => String(first.displayName || '').localeCompare(String(second.displayName || ''), 'it'));
    renderInvites();
    renderPayments({ empty: activePayments.length === 0, docs: activePayments.map((payment) => ({ id: payment.id, data: () => payment })) });
  }, () => setMessage(document.querySelector('#inviteFormMessage'), 'Impossibile leggere gli inviti personali.', true));
}

function loadSkipperArea(user) {
  const boatQuery = query(collection(db, 'boats'), where('skipperId', '==', user.uid));
  stopBoatSubscription = onSnapshot(boatQuery, (snapshot) => {
    const boats = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'it'));
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
    setMessage(document.querySelector('#boatFormMessage'), 'Non riesco a leggere la tua barca. Riprova tra poco.', true);
  });
}

signInButton.addEventListener('click', async () => {
  signInButton.disabled = true;
  setMessage(authMessage, 'Apro l’accesso Google…');
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    setMessage(authMessage, error.code === 'auth/popup-closed-by-user' ? 'Accesso annullato.' : getAuthErrorMessage(error), true);
  } finally {
    signInButton.disabled = false;
  }
});

document.querySelector('#signOutButton').addEventListener('click', () => signOut(auth));
document.querySelector('#editBoatButton').addEventListener('click', openBoatEdit);
document.querySelector('#cancelBoatEdit').addEventListener('click', () => {
  creatingBoat = false;
  resetBoatForm(auth.currentUser);
  if (activeBoat) {
    registerSection.hidden = true;
    dashboard.hidden = false;
  }
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
      homePort: fields.get('homePort').trim(), flag: fields.get('flag').trim(),
      skipperName: fields.get('skipperName').trim(), note: fields.get('note').trim(), skipperId: user.uid,
      eventId, updatedAt: serverTimestamp(),
    };
    if (editingBoatId) {
      await updateDoc(doc(db, 'boats', editingBoatId), boatData);
      activeBoat = { ...activeBoat, ...boatData };
      creatingBoat = false;
      resetBoatForm(user);
      subscribeToBoat(activeBoat);
      setMessage(document.querySelector('#boatFormMessage'), 'Dati della barca aggiornati.');
    } else {
      await setDoc(doc(db, 'boats', user.uid), { ...boatData, createdAt: serverTimestamp() });
      activeBoat = { id: user.uid, ...boatData };
      creatingBoat = false;
      subscribeToBoat(activeBoat);
      resetBoatForm(user);
      setMessage(document.querySelector('#boatFormMessage'), 'Barca registrata.');
    }
  } catch (error) {
    setMessage(document.querySelector('#boatFormMessage'), 'Non riesco a registrare la barca. Verifica le regole Firestore.', true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#inviteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeBoat || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const displayName = fields.get('displayName').trim();
  const whatsappNumber = fields.get('whatsappNumber').trim();
  const normalizedNumber = whatsappNumber.replace(/\D/g, '');
  if (normalizedNumber.length < 8) {
    setMessage(document.querySelector('#inviteFormMessage'), 'Inserisci un numero WhatsApp completo, con prefisso internazionale.', true);
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  const whatsappWindow = window.open('', '_blank');
  if (whatsappWindow) whatsappWindow.opener = null;
  const inviteId = createInviteId();
  const invite = { id: inviteId, boatId: activeBoat.id, displayName, whatsappNumber, participantUid: null, status: 'sent' };
  try {
    await setDoc(doc(db, 'boats', activeBoat.id, 'invites', inviteId), {
      ...invite, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid,
    });
    form.reset();
    if (whatsappWindow) {
      whatsappWindow.location.replace(whatsappUrl(invite));
      setMessage(document.querySelector('#inviteFormMessage'), 'Link personale creato: WhatsApp è aperto con il messaggio già pronto.');
    } else {
      setMessage(document.querySelector('#inviteFormMessage'), 'Link personale creato: apri WhatsApp dalla scheda dell’invito.');
    }
  } catch (error) {
    whatsappWindow?.close();
    setMessage(document.querySelector('#inviteFormMessage'), 'Non riesco a creare il link personale.', true);
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
      recipientId: fields.get('recipientId'), memberId: fields.get('recipientId'), amount: Number(fields.get('amount')), reason: fields.get('reason').trim(), isOptional: fields.get('isOptional') === 'on', dueDate: fields.get('dueDate'), instructions: fields.get('instructions').trim(),
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
  const whatsappButton = event.target.closest('[data-whatsapp-invite]');
  if (whatsappButton) {
    const invite = activeInvites.find((candidate) => candidate.id === whatsappButton.dataset.whatsappInvite);
    if (invite) window.open(whatsappUrl(invite), '_blank', 'noopener');
    return;
  }
  const inviteCopyButton = event.target.closest('[data-copy-invite]');
  if (inviteCopyButton) {
    const invite = activeInvites.find((candidate) => candidate.id === inviteCopyButton.dataset.copyInvite);
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(participantUrl(invite.id));
      setMessage(document.querySelector('#inviteFormMessage'), 'Link personale copiato.');
    } catch (error) {
      setMessage(document.querySelector('#inviteFormMessage'), 'Non riesco a copiare il link. Verifica i permessi del browser.', true);
    }
    return;
  }
  const copyButton = event.target.closest('[data-copy-payment]');
  if (copyButton) {
    const payment = activePayments.find((candidate) => candidate.id === copyButton.dataset.copyPayment);
    if (!payment) return;
    const amount = formatCurrency(payment.amount);
    const dueDate = payment.dueDate ? ` Entro il ${formatDate(payment.dueDate)}.` : '';
    const message = `Ciao ${recipientName(payment.recipientId || payment.memberId)}, per ${payment.reason || 'il contributo del weekend'} la quota è ${amount}.${dueDate}\n\nIstruzioni: ${payment.instructions}\n\nDopo l'accredito avvisa lo skipper, così potrà verificarlo manualmente. Grazie!`;
    try {
      await navigator.clipboard.writeText(message);
      setMessage(document.querySelector('#paymentFormMessage'), 'Messaggio copiato: puoi inviarlo tu su WhatsApp o dove preferisci.');
    } catch (error) {
      setMessage(document.querySelector('#paymentFormMessage'), 'Non riesco a copiare il messaggio. Verifica i permessi del browser.', true);
    }
    return;
  }
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

document.querySelector('#inviteList').addEventListener('click', async (event) => {
  const whatsappButton = event.target.closest('[data-whatsapp-invite]');
  if (whatsappButton) {
    const invite = activeInvites.find((candidate) => candidate.id === whatsappButton.dataset.whatsappInvite);
    if (invite) window.open(whatsappUrl(invite), '_blank', 'noopener');
    return;
  }
  const copyButton = event.target.closest('[data-copy-invite]');
  if (!copyButton) return;
  const invite = activeInvites.find((candidate) => candidate.id === copyButton.dataset.copyInvite);
  if (!invite) return;
  try {
    await navigator.clipboard.writeText(participantUrl(invite.id));
    setMessage(document.querySelector('#inviteFormMessage'), 'Link personale copiato.');
  } catch (error) {
    setMessage(document.querySelector('#inviteFormMessage'), 'Non riesco a copiare il link. Verifica i permessi del browser.', true);
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

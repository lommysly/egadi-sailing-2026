import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { getMissingCharterFields, isBoatReadyForPdf, isCharterReady, openCapitaneriaPdf } from './crew-pdf.js';
import { createCrewInviteIdentity, normalizeCrewPhone } from './crew-identity.js';
import { canUsePrivateArea, privateAreaBlockMessage } from './private-area-access.js?v=20260911-live';
import { DEFAULT_CREW_ROLE, fillRoleFields, roleConfirmationText, roleFromFields } from './crew-roles.js?v=20260911-role1';

const eventId = 'egadi-2026';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
const signInCard = document.querySelector('#signInCard');
const accountCard = document.querySelector('#accountCard');
const registerSection = document.querySelector('#registra-barca');
const dashboard = document.querySelector('#dashboard');
const signInButton = document.querySelector('#signInButton');
const authMessage = document.querySelector('#authMessage');
const PAYMENT_PROFILE_ID = 'default';
const PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal', profileField: 'paypalEnabled' },
  { id: 'satispay', label: 'Satispay', profileField: 'satispayEnabled' },
  { id: 'revolut', label: 'Revolut', profileField: 'revolutEnabled' },
  { id: 'bankTransfer', label: 'Bonifico', profileField: 'bankTransferEnabled' },
];
const FLEET_BOAT_TYPES = new Set(['Catamarano', 'Monoscafo', 'Gommone', 'Altro']);
const FLEET_BERTH_PREFERENCES = new Set(['not_specified', 'cabin_female', 'cabin_male', 'dinette', 'crew_cabin', 'other']);
let activeBoat = null;
let activeMembers = [];
let activePayments = [];
let activeInvites = [];
let activePaymentProfile = null;
let activeBriefing = null;
let activeAcceptances = [];
let stopBoatSubscription = null;
let stopMemberSubscription = null;
let stopPaymentSubscription = null;
let stopPaymentProfileSubscription = null;
let stopInviteSubscription = null;
let stopBriefingSubscription = null;
let stopAnnouncementSubscription = null;
let stopAcceptanceSubscription = null;
let creatingBoat = false;
let editingBoatId = null;
let editingMemberId = null;
const fleetPublicationInProgress = new Set();

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function getAuthErrorMessage(error) {
  if (error.code === 'auth/unauthorized-domain') return 'Questo indirizzo del sito non è ancora autorizzato in Firebase.';
  if (error.code === 'auth/operation-not-allowed') return 'L’accesso con Google non è abilitato nel progetto Firebase.';
  return 'Accesso non completato. Riprova tra poco.';
}

function isGoogleSkipperAccount(user) {
  return user?.providerData?.some((profile) => profile.providerId === 'google.com');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function createPublicFleetId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function declaredFleetAvailability(boat) {
  const capacity = Number(boat?.capacity);
  const declared = Number(boat?.fleetAvailableSeats);
  if (Number.isInteger(declared) && declared >= 0 && declared <= capacity) return declared;
  return Number.isInteger(capacity) && capacity > 0 ? capacity : 0;
}

function hasValidFleetAvailability(boat) {
  const capacity = Number(boat?.capacity);
  return Number.isInteger(boat?.fleetAvailableSeats)
    && boat.fleetAvailableSeats >= 0
    && boat.fleetAvailableSeats <= capacity;
}

function declaredFleetBoatType(boat) {
  return FLEET_BOAT_TYPES.has(boat?.boatType) ? boat.boatType : 'Altro';
}

function declaredFleetBerthPreference(boat) {
  return FLEET_BERTH_PREFERENCES.has(boat?.fleetBerthPreference)
    ? boat.fleetBerthPreference
    : 'not_specified';
}

function isFleetAvailabilityPublic(boat) {
  // Prima di questa pubblicazione non esisteva una scelta persistita: anche
  // l'eventuale `false` legacy era il vecchio default, non un opt-out dello skipper.
  return boat?.fleetPublicProfileReady !== true || boat?.fleetShowAvailability !== false;
}

function publicFleetProfile(boat) {
  const showAvailability = isFleetAvailabilityPublic(boat);
  return {
    name: String(boat.name || '').trim(),
    model: String(boat.model || '').trim(),
    boatType: declaredFleetBoatType(boat),
    skipperName: String(boat.skipperName || '').trim(),
    capacity: Number(boat.capacity),
    showAvailability,
    availableSeats: showAvailability ? declaredFleetAvailability(boat) : null,
    berthPreference: showAvailability ? declaredFleetBerthPreference(boat) : 'not_specified',
    updatedAt: serverTimestamp(),
  };
}

async function saveBoatAndPublicFleet(boatId, currentBoat, changes, isNew = false) {
  if (!boatId || !auth.currentUser) throw new Error('Barca non disponibile.');
  const privateChanges = { ...changes, fleetPublicProfileReady: true };
  const nextBoat = { ...currentBoat, ...privateChanges, id: boatId };
  if (!nextBoat.publicFleetId) throw new Error('Profilo flotta mancante.');

  // La barca e la sua card pubblica viaggiano nello stesso batch: non può
  // esistere una registrazione riuscita senza il profilo della flotta.
  const batch = writeBatch(db);
  const boatRef = doc(db, 'boats', boatId);
  if (isNew) {
    batch.set(boatRef, { ...privateChanges, createdAt: serverTimestamp() });
  } else {
    batch.update(boatRef, privateChanges);
  }
  // L'associazione privata e immutabile impedisce che un altro skipper possa
  // riutilizzare l'identificativo casuale di una barca già pubblicata.
  batch.set(doc(db, 'events', eventId, 'publicFleetOwners', nextBoat.publicFleetId), {
    skipperId: auth.currentUser.uid,
  }, { merge: true });
  batch.set(doc(db, 'events', eventId, 'publicFleet', nextBoat.publicFleetId), publicFleetProfile(nextBoat));
  await batch.commit();
  return nextBoat;
}

function renderFleetProfileForm() {
  const form = document.querySelector('#fleetProfileForm');
  if (!form || !activeBoat) return;
  form.elements.availableSeats.value = String(declaredFleetAvailability(activeBoat));
  form.elements.berthPreference.value = declaredFleetBerthPreference(activeBoat);
  form.elements.showAvailability.checked = isFleetAvailabilityPublic(activeBoat);
}

function fleetInitializationChanges(boat) {
  const changes = {};
  const isLegacyFleetProfile = boat.fleetPublicProfileReady !== true;
  const boatType = declaredFleetBoatType(boat);
  const berthPreference = declaredFleetBerthPreference(boat);
  if (!boat.publicFleetId) changes.publicFleetId = createPublicFleetId();
  if (boat.boatType !== boatType) changes.boatType = boatType;
  if (isLegacyFleetProfile || !hasValidFleetAvailability(boat)) {
    changes.fleetAvailableSeats = declaredFleetAvailability({ capacity: boat.capacity });
  }
  if (isLegacyFleetProfile || typeof boat.fleetShowAvailability !== 'boolean') changes.fleetShowAvailability = true;
  if (boat.fleetBerthPreference !== berthPreference) changes.fleetBerthPreference = berthPreference;
  if (boat.fleetPublicProfileReady !== true) changes.fleetPublicProfileReady = true;
  return changes;
}

async function publishExistingBoatToFleet(boat) {
  if (!canUsePrivateArea() || !boat?.id || !auth.currentUser || boat.skipperId !== auth.currentUser.uid) return;
  const changes = fleetInitializationChanges(boat);
  if (!Object.keys(changes).length || fleetPublicationInProgress.has(boat.id)) return;

  fleetPublicationInProgress.add(boat.id);
  const message = document.querySelector('#fleetProfileMessage');
  setMessage(message, 'Aggiungo la tua barca alla flotta pubblica…');
  try {
    const publishedBoat = await saveBoatAndPublicFleet(boat.id, boat, changes);
    if (activeBoat?.id === boat.id) {
      activeBoat = publishedBoat;
      renderFleetProfileForm();
      setMessage(message, publishedBoat.fleetShowAvailability
        ? 'Partecipazione pubblicata: anche i posti disponibili sono visibili.'
        : 'Partecipazione pubblicata: i posti disponibili restano privati.');
    }
  } catch (error) {
    setMessage(message, 'Non riesco ad aggiungere automaticamente la barca alla flotta. Verifica le regole Firestore.', true);
  } finally {
    fleetPublicationInProgress.delete(boat.id);
  }
}

function resetPrivateView() {
  activeBoat = null;
  activeMembers = [];
  activePayments = [];
  activeInvites = [];
  activePaymentProfile = null;
  activeBriefing = null;
  activeAcceptances = [];
  creatingBoat = false;
  editingBoatId = null;
  editingMemberId = null;
  fleetPublicationInProgress.clear();
  stopBoatSubscription?.();
  stopMemberSubscription?.();
  stopPaymentSubscription?.();
  stopPaymentProfileSubscription?.();
  stopInviteSubscription?.();
  stopBriefingSubscription?.();
  stopAnnouncementSubscription?.();
  stopAcceptanceSubscription?.();
  stopBoatSubscription = null;
  stopMemberSubscription = null;
  stopPaymentSubscription = null;
  stopPaymentProfileSubscription = null;
  stopInviteSubscription = null;
  stopBriefingSubscription = null;
  stopAnnouncementSubscription = null;
  stopAcceptanceSubscription = null;
  dashboard.hidden = true;
  registerSection.hidden = true;
}

function showPrivateAreaBlocked() {
  resetPrivateView();
  signInCard.hidden = false;
  accountCard.hidden = true;
  signInButton.disabled = true;
  setMessage(authMessage, privateAreaBlockMessage(), true);
}

function blockPrivateAction(messageElement) {
  if (canUsePrivateArea()) return false;
  showPrivateAreaBlocked();
  if (messageElement) setMessage(messageElement, privateAreaBlockMessage(), true);
  return true;
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

function defaultPaymentProfile() {
  return {
    collectorName: auth.currentUser?.displayName || '',
    paypalEnabled: false,
    satispayEnabled: false,
    revolutEnabled: false,
    bankTransferEnabled: false,
  };
}

function availablePaymentMethods() {
  const profile = activePaymentProfile || defaultPaymentProfile();
  return PAYMENT_METHODS.filter((method) => profile[method.profileField] === true);
}

function paymentMethodsFor(payment) {
  const selectedMethods = payment.paymentMethods || payment.methods || {};
  return PAYMENT_METHODS.filter((method) => selectedMethods[method.id] === true);
}

function paymentAmount(payment) {
  if (Number.isInteger(payment.amountCents)) return payment.amountCents / 100;
  return Number(payment.amount) || 0;
}

function paymentMethodTags(payment) {
  const methods = paymentMethodsFor(payment);
  if (!methods.length) return '';
  return `<div class="payment-method-tags">${methods.map((method) => `<span class="payment-method-tag">${method.label}</span>`).join('')}</div>`;
}

function paymentStatusLabel(payment) {
  if (payment.status === 'verified') return 'Accredito verificato';
  if (payment.status === 'cancelled') return 'Richiesta annullata';
  return 'In attesa di verifica';
}

function isPendingPayment(payment) {
  return payment.status === 'prepared' || payment.status === 'requested' || !payment.status;
}

function renderPaymentMethodOptions() {
  const options = document.querySelector('#paymentMethodOptions');
  if (!options) return;
  const selected = new Set([...options.querySelectorAll('input[name="paymentMethod"]:checked')].map((input) => input.value));
  const methods = availablePaymentMethods();
  if (!methods.length) {
    options.innerHTML = '<p class="field-hint">Salva prima almeno un metodo di incasso.</p>';
    return;
  }
  options.innerHTML = methods.map((method) => {
    const checked = selected.size ? selected.has(method.id) : true;
    return `<label class="payment-method-choice"><input name="paymentMethod" type="checkbox" value="${method.id}"${checked ? ' checked' : ''} /> <span>${method.label}</span></label>`;
  }).join('');
}

function renderPaymentProfile(profile) {
  activePaymentProfile = { ...defaultPaymentProfile(), ...(profile || {}) };
  const form = document.querySelector('#paymentProfileForm');
  const collectorName = form.elements.namedItem('collectorName');
  if (collectorName) collectorName.value = activePaymentProfile.collectorName || '';
  PAYMENT_METHODS.forEach((method) => {
    const input = form.elements.namedItem(method.profileField);
    if (input) input.checked = activePaymentProfile[method.profileField] === true;
  });
  renderPaymentMethodOptions();
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

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const INVITE_VALIDITY_DAYS = 14;

function participantUrl(invite) {
  if (!invite?.accessKey) return '';
  const url = new URL('participant.html', window.location.href);
  url.searchParams.set('invite', invite.id);
  url.searchParams.set('boat', activeBoat.id);
  url.searchParams.set('key', invite.accessKey);
  return url.toString();
}

function normalizeWhatsAppNumber(value) {
  const normalized = normalizeCrewPhone(value);
  return normalized ? normalized.slice(1) : '';
}

function whatsappUrl(invite) {
  const number = normalizeWhatsAppNumber(invite.whatsappNumber);
  const personalUrl = participantUrl(invite);
  if (!number || !personalUrl) return '';
  const message = `Ciao ${invite.displayName}, ecco il tuo invito personale per la Crew List Egadi. Apri il link, conferma il numero WhatsApp e scegli un codice personale di 6 cifre: ${personalUrl}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function paymentRecipientWhatsappNumber(recipientId) {
  const invite = activeInvites.find((candidate) => candidate.id === recipientId);
  if (invite?.whatsappNumber) return normalizeWhatsAppNumber(invite.whatsappNumber);
  const member = activeMembers.find((candidate) => candidate.id === recipientId);
  return normalizeWhatsAppNumber(member?.phone || '');
}

function paymentWhatsappMessage(payment, { messageDetails = '' } = {}) {
  const recipientId = payment.recipientId || payment.memberId || payment.payerInviteId;
  const amount = formatCurrency(paymentAmount(payment));
  const reason = payment.reason || 'il contributo del weekend';
  const dueDate = payment.dueDate ? `\nSe possibile entro il ${formatDate(payment.dueDate)}.` : '';
  const methods = paymentMethodsFor(payment).map((method) => method.label);
  const methodText = methods.length
    ? `\n\nPuoi scegliere il metodo che preferisci: ${methods.join(', ')}.`
    : '\n\nScrivimi qui e scegliamo insieme il metodo più comodo.';
  const details = String(messageDetails || '').trim();
  const detailsText = details
    ? `\n\nDettagli per il pagamento:\n${details}`
    : '\n\nPer i dettagli del metodo scelto, rispondimi qui su WhatsApp.';
  return `Ciao ${recipientName(recipientId)} 🌊\n\nPer ${reason}, il contributo è di ${amount}.${dueDate}${methodText}${detailsText}\n\nIl sito non riceve denaro: dopo il contributo avvisami qui, così controllo l’accredito reale. Grazie! ⛵`;
}

function paymentWhatsappUrl(payment, options = {}) {
  const recipientId = payment.recipientId || payment.memberId || payment.payerInviteId;
  const number = paymentRecipientWhatsappNumber(recipientId);
  if (!number) return '';
  return `https://wa.me/${number}?text=${encodeURIComponent(paymentWhatsappMessage(payment, options))}`;
}

function createInviteId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function inviteExpiresAt() {
  return Timestamp.fromDate(new Date(Date.now() + INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000));
}

async function createInviteRecord({ displayName, whatsappNumber, existingInvite = null }) {
  const accessKey = createInviteId();
  const identity = await createCrewInviteIdentity({ phone: whatsappNumber, accessKey });
  if (!existingInvite) {
    const assignedIndex = await getDoc(doc(db, 'crewLoginIndex', identity.phoneFingerprint));
    if (assignedIndex.exists()) {
      const error = new Error('Numero già associato a una barca.');
      error.code = 'phone-already-assigned';
      throw error;
    }
  }
  return {
    id: existingInvite?.id || createInviteId(),
    boatId: activeBoat.id,
    displayName,
    whatsappNumber: identity.normalizedPhone,
    phoneFingerprint: identity.phoneFingerprint,
    loginEmail: identity.loginEmail,
    accessKey,
    participantUid: null,
    status: 'pending',
    accessVersion: Number(existingInvite?.accessVersion || 0) + 1,
    expiresAt: inviteExpiresAt(),
  };
}

async function reissueInvite(invite) {
  const renewedInvite = await createInviteRecord({
    displayName: invite.displayName,
    whatsappNumber: invite.whatsappNumber,
    existingInvite: invite,
  });
  await updateDoc(doc(db, 'boats', activeBoat.id, 'invites', invite.id), {
    ...renewedInvite,
    activatedAt: null,
    reissuedAt: serverTimestamp(),
    reissuedBy: auth.currentUser.uid,
  });
  return renewedInvite;
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

function crewSeatLimit() {
  const capacity = Number(activeBoat?.capacity);
  return Number.isInteger(capacity) && capacity > 0 ? capacity : 0;
}

function allocatedCrewSeatCount() {
  const seatIds = new Set(activeInvites.filter((invite) => invite.status !== 'revoked').map((invite) => invite.id));
  activeMembers.forEach((member) => seatIds.add(member.id));
  return seatIds.size;
}

function isCrewCapacityReached() {
  return allocatedCrewSeatCount() >= crewSeatLimit();
}

function renderCapacityStatus() {
  const status = document.querySelector('#capacityStatus');
  if (!status) return;
  const limit = crewSeatLimit();
  const allocated = allocatedCrewSeatCount();
  if (!activeBoat || !limit) {
    status.textContent = 'Definisci i posti equipaggio della barca prima di inviare gli inviti.';
    return;
  }
  const available = Math.max(0, limit - allocated);
  status.textContent = 'Posti equipaggio: ' + allocated + ' di ' + limit + ' occupati o riservati. '
    + (available ? available + ' ancora disponibili.' : 'Nessun posto ancora disponibile.');
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
  const overCapacity = activeBoat && activeMembers.length > crewSeatLimit();
  generatePdfButton.disabled = !activeBoat || activeMembers.length === 0 || incomplete.length > 0 || boatMissing || overCapacity;
  readiness.textContent = !activeBoat
    ? 'Registra prima la barca per preparare il PDF.'
    : boatMissing
      ? 'Completa bandiera e comandante della barca per attivare il PDF.'
      : overCapacity
        ? 'La Crew List supera i posti equipaggio indicati per la barca.'
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
    renderCapacityStatus();
    updateCharterReadiness();
    return;
  }
  list.innerHTML = activeMembers.map((member) => {
    const missing = getMissingCharterFields(member);
    const status = missing.length ? `Mancano ${missing.length} dati` : 'Pronta per il charter';
    const roleStatus = roleConfirmationText(member);
    const confirmAction = member.roleConfirmed === true
      ? ''
      : `<button class="text-button" type="button" data-confirm-member-role="${escapeHtml(member.id)}">Conferma ruolo</button>`;
    return `<article class="member-row"><div><strong>${escapeHtml(memberName(member))}</strong><span>${escapeHtml(roleStatus)} · ${escapeHtml(status)}</span></div><div class="member-actions">${confirmAction}<button class="text-button" type="button" data-edit-member="${escapeHtml(member.id)}">Modifica</button></div></article>`;
  }).join('');
  renderPaymentRecipientOptions();
  renderCapacityStatus();
  updateCharterReadiness();
}

function renderInvites() {
  const list = document.querySelector('#inviteList');
  if (!activeInvites.length) {
    list.innerHTML = '<p class="empty-state">Nessun link personale creato.</p>';
    renderPaymentRecipientOptions();
    renderCapacityStatus();
    return;
  }
  list.innerHTML = activeInvites.map((invite) => {
    const profileCompleted = activeMembers.some((member) => member.id === invite.id);
    const expired = invite.expiresAt?.toDate && invite.expiresAt.toDate() < new Date();
    const status = invite.status === 'active'
      ? (profileCompleted ? 'Accesso attivo · anagrafica completata' : 'Accesso attivo · dati da completare')
      : (expired ? 'Invito scaduto' : 'Pronto da inviare · valido 14 giorni');
    const sendActions = invite.status === 'pending' && !expired && invite.accessKey
      ? `<button class="text-button" type="button" data-copy-invite="${escapeHtml(invite.id)}">Copia link</button><button class="text-button" type="button" data-whatsapp-invite="${escapeHtml(invite.id)}">Apri WhatsApp</button>`
      : '';
    return `<article class="invite-row"><div><strong>${escapeHtml(invite.displayName)}</strong><span>${escapeHtml(status)} · ${escapeHtml(invite.whatsappNumber)}</span></div><div class="payment-action">${sendActions}<button class="text-button" type="button" data-reissue-invite="${escapeHtml(invite.id)}">Revoca e genera nuovo link</button></div></article>`;
  }).join('');
  renderPaymentRecipientOptions();
  renderCapacityStatus();
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
    const recipientId = payment.recipientId || payment.memberId || payment.payerInviteId;
    const name = recipientName(recipientId);
    const amount = formatCurrency(paymentAmount(payment));
    const reason = `${payment.reason || 'Contributo weekend'}${payment.isOptional ? ' · Facoltativo' : ''}`;
    const dueDate = payment.dueDate ? ` · Entro ${formatDate(payment.dueDate)}` : '';
    const status = paymentStatusLabel(payment);
    const canUpdateStatus = isPendingPayment(payment);
    const statusActions = canUpdateStatus
      ? `<button class="text-button" type="button" data-verify-payment="${escapeHtml(payment.id)}">Conferma accredito</button><button class="text-button" type="button" data-cancel-payment="${escapeHtml(payment.id)}">Annulla richiesta</button>`
      : '';
    const inviteAction = activeInvites.some((invite) => invite.id === recipientId && invite.status === 'pending' && invite.accessKey)
      ? `<button class="text-button" type="button" data-whatsapp-invite="${escapeHtml(recipientId)}">Invia invito</button>`
      : '';
    const paymentMessageAction = paymentRecipientWhatsappNumber(recipientId)
      ? `<button class="text-button" type="button" data-whatsapp-payment="${escapeHtml(payment.id)}">Apri WhatsApp</button>`
      : '';
    const legacyInstructions = payment.instructions ? `<span>${escapeHtml(payment.instructions)}</span>` : '';
    const methods = paymentMethodTags(payment) || '<span>Metodo da concordare nello scambio WhatsApp.</span>';
    return `<article class="payment-row"><div><strong>${escapeHtml(name)} · ${amount}</strong><span>${escapeHtml(reason)}${escapeHtml(dueDate)}</span>${methods}${legacyInstructions}</div><div class="payment-action"><span class="payment-status">${escapeHtml(status)}</span>${paymentMessageAction}<button class="text-button" type="button" data-copy-payment="${escapeHtml(payment.id)}">Copia messaggio</button>${inviteAction}${statusActions}</div></article>`;
  }).join('');
}

function renderBriefingForm() {
  const form = document.querySelector('#briefingForm');
  if (!activeBriefing || form.dataset.editing === 'true') return;
  for (const [field, value] of Object.entries(activeBriefing)) {
    const input = form.elements.namedItem(field);
    if (!input) continue;
    input.value = input.type === 'datetime-local' ? toDateTimeLocal(value) : value || '';
  }
  form.dataset.loadedVersion = String(activeBriefing.rulesVersion || 1);
}

function renderBriefingStatus() {
  const status = document.querySelector('#briefingStatus');
  if (!activeBriefing?.rulesText) {
    status.textContent = 'Pubblica le regole per renderle disponibili all’equipaggio.';
    return;
  }
  const version = activeBriefing.rulesVersion || 1;
  const accepted = activeAcceptances.filter((item) => item.rulesVersion === version).length;
  status.textContent = `Regole versione ${version} pubblicate. ${accepted} ${accepted === 1 ? 'persona ha' : 'persone hanno'} confermato la lettura.`;
}

function renderAnnouncements(snapshot) {
  const list = document.querySelector('#announcementList');
  if (snapshot.empty) {
    list.innerHTML = '<p class="empty-state">Nessuna comunicazione pubblicata.</p>';
    return;
  }
  list.innerHTML = snapshot.docs.map((item) => {
    const announcement = item.data();
    const date = formatDateTime(announcement.createdAt);
    const important = announcement.isImportant ? '<span class="announcement-important">Importante</span>' : '';
    return `<article class="announcement-row"><strong>${escapeHtml(announcement.title || 'Comunicazione dello skipper')}</strong><span>${escapeHtml(announcement.message || '')}</span><span class="announcement-meta">${important}${escapeHtml(date || 'Appena pubblicato')}</span></article>`;
  }).join('');
}

function subscribeToBoat(boat) {
  activeBoat = boat;
  registerSection.hidden = true;
  dashboard.hidden = false;
  document.querySelector('#boatTitle').textContent = boat.name;
  document.querySelector('#boatMeta').textContent = boat.model + ' · ' + boat.capacity + ' posti equipaggio · ' + boat.homePort;
  renderFleetProfileForm();
  void publishExistingBoatToFleet(boat);
  stopMemberSubscription?.();
  stopPaymentSubscription?.();
  stopPaymentProfileSubscription?.();
  stopInviteSubscription?.();
  stopBriefingSubscription?.();
  stopAnnouncementSubscription?.();
  stopAcceptanceSubscription?.();
  stopMemberSubscription = onSnapshot(collection(db, 'boats', boat.id, 'members'), (snapshot) => {
    activeMembers = snapshot.docs.map((item) => normalizeMember(item.id, item.data())).sort((first, second) => memberName(first).localeCompare(memberName(second), 'it'));
    renderMembers();
  }, () => setMessage(document.querySelector('#memberFormMessage'), 'Impossibile leggere la Crew List.', true));
  stopPaymentProfileSubscription = onSnapshot(doc(db, 'boats', boat.id, 'collectionProfile', PAYMENT_PROFILE_ID), (snapshot) => {
    renderPaymentProfile(snapshot.exists() ? snapshot.data() : null);
  }, () => {
    renderPaymentProfile(null);
    setMessage(document.querySelector('#paymentProfileMessage'), 'Impossibile leggere i metodi di incasso.', true);
  });
  stopPaymentSubscription = onSnapshot(query(collection(db, 'boats', boat.id, 'paymentRequests'), orderBy('createdAt', 'desc')), renderPayments, () => setMessage(document.querySelector('#paymentFormMessage'), 'Impossibile leggere le richieste.', true));
  stopInviteSubscription = onSnapshot(collection(db, 'boats', boat.id, 'invites'), (snapshot) => {
    activeInvites = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((first, second) => String(first.displayName || '').localeCompare(String(second.displayName || ''), 'it'));
    renderInvites();
    renderPayments({ empty: activePayments.length === 0, docs: activePayments.map((payment) => ({ id: payment.id, data: () => payment })) });
  }, () => setMessage(document.querySelector('#inviteFormMessage'), 'Impossibile leggere gli inviti personali.', true));
  stopBriefingSubscription = onSnapshot(doc(db, 'boats', boat.id, 'briefing', 'board'), (snapshot) => {
    activeBriefing = snapshot.exists() ? snapshot.data() : null;
    renderBriefingForm();
    renderBriefingStatus();
  }, () => setMessage(document.querySelector('#briefingFormMessage'), 'Impossibile leggere la bacheca di bordo.', true));
  stopAnnouncementSubscription = onSnapshot(query(collection(db, 'boats', boat.id, 'announcements'), orderBy('createdAt', 'desc')), renderAnnouncements, () => setMessage(document.querySelector('#announcementFormMessage'), 'Impossibile leggere le comunicazioni.', true));
  stopAcceptanceSubscription = onSnapshot(collection(db, 'boats', boat.id, 'ruleAcceptances'), (snapshot) => {
    activeAcceptances = snapshot.docs.map((item) => item.data());
    renderBriefingStatus();
  }, () => setMessage(document.querySelector('#briefingFormMessage'), 'Impossibile leggere le conferme delle regole.', true));
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
  if (blockPrivateAction(authMessage)) return;
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
  if (blockPrivateAction(document.querySelector('#boatFormMessage'))) return;
  const user = auth.currentUser;
  if (!user) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(document.querySelector('#boatFormMessage'), 'Registro la barca…');
  try {
    const capacity = Number(fields.get('capacity'));
    const previousAvailability = declaredFleetAvailability(activeBoat);
    const boatData = {
      name: fields.get('name').trim(), model: fields.get('model').trim(), boatType: fields.get('boatType'), capacity,
      homePort: fields.get('homePort').trim(), flag: fields.get('flag').trim(),
      skipperName: fields.get('skipperName').trim(), note: fields.get('note').trim(), skipperId: user.uid,
      publicFleetId: activeBoat?.publicFleetId || createPublicFleetId(),
      fleetAvailableSeats: Math.min(previousAvailability, capacity),
      fleetShowAvailability: isFleetAvailabilityPublic(activeBoat),
      fleetBerthPreference: declaredFleetBerthPreference(activeBoat),
      eventId, updatedAt: serverTimestamp(),
    };
    if (editingBoatId) {
      activeBoat = await saveBoatAndPublicFleet(editingBoatId, activeBoat, boatData);
      creatingBoat = false;
      resetBoatForm(user);
      subscribeToBoat(activeBoat);
      setMessage(document.querySelector('#boatFormMessage'), 'Dati della barca aggiornati e partecipazione alla flotta pubblicata.');
    } else {
      activeBoat = await saveBoatAndPublicFleet(user.uid, {}, boatData, true);
      creatingBoat = false;
      subscribeToBoat(activeBoat);
      resetBoatForm(user);
      setMessage(document.querySelector('#boatFormMessage'), 'Barca registrata e partecipazione alla flotta pubblicata.');
    }
  } catch (error) {
    setMessage(document.querySelector('#boatFormMessage'), 'Non riesco a registrare la barca. Verifica le regole Firestore.', true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#fleetProfileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#fleetProfileMessage');
  if (blockPrivateAction(message) || !activeBoat || !auth.currentUser) return;
  if (!activeBoat.boatType) {
    setMessage(message, 'Completa prima il tipo di imbarcazione nei dati della barca.', true);
    return;
  }
  const form = event.currentTarget;
  const fields = new FormData(form);
  const capacity = Number(activeBoat.capacity);
  const availableSeats = Number(fields.get('availableSeats'));
  if (!Number.isInteger(availableSeats) || availableSeats < 0 || availableSeats > capacity) {
    setMessage(message, `Indica un numero da 0 a ${capacity}.`, true);
    return;
  }
  const berthPreference = String(fields.get('berthPreference') || 'not_specified');
  if (!FLEET_BERTH_PREFERENCES.has(berthPreference)) {
    setMessage(message, 'Configurazione del posto non valida.', true);
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(message, 'Aggiorno la flotta…');
  try {
    const fleetData = {
      publicFleetId: activeBoat.publicFleetId || createPublicFleetId(),
      fleetAvailableSeats: availableSeats,
      fleetShowAvailability: fields.get('showAvailability') === 'on',
      fleetBerthPreference: berthPreference,
      updatedAt: serverTimestamp(),
    };
    activeBoat = await saveBoatAndPublicFleet(activeBoat.id, activeBoat, fleetData);
    renderFleetProfileForm();
    setMessage(message, activeBoat.fleetShowAvailability
      ? 'Flotta aggiornata: i posti disponibili sono pubblici.'
      : 'Flotta aggiornata: i posti disponibili restano privati.');
  } catch (error) {
    setMessage(message, 'Non riesco ad aggiornare la flotta. Verifica le regole Firestore.', true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#inviteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (blockPrivateAction(document.querySelector('#inviteFormMessage'))) return;
  if (!activeBoat || !auth.currentUser) return;
  if (isCrewCapacityReached()) {
    setMessage(document.querySelector('#inviteFormMessage'), 'Hai già riservato tutti i posti equipaggio indicati per questa barca.', true);
    return;
  }
  const form = event.currentTarget;
  const fields = new FormData(form);
  const displayName = fields.get('displayName').trim();
  const normalizedNumber = normalizeWhatsAppNumber(fields.get('whatsappNumber'));
  if (!normalizedNumber) {
    setMessage(document.querySelector('#inviteFormMessage'), 'Inserisci il numero WhatsApp in formato internazionale, ad esempio +39 333 1234567.', true);
    return;
  }
  const whatsappNumber = `+${normalizedNumber}`;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  const whatsappWindow = window.open('', '_blank');
  if (whatsappWindow) whatsappWindow.opener = null;
  try {
    const invite = await createInviteRecord({ displayName, whatsappNumber });
    await setDoc(doc(db, 'boats', activeBoat.id, 'invites', invite.id), {
      ...invite, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid,
    });
    form.reset();
    if (whatsappWindow) {
      const url = whatsappUrl(invite);
      if (url) {
        whatsappWindow.location.replace(url);
        setMessage(document.querySelector('#inviteFormMessage'), 'Link personale creato: WhatsApp è aperto con il messaggio già pronto.');
      } else {
        whatsappWindow.close();
        setMessage(document.querySelector('#inviteFormMessage'), 'Link creato, ma il numero WhatsApp non è valido. Correggilo prima di inviarlo.', true);
      }
    } else {
      setMessage(document.querySelector('#inviteFormMessage'), 'Link personale creato: apri WhatsApp dalla scheda dell’invito.');
    }
  } catch (error) {
    whatsappWindow?.close();
    setMessage(document.querySelector('#inviteFormMessage'), error.code === 'phone-already-assigned'
      ? 'Questo numero è già associato a una barca dell’evento. Non creare un secondo invito: verifica prima con l’organizzatore.'
      : 'Non riesco a creare il link personale.', true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#memberForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (blockPrivateAction(document.querySelector('#memberFormMessage'))) return;
  if (!activeBoat) return;
  if (!editingMemberId && isCrewCapacityReached()) {
    setMessage(document.querySelector('#memberFormMessage'), 'Hai già riservato tutti i posti equipaggio indicati per questa barca.', true);
    return;
  }
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const memberData = {
      firstName: fields.get('firstName').trim(), lastName: fields.get('lastName').trim(), birthDate: fields.get('birthDate'),
      birthPlace: fields.get('birthPlace').trim(), nationality: fields.get('nationality').trim(), gender: fields.get('gender'),
      documentType: fields.get('documentType'), documentNumber: fields.get('documentNumber').trim(), documentExpiry: fields.get('documentExpiry'),
      role: roleFromFields(fields, 'role'), roleConfirmed: true, email: fields.get('email').trim().toLowerCase(), phone: fields.get('phone').trim(),
      charterConsent: fields.get('charterConsent') === 'on', updatedAt: serverTimestamp(),
    };
    memberData.displayName = `${memberData.firstName} ${memberData.lastName}`;
    if (editingMemberId) {
      await updateDoc(doc(db, 'boats', activeBoat.id, 'members', editingMemberId), memberData);
      setMessage(document.querySelector('#memberFormMessage'), 'Dati della persona aggiornati e ruolo confermato.');
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

document.querySelector('#memberList').addEventListener('click', async (event) => {
  const confirmButton = event.target.closest('[data-confirm-member-role]');
  if (confirmButton) {
    const member = activeMembers.find((candidate) => candidate.id === confirmButton.dataset.confirmMemberRole);
    if (!member || !activeBoat) return;
    confirmButton.disabled = true;
    try {
      await updateDoc(doc(db, 'boats', activeBoat.id, 'members', member.id), {
        role: String(member.role || '').trim() || DEFAULT_CREW_ROLE,
        roleConfirmed: true,
        updatedAt: serverTimestamp(),
      });
      setMessage(document.querySelector('#memberFormMessage'), `Ruolo di ${memberName(member)} confermato.`);
    } catch (error) {
      setMessage(document.querySelector('#memberFormMessage'), 'Non riesco a confermare il ruolo.', true);
      confirmButton.disabled = false;
    }
    return;
  }
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
  fillRoleFields(form, 'role', member.role);
  editingMemberId = member.id;
  document.querySelector('#memberSubmitButton').textContent = 'Salva modifiche';
  document.querySelector('#cancelMemberEdit').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.querySelector('#cancelMemberEdit').addEventListener('click', resetMemberForm);
document.querySelector('#briefingForm').addEventListener('input', () => {
  document.querySelector('#briefingForm').dataset.editing = 'true';
});
document.querySelector('#briefingForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (blockPrivateAction(document.querySelector('#briefingFormMessage'))) return;
  if (!activeBoat || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  const rulesTitle = fields.get('rulesTitle').trim();
  const rulesText = fields.get('rulesText').trim();
  const rulesChanged = !activeBriefing || rulesTitle !== (activeBriefing.rulesTitle || '') || rulesText !== (activeBriefing.rulesText || '');
  const rulesVersion = activeBriefing ? (activeBriefing.rulesVersion || 1) + (rulesChanged ? 1 : 0) : 1;
  submitButton.disabled = true;
  setMessage(document.querySelector('#briefingFormMessage'), 'Pubblico la bacheca…');
  try {
    await setDoc(doc(db, 'boats', activeBoat.id, 'briefing', 'board'), {
      rulesTitle, rulesText, rulesVersion, meetingPoint: fields.get('meetingPoint').trim(),
      boardingAt: fields.get('boardingAt'), departureAt: fields.get('departureAt'), returnAt: fields.get('returnAt'),
      scheduleNote: fields.get('scheduleNote').trim(), updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid,
    }, { merge: true });
    form.dataset.editing = '';
    setMessage(document.querySelector('#briefingFormMessage'), rulesChanged && activeBriefing ? `Regole aggiornate: l’equipaggio dovrà confermare la versione ${rulesVersion}.` : 'Bacheca pubblicata.');
  } catch (error) {
    setMessage(document.querySelector('#briefingFormMessage'), 'Non riesco a pubblicare la bacheca.', true);
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelector('#announcementForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (blockPrivateAction(document.querySelector('#announcementFormMessage'))) return;
  if (!activeBoat || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await addDoc(collection(db, 'boats', activeBoat.id, 'announcements'), {
      title: fields.get('title').trim(), message: fields.get('message').trim(), isImportant: fields.get('isImportant') === 'on',
      createdAt: serverTimestamp(), createdBy: auth.currentUser.uid,
    });
    form.reset();
    setMessage(document.querySelector('#announcementFormMessage'), 'Comunicazione pubblicata per il tuo equipaggio.');
  } catch (error) {
    setMessage(document.querySelector('#announcementFormMessage'), 'Non riesco a pubblicare la comunicazione.', true);
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelector('#generatePdfButton').addEventListener('click', () => {
  if (blockPrivateAction(document.querySelector('#memberFormMessage'))) return;
  if (!activeBoat || !isBoatReadyForPdf(activeBoat) || activeMembers.length > crewSeatLimit() || activeMembers.some((member) => !isCharterReady(member))) return;
  try {
    openCapitaneriaPdf({ boat: activeBoat, members: activeMembers });
    setMessage(document.querySelector('#memberFormMessage'), 'Si apre la stampa: scegli “Salva come PDF” per scaricare il foglio.');
  } catch (error) {
    setMessage(document.querySelector('#memberFormMessage'), 'Impossibile aprire la stampa. Consenti le finestre popup e riprova.', true);
  }
});

document.querySelector('#paymentProfileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (blockPrivateAction(document.querySelector('#paymentProfileMessage'))) return;
  if (!activeBoat || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const collectorName = String(fields.get('collectorName') || '').trim();
  const enabledMethods = PAYMENT_METHODS.filter((method) => fields.get(method.profileField) === 'on');
  if (!collectorName) {
    setMessage(document.querySelector('#paymentProfileMessage'), 'Indica il nome di chi incassa il contributo.', true);
    return;
  }
  if (!enabledMethods.length) {
    setMessage(document.querySelector('#paymentProfileMessage'), 'Seleziona almeno un metodo di incasso.', true);
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await setDoc(doc(db, 'boats', activeBoat.id, 'collectionProfile', PAYMENT_PROFILE_ID), {
      collectorId: auth.currentUser.uid,
      collectorName,
      paypalEnabled: fields.get('paypalEnabled') === 'on',
      satispayEnabled: fields.get('satispayEnabled') === 'on',
      revolutEnabled: fields.get('revolutEnabled') === 'on',
      bankTransferEnabled: fields.get('bankTransferEnabled') === 'on',
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
    });
    setMessage(document.querySelector('#paymentProfileMessage'), 'Metodi di incasso salvati. Ora puoi usarli nelle richieste personali.');
  } catch (error) {
    setMessage(document.querySelector('#paymentProfileMessage'), 'Non riesco a salvare i metodi di incasso.', true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#paymentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (blockPrivateAction(document.querySelector('#paymentFormMessage'))) return;
  if (!activeBoat || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const recipientId = String(fields.get('recipientId') || '');
  const collectorName = String(activePaymentProfile?.collectorName || '').trim();
  const reason = String(fields.get('reason') || '').trim();
  const amountCents = Math.round(Number(fields.get('amount')) * 100);
  const allowedMethods = new Set(availablePaymentMethods().map((method) => method.id));
  const selectedMethodIds = fields.getAll('paymentMethod').filter((methodId) => allowedMethods.has(methodId));
  if (!collectorName || !allowedMethods.size) {
    setMessage(document.querySelector('#paymentFormMessage'), 'Salva prima il nome e almeno un metodo di incasso.', true);
    return;
  }
  if (!recipientId) {
    setMessage(document.querySelector('#paymentFormMessage'), 'Seleziona la persona a cui inviare la richiesta.', true);
    return;
  }
  if (!reason) {
    setMessage(document.querySelector('#paymentFormMessage'), 'Indica una causale per la richiesta.', true);
    return;
  }
  if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > 1_000_000) {
    setMessage(document.querySelector('#paymentFormMessage'), 'Inserisci un importo valido fino a 10.000 euro.', true);
    return;
  }
  if (!selectedMethodIds.length) {
    setMessage(document.querySelector('#paymentFormMessage'), 'Scegli almeno un metodo da proporre.', true);
    return;
  }
  const paymentMethods = Object.fromEntries(selectedMethodIds.map((methodId) => [methodId, true]));
  const payment = {
    recipientId,
    memberId: recipientId,
    payerInviteId: recipientId,
    amountCents,
    currency: 'EUR',
    reason,
    isOptional: fields.get('isOptional') === 'on',
    dueDate: String(fields.get('dueDate') || ''),
    collectorId: auth.currentUser.uid,
    collectorName,
    paymentMethods,
    status: 'prepared',
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    verifiedAt: null,
    verifiedBy: null,
    cancelledAt: null,
    cancelledBy: null,
  };
  const whatsappUrl = paymentWhatsappUrl(payment, { messageDetails: fields.get('messageDetails') });
  if (!whatsappUrl) {
    setMessage(document.querySelector('#paymentFormMessage'), 'Per aprire WhatsApp serve un numero valido nell’invito della persona. Crea o correggi prima l’invito personale.', true);
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  const whatsappWindow = window.open('', '_blank');
  if (whatsappWindow) whatsappWindow.opener = null;
  try {
    await addDoc(collection(db, 'boats', activeBoat.id, 'paymentRequests'), payment);
    form.reset();
    renderPaymentMethodOptions();
    if (whatsappWindow) whatsappWindow.location.replace(whatsappUrl);
    setMessage(document.querySelector('#paymentFormMessage'), whatsappWindow
      ? 'Richiesta preparata: WhatsApp è aperto con il messaggio da inviare personalmente.'
      : 'Richiesta preparata. Il browser ha bloccato la nuova finestra: usa “Apri WhatsApp” dalla richiesta.');
  } catch (error) {
    whatsappWindow?.close();
    setMessage(document.querySelector('#paymentFormMessage'), 'Non riesco a preparare la richiesta.', true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#paymentList').addEventListener('click', async (event) => {
  if (blockPrivateAction(document.querySelector('#paymentFormMessage'))) return;
  const whatsappButton = event.target.closest('[data-whatsapp-invite]');
  if (whatsappButton) {
    const invite = activeInvites.find((candidate) => candidate.id === whatsappButton.dataset.whatsappInvite);
    const url = invite && whatsappUrl(invite);
    if (url) window.open(url, '_blank', 'noopener');
    else setMessage(document.querySelector('#paymentFormMessage'), 'Il numero WhatsApp dell’invito non è nel formato internazionale richiesto.', true);
    return;
  }
  const paymentWhatsappButton = event.target.closest('[data-whatsapp-payment]');
  if (paymentWhatsappButton) {
    const payment = activePayments.find((candidate) => candidate.id === paymentWhatsappButton.dataset.whatsappPayment);
    const url = payment && paymentWhatsappUrl(payment);
    if (url) window.open(url, '_blank', 'noopener');
    else setMessage(document.querySelector('#paymentFormMessage'), 'Non trovo un numero WhatsApp valido per questa richiesta.', true);
    return;
  }
  const inviteCopyButton = event.target.closest('[data-copy-invite]');
  if (inviteCopyButton) {
    const invite = activeInvites.find((candidate) => candidate.id === inviteCopyButton.dataset.copyInvite);
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(participantUrl(invite));
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
    const message = paymentWhatsappMessage(payment);
    try {
      await navigator.clipboard.writeText(message);
      setMessage(document.querySelector('#paymentFormMessage'), 'Messaggio copiato. I dettagli di pagamento vanno aggiunti solo nella chat WhatsApp.');
    } catch (error) {
      setMessage(document.querySelector('#paymentFormMessage'), 'Non riesco a copiare il messaggio. Verifica i permessi del browser.', true);
    }
    return;
  }
  const cancelButton = event.target.closest('[data-cancel-payment]');
  if (cancelButton && activeBoat) {
    const payment = activePayments.find((candidate) => candidate.id === cancelButton.dataset.cancelPayment);
    if (!payment || !isPendingPayment(payment)) return;
    if (!window.confirm('Annullare questa richiesta? L’operazione resta registrata e non cancella alcun contributo esterno.')) return;
    cancelButton.disabled = true;
    try {
      await updateDoc(doc(db, 'boats', activeBoat.id, 'paymentRequests', payment.id), {
        status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: auth.currentUser.uid,
      });
      setMessage(document.querySelector('#paymentFormMessage'), 'Richiesta annullata.');
    } catch (error) {
      cancelButton.disabled = false;
      setMessage(document.querySelector('#paymentFormMessage'), 'Non riesco ad annullare la richiesta.', true);
    }
    return;
  }
  const button = event.target.closest('[data-verify-payment]');
  if (!button || !activeBoat) return;
  const payment = activePayments.find((candidate) => candidate.id === button.dataset.verifyPayment);
  if (!payment || !isPendingPayment(payment)) return;
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
  if (blockPrivateAction(document.querySelector('#inviteFormMessage'))) return;
  const reissueButton = event.target.closest('[data-reissue-invite]');
  if (reissueButton) {
    const invite = activeInvites.find((candidate) => candidate.id === reissueButton.dataset.reissueInvite);
    if (!invite || !activeBoat || !auth.currentUser) return;
    const confirmed = window.confirm(`Revocare l’accesso attuale di ${invite.displayName} e inviare un nuovo link? Il vecchio codice personale smetterà di funzionare.`);
    if (!confirmed) return;
    reissueButton.disabled = true;
    const whatsappWindow = window.open('', '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    try {
      const renewedInvite = await reissueInvite(invite);
      const url = whatsappUrl(renewedInvite);
      if (whatsappWindow && url) whatsappWindow.location.replace(url);
      else whatsappWindow?.close();
      setMessage(document.querySelector('#inviteFormMessage'), whatsappWindow && url
        ? 'Il vecchio accesso è stato revocato: WhatsApp è aperto con il nuovo link.'
        : 'Il vecchio accesso è stato revocato. Copia il nuovo link dalla scheda dell’invito.', !url);
    } catch (error) {
      whatsappWindow?.close();
      reissueButton.disabled = false;
      setMessage(document.querySelector('#inviteFormMessage'), 'Non riesco a revocare e generare il nuovo link. Se era aperta un’altra scheda, aggiorna l’elenco e usa il link più recente.', true);
    }
    return;
  }
  const whatsappButton = event.target.closest('[data-whatsapp-invite]');
  if (whatsappButton) {
    const invite = activeInvites.find((candidate) => candidate.id === whatsappButton.dataset.whatsappInvite);
    const url = invite && whatsappUrl(invite);
    if (url) window.open(url, '_blank', 'noopener');
    else setMessage(document.querySelector('#inviteFormMessage'), 'Il numero WhatsApp dell’invito non è nel formato internazionale richiesto.', true);
    return;
  }
  const copyButton = event.target.closest('[data-copy-invite]');
  if (!copyButton) return;
  const invite = activeInvites.find((candidate) => candidate.id === copyButton.dataset.copyInvite);
  if (!invite) return;
  try {
    await navigator.clipboard.writeText(participantUrl(invite));
    setMessage(document.querySelector('#inviteFormMessage'), 'Link personale copiato.');
  } catch (error) {
    setMessage(document.querySelector('#inviteFormMessage'), 'Non riesco a copiare il link. Verifica i permessi del browser.', true);
  }
});

onAuthStateChanged(auth, async (user) => {
  resetPrivateView();
  if (!canUsePrivateArea()) {
    showPrivateAreaBlocked();
    return;
  }
  if (!user || !isGoogleSkipperAccount(user)) {
    signInCard.hidden = false;
    accountCard.hidden = true;
    if (user) {
      setMessage(authMessage, 'Questa è l’area skipper. Per l’equipaggio usa l’accesso con numero e codice personale.', true);
    }
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

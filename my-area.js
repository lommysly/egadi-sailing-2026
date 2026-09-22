import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { auth, crewAccessErrorMessage, crewAccessUrl, db, profileUrl, signOutCrew, startCrewAreaSession } from './crew-session.js?v=20260911-live';
import { AIRLINE_CATALOG, airlineById, AIRPORT_CATALOG, airportByIata, airportsForCity, CITY_CATALOG, cityById, TRANSFER_CATALOG_VERSION, TRANSFER_LEG_CONFIG } from './transfer-catalog.js?v=20260911-live';
import { roleConfirmationText } from './crew-roles.js?v=20260911-role1';

let activeInvite = null;
let activeBriefing = null;
let activeRuleAcceptance = null;
let activeTransferLegs = [];
let editingTransferLegId = null;
let stopTransferLegSubscription = null;
const PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal' },
  { id: 'satispay', label: 'Satispay' },
  { id: 'revolut', label: 'Revolut' },
  { id: 'bankTransfer', label: 'Bonifico' },
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

function transferConfig(legKind) {
  return TRANSFER_LEG_CONFIG[legKind] || TRANSFER_LEG_CONFIG.home_to_airport;
}

function transferIntentLabel(intent) {
  if (intent === 'looking') return 'Cerco un passaggio';
  if (intent === 'offering') return 'Offro posti in auto';
  return 'Solo coordinamento';
}

function transferVehicleLabel(vehicleType) {
  if (vehicleType === 'rental_car') return 'Auto a noleggio';
  if (vehicleType === 'own_car') return 'Auto propria';
  return '';
}

function transferTime(value) {
  return typeof value === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? value : '';
}

function transferLegReference(legId) {
  return doc(db, 'events', 'egadi-2026', 'transferProfiles', auth.currentUser.uid, 'transferLegs', legId);
}

function transferLegCollection() {
  return collection(db, 'events', 'egadi-2026', 'transferProfiles', auth.currentUser.uid, 'transferLegs');
}

function transferForm() {
  return document.querySelector('#transferLegForm');
}

function renderTransferCityOptions(selectedCityId = '') {
  const select = document.querySelector('#transferCitySelect');
  select.innerHTML = `<option value="">Seleziona città o zona</option>${CITY_CATALOG.map((city) => `<option value="${escapeHtml(city.id)}">${escapeHtml(city.label)}</option>`).join('')}<option value="other">Altra città o zona</option>`;
  select.value = selectedCityId || '';
}

function renderTransferAirportOptions(cityId = '', selectedAirportIata = '') {
  const select = document.querySelector('#transferAirportSelect');
  const suggestedCodes = new Set(airportsForCity(cityId).map((airport) => airport.iata));
  const suggested = AIRPORT_CATALOG.filter((airport) => suggestedCodes.has(airport.iata));
  const remaining = AIRPORT_CATALOG.filter((airport) => !suggestedCodes.has(airport.iata));
  const options = (airports) => airports.map((airport) => `<option value="${airport.iata}">${escapeHtml(`${airport.label} · ${airport.iata}`)}</option>`).join('');
  const suggestedGroup = suggested.length ? `<optgroup label="Aeroporti suggeriti per la tua città">${options(suggested)}</optgroup>` : '';
  const remainingGroup = `<optgroup label="Tutti gli aeroporti disponibili">${options(remaining)}</optgroup>`;
  select.innerHTML = `<option value="">Seleziona aeroporto</option>${suggestedGroup}${remainingGroup}`;
  select.value = selectedAirportIata || '';
}

function renderTransferAirlineOptions(selectedAirlineId = '') {
  const select = document.querySelector('#transferAirlineSelect');
  select.innerHTML = `<option value="">Non indicata</option>${AIRLINE_CATALOG.map((airline) => `<option value="${escapeHtml(airline.id)}">${escapeHtml(airline.label)}</option>`).join('')}<option value="other">Altra compagnia</option>`;
  select.value = selectedAirlineId || '';
}

function updateTransferFormPresentation({ selectedAirportIata } = {}) {
  const form = transferForm();
  if (!form) return;
  const config = transferConfig(form.elements.legKind.value);
  const cityField = document.querySelector('#transferCityField');
  const cityRow = document.querySelector('#transferCityRow');
  const citySelect = document.querySelector('#transferCitySelect');
  const otherCityField = document.querySelector('#transferOtherCityField');
  const airportSelect = document.querySelector('#transferAirportSelect');
  const isFixedMarsala = config.cityDirection === 'fixed';
  if (isFixedMarsala) citySelect.value = 'marsala';
  cityField.hidden = isFixedMarsala;
  cityRow.classList.toggle('transfer-city-fixed', isFixedMarsala);
  document.querySelector('#transferCityText').textContent = `${config.cityLabel} *`;
  document.querySelector('#transferAirportText').textContent = `${config.airportLabel} *`;
  document.querySelector('#transferMatchTimeText').textContent = `${config.matchTimeLabel} *`;
  document.querySelector('#transferAirlineText').textContent = config.flightHint;
  const currentAirport = selectedAirportIata || airportSelect.value;
  renderTransferAirportOptions(citySelect.value, currentAirport);
  const isOtherCity = !isFixedMarsala && citySelect.value === 'other';
  otherCityField.hidden = !isOtherCity;
  form.elements.otherCityLabel.required = isOtherCity;
  const isOtherAirline = form.elements.airlineId.value === 'other';
  document.querySelector('#transferOtherAirlineField').hidden = !isOtherAirline;
  form.elements.otherAirlineLabel.required = isOtherAirline;
  const isOffering = form.elements.rideIntent.value === 'offering';
  document.querySelector('#transferOfferFields').hidden = !isOffering;
  document.querySelector('#transferPeerConsentField').hidden = form.elements.rideIntent.value === 'not_needed';
  document.querySelector('#transferOperatorConsentField').hidden = !config.operatorEligible;
  document.querySelector('#transferBagsText').textContent = isOffering ? 'Valigie standard che puoi portare' : 'I miei bagagli standard';
  document.querySelector('#transferBulkyBagsText').textContent = isOffering ? 'Accetto anche un collo ingombrante' : 'Ho un collo ingombrante';
}

function resetTransferLegForm() {
  const form = transferForm();
  if (!form) return;
  editingTransferLegId = null;
  form.reset();
  form.elements.legKind.value = 'home_to_airport';
  form.elements.rideIntent.value = 'not_needed';
  renderTransferCityOptions();
  renderTransferAirlineOptions();
  updateTransferFormPresentation();
  document.querySelector('#transferLegSubmitButton').textContent = 'Salva tratta';
  document.querySelector('#cancelTransferLegEdit').hidden = true;
}

function transferRouteLabel(leg) {
  const config = transferConfig(leg.legKind);
  const city = leg.cityLabel || 'Città / zona';
  const airport = leg.airportLabel && leg.airportIata ? `${leg.airportLabel} · ${leg.airportIata}` : leg.airportIata || 'Aeroporto';
  if (leg.legKind === 'home_to_airport') return `${city} → ${airport}`;
  if (leg.legKind === 'airport_to_marsala') return `${airport} → Marsala`;
  if (leg.legKind === 'marsala_to_airport') return `Marsala → ${airport}`;
  if (leg.legKind === 'airport_to_home') return `${airport} → ${city}`;
  return config.label;
}

function transferLegDetails(leg) {
  const details = [
    `${formatDate(leg.travelDate)} · ${transferTime(leg.matchTime) || 'orario da definire'}`,
    transferIntentLabel(leg.rideIntent),
  ];
  if (leg.rideIntent === 'offering') {
    details.push(`${transferVehicleLabel(leg.vehicleType)} · ${leg.seatsAvailable || 0} posti`);
  }
  if (leg.airlineLabel) details.push(`${leg.airlineLabel}${leg.flightNumber ? ` · ${leg.flightNumber}` : ''}`);
  if (leg.peerMatchConsent) details.push('Disponibile al match protetto');
  return details.filter(Boolean);
}

function renderTransferLegs(snapshot) {
  activeTransferLegs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => {
    const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
    const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
    return bTime - aTime;
  });
  const list = document.querySelector('#participantTransferLegList');
  if (!activeTransferLegs.length) {
    list.innerHTML = '<p class="empty-state">Non hai ancora aggiunto una tratta. Puoi farlo anche più avanti o salvarne una sola.</p>';
    return;
  }
  list.innerHTML = activeTransferLegs.map((leg) => {
    const details = transferLegDetails(leg).map((detail) => `<span>${escapeHtml(detail)}</span>`).join('');
    const operator = transferConfig(leg.legKind).operatorEligible && leg.operatorConsent
      ? '<span class="transfer-operator-note">Tratta autorizzata per il coordinamento transfer Sicilia.</span>'
      : '';
    return `<article class="transfer-leg-row"><div><strong>${escapeHtml(transferRouteLabel(leg))}</strong>${details}${operator}</div><div class="member-actions"><button class="text-button" type="button" data-edit-transfer-leg="${escapeHtml(leg.id)}">Modifica</button><button class="text-button danger-button" type="button" data-delete-transfer-leg="${escapeHtml(leg.id)}">Elimina</button></div></article>`;
  }).join('');
}

function editTransferLeg(leg) {
  const form = transferForm();
  editingTransferLegId = leg.id;
  renderTransferCityOptions(leg.cityId || '');
  renderTransferAirlineOptions(leg.airlineId || '');
  form.elements.legKind.value = leg.legKind || 'home_to_airport';
  form.elements.rideIntent.value = leg.rideIntent || 'not_needed';
  updateTransferFormPresentation({ selectedAirportIata: leg.airportIata || '' });
  form.elements.cityId.value = leg.cityId || '';
  form.elements.otherCityLabel.value = leg.cityId === 'other' ? (leg.cityLabel || '') : '';
  form.elements.airportIata.value = leg.airportIata || '';
  form.elements.travelDate.value = leg.travelDate || '';
  form.elements.matchTime.value = transferTime(leg.matchTime);
  form.elements.departureTime.value = transferTime(leg.departureTime);
  form.elements.arrivalTime.value = transferTime(leg.arrivalTime);
  form.elements.airlineId.value = leg.airlineId || '';
  form.elements.otherAirlineLabel.value = leg.airlineId === 'other' ? (leg.airlineLabel || '') : '';
  form.elements.flightNumber.value = leg.flightNumber || '';
  form.elements.standardBagSlots.value = String(leg.rideIntent === 'offering' ? (leg.luggageCapacity || 0) : (leg.bagsCount || 0));
  form.elements.hasBulkyBags.checked = leg.rideIntent === 'offering' ? leg.acceptsBulkyBags === true : leg.hasBulkyBags === true;
  form.elements.vehicleType.value = leg.vehicleType === 'rental_car' ? 'rental_car' : 'own_car';
  form.elements.seatsAvailable.value = String(Math.max(1, Math.min(5, leg.seatsAvailable || 1)));
  form.elements.peerMatchConsent.checked = leg.peerMatchConsent === true;
  form.elements.operatorConsent.checked = leg.operatorConsent === true;
  updateTransferFormPresentation({ selectedAirportIata: leg.airportIata || '' });
  document.querySelector('#transferLegSubmitButton').textContent = 'Aggiorna tratta';
  document.querySelector('#cancelTransferLegEdit').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function transferPayloadFromForm() {
  const form = transferForm();
  const legKind = form.elements.legKind.value;
  const config = transferConfig(legKind);
  const cityId = config.cityDirection === 'fixed' ? 'marsala' : form.elements.cityId.value;
  const knownCity = cityById(cityId);
  const otherCityLabel = form.elements.otherCityLabel.value.trim();
  const cityLabel = cityId === 'other' ? otherCityLabel : knownCity?.label;
  const airportIata = form.elements.airportIata.value;
  const airport = airportByIata(airportIata);
  const airlineId = form.elements.airlineId.value;
  const knownAirline = airlineById(airlineId);
  const otherAirlineLabel = form.elements.otherAirlineLabel.value.trim();
  const airlineLabel = airlineId === 'other' ? otherAirlineLabel : (knownAirline?.label || '');
  const rideIntent = form.elements.rideIntent.value;
  const isOffering = rideIntent === 'offering';
  if (!cityId || !cityLabel || !airport || !form.elements.travelDate.value || !transferTime(form.elements.matchTime.value)) {
    throw new Error('Completa città, aeroporto, data e orario di riferimento.');
  }
  if (airlineId === 'other' && !airlineLabel) throw new Error('Inserisci il nome della compagnia aerea.');
  return {
    ownerUid: auth.currentUser.uid,
    boatId: activeInvite.boatId,
    inviteId: activeInvite.id,
    legKind,
    catalogVersion: TRANSFER_CATALOG_VERSION,
    cityId,
    cityLabel,
    airportIata,
    airportLabel: airport.label,
    travelDate: form.elements.travelDate.value,
    matchTime: form.elements.matchTime.value,
    departureTime: form.elements.departureTime.value || '',
    arrivalTime: form.elements.arrivalTime.value || '',
    airlineId,
    airlineLabel,
    flightNumber: form.elements.flightNumber.value.trim().toUpperCase(),
    rideIntent,
    vehicleType: isOffering ? form.elements.vehicleType.value : 'none',
    seatsAvailable: isOffering ? Number(form.elements.seatsAvailable.value) : 0,
    bagsCount: isOffering ? 0 : Number(form.elements.standardBagSlots.value),
    luggageCapacity: isOffering ? Number(form.elements.standardBagSlots.value) : 0,
    hasBulkyBags: isOffering ? false : form.elements.hasBulkyBags.checked,
    acceptsBulkyBags: isOffering ? form.elements.hasBulkyBags.checked : false,
    peerMatchConsent: rideIntent === 'not_needed' ? false : form.elements.peerMatchConsent.checked,
    operatorConsent: config.operatorEligible ? form.elements.operatorConsent.checked : false,
  };
}

function showOpening(message = '', isError = false) {
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#participantDashboard').hidden = true;
  document.querySelector('#signInSection').hidden = false;
  setMessage(document.querySelector('#participantAuthMessage'), message, isError);
}

function showInvalid(error) {
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#participantDashboard').hidden = true;
  document.querySelector('#invalidLink').hidden = false;
  const message = document.querySelector('#invalidAccessMessage');
  if (message) setMessage(message, crewAccessErrorMessage(error));
  const loginLink = document.querySelector('#crewLoginLink');
  if (loginLink) loginLink.href = crewAccessUrl();
}

function clearPersonalDashboard() {
  activeInvite = null;
  activeBriefing = null;
  activeRuleAcceptance = null;
  stopTransferLegSubscription?.();
  stopTransferLegSubscription = null;
  activeTransferLegs = [];
  editingTransferLegId = null;
  ['#participantProfileSummary', '#participantPaymentList', '#participantSchedule', '#participantRulesText', '#participantAnnouncementList', '#participantTransferLegList'].forEach((selector) => {
    document.querySelector(selector).replaceChildren();
  });
  document.querySelector('#participantBriefing').hidden = true;
  document.querySelector('#acceptRulesButton').hidden = true;
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
  const accepted = activeRuleAcceptance?.rulesVersion === version
    && activeRuleAcceptance?.acceptedBy === auth.currentUser?.uid;
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

document.querySelector('#participantSignOutButton').addEventListener('click', async () => {
  try {
    await signOutCrew();
  } finally {
    window.location.assign('index.html');
  }
});
document.querySelector('#acceptRulesButton').addEventListener('click', async () => {
  if (!activeBriefing || !activeInvite || !auth.currentUser) return;
  const button = document.querySelector('#acceptRulesButton');
  button.disabled = true;
  try {
    const rulesVersion = activeBriefing.rulesVersion || 1;
    const acceptance = { inviteId: activeInvite.id, acceptedBy: auth.currentUser.uid, rulesVersion, acceptedAt: serverTimestamp() };
    const batch = writeBatch(db);
    batch.set(doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id), acceptance, { merge: true });
    const historyId = `${rulesVersion}-${auth.currentUser.uid}`;
    batch.create(doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id, 'history', historyId), acceptance);
    await batch.commit();
    setMessage(document.querySelector('#participantRulesMessage'), 'Regole confermate.');
  } catch (error) {
    setMessage(document.querySelector('#participantRulesMessage'), 'Non riesco a confermare le regole. Riprova tra poco.', true);
    button.disabled = false;
  }
});

resetTransferLegForm();

transferForm().addEventListener('change', (event) => {
  if (['legKind', 'cityId', 'rideIntent', 'airlineId'].includes(event.target.name)) {
    updateTransferFormPresentation({ selectedAirportIata: event.target.name === 'cityId' ? '' : document.querySelector('#transferAirportSelect').value });
  }
});

document.querySelector('#cancelTransferLegEdit').addEventListener('click', () => {
  resetTransferLegForm();
  setMessage(document.querySelector('#transferLegMessage'), 'Modifica annullata.');
});

transferForm().addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeInvite || !auth.currentUser) return;
  const submitButton = document.querySelector('#transferLegSubmitButton');
  const message = document.querySelector('#transferLegMessage');
  submitButton.disabled = true;
  try {
    const payload = transferPayloadFromForm();
    if (editingTransferLegId) {
      await updateDoc(transferLegReference(editingTransferLegId), { ...payload, updatedAt: serverTimestamp() });
      setMessage(message, 'Tratta aggiornata.');
    } else {
      await addDoc(transferLegCollection(), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setMessage(message, 'Tratta salvata. Il tuo numero non è visibile in elenchi pubblici.');
    }
    resetTransferLegForm();
  } catch (error) {
    const text = error?.message && !String(error.message).startsWith('Missing or insufficient')
      ? error.message
      : 'Non riesco a salvare la tratta. Riprova tra poco.';
    setMessage(message, text, true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#participantTransferLegList').addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit-transfer-leg]');
  if (editButton) {
    const leg = activeTransferLegs.find((item) => item.id === editButton.dataset.editTransferLeg);
    if (leg) editTransferLeg(leg);
    return;
  }
  const deleteButton = event.target.closest('[data-delete-transfer-leg]');
  if (!deleteButton || !activeInvite || !auth.currentUser) return;
  const leg = activeTransferLegs.find((item) => item.id === deleteButton.dataset.deleteTransferLeg);
  if (!leg || !window.confirm(`Eliminare la tratta “${transferRouteLabel(leg)}”?`)) return;
  deleteButton.disabled = true;
  try {
    await deleteDoc(transferLegReference(leg.id));
    if (editingTransferLegId === leg.id) resetTransferLegForm();
    setMessage(document.querySelector('#transferLegMessage'), 'Tratta eliminata.');
  } catch (error) {
    setMessage(document.querySelector('#transferLegMessage'), 'Non riesco a eliminare la tratta. Riprova tra poco.', true);
    deleteButton.disabled = false;
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
    document.querySelector('#participantDashboard').hidden = false;
    document.querySelector('#participantTitle').textContent = member.data().displayName || invite.displayName || 'La mia area';
    document.querySelector('#editProfileButton').href = profileUrl({ edit: true });
    renderProfile(member.data());
    onSnapshot(query(collection(db, 'boats', invite.boatId, 'paymentRequests'), where('recipientId', '==', invite.id)), renderPayments, (error) => handlePrivateReadError(error, document.querySelector('#accessLinkMessage'), 'Non riesco a leggere le richieste personali.'));
    stopTransferLegSubscription?.();
    stopTransferLegSubscription = onSnapshot(transferLegCollection(), renderTransferLegs, (error) => handlePrivateReadError(error, document.querySelector('#transferLegMessage'), 'Non riesco a leggere le tue tratte.'));
    onSnapshot(doc(db, 'boats', invite.boatId, 'briefing', 'board'), (snapshot) => { activeBriefing = snapshot.exists() ? snapshot.data() : null; renderBriefing(); }, (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), 'Non riesco a leggere la bacheca di bordo.'));
    onSnapshot(query(collection(db, 'boats', invite.boatId, 'announcements'), orderBy('createdAt', 'desc')), renderAnnouncements, (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), 'Non riesco a leggere le comunicazioni.'));
    onSnapshot(doc(db, 'boats', invite.boatId, 'ruleAcceptances', invite.id), (snapshot) => { activeRuleAcceptance = snapshot.exists() ? snapshot.data() : null; renderBriefing(); }, (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), 'Non riesco a leggere la conferma delle regole.'));
  },
});

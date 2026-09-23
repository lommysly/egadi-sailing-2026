import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const EVENT_ID = 'egadi-2026';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'europe-west8');
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const hero = document.querySelector('#transferHero');
const root = document.querySelector('#transferApp');
const roleSwitch = document.querySelector('#transferRoleSwitch');

const COPY = {
  it: {
    heroEyebrow: 'Area operativa · società transfer',
    heroTitle: 'Arrivi e partenze,<br /><em>ordinati e leggibili.</em>',
    heroText: 'Questa area è riservata alla società transfer incaricata e agli organizzatori. Mostra soltanto i movimenti per i quali la persona ha dato il consenso al servizio.',
    signInEyebrow: 'Accesso protetto',
    signInTitle: 'Accedi alla gestione transfer.',
    signInText: 'Usa l’account Google già approvato oppure l’email operativa e la password ricevute dalla regia. L’accesso non è pubblico: un organizzatore abilita prima il referente della società transfer.',
    signInAction: 'Continua con Google',
    emailSignInAction: 'Accedi con email e password',
    emailLabel: 'Nome utente / email operativa',
    passwordLabel: 'Password dedicata',
    requestEyebrow: 'Richiedi l’accesso',
    requestTitle: 'Invia la richiesta alla regia del viaggio.',
    requestText: 'L’organizzatore vedrà il nome e l’email del tuo account di accesso e potrà abilitarti alla gestione dei transfer. Fino all’approvazione non vedrai alcun movimento.',
    requestAction: 'Invia richiesta di accesso',
    refreshRequest: 'Aggiorna richiesta',
    requestPendingTitle: 'Richiesta inviata.',
    requestPendingText: 'L’accesso sarà attivo solo quando un organizzatore lo approverà. Puoi lasciare questa pagina e rientrare con lo stesso account di accesso.',
    signedInAs: 'Account di accesso',
    signOut: 'Esci',
    waiting: 'Caricamento dell’area transfer…',
    organizationEyebrow: 'Regia del viaggio',
    organizationTitle: 'Gestisci gli accessi della società transfer.',
    organizationText: 'Qui crei, sospendi o elimini gli account della società transfer. Ogni referente vede soltanto i movimenti per i quali i partecipanti hanno chiesto il servizio.',
    createOperatorTitle: 'Crea o riattiva un referente transfer',
    createOperatorText: 'Scegli email e password iniziale o nuova da comunicare al referente con un canale separato. La password non verrà più mostrata qui.',
    operatorNameLabel: 'Nome del referente',
    operatorEmailLabel: 'Email operativa',
    temporaryPasswordLabel: 'Password iniziale o nuova',
    temporaryPasswordHelp: 'Almeno 12 caratteri. Per riattivare un account sospeso, usa la stessa email e imposta una nuova password provvisoria.',
    createOperator: 'Crea o riattiva accesso',
    createOperatorSuccess: 'Accesso creato o riattivato. Comunica al referente email e password con un messaggio separato.',
    createOperatorError: 'Non è stato possibile creare o riattivare l’accesso. Verifica email e password, poi riprova.',
    operatorsTitle: 'Referenti creati',
    noOperators: 'Non hai ancora creato alcun accesso transfer.',
    activeOperator: 'Accesso attivo',
    suspendedOperator: 'Accesso sospeso',
    suspend: 'Sospendi',
    suspendConfirm: 'Sospendere l’accesso di {name}? Il referente non vedrà più i movimenti, ma l’account resterà disponibile per una futura riattivazione.',
    suspendSuccess: 'Accesso sospeso. Il referente non può più vedere i movimenti.',
    revokeGoogleConfirm: 'Revocare l’accesso transfer di {name}? Il suo account Google non verrà eliminato, ma non potrà più vedere i movimenti.',
    revokeGoogleSuccess: 'Accesso Google revocato. Il referente non può più vedere i movimenti.',
    deleteOperator: 'Elimina definitivamente',
    deleteOperatorConfirm: 'Eliminare definitivamente l’account di {name}? Questa azione non può essere annullata.',
    deleteOperatorSuccess: 'Account eliminato definitivamente.',
    manageOperatorError: 'Non è stato possibile aggiornare questo accesso. Riprova tra poco.',
    requestsTitle: 'Richieste Google da approvare',
    noRequests: 'Non ci sono richieste da approvare.',
    approve: 'Approva accesso',
    revoke: 'Revoca',
    approved: 'Operatore abilitato',
    operatorEyebrow: 'Area transfer attiva',
    operatorTitle: 'Movimenti da organizzare.',
    operatorText: 'Qui compaiono solo le tratte per cui è stato richiesto il transfer con consenso. Le scelte ancora da fare restano nell’area skipper; per queste tratte puoi organizzare mezzo, punto e orario di ritrovo.',
    skipperArea: 'Torna all’area skipper',
    switchContext: 'Sei nella gestione transfer',
    records: 'movimenti',
    inbound: 'andata',
    outbound: 'ritorno',
    newStatus: 'da organizzare',
    planned: 'in pianificazione',
    confirmed: 'confermato',
    completed: 'concluso',
    cancelled: 'annullato',
    draftStatus: 'bozza',
    draftsLabel: 'bozze',
    draftNotice: 'Questa persona ha chiesto il transfer ma non ha ancora confermato il resto del viaggio: contattala per sapere se conferma.',
    whatsappContact: 'Scrivi su WhatsApp',
    allDirections: 'Tutte le tratte',
    allStatuses: 'Tutti gli stati',
    filterDirection: 'Direzione',
    filterStatus: 'Stato',
    filterSearch: 'Cerca per nome, aeroporto o volo',
    noRecords: 'Non ci sono movimenti con questi filtri.',
    direction: 'Tratta',
    dateTime: 'Data e ora',
    route: 'Percorso',
    flight: 'Volo / collegamento',
    luggage: 'Bagagli',
    contact: 'Contatto autorizzato',
    noContact: 'Nessun contatto condiviso per questo movimento.',
    status: 'Stato operativo',
    assignment: 'Assegnazione / gruppo',
    meetingPoint: 'Punto di ritrovo',
    meetingTime: 'Orario di ritrovo',
    vehicle: 'Mezzo assegnato',
    notes: 'Note operative',
    saveRecord: 'Salva aggiornamento',
    saved: 'Aggiornamento salvato.',
    saveError: 'Impossibile salvare l’aggiornamento. Riprova tra poco.',
    requestSent: 'Richiesta inviata. Ora serve l’approvazione dell’organizzatore.',
    requestError: 'Impossibile inviare la richiesta. Riprova tra poco.',
    approvalError: 'Impossibile aggiornare l’abilitazione. Riprova tra poco.',
    loadError: 'L’area transfer non è disponibile in questo momento. Riprova tra poco.',
    signInError: 'Non è stato possibile completare l’accesso Google. Riprova scegliendo l’account corretto.',
    emailSignInError: 'Email o password non corrette. Usa le credenziali dedicate ricevute dalla regia.',
    unknownRoute: 'Tratta da confermare',
    unknownDateTime: 'Orario da definire',
    sheet: 'Foglio di backup · account proprietario',
    lastUpdated: 'Aggiornato',
    accountPending: 'In attesa di approvazione',
    panelOutboundTitle: 'Andata · verso Marsala',
    panelOutboundHint: 'Persone che arrivano in aeroporto e devono raggiungere Marsala.',
    panelReturnTitle: 'Ritorno · verso l’aeroporto',
    panelReturnHint: 'Persone che partono da Marsala e devono raggiungere l’aeroporto.',
    airportUnknown: 'Aeroporto da definire',
    flightArrival: 'Orario di arrivo del volo',
    flightDeparture: 'Orario di partenza del volo',
    meetingPointPlaceholderOutbound: 'Es. Uscita Arrivi, Aeroporto di {airport}',
    meetingPointPlaceholderReturn: 'Es. Molo imbarco, Porto di Marsala',
    suggestedDepartureLabel: 'Partenza da Marsala (stimata)',
    suggestedDepartureHint: 'Include il tempo di viaggio e il margine in aeroporto: verifica sempre il traffico reale del giorno.',
    timeBandArrivalPrefix: 'Arrivo',
    timeBandDeparturePrefix: 'Partenza da Marsala',
    timeBandUnscheduled: 'Orario da definire',
  },
  en: {
    heroEyebrow: 'Operations area · transfer company',
    heroTitle: 'Arrivals and departures,<br /><em>clear and organised.</em>',
    heroText: 'This private area is for the appointed transfer company and organisers. It shows only journeys for which the traveller has consented to the service.',
    signInEyebrow: 'Protected access',
    signInTitle: 'Sign in to transfer operations.',
    signInText: 'Use the approved Google account or the operations email and password supplied by the trip coordinators. Access is not public: an organiser must first approve the transfer contact.',
    signInAction: 'Continue with Google',
    emailSignInAction: 'Sign in with email and password',
    emailLabel: 'Username / operations email',
    passwordLabel: 'Dedicated password',
    requestEyebrow: 'Request access',
    requestTitle: 'Send a request to the trip organisers.',
    requestText: 'The organiser will see the name and email on your access account and can enable access to transfer operations. You cannot see journeys before approval.',
    requestAction: 'Send access request',
    refreshRequest: 'Update request',
    requestPendingTitle: 'Request sent.',
    requestPendingText: 'Access becomes active only after organiser approval. You can return with the same access account.',
    signedInAs: 'Access account',
    signOut: 'Sign out',
    waiting: 'Loading the transfer area…',
    organizationEyebrow: 'Trip coordination',
    organizationTitle: 'Manage transfer company access.',
    organizationText: 'Create, suspend or delete transfer-company accounts here. Each contact sees only journeys for which travellers requested the service.',
    createOperatorTitle: 'Create or reactivate a transfer contact',
    createOperatorText: 'Choose the email and initial or new password to send to the contact through a separate channel. The password will not be shown here again.',
    operatorNameLabel: 'Contact name',
    operatorEmailLabel: 'Operations email',
    temporaryPasswordLabel: 'Initial or new password',
    temporaryPasswordHelp: 'At least 12 characters. To reactivate a suspended account, use the same email and set a new temporary password.',
    createOperator: 'Create or reactivate access',
    createOperatorSuccess: 'Access created or reactivated. Send the contact the email and password through a separate message.',
    createOperatorError: 'The access could not be created or reactivated. Check the email and password, then try again.',
    operatorsTitle: 'Created contacts',
    noOperators: 'You have not created any transfer access yet.',
    activeOperator: 'Access active',
    suspendedOperator: 'Access suspended',
    suspend: 'Suspend',
    suspendConfirm: 'Suspend {name}’s access? The contact will no longer see journeys, but the account will remain available for future reactivation.',
    suspendSuccess: 'Access suspended. The contact can no longer see journeys.',
    revokeGoogleConfirm: 'Revoke {name}’s transfer access? Their Google account will not be deleted, but they will no longer see journeys.',
    revokeGoogleSuccess: 'Google access revoked. The contact can no longer see journeys.',
    deleteOperator: 'Delete permanently',
    deleteOperatorConfirm: 'Permanently delete {name}’s account? This action cannot be undone.',
    deleteOperatorSuccess: 'Account deleted permanently.',
    manageOperatorError: 'This access could not be updated. Please try again shortly.',
    requestsTitle: 'Google access requests',
    noRequests: 'There are no access requests to approve.',
    approve: 'Approve access',
    revoke: 'Revoke',
    approved: 'Operator enabled',
    operatorEyebrow: 'Transfer area active',
    operatorTitle: 'Journeys to arrange.',
    operatorText: 'Only journeys with a transfer request and consent appear here. Choices still to be made remain in the skipper area; use this page to organise the vehicle, meeting point and time.',
    skipperArea: 'Back to skipper area',
    switchContext: 'You are managing transfers',
    records: 'journeys',
    inbound: 'outbound',
    outbound: 'return',
    newStatus: 'to arrange',
    planned: 'planning',
    confirmed: 'confirmed',
    completed: 'completed',
    cancelled: 'cancelled',
    draftStatus: 'draft',
    draftsLabel: 'drafts',
    draftNotice: 'This person requested the transfer but has not confirmed the rest of the journey yet — contact them to check.',
    whatsappContact: 'Message on WhatsApp',
    allDirections: 'All directions',
    allStatuses: 'All statuses',
    filterDirection: 'Direction',
    filterStatus: 'Status',
    filterSearch: 'Search name, airport or flight',
    noRecords: 'There are no journeys matching these filters.',
    direction: 'Journey',
    dateTime: 'Date and time',
    route: 'Route',
    flight: 'Flight / connection',
    luggage: 'Luggage',
    contact: 'Approved contact',
    noContact: 'No contact has been shared for this journey.',
    status: 'Operational status',
    assignment: 'Assignment / group',
    meetingPoint: 'Meeting point',
    meetingTime: 'Meeting time',
    vehicle: 'Assigned vehicle',
    notes: 'Operational notes',
    saveRecord: 'Save update',
    saved: 'Update saved.',
    saveError: 'The update could not be saved. Please try again shortly.',
    requestSent: 'Request sent. It now needs organiser approval.',
    requestError: 'The request could not be sent. Please try again shortly.',
    approvalError: 'The access setting could not be updated. Please try again shortly.',
    loadError: 'The transfer area is not available right now. Please try again shortly.',
    signInError: 'Google sign-in could not be completed. Please choose the correct account and try again.',
    emailSignInError: 'The email or password is incorrect. Use the dedicated credentials provided by the trip coordinators.',
    unknownRoute: 'Route to be confirmed',
    unknownDateTime: 'Time to be defined',
    sheet: 'Backup sheet · owner account',
    lastUpdated: 'Updated',
    accountPending: 'Waiting for approval',
    panelOutboundTitle: 'Outbound · to Marsala',
    panelOutboundHint: 'People landing at the airport who need to reach Marsala.',
    panelReturnTitle: 'Return · to the airport',
    panelReturnHint: 'People leaving Marsala who need to reach the airport.',
    airportUnknown: 'Airport to be defined',
    flightArrival: 'Flight arrival time',
    flightDeparture: 'Flight departure time',
    meetingPointPlaceholderOutbound: 'E.g. Arrivals exit, {airport} Airport',
    meetingPointPlaceholderReturn: 'E.g. Boarding pontoon, Port of Marsala',
    suggestedDepartureLabel: 'Departure from Marsala (estimated)',
    suggestedDepartureHint: 'Includes travel time and the airport margin: always check the real traffic on the day.',
    timeBandArrivalPrefix: 'Arrival',
    timeBandDeparturePrefix: 'Departure from Marsala',
    timeBandUnscheduled: 'Time to be defined',
  },
};

const state = {
  user: null,
  event: null,
  isOrganizer: false,
  hasSkipperBoat: false,
  operator: null,
  accessRequest: null,
  accessRequests: [],
  transferOperators: [],
  records: [],
  loading: true,
  error: '',
  filters: { direction: 'all', status: 'all', search: '' },
  unsubs: [],
};

function locale() {
  return window.EgadiI18n?.getLocale?.() === 'en' ? 'en' : 'it';
}

function t(key) {
  return COPY[locale()][key] || COPY.en[key] || key;
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character]));
}

function text(value, maxLength = 180) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function optionalTime(value) {
  const normalized = text(value, 5);
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(normalized) ? normalized : '';
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatDateTime(value) {
  const date = dateValue(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(locale() === 'en' ? 'en-GB' : 'it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatSchedule(record) {
  const date = text(record.transferDate || record.date || record.arrivalDate || record.departureDate, 32);
  const time = optionalTime(record.transferTime || record.time || record.arrivalTime || record.departureTime);
  return [date, time].filter(Boolean).join(' · ') || t('unknownDateTime');
}

function normalizeDirection(value) {
  const normalized = text(value, 40).toLowerCase();
  if (['outbound', 'andata', 'arrival', 'arrivo', 'to_marsala', 'airport_to_marsala'].includes(normalized)) return 'outbound';
  if (['return', 'ritorno', 'departure', 'partenza', 'from_marsala', 'marsala_to_airport'].includes(normalized)) return 'return';
  return '';
}

function directionLabel(value) {
  const normalized = normalizeDirection(value);
  return normalized === 'return' ? t('outbound') : normalized === 'outbound' ? t('inbound') : t('unknownRoute');
}

function normalizedStatus(value) {
  const normalized = text(value, 40).toLowerCase();
  if (['new', 'new_request', 'to_arrange', 'pending'].includes(normalized)) return 'new';
  if (['planned', 'planning', 'assigned'].includes(normalized)) return 'planned';
  if (['confirmed', 'confirm'].includes(normalized)) return 'confirmed';
  if (['completed', 'done'].includes(normalized)) return 'completed';
  if (['cancelled', 'canceled', 'revoked'].includes(normalized)) return 'cancelled';
  return 'new';
}

const STATUS_LABEL_KEYS = {
  draft: 'draftStatus',
  new: 'newStatus',
  planned: 'planned',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
};

// "draft" non è uno stato operativo che l'operatore può scegliere (viene dal
// viaggio della persona, non da un'azione della società transfer): va
// riconosciuto così com'è, senza passare da normalizedStatus che non lo
// conosce e lo farebbe ricadere su "new".
function statusLabel(value) {
  const key = STATUS_LABEL_KEYS[value] ? value : normalizedStatus(value);
  return t(STATUS_LABEL_KEYS[key]);
}

// Bozza = la persona ha chiesto il transfer (consenso dato) ma non ha ancora
// confermato il resto del suo viaggio: è un'informazione sul viaggio, non
// sullo stato operativo che l'operatore imposta, quindi ha priorità visiva
// ma non sostituisce mai record.status nel form di modifica.
function recordStatusKey(record) {
  return record.legState === 'draft' ? 'draft' : normalizedStatus(record.status);
}

// Nomi conosciuti per i due soli aeroporti del servizio: rende la tratta e i
// raggruppamenti leggibili subito, invece del solo codice IATA (TPS/PMO).
const AIRPORT_NAMES = { TPS: 'Trapani', PMO: 'Palermo' };

function airportCode(record) {
  return text(record.airport, 4).toUpperCase();
}

function airportLabel(code) {
  const upper = text(code, 4).toUpperCase();
  if (!upper) return t('airportUnknown');
  return AIRPORT_NAMES[upper] ? `${AIRPORT_NAMES[upper]} (${upper})` : upper;
}

function routeLabel(record) {
  const declared = text(record.routeLabel || record.route || record.transferRoute, 180);
  if (declared) return declared;
  const origin = text(record.originLabel || record.origin || record.originAirportName || record.originAirport || record.from, 100);
  const destination = text(record.destinationLabel || record.destination || record.destinationAirportName || record.destinationAirport || record.to, 100);
  if (origin || destination) return [origin, destination].filter(Boolean).join(' → ');
  const airport = airportCode(record);
  const direction = normalizeDirection(record.direction || record.legDirection || record.travelDirection);
  if (airport && direction === 'outbound') return `${airportLabel(airport)} → Marsala`;
  if (airport && direction === 'return') return `Marsala → ${airportLabel(airport)}`;
  return t('unknownRoute');
}

function participantName(record) {
  return text(record.participantName || record.displayName || record.contactName || record.name, 120) || '—';
}

function contactPhone(record) {
  return text(record.contactPhone || record.phone || record.whatsappNumber, 40);
}

function contactEmail(record) {
  return text(record.contactEmail || record.email, 160);
}

function recordFlight(record) {
  return text(record.flight || record.flightNumber || record.serviceNumber || record.carrier, 120);
}

function recordLuggage(record) {
  const count = record.luggageCount;
  const bulky = record.bulkyLuggage === true;
  const values = [];
  if (Number.isFinite(Number(count))) values.push(`${Number(count)} ${locale() === 'en' ? 'items' : 'colli'}`);
  if (bulky) values.push(locale() === 'en' ? 'bulky luggage' : 'bagaglio ingombrante');
  return values.join(' · ') || '—';
}

function safeSheetUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function clearSubscriptions() {
  state.unsubs.forEach((unsubscribe) => unsubscribe());
  state.unsubs = [];
}

function displayMessage(id, message, error = false) {
  const target = [...document.querySelectorAll('[data-message]')]
    .find((candidate) => candidate.dataset.message === id);
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('is-error', error);
}

function renderHero() {
  hero.innerHTML = `<p class="eyebrow">${escapeHtml(t('heroEyebrow'))}</p><h1>${t('heroTitle')}</h1><p>${escapeHtml(t('heroText'))}</p>`;
}

function renderLoading() {
  root.innerHTML = `<article class="transfer-operator-card"><p class="eyebrow">Egadi Sailing Experience</p><h2>${escapeHtml(t('waiting'))}</h2></article>`;
}

function renderSignedInAccount() {
  if (!state.user) return '';
  return `<div class="transfer-operator-notice"><span class="transfer-operator-notice-icon" aria-hidden="true">✓</span><div><strong>${escapeHtml(t('signedInAs'))}</strong><span>${escapeHtml(state.user.displayName || state.user.email || '')}</span></div></div><div class="transfer-operator-actions"><button class="button button-ghost" type="button" data-action="sign-out">${escapeHtml(t('signOut'))}</button></div>`;
}

function renderSignIn() {
  root.innerHTML = `<article class="transfer-operator-card"><p class="eyebrow">${escapeHtml(t('signInEyebrow'))}</p><h2>${escapeHtml(t('signInTitle'))}</h2><p>${escapeHtml(t('signInText'))}</p><form class="compact-form" data-transfer-email-login><label><span>${escapeHtml(t('emailLabel'))}</span><input name="email" type="email" required autocomplete="username" inputmode="email" maxlength="160" /></label><label><span>${escapeHtml(t('passwordLabel'))}</span><input name="password" type="password" required autocomplete="current-password" minlength="6" /></label><button class="button button-primary" type="submit">${escapeHtml(t('emailSignInAction'))}</button></form><div class="transfer-operator-actions"><button class="button button-ghost" type="button" data-action="sign-in">${escapeHtml(t('signInAction'))}</button></div><p class="form-message" data-message="main" role="status"></p></article>`;
}

function renderAccessRequest() {
  const requested = Boolean(state.accessRequest);
  root.innerHTML = `<article class="transfer-operator-card"><p class="eyebrow">${escapeHtml(t('requestEyebrow'))}</p><h2>${escapeHtml(requested ? t('requestPendingTitle') : t('requestTitle'))}</h2><p>${escapeHtml(requested ? t('requestPendingText') : t('requestText'))}</p>${renderSignedInAccount()}<div class="transfer-operator-actions"><button class="button button-primary" type="button" data-action="request-access">${escapeHtml(requested ? t('refreshRequest') : t('requestAction'))}</button></div><p class="form-message" data-message="main" role="status"></p></article>`;
}

function requestRole(request) {
  return state.transferOperators.find((operator) => operator.id === request.id) || null;
}

function operatorName(operator) {
  return text(operator?.name, 120)
    || text(operator?.email, 160).split('@')[0]
    || '—';
}

function operatorEmail(operator) {
  return text(operator?.email, 160) || '—';
}

function managedOperators() {
  return [...state.transferOperators]
    .filter((operator) => operator?.role === 'transfer_operator' && operator.accessMode === 'managed_password')
    .sort((left, right) => (dateValue(right.updatedAt)?.getTime() || 0) - (dateValue(left.updatedAt)?.getTime() || 0));
}

function renderAccessRequestRow(request) {
  const role = requestRole(request);
  const updated = formatDateTime(request.updatedAt);
  const name = text(request.name, 120) || '—';
  const email = text(request.email, 160) || '—';
  const active = role?.active === true;
  const action = active
    ? `<button class="button button-ghost" type="button" data-action="revoke-google-access" data-request-id="${escapeHtml(request.id)}" data-operator-name="${escapeHtml(name)}">${escapeHtml(t('revoke'))}</button>`
    : `<button class="button button-primary" type="button" data-action="approve-access" data-request-id="${escapeHtml(request.id)}">${escapeHtml(t('approve'))}</button>`;
  return `<article class="transfer-access-request"><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(email)}${updated ? ` · ${escapeHtml(t('lastUpdated'))}: ${escapeHtml(updated)}` : ''}${active ? ` · ${escapeHtml(t('approved'))}` : ''}</span></div><div class="transfer-access-request-actions">${action}</div></article>`;
}

function renderManagedOperatorRow(operator) {
  const name = operatorName(operator);
  const email = operatorEmail(operator);
  const active = operator.active === true;
  const updated = formatDateTime(operator.updatedAt || operator.approvedAt);
  const status = active ? t('activeOperator') : t('suspendedOperator');
  const actions = active
    ? `<button class="button button-ghost" type="button" data-action="suspend-operator" data-operator-id="${escapeHtml(operator.id)}" data-operator-name="${escapeHtml(name)}">${escapeHtml(t('suspend'))}</button>`
    : '';
  return `<article class="transfer-access-request"><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(email)} · ${escapeHtml(status)}${updated ? ` · ${escapeHtml(t('lastUpdated'))}: ${escapeHtml(updated)}` : ''}</span></div><div class="transfer-access-request-actions">${actions}<button class="button button-ghost" type="button" data-action="delete-operator" data-operator-id="${escapeHtml(operator.id)}" data-operator-name="${escapeHtml(name)}">${escapeHtml(t('deleteOperator'))}</button></div></article>`;
}

function renderOperatorCreationForm() {
  return `<form class="transfer-operator-create-form" data-create-transfer-operator><label><span>${escapeHtml(t('operatorNameLabel'))}</span><input name="name" type="text" required autocomplete="name" maxlength="120" /></label><label><span>${escapeHtml(t('operatorEmailLabel'))}</span><input name="email" type="email" required autocomplete="username" inputmode="email" maxlength="160" /></label><label data-wide><span>${escapeHtml(t('temporaryPasswordLabel'))}</span><input name="temporaryPassword" type="password" required autocomplete="new-password" minlength="12" maxlength="128" aria-describedby="temporary-password-help" /><small id="temporary-password-help">${escapeHtml(t('temporaryPasswordHelp'))}</small></label><div class="form-actions"><button class="button button-primary" type="submit">${escapeHtml(t('createOperator'))}</button><p class="form-message" data-message="operator-create" role="status"></p></div></form>`;
}

function renderAccessManagement() {
  const operators = managedOperators();
  const requests = [...state.accessRequests]
    .filter((request) => requestRole(request)?.accessMode !== 'managed_password')
    .sort((a, b) => (dateValue(b.updatedAt)?.getTime() || 0) - (dateValue(a.updatedAt)?.getTime() || 0));
  return `<section class="transfer-operator-card"><p class="eyebrow">${escapeHtml(t('organizationEyebrow'))}</p><h2>${escapeHtml(t('organizationTitle'))}</h2><p>${escapeHtml(t('organizationText'))}</p><div class="transfer-operator-management-section"><h3>${escapeHtml(t('createOperatorTitle'))}</h3><p>${escapeHtml(t('createOperatorText'))}</p>${renderOperatorCreationForm()}</div><div class="transfer-operator-management-section"><h3>${escapeHtml(t('operatorsTitle'))}</h3><div class="transfer-request-list">${operators.length ? operators.map(renderManagedOperatorRow).join('') : `<p class="transfer-empty">${escapeHtml(t('noOperators'))}</p>`}</div></div><div class="transfer-operator-management-section"><h3>${escapeHtml(t('requestsTitle'))}</h3><div class="transfer-request-list">${requests.length ? requests.map(renderAccessRequestRow).join('') : `<p class="transfer-empty">${escapeHtml(t('noRequests'))}</p>`}</div></div><p class="form-message" data-message="access-management" role="status"></p></section>`;
}

function recordMatchesFilters(record) {
  // Un record "revoked" nasce da una tratta non ancora confermata (bozza) o
  // per cui la persona non ha chiesto il transfer organizzato: i campi sono
  // sempre vuoti (vedi markTransferRequestRevoked in functions/index.js), non
  // c'è nulla da mostrare né da organizzare. Va escluso qui, non solo dal
  // filtro stato, perché altrimenti compare comunque con "Tutti gli stati".
  if (record.recordState && record.recordState !== 'active') return false;
  const { direction, status, search } = state.filters;
  const recordDirection = normalizeDirection(record.direction || record.legDirection || record.travelDirection);
  const recordStatus = recordStatusKey(record);
  if (direction !== 'all' && direction !== recordDirection) return false;
  if (status !== 'all' && status !== recordStatus) return false;
  if (!search) return true;
  const haystack = [participantName(record), routeLabel(record), recordFlight(record), contactPhone(record), contactEmail(record)]
    .join(' ')
    .toLocaleLowerCase();
  return haystack.includes(search.toLocaleLowerCase());
}

const OPERATIONAL_STATUSES = ['new', 'planned', 'confirmed', 'completed', 'cancelled'];
// "draft" compare solo nel filtro dell'elenco, mai nel form di modifica di un
// singolo movimento: l'operatore non "imposta" una bozza, la osserva.
const FILTERABLE_STATUSES = ['draft', ...OPERATIONAL_STATUSES];

function statusOptions(selected, options = OPERATIONAL_STATUSES) {
  const current = options.includes(selected) ? selected : '';
  return options
    .map((value) => `<option value="${value}"${value === current ? ' selected' : ''}>${escapeHtml(statusLabel(value))}</option>`)
    .join('');
}

function recordContactMarkup(record) {
  const phone = contactPhone(record);
  const email = contactEmail(record);
  if (!phone && !email) return escapeHtml(t('noContact'));
  const items = [];
  if (phone) items.push(`<a href="tel:${escapeHtml(phone.replace(/[^+0-9]/g, ''))}">${escapeHtml(phone)}</a>`);
  if (email) items.push(`<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`);
  return items.join('<br />');
}

function recordDetail(label, value, className = '') {
  return `<div${className ? ` class="${className}"` : ''}><dt>${escapeHtml(label)}</dt><dd>${value || '—'}</dd></div>`;
}

function whatsappUrl(phone) {
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

function renderDraftNotice(record) {
  if (record.legState !== 'draft') return '';
  const phone = contactPhone(record);
  const waUrl = phone ? whatsappUrl(phone) : '';
  const action = waUrl ? ` <a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener">${escapeHtml(t('whatsappContact'))}</a>` : '';
  return `<p class="transfer-record-draft-notice">${escapeHtml(t('draftNotice'))}${action}</p>`;
}

function renderRecord(record) {
  const direction = normalizeDirection(record.direction || record.legDirection || record.travelDirection);
  const operationalStatus = normalizedStatus(record.status);
  const displayStatus = recordStatusKey(record);
  const assignment = text(record.assignment || record.operatorAssignment || record.groupName, 120);
  const meetingPoint = text(record.meetingPoint, 160);
  const meetingTime = optionalTime(record.meetingTime);
  const vehicleName = text(record.vehicleName || record.assignedVehicle || record.vehicle, 120);
  const notes = text(record.operatorNotes || record.notes, 500);
  const recordId = escapeHtml(record.id);
  const directionClass = direction || 'unknown';
  // L'orario salvato sul movimento è quello del volo (arrivo per l'andata,
  // partenza per il ritorno): l'etichetta lo dice esplicitamente, altrimenti
  // si presta a essere letta come l'orario di ritrovo del transfer.
  const scheduleLabel = direction === 'return' ? t('flightDeparture') : t('flightArrival');
  const meetingPointPlaceholder = direction === 'return'
    ? t('meetingPointPlaceholderReturn')
    : t('meetingPointPlaceholderOutbound').replace('{airport}', airportLabel(airportCode(record)));
  const suggestedDeparture = direction === 'return' ? suggestedMarsalaDeparture(record) : '';
  const suggestedDepartureDetail = suggestedDeparture
    ? recordDetail(t('suggestedDepartureLabel'), `${escapeHtml(suggestedDeparture)}<small>${escapeHtml(t('suggestedDepartureHint'))}</small>`)
    : '';
  return `<details class="transfer-record" data-record-id="${recordId}"><summary><span class="transfer-record-summary-copy"><strong>${escapeHtml(participantName(record))}</strong><span>${escapeHtml(routeLabel(record))} · ${escapeHtml(formatSchedule(record))}</span></span><span class="transfer-record-badges"><span class="transfer-badge transfer-badge--${directionClass}">${escapeHtml(directionLabel(direction))}</span><span class="transfer-badge transfer-badge--${escapeHtml(displayStatus)}">${escapeHtml(statusLabel(displayStatus))}</span></span></summary><div class="transfer-record-body">${renderDraftNotice(record)}<dl class="transfer-record-details">${recordDetail(t('direction'), escapeHtml(directionLabel(direction)))}${recordDetail(scheduleLabel, escapeHtml(formatSchedule(record)))}${suggestedDepartureDetail}${recordDetail(t('route'), escapeHtml(routeLabel(record)))}${recordDetail(t('flight'), escapeHtml(recordFlight(record)))}${recordDetail(t('luggage'), escapeHtml(recordLuggage(record)))}${recordDetail(t('contact'), recordContactMarkup(record), 'transfer-record-contact')}</dl><form class="transfer-record-form" data-record-form="${recordId}"><label><span>${escapeHtml(t('status'))}</span><select name="status">${statusOptions(operationalStatus)}</select></label><label><span>${escapeHtml(t('assignment'))}</span><input name="assignment" maxlength="120" value="${escapeHtml(assignment)}" /></label><label><span>${escapeHtml(t('meetingPoint'))}</span><input name="meetingPoint" maxlength="160" value="${escapeHtml(meetingPoint)}" placeholder="${escapeHtml(meetingPointPlaceholder)}" /></label><label><span>${escapeHtml(t('meetingTime'))}</span><input name="meetingTime" type="time" value="${escapeHtml(meetingTime)}" /></label><label data-wide><span>${escapeHtml(t('vehicle'))}</span><input name="vehicleName" maxlength="120" value="${escapeHtml(vehicleName)}" /></label><label data-wide><span>${escapeHtml(t('notes'))}</span><textarea name="operatorNotes" maxlength="500">${escapeHtml(notes)}</textarea></label><div class="form-actions"><button class="button button-primary" type="submit">${escapeHtml(t('saveRecord'))}</button><p class="form-message" data-message="record-${recordId}" role="status"></p></div></form></div></details>`;
}

// Tempi di percorrenza Marsala↔aeroporto e margine di arrivo, confermati dal
// titolare il 22/09/2026: servono a calcolare a che ora il van deve partire
// da Marsala per un ritorno, non solo a che ora è il volo. Sono stime, non
// promesse: il traffico reale può sempre cambiarle.
const TRANSFER_TRAVEL_MINUTES = { TPS: 45, PMO: 105 };
const AIRPORT_BUFFER_WITH_CHECKED_BAG_MINUTES = 90;
const AIRPORT_BUFFER_HAND_LUGGAGE_MINUTES = 60;
// Oltre questo intervallo fra un orario e il successivo (già ordinati), la
// persona apre una nuova fascia: due voli/partenze vicini nel tempo vanno
// nello stesso van, uno lontano nel tempo no.
const TIME_BAND_GAP_MINUTES = 90;
// Sotto questa soglia di persone in un gruppo aeroporto, le fasce orarie non
// aggiungono nulla e sono solo un titolo in più da leggere: si mostra la
// lista piatta come prima, esattamente come per una barca piccola oggi.
const TIME_BAND_MIN_GROUP_SIZE = 6;

function timeToMinutes(hhmm) {
  const normalized = optionalTime(hhmm);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Solo per il ritorno: a che ora il van deve lasciare Marsala perché la
// persona arrivi in aeroporto col margine giusto, calcolato all'indietro
// dall'orario del volo. Il bagaglio in stiva richiede più margine di un
// bagaglio a mano (imbarco più lento), come indicato dal titolare.
function suggestedMarsalaDeparture(record) {
  const airport = airportCode(record);
  const travelMinutes = TRANSFER_TRAVEL_MINUTES[airport];
  const flightMinutes = timeToMinutes(record.time || record.departureTime);
  if (!travelMinutes || flightMinutes === null) return '';
  const bufferMinutes = Number(record.luggageCount) > 0
    ? AIRPORT_BUFFER_WITH_CHECKED_BAG_MINUTES
    : AIRPORT_BUFFER_HAND_LUGGAGE_MINUTES;
  return minutesToTime(flightMinutes - travelMinutes - bufferMinutes);
}

// Chiave usata per ordinare e raggruppare per fascia oraria: per l'andata è
// l'orario di arrivo del volo (quando la persona è pronta al ritiro), per il
// ritorno è l'orario di partenza da Marsala calcolato sopra, non l'orario del
// volo — altrimenti due voli vicini ma con bagagli diversi finirebbero in
// fasce sbagliate rispetto a quando il van deve davvero muoversi.
function recordClusterMinutes(record, direction) {
  if (direction === 'return') {
    const suggested = suggestedMarsalaDeparture(record);
    return suggested ? timeToMinutes(suggested) : timeToMinutes(record.time);
  }
  return timeToMinutes(record.time);
}

// Fasce dinamiche invece di orari fissi (es. "12-14"): due persone vicine nel
// tempo restano insieme anche a cavallo di un'ora tonda, una lontana apre una
// fascia nuova. Più utile per organizzare un singolo van/pullman per fascia.
function groupByTimeBand(records, direction) {
  const withTime = records
    .map((record) => ({ record, minutes: recordClusterMinutes(record, direction) }))
    .filter((entry) => entry.minutes !== null)
    .sort((left, right) => left.minutes - right.minutes);
  const withoutTime = records.filter((record) => recordClusterMinutes(record, direction) === null);
  const bands = [];
  withTime.forEach((entry) => {
    const currentBand = bands[bands.length - 1];
    if (currentBand && entry.minutes - currentBand.maxMinutes <= TIME_BAND_GAP_MINUTES) {
      currentBand.records.push(entry.record);
      currentBand.maxMinutes = entry.minutes;
    } else {
      bands.push({ records: [entry.record], minMinutes: entry.minutes, maxMinutes: entry.minutes });
    }
  });
  if (withoutTime.length) bands.push({ records: withoutTime, minMinutes: null, maxMinutes: null });
  return bands;
}

function timeBandTitle(band, direction) {
  if (band.minMinutes === null) return t('timeBandUnscheduled');
  const prefix = direction === 'return' ? t('timeBandDeparturePrefix') : t('timeBandArrivalPrefix');
  const range = band.minMinutes === band.maxMinutes
    ? minutesToTime(band.minMinutes)
    : `${minutesToTime(band.minMinutes)}–${minutesToTime(band.maxMinutes)}`;
  return `${prefix} ${range}`;
}

// Un solo elenco misto (andata, ritorno, andata, ritorno...) obbliga a
// leggere ogni riga per capire di cosa si tratta. Due pannelli fissi, ognuno
// diviso per aeroporto, riflettono come si organizza davvero un transfer:
// un furgone per Trapani, uno per Palermo, andata e ritorno separati.
function groupByAirport(records) {
  const groups = new Map();
  records.forEach((record) => {
    const code = airportCode(record) || 'UNKNOWN';
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(record);
  });
  const order = ['TPS', 'PMO'];
  return [...groups.entries()].sort(([left], [right]) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

function renderAirportGroupBody(groupRecords, direction) {
  if (groupRecords.length <= TIME_BAND_MIN_GROUP_SIZE) {
    return `<div class="transfer-operator-list">${groupRecords.map(renderRecord).join('')}</div>`;
  }
  return groupByTimeBand(groupRecords, direction).map((band) => `<div class="transfer-time-band"><h4 class="transfer-time-band-title">${escapeHtml(timeBandTitle(band, direction))}<span>${band.records.length}</span></h4><div class="transfer-operator-list">${band.records.map(renderRecord).join('')}</div></div>`).join('');
}

function renderDirectionPanel(direction, records) {
  const title = direction === 'return' ? t('panelReturnTitle') : t('panelOutboundTitle');
  const hint = direction === 'return' ? t('panelReturnHint') : t('panelOutboundHint');
  const groups = groupByAirport(records);
  const body = groups.length
    ? groups.map(([code, groupRecords]) => `<div class="transfer-airport-group"><h3 class="transfer-airport-group-title">${escapeHtml(airportLabel(code))}<span>${groupRecords.length}</span></h3>${renderAirportGroupBody(groupRecords, direction)}</div>`).join('')
    : `<p class="transfer-empty">${escapeHtml(t('noRecords'))}</p>`;
  return `<section class="transfer-direction-panel"><h2>${escapeHtml(title)}<span class="transfer-direction-panel-count">${records.length}</span></h2><p class="field-hint">${escapeHtml(hint)}</p>${body}</section>`;
}

function renderGroupedRecords(filtered) {
  const outboundRecords = filtered.filter((record) => normalizeDirection(record.direction || record.legDirection || record.travelDirection) === 'outbound');
  const returnRecords = filtered.filter((record) => normalizeDirection(record.direction || record.legDirection || record.travelDirection) === 'return');
  return renderDirectionPanel('outbound', outboundRecords) + renderDirectionPanel('return', returnRecords);
}

function recordStats(records) {
  // Stesso filtro di recordMatchesFilters per lo stato del record: un
  // movimento revocato (bozza mai confermata) non deve gonfiare il totale,
  // altrimenti il riepilogo non corrisponde a ciò che si vede sotto.
  const active = records.filter((record) => !record.recordState || record.recordState === 'active');
  return {
    total: active.length,
    outbound: active.filter((record) => normalizeDirection(record.direction || record.legDirection || record.travelDirection) === 'outbound').length,
    return: active.filter((record) => normalizeDirection(record.direction || record.legDirection || record.travelDirection) === 'return').length,
    pending: active.filter((record) => ['new', 'planned'].includes(normalizedStatus(record.status))).length,
    drafts: active.filter((record) => record.legState === 'draft').length,
  };
}

function renderOperatorDashboard() {
  const filtered = state.records.filter(recordMatchesFilters);
  const stats = recordStats(state.records);
  const sheetUrl = state.isOrganizer ? safeSheetUrl(state.event?.transferSheetUrl) : '';
  root.innerHTML = `<section class="transfer-operator-toolbar"><div><p class="eyebrow">${escapeHtml(t('operatorEyebrow'))}</p><h2>${escapeHtml(t('operatorTitle'))}</h2><p>${escapeHtml(t('operatorText'))}</p>${sheetUrl ? `<p><a class="transfer-sheet-link" href="${escapeHtml(sheetUrl)}" target="_blank" rel="noopener">${escapeHtml(t('sheet'))}</a></p>` : ''}</div><div class="transfer-operator-actions"><button class="button button-light" type="button" data-action="sign-out">${escapeHtml(t('signOut'))}</button></div></section><section class="transfer-operator-summary" aria-label="Riepilogo movimenti"><article><span>${escapeHtml(t('records'))}</span><strong>${stats.total}</strong></article><article><span>${escapeHtml(t('inbound'))}</span><strong>${stats.outbound}</strong></article><article><span>${escapeHtml(t('outbound'))}</span><strong>${stats.return}</strong></article><article><span>${escapeHtml(t('newStatus'))}</span><strong>${stats.pending}</strong></article><article><span>${escapeHtml(t('draftsLabel'))}</span><strong>${stats.drafts}</strong></article></section><section class="transfer-operator-card"><form class="transfer-operator-filters" data-filter-form><label><span>${escapeHtml(t('filterStatus'))}</span><select name="status"><option value="all">${escapeHtml(t('allStatuses'))}</option>${statusOptions(state.filters.status, FILTERABLE_STATUSES)}</select></label><label><span>${escapeHtml(t('filterSearch'))}</span><input name="search" type="search" value="${escapeHtml(state.filters.search)}" autocomplete="off" /></label></form></section><div class="transfer-operator-groups">${renderGroupedRecords(filtered)}</div>${state.isOrganizer ? renderAccessManagement() : ''}`;
}

function renderRoleSwitch() {
  if (!roleSwitch) return;
  roleSwitch.hidden = !state.user || !state.hasSkipperBoat;
  if (roleSwitch.hidden) {
    roleSwitch.replaceChildren();
    return;
  }
  roleSwitch.innerHTML = `<span>${escapeHtml(t('switchContext'))}</span><a class="button button-ghost" href="area.html?lang=${escapeHtml(locale())}#skipper-equipaggio">← ${escapeHtml(t('skipperArea'))}</a>`;
}

function renderRecordListOnly() {
  const groups = root.querySelector('.transfer-operator-groups');
  if (!groups) return;
  const filtered = state.records.filter(recordMatchesFilters);
  groups.innerHTML = renderGroupedRecords(filtered);
}

function render() {
  renderHero();
  renderRoleSwitch();
  if (state.loading) {
    renderLoading();
    return;
  }
  if (!state.user) {
    renderSignIn();
    return;
  }
  if (state.error) {
    root.innerHTML = `<article class="transfer-operator-card"><p class="eyebrow">Egadi Sailing Experience</p><h2>${escapeHtml(t('loadError'))}</h2><p>${escapeHtml(state.error)}</p>${renderSignedInAccount()}</article>`;
    return;
  }
  if (state.isOrganizer || state.operator?.active === true) {
    renderOperatorDashboard();
    return;
  }
  renderAccessRequest();
}

function sortByUpdatedAt(documents) {
  return [...documents].sort((left, right) => (dateValue(right.updatedAt)?.getTime() || 0) - (dateValue(left.updatedAt)?.getTime() || 0));
}

function listenToPrivateData() {
  clearSubscriptions();
  if (!state.user) return;

  // L'abilitazione personale viene osservata anche quando la richiesta è in
  // attesa: l'operatore vede l'area attiva senza dover ricaricare la pagina.
  if (!state.isOrganizer) {
    const ownRoleRef = doc(db, 'events', EVENT_ID, 'transferOperators', state.user.uid);
    state.unsubs.push(onSnapshot(ownRoleRef, (snapshot) => {
      const wasActive = state.operator?.active === true;
      const nextOperator = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      const isActive = nextOperator?.active === true;
      state.operator = nextOperator;
      if (wasActive !== isActive) {
        if (!isActive) state.records = [];
        listenToPrivateData();
        render();
      }
    }, () => {
      state.error = t('loadError');
      render();
    }));
  }

  if (!state.isOrganizer && state.operator?.active !== true) return;

  const recordsRef = collection(db, 'events', EVENT_ID, 'transferOpsRecords');
  state.unsubs.push(onSnapshot(recordsRef, (snapshot) => {
    state.records = sortByUpdatedAt(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    render();
  }, () => {
    state.error = t('loadError');
    render();
  }));

  if (!state.isOrganizer) return;
  const requestsRef = collection(db, 'events', EVENT_ID, 'transferAccessRequests');
  const operatorsRef = collection(db, 'events', EVENT_ID, 'transferOperators');
  state.unsubs.push(onSnapshot(requestsRef, (snapshot) => {
    state.accessRequests = sortByUpdatedAt(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    render();
  }, () => {
    state.error = t('loadError');
    render();
  }));
  state.unsubs.push(onSnapshot(operatorsRef, (snapshot) => {
    state.transferOperators = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    render();
  }, () => {
    state.error = t('loadError');
    render();
  }));
}

async function refreshAccess() {
  clearSubscriptions();
  state.loading = true;
  state.error = '';
  state.event = null;
  state.isOrganizer = false;
  state.hasSkipperBoat = false;
  state.operator = null;
  state.accessRequest = null;
  state.accessRequests = [];
  state.transferOperators = [];
  state.records = [];
  render();

  if (!state.user) {
    state.loading = false;
    render();
    return;
  }

  try {
    const [operatorSnapshot, requestSnapshot] = await Promise.all([
      getDoc(doc(db, 'events', EVENT_ID, 'transferOperators', state.user.uid)),
      getDoc(doc(db, 'events', EVENT_ID, 'transferAccessRequests', state.user.uid)),
    ]);
    // Il documento evento resta leggibile solo agli organizzatori: per un
    // referente transfer il suo rifiuto e' previsto, non e' un errore di area.
    try {
      const eventSnapshot = await getDoc(doc(db, 'events', EVENT_ID));
      state.event = eventSnapshot.exists() ? eventSnapshot.data() : null;
      state.isOrganizer = Boolean(state.event?.organizerIds?.includes(state.user.uid));
    } catch (eventError) {
      console.info('Accesso transfer senza privilegi organizzatore.', eventError.code || eventError);
      state.event = null;
      state.isOrganizer = false;
    }
    try {
      const boatSnapshot = await getDoc(doc(db, 'boats', state.user.uid));
      state.hasSkipperBoat = boatSnapshot.exists() && boatSnapshot.data()?.skipperId === state.user.uid;
    } catch (_) {
      state.hasSkipperBoat = false;
    }
    state.operator = operatorSnapshot.exists() ? { id: operatorSnapshot.id, ...operatorSnapshot.data() } : null;
    state.accessRequest = requestSnapshot.exists() ? { id: requestSnapshot.id, ...requestSnapshot.data() } : null;
    state.loading = false;
    listenToPrivateData();
    render();
  } catch (error) {
    console.error('Impossibile verificare l’accesso transfer.', error);
    state.loading = false;
    state.error = t('loadError');
    render();
  }
}

async function requestAccess() {
  if (!state.user) return;
  displayMessage('main', '');
  try {
    await setDoc(doc(db, 'events', EVENT_ID, 'transferAccessRequests', state.user.uid), {
      name: text(state.user.displayName || state.user.email?.split('@')[0] || 'Referente transfer', 120),
      email: text(state.user.email, 160),
      updatedAt: serverTimestamp(),
    });
    await refreshAccess();
    displayMessage('main', t('requestSent'));
  } catch (error) {
    console.error('Impossibile inviare la richiesta transfer.', error);
    displayMessage('main', t('requestError'), true);
  }
}

async function approveAccess(requestId) {
  const request = state.accessRequests.find((candidate) => candidate.id === requestId);
  if (!state.user || !state.isOrganizer || !request) return;
  displayMessage('access-management', '');
  try {
    await setDoc(doc(db, 'events', EVENT_ID, 'transferOperators', requestId), {
      role: 'transfer_operator',
      name: text(request.name, 120),
      email: text(request.email, 160),
      active: true,
      approvedAt: serverTimestamp(),
      approvedBy: state.user.uid,
      updatedAt: serverTimestamp(),
    });
    displayMessage('access-management', t('approved'));
  } catch (error) {
    console.error('Impossibile approvare l’operatore transfer.', error);
    displayMessage('access-management', t('approvalError'), true);
  }
}

function messageForOperator(key, name) {
  return t(key).replace('{name}', name || '—');
}

async function revokeGoogleAccess(requestId, name, button) {
  if (!state.user || !state.isOrganizer || !requestId) return;
  if (!window.confirm(messageForOperator('revokeGoogleConfirm', name))) return;
  displayMessage('access-management', '');
  if (button) button.disabled = true;
  try {
    await deleteDoc(doc(db, 'events', EVENT_ID, 'transferOperators', requestId));
    displayMessage('access-management', t('revokeGoogleSuccess'));
  } catch (error) {
    console.error('Impossibile revocare l’accesso Google transfer.', error?.code || error);
    displayMessage('access-management', t('approvalError'), true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function createTransferOperator(form) {
  if (!state.user || !state.isOrganizer) return;
  const values = new FormData(form);
  const name = text(values.get('name'), 120);
  const email = text(values.get('email'), 160).toLowerCase();
  const temporaryPassword = String(values.get('temporaryPassword') || '');
  const submit = form.querySelector('button[type="submit"]');
  if (!name || !email || temporaryPassword.length < 12) {
    displayMessage('operator-create', t('createOperatorError'), true);
    return;
  }

  displayMessage('operator-create', '');
  if (submit) submit.disabled = true;
  try {
    await httpsCallable(functions, 'provisionTransferOperator')({
      name,
      email,
      temporaryPassword,
    });
    form.reset();
    displayMessage('operator-create', t('createOperatorSuccess'));
  } catch (error) {
    // Non registriamo mai la password provvisoria né i dati inseriti nel form.
    console.error('Impossibile creare l’accesso transfer.', error?.code || error);
    displayMessage('operator-create', t('createOperatorError'), true);
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function suspendOperator(operatorId, name, button) {
  if (!state.user || !state.isOrganizer || !operatorId) return;
  if (!window.confirm(messageForOperator('suspendConfirm', name))) return;
  displayMessage('access-management', '');
  if (button) button.disabled = true;
  try {
    await httpsCallable(functions, 'revokeTransferOperator')({ uid: operatorId });
    displayMessage('access-management', t('suspendSuccess'));
  } catch (error) {
    console.error('Impossibile sospendere l’accesso transfer.', error?.code || error);
    displayMessage('access-management', t('manageOperatorError'), true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteOperator(operatorId, name, button) {
  if (!state.user || !state.isOrganizer || !operatorId) return;
  if (!window.confirm(messageForOperator('deleteOperatorConfirm', name))) return;
  displayMessage('access-management', '');
  if (button) button.disabled = true;
  try {
    await httpsCallable(functions, 'deleteTransferOperator')({ uid: operatorId });
    displayMessage('access-management', t('deleteOperatorSuccess'));
  } catch (error) {
    console.error('Impossibile eliminare l’accesso transfer.', error?.code || error);
    displayMessage('access-management', t('manageOperatorError'), true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function saveRecord(form) {
  if (!state.user || (!state.isOrganizer && state.operator?.active !== true)) return;
  const recordId = form.dataset.recordForm;
  if (!recordId) return;
  const values = new FormData(form);
  const status = normalizedStatus(values.get('status'));
  const payload = {
    status,
    assignedOperatorUid: state.user.uid,
    groupName: text(values.get('assignment'), 120),
    meetingPoint: text(values.get('meetingPoint'), 160),
    meetingTime: optionalTime(values.get('meetingTime')),
    vehicleName: text(values.get('vehicleName'), 120),
    operatorNotes: text(values.get('operatorNotes'), 500),
    updatedAt: serverTimestamp(),
    updatedBy: state.user.uid,
  };
  displayMessage(`record-${recordId}`, '');
  try {
    await updateDoc(doc(db, 'events', EVENT_ID, 'transferOpsRecords', recordId), payload);
    displayMessage(`record-${recordId}`, t('saved'));
  } catch (error) {
    console.error('Impossibile salvare il movimento transfer.', error);
    displayMessage(`record-${recordId}`, t('saveError'), true);
  }
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'sign-in') {
    displayMessage('main', '');
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Impossibile completare l’accesso Google transfer.', error);
      displayMessage('main', t('signInError'), true);
    }
  }
  if (action === 'sign-out') {
    await signOut(auth);
  }
  if (action === 'request-access') await requestAccess();
  if (action === 'approve-access') await approveAccess(button.dataset.requestId);
  if (action === 'revoke-google-access') await revokeGoogleAccess(button.dataset.requestId, button.dataset.operatorName, button);
  if (action === 'suspend-operator') await suspendOperator(button.dataset.operatorId, button.dataset.operatorName, button);
  if (action === 'delete-operator') await deleteOperator(button.dataset.operatorId, button.dataset.operatorName, button);
});

document.addEventListener('change', (event) => {
  const form = event.target.closest('[data-filter-form]');
  if (!form) return;
  const values = new FormData(form);
  state.filters.direction = ['all', 'outbound', 'return'].includes(values.get('direction')) ? values.get('direction') : 'all';
  state.filters.status = ['all', ...FILTERABLE_STATUSES].includes(values.get('status')) ? values.get('status') : 'all';
  state.filters.search = text(values.get('search'), 120);
  renderRecordListOnly();
});

document.addEventListener('input', (event) => {
  if (event.target.name !== 'search' || !event.target.closest('[data-filter-form]')) return;
  state.filters.search = text(event.target.value, 120);
  renderRecordListOnly();
});

document.addEventListener('submit', (event) => {
  const emailLoginForm = event.target.closest('[data-transfer-email-login]');
  if (emailLoginForm) {
    event.preventDefault();
    const values = new FormData(emailLoginForm);
    const email = text(values.get('email'), 160).toLowerCase();
    const password = String(values.get('password') || '');
    displayMessage('main', '');
    signInWithEmailAndPassword(auth, email, password).catch((error) => {
      console.error('Impossibile completare l’accesso email transfer.', error);
      displayMessage('main', t('emailSignInError'), true);
    });
    return;
  }
  const filterForm = event.target.closest('[data-filter-form]');
  if (filterForm) {
    event.preventDefault();
    return;
  }
  const createOperatorForm = event.target.closest('[data-create-transfer-operator]');
  if (createOperatorForm) {
    event.preventDefault();
    createTransferOperator(createOperatorForm);
    return;
  }
  const form = event.target.closest('[data-record-form]');
  if (!form) return;
  event.preventDefault();
  saveRecord(form);
});

window.addEventListener('egadi:localechange', () => render());
window.addEventListener('beforeunload', clearSubscriptions);

onAuthStateChanged(auth, (user) => {
  state.user = user;
  refreshAccess();
});

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { simplifyReservedAreaNavigation } from './reserved-area-nav.js?v=20260928-blast-experience-v1';
import {
  groupTransferRecords,
  recordClusterMinutes,
  suggestedMarsalaDeparture,
} from './transfer-ordering.js?v=20260929-transfer-timeline-v1';

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
    signInText: 'Sei il referente transfer? Usa esclusivamente l’email operativa e la password create dalla regia del viaggio. Questo è il terzo percorso dell’Area riservata: qui non si richiedono nuovi accessi.',
    signInAction: 'Accedi come proprietario con Google',
    emailSignInAction: 'Accedi con email e password',
    privateArea: 'Torna all’Area riservata',
    emailLabel: 'Nome utente / email operativa',
    passwordLabel: 'Password dedicata',
    accessNotAssignedEyebrow: 'Accesso non abilitato',
    accessNotAssignedTitle: 'Usa le credenziali create dall’organizzatore.',
    accessNotAssignedText: 'La gestione transfer non ha registrazione né richiesta di accesso. Se sei il referente incaricato, esci e rientra con l’email operativa e la password ricevute dalla regia.',
    signedInAs: 'Account di accesso',
    signOut: 'Esci',
    waiting: 'Caricamento dell’area transfer…',
    organizationEyebrow: 'Regia del viaggio',
    organizationTitle: 'Gestisci gli accessi della società transfer.',
    organizationText: 'Solo tu crei, sospendi o elimini le credenziali della società transfer. Ogni referente vede soltanto i movimenti per i quali i partecipanti hanno chiesto il servizio.',
    pricingTitle: 'Prezzo del transfer',
    pricingText: 'Il transfer non è gratuito: skipper ed equipaggio lo vedono prima di richiederlo. Il minimo fatturabile si applica anche a chi viaggia da solo (es. 3 persone minimo a 10€ = 30€ anche per una sola persona).',
    pricingTpsLabel: 'Prezzo a persona · Trapani (TPS)',
    pricingPmoLabel: 'Prezzo a persona · Palermo (PMO)',
    pricingMinimumLabel: 'Minimo persone fatturabili',
    pricingSave: 'Salva prezzo',
    pricingSaved: 'Prezzo del transfer aggiornato.',
    pricingError: 'Non è stato possibile salvare il prezzo. Controlla i valori e riprova.',
    pricingUpdated: 'Ultimo aggiornamento: {date}.',
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
    deleteOperator: 'Elimina definitivamente',
    deleteOperatorConfirm: 'Eliminare definitivamente l’account di {name}? Questa azione non può essere annullata.',
    deleteOperatorSuccess: 'Account eliminato definitivamente.',
    manageOperatorError: 'Non è stato possibile aggiornare questo accesso. Riprova tra poco.',
    legacyAccessTitle: 'Pulizia dei vecchi accessi',
    legacyAccessText: 'Questi elementi provengono dal precedente sistema Google. Non possono più essere approvati e non danno accesso: rimuovili.',
    legacyRequestTitle: 'Richiesta precedente non valida',
    legacyRequestText: 'Non corrisponde a una credenziale creata dalla regia.',
    deleteLegacyRequest: 'Elimina richiesta',
    deleteLegacyRequestConfirm: 'Eliminare questa vecchia richiesta? Non ha mai concesso accesso transfer.',
    deleteLegacyRequestSuccess: 'Richiesta precedente eliminata.',
    legacyOperatorTitle: 'Accesso precedente da rimuovere',
    legacyOperatorText: 'Non usa credenziali create dalla regia e non può più accedere ai movimenti.',
    deleteLegacyOperator: 'Rimuovi accesso',
    deleteLegacyOperatorConfirm: 'Rimuovere questo vecchio accesso transfer? L’account esterno non verrà eliminato.',
    deleteLegacyOperatorSuccess: 'Vecchio accesso transfer rimosso.',
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
    filterBoat: 'Barca',
    allBoats: 'Tutte le barche',
    boatStatsEyebrow: 'Riepilogo per barca',
    boatStatsTitle: 'Chi ha scelto il transfer, barca per barca',
    boatStatsSummary: '{boats} barche · {members} persone registrate · {outbound} hanno chiesto il transfer in andata, {return} al ritorno.',
    boatStatSkipper: 'Skipper {name}',
    boatStatOnBoard: 'persone registrate',
    boatStatRequestedShort: 'transfer',
    boatStatIndependentShort: 'in autonomia',
    boatStatPendingShort: 'da sollecitare',
    boatStatFollowUp: 'Contatta lo skipper: qualcuno non ha ancora deciso',
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
    approvalError: 'Impossibile aggiornare l’abilitazione. Riprova tra poco.',
    loadError: 'L’area transfer non è disponibile in questo momento. Riprova tra poco.',
    signInError: 'Non è stato possibile completare l’accesso Google. Riprova scegliendo l’account corretto.',
    emailSignInError: 'Email o password non corrette. Usa le credenziali dedicate ricevute dalla regia.',
    unknownRoute: 'Tratta da confermare',
    unknownDateTime: 'Orario da definire',
    sheet: 'Foglio di backup · account proprietario',
    lastUpdated: 'Aggiornato',
    panelOutboundTitle: 'Andata · verso Marsala',
    panelOutboundHint: 'Prima le date più vicine; per ogni aeroporto trovi in alto chi deve essere raggiunto per primo.',
    panelReturnTitle: 'Ritorno · verso l’aeroporto',
    panelReturnHint: 'Prima le date più vicine; per ogni aeroporto trovi in alto chi deve partire da Marsala per primo.',
    airportUnknown: 'Aeroporto da definire',
    dateUnknown: 'Data da definire',
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
    signInText: 'Are you the transfer contact? Use only the operations email and password created by the trip coordinators. This is the third route from the Private area: new access cannot be requested here.',
    signInAction: 'Sign in as owner with Google',
    emailSignInAction: 'Sign in with email and password',
    privateArea: 'Back to Private area',
    emailLabel: 'Username / operations email',
    passwordLabel: 'Dedicated password',
    accessNotAssignedEyebrow: 'Access not enabled',
    accessNotAssignedTitle: 'Use credentials created by the organiser.',
    accessNotAssignedText: 'Transfer operations have no registration or access-request route. If you are the appointed contact, sign out and use the operations email and password supplied by the trip coordinators.',
    signedInAs: 'Access account',
    signOut: 'Sign out',
    waiting: 'Loading the transfer area…',
    organizationEyebrow: 'Trip coordination',
    organizationTitle: 'Manage transfer company access.',
    organizationText: 'Only you can create, suspend or delete transfer-company credentials. Each contact sees only journeys for which travellers requested the service.',
    pricingTitle: 'Transfer price',
    pricingText: 'The transfer is not free: skipper and crew see it before requesting it. The minimum billable applies even travelling alone (e.g. minimum 3 people at €10 = €30 even for one person).',
    pricingTpsLabel: 'Price per person · Trapani (TPS)',
    pricingPmoLabel: 'Price per person · Palermo (PMO)',
    pricingMinimumLabel: 'Minimum billable people',
    pricingSave: 'Save price',
    pricingSaved: 'Transfer price updated.',
    pricingError: 'The price could not be saved. Check the values and try again.',
    pricingUpdated: 'Last updated: {date}.',
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
    deleteOperator: 'Delete permanently',
    deleteOperatorConfirm: 'Permanently delete {name}’s account? This action cannot be undone.',
    deleteOperatorSuccess: 'Account deleted permanently.',
    manageOperatorError: 'This access could not be updated. Please try again shortly.',
    legacyAccessTitle: 'Clean up previous access',
    legacyAccessText: 'These items come from the former Google route. They can no longer be approved and grant no access: remove them.',
    legacyRequestTitle: 'Invalid previous request',
    legacyRequestText: 'It does not correspond to credentials created by trip coordination.',
    deleteLegacyRequest: 'Delete request',
    deleteLegacyRequestConfirm: 'Delete this previous request? It never granted transfer access.',
    deleteLegacyRequestSuccess: 'Previous request deleted.',
    legacyOperatorTitle: 'Previous access to remove',
    legacyOperatorText: 'It does not use credentials created by trip coordination and can no longer access journeys.',
    deleteLegacyOperator: 'Remove access',
    deleteLegacyOperatorConfirm: 'Remove this previous transfer access? The external account will not be deleted.',
    deleteLegacyOperatorSuccess: 'Previous transfer access removed.',
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
    filterBoat: 'Boat',
    allBoats: 'All boats',
    boatStatsEyebrow: 'Boat by boat',
    boatStatsTitle: 'Who chose the transfer, boat by boat',
    boatStatsSummary: '{boats} boats · {members} registered people · {outbound} requested the outbound transfer, {return} the return.',
    boatStatSkipper: 'Skipper {name}',
    boatStatOnBoard: 'registered people',
    boatStatRequestedShort: 'transfer',
    boatStatIndependentShort: 'on their own',
    boatStatPendingShort: 'to follow up',
    boatStatFollowUp: 'Contact the skipper: someone has not decided yet',
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
    approvalError: 'The access setting could not be updated. Please try again shortly.',
    loadError: 'The transfer area is not available right now. Please try again shortly.',
    signInError: 'Google sign-in could not be completed. Please choose the correct account and try again.',
    emailSignInError: 'The email or password is incorrect. Use the dedicated credentials provided by the trip coordinators.',
    unknownRoute: 'Route to be confirmed',
    unknownDateTime: 'Time to be defined',
    sheet: 'Backup sheet · owner account',
    lastUpdated: 'Updated',
    panelOutboundTitle: 'Outbound · to Marsala',
    panelOutboundHint: 'Nearest dates first; for each airport, the first person to collect is shown at the top.',
    panelReturnTitle: 'Return · to the airport',
    panelReturnHint: 'Nearest dates first; for each airport, the first person who must leave Marsala is shown at the top.',
    airportUnknown: 'Airport to be defined',
    dateUnknown: 'Date to be defined',
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
  accessRequests: [],
  transferOperators: [],
  transferPricing: null,
  records: [],
  loading: true,
  error: '',
  filters: { direction: 'all', status: 'all', search: '', boat: 'all' },
  unsubs: [],
  // Popolato via getDocs quando compare un boatId nuovo tra i record: quante
  // persone risultano nella Crew List di quella barca, per confrontarlo con
  // quante hanno già scelto il transfer (richiesta del titolare, 29/09/2026 —
  // "non riesco a controllare chi ha fatto e cosa ha fatto" senza un filtro
  // e una statistica per barca).
  boatMemberCounts: {},
  // Elenco completo delle barche (richiede `list` su boats, solo organizzatore)
  // e stato dettagliato di viaggio per barca (crewTravelStatus), per capire
  // quali skipper non hanno ancora fatto compilare il transfer al loro
  // equipaggio (richiesta del titolare, 29/09/2026).
  allBoats: [],
  boatTravelStatus: {},
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

// Stesso motivo del pattern già usato in area.js: con type="number" alcuni
// browser/lingue interpretano la virgola come separatore delle migliaia e
// svuotano il campo. Tutti gli importi del sito restano <input type="text">
// con questa normalizzazione manuale (fix reale, 25/09/2026).
function normalizeEuroInputString(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) return '';
  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');
  if (hasComma && hasDot) {
    return trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed.replace(/,/g, '');
  }
  return hasComma ? trimmed.replace(',', '.') : trimmed;
}

function toEuroCents(value) {
  const rawValue = normalizeEuroInputString(value);
  if (!rawValue) return 0;
  const amount = Number(rawValue);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1000 ? Math.round(amount * 100) : 0;
}

function euroInputValue(cents) {
  return Number.isFinite(cents) && cents > 0 ? (cents / 100).toFixed(2) : '';
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
  const privateAreaUrl = `accesso.html?lang=${encodeURIComponent(locale())}#gestore-transfer`;
  root.innerHTML = `<article class="transfer-operator-card"><p class="eyebrow">${escapeHtml(t('signInEyebrow'))}</p><h2>${escapeHtml(t('signInTitle'))}</h2><p>${escapeHtml(t('signInText'))}</p><form class="compact-form" data-transfer-email-login><label><span>${escapeHtml(t('emailLabel'))}</span><input name="email" type="email" required autocomplete="username" inputmode="email" maxlength="160" /></label><label><span>${escapeHtml(t('passwordLabel'))}</span><input name="password" type="password" required autocomplete="current-password" minlength="6" /></label><button class="button button-primary" type="submit">${escapeHtml(t('emailSignInAction'))}</button></form><div class="transfer-operator-actions"><button class="button button-ghost" type="button" data-action="sign-in-organizer">${escapeHtml(t('signInAction'))}</button><a class="button button-ghost" href="${escapeHtml(privateAreaUrl)}">← ${escapeHtml(t('privateArea'))}</a></div><p class="form-message" data-message="main" role="status"></p></article>`;
}

function renderAccessNotAssigned() {
  const privateAreaUrl = `accesso.html?lang=${encodeURIComponent(locale())}#gestore-transfer`;
  root.innerHTML = `<article class="transfer-operator-card"><p class="eyebrow">${escapeHtml(t('accessNotAssignedEyebrow'))}</p><h2>${escapeHtml(t('accessNotAssignedTitle'))}</h2><p>${escapeHtml(t('accessNotAssignedText'))}</p><div class="transfer-operator-actions"><a class="button button-ghost" href="${escapeHtml(privateAreaUrl)}">← ${escapeHtml(t('privateArea'))}</a></div>${renderSignedInAccount()}</article>`;
}

function isManagedPasswordAccount(operator) {
  return operator?.role === 'transfer_operator'
    && operator?.accessMode === 'managed_password'
    && operator?.authProvider === 'password';
}

function isManagedPasswordOperator(operator) {
  return isManagedPasswordAccount(operator) && operator?.active === true;
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
    .filter(isManagedPasswordAccount)
    .sort((left, right) => (dateValue(right.updatedAt)?.getTime() || 0) - (dateValue(left.updatedAt)?.getTime() || 0));
}

function legacyOperators() {
  return [...state.transferOperators]
    .filter((operator) => operator?.role === 'transfer_operator' && !isManagedPasswordAccount(operator))
    .sort((left, right) => (dateValue(right.updatedAt)?.getTime() || 0) - (dateValue(left.updatedAt)?.getTime() || 0));
}

function legacyRequests() {
  return [...state.accessRequests]
    .sort((left, right) => (dateValue(right.updatedAt)?.getTime() || 0) - (dateValue(left.updatedAt)?.getTime() || 0));
}

function renderLegacyRequestRow(request) {
  const updated = formatDateTime(request.updatedAt);
  return `<article class="transfer-access-request"><div><strong>${escapeHtml(t('legacyRequestTitle'))}</strong><span>${escapeHtml(t('legacyRequestText'))}${updated ? ` · ${escapeHtml(t('lastUpdated'))}: ${escapeHtml(updated)}` : ''}</span></div><div class="transfer-access-request-actions"><button class="button button-ghost" type="button" data-action="delete-legacy-request" data-request-id="${escapeHtml(request.id)}">${escapeHtml(t('deleteLegacyRequest'))}</button></div></article>`;
}

function renderLegacyOperatorRow(operator) {
  const updated = formatDateTime(operator.updatedAt || operator.approvedAt);
  return `<article class="transfer-access-request"><div><strong>${escapeHtml(t('legacyOperatorTitle'))}</strong><span>${escapeHtml(t('legacyOperatorText'))}${updated ? ` · ${escapeHtml(t('lastUpdated'))}: ${escapeHtml(updated)}` : ''}</span></div><div class="transfer-access-request-actions"><button class="button button-ghost" type="button" data-action="delete-legacy-operator" data-operator-id="${escapeHtml(operator.id)}">${escapeHtml(t('deleteLegacyOperator'))}</button></div></article>`;
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
  return `<form class="compact-form" data-create-transfer-operator><label><span>${escapeHtml(t('operatorNameLabel'))}</span><input name="name" type="text" required autocomplete="name" maxlength="120" /></label><label><span>${escapeHtml(t('operatorEmailLabel'))}</span><input name="email" type="email" required autocomplete="username" inputmode="email" maxlength="160" /></label><label data-wide><span>${escapeHtml(t('temporaryPasswordLabel'))}</span><input name="temporaryPassword" type="password" required autocomplete="new-password" minlength="12" maxlength="128" aria-describedby="temporary-password-help" /><small id="temporary-password-help">${escapeHtml(t('temporaryPasswordHelp'))}</small></label><div class="form-actions"><button class="button button-primary" type="submit">${escapeHtml(t('createOperator'))}</button><p class="form-message" data-message="operator-create" role="status"></p></div></form>`;
}

function renderPricingForm() {
  const pricing = state.transferPricing;
  const updated = pricing ? formatDateTime(pricing.updatedAt) : '';
  return `<div class="transfer-operator-management-section"><h3>${escapeHtml(t('pricingTitle'))}</h3><p>${escapeHtml(t('pricingText'))}</p><form class="compact-form" data-transfer-pricing-form><label><span>${escapeHtml(t('pricingTpsLabel'))}</span><input name="tpsPrice" type="text" inputmode="decimal" required value="${escapeHtml(euroInputValue(pricing?.tpsPricePerPersonCents))}" placeholder="Es. 10,00" /></label><label><span>${escapeHtml(t('pricingPmoLabel'))}</span><input name="pmoPrice" type="text" inputmode="decimal" required value="${escapeHtml(euroInputValue(pricing?.pmoPricePerPersonCents))}" placeholder="Es. 20,00" /></label><label><span>${escapeHtml(t('pricingMinimumLabel'))}</span><input name="minimumPersons" type="text" inputmode="numeric" required value="${escapeHtml(pricing?.minimumBillablePersons ? String(pricing.minimumBillablePersons) : '3')}" placeholder="3" /></label><div class="form-actions"><button class="button button-primary" type="submit">${escapeHtml(t('pricingSave'))}</button><p class="form-message" data-message="pricing" role="status"></p></div></form>${updated ? `<p class="field-hint">${escapeHtml(t('pricingUpdated').replace('{date}', updated))}</p>` : ''}</div>`;
}

function renderAccessManagement() {
  const operators = managedOperators();
  const requests = legacyRequests();
  const oldOperators = legacyOperators();
  const cleanup = requests.length || oldOperators.length
    ? `<div class="transfer-operator-management-section"><h3>${escapeHtml(t('legacyAccessTitle'))}</h3><p>${escapeHtml(t('legacyAccessText'))}</p><div class="transfer-request-list">${requests.map(renderLegacyRequestRow).join('')}${oldOperators.map(renderLegacyOperatorRow).join('')}</div></div>`
    : '';
  return `<section class="transfer-operator-card"><p class="eyebrow">${escapeHtml(t('organizationEyebrow'))}</p><h2>${escapeHtml(t('organizationTitle'))}</h2><p>${escapeHtml(t('organizationText'))}</p>${renderPricingForm()}<div class="transfer-operator-management-section"><h3>${escapeHtml(t('createOperatorTitle'))}</h3><p>${escapeHtml(t('createOperatorText'))}</p>${renderOperatorCreationForm()}</div><div class="transfer-operator-management-section"><h3>${escapeHtml(t('operatorsTitle'))}</h3><div class="transfer-request-list">${operators.length ? operators.map(renderManagedOperatorRow).join('') : `<p class="empty-state">${escapeHtml(t('noOperators'))}</p>`}</div></div>${cleanup}<p class="form-message" data-message="access-management" role="status"></p></section>`;
}

function recordMatchesFilters(record) {
  // Un record "revoked" nasce da una tratta non ancora confermata (bozza) o
  // per cui la persona non ha chiesto il transfer organizzato: i campi sono
  // sempre vuoti (vedi markTransferRequestRevoked in functions/index.js), non
  // c'è nulla da mostrare né da organizzare. Va escluso qui, non solo dal
  // filtro stato, perché altrimenti compare comunque con "Tutti gli stati".
  if (record.recordState && record.recordState !== 'active') return false;
  const { direction, status, search, boat } = state.filters;
  const recordDirection = normalizeDirection(record.direction || record.legDirection || record.travelDirection);
  const recordStatus = recordStatusKey(record);
  if (boat !== 'all' && boat !== (record.boatId || '')) return false;
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
  const waUrl = whatsappUrl(phone, whatsappMessage(record));
  if (waUrl) {
    items.push(`<a class="button button-whatsapp transfer-whatsapp-action" href="${escapeHtml(waUrl)}" target="_blank" rel="noopener noreferrer"><span class="whatsapp-action-icon" aria-hidden="true">${whatsappIconSvg()}</span>${escapeHtml(t('whatsappContact'))}</a>`);
  }
  return items.join('<br />');
}

function recordDetail(label, value, className = '') {
  return `<div${className ? ` class="${className}"` : ''}><dt>${escapeHtml(label)}</dt><dd>${value || '—'}</dd></div>`;
}

function whatsappIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4.1A8 8 0 1 1 20 11.6Z"></path><path d="M9 8.5c.3 2.4 2.1 4.2 4.5 4.8l1.2-1 2 .9c.2.1.3.4.2.6-.6 1.3-1.7 2-3.1 2-3.6 0-6.6-3-6.6-6.6 0-1.4.7-2.6 2-3.1.3-.1.5 0 .6.2l.9 2-1.7 1.2Z"></path></svg>';
}

function whatsappMessage(record) {
  const name = participantName(record);
  const route = routeLabel(record);
  const schedule = formatSchedule(record);
  return locale() === 'en'
    ? `Hi ${name}, I’m contacting you about your Egadi Sailing Experience transfer: ${route}, ${schedule}.`
    : `Ciao ${name}, ti contatto per il transfer di Egadi Sailing Experience: ${route}, ${schedule}.`;
}

function whatsappUrl(phone, message = '') {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (digits.length < 8 || digits.length > 15) return '';
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${query}`;
}

function renderDraftNotice(record) {
  if (record.legState !== 'draft') return '';
  const phone = contactPhone(record);
  const waUrl = whatsappUrl(phone, whatsappMessage(record));
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
  return `<details class="transfer-record transfer-record--${escapeHtml(displayStatus)}" data-record-id="${recordId}"><summary><span class="transfer-record-summary-copy"><strong>${escapeHtml(participantName(record))}</strong><span>${escapeHtml(routeLabel(record))} · ${escapeHtml(formatSchedule(record))}</span></span><span class="transfer-record-badges"><span class="transfer-badge transfer-badge--${directionClass}">${escapeHtml(directionLabel(direction))}</span><span class="transfer-badge transfer-badge--${escapeHtml(displayStatus)}">${escapeHtml(statusLabel(displayStatus))}</span></span></summary><div class="transfer-record-body">${renderDraftNotice(record)}<dl class="transfer-record-details">${recordDetail(t('direction'), escapeHtml(directionLabel(direction)))}${recordDetail(scheduleLabel, escapeHtml(formatSchedule(record)))}${suggestedDepartureDetail}${recordDetail(t('route'), escapeHtml(routeLabel(record)))}${recordDetail(t('flight'), escapeHtml(recordFlight(record)))}${recordDetail(t('luggage'), escapeHtml(recordLuggage(record)))}${recordDetail(t('contact'), recordContactMarkup(record), 'transfer-record-contact')}</dl><form class="transfer-record-form" data-record-form="${recordId}"><label><span>${escapeHtml(t('status'))}</span><select name="status">${statusOptions(operationalStatus)}</select></label><label><span>${escapeHtml(t('assignment'))}</span><input name="assignment" maxlength="120" value="${escapeHtml(assignment)}" /></label><label><span>${escapeHtml(t('meetingPoint'))}</span><input name="meetingPoint" maxlength="160" value="${escapeHtml(meetingPoint)}" placeholder="${escapeHtml(meetingPointPlaceholder)}" /></label><label><span>${escapeHtml(t('meetingTime'))}</span><input name="meetingTime" type="time" value="${escapeHtml(meetingTime)}" /></label><label data-wide><span>${escapeHtml(t('vehicle'))}</span><input name="vehicleName" maxlength="120" value="${escapeHtml(vehicleName)}" /></label><label data-wide><span>${escapeHtml(t('notes'))}</span><textarea name="operatorNotes" maxlength="500">${escapeHtml(notes)}</textarea></label><div class="form-actions"><button class="button button-primary" type="submit">${escapeHtml(t('saveRecord'))}</button><p class="form-message" data-message="record-${recordId}" role="status"></p></div></form></div></details>`;
}

// Oltre questo intervallo fra un orario e il successivo (già ordinati), la
// persona apre una nuova fascia: due voli/partenze vicini nel tempo vanno
// nello stesso van, uno lontano nel tempo no.
const TIME_BAND_GAP_MINUTES = 90;
// Sotto questa soglia di persone in un gruppo aeroporto, le fasce orarie non
// aggiungono nulla e sono solo un titolo in più da leggere: si mostra la
// lista piatta come prima, esattamente come per una barca piccola oggi.
const TIME_BAND_MIN_GROUP_SIZE = 6;

function minutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

function renderAirportGroupBody(groupRecords, direction) {
  if (groupRecords.length <= TIME_BAND_MIN_GROUP_SIZE) {
    return `<div class="transfer-operator-list">${groupRecords.map(renderRecord).join('')}</div>`;
  }
  return groupByTimeBand(groupRecords, direction).map((band) => `<div class="transfer-time-band"><h4 class="transfer-time-band-title">${escapeHtml(timeBandTitle(band, direction))}<span>${band.records.length}</span></h4><div class="transfer-operator-list">${band.records.map(renderRecord).join('')}</div></div>`).join('');
}

function dateGroupLabel(date) {
  if (!date) return t('dateUnknown');
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat(locale() === 'en' ? 'en-GB' : 'it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(value);
}

function renderDateGroup(group, direction) {
  const airports = group.airportGroups
    .map(({ airport, records }) => `<div class="transfer-airport-group"><h4 class="transfer-airport-group-title">${escapeHtml(airportLabel(airport))}<span>${records.length}</span></h4>${renderAirportGroupBody(records, direction)}</div>`)
    .join('');
  const dateLabel = dateGroupLabel(group.date);
  const dateTitle = group.date
    ? `<time datetime="${escapeHtml(group.date)}">${escapeHtml(dateLabel)}</time>`
    : escapeHtml(dateLabel);
  return `<section class="transfer-date-group"><h3 class="transfer-date-group-title">${dateTitle}<span>${group.count}</span></h3>${airports}</section>`;
}

function renderDirectionPanel(direction, records) {
  const title = direction === 'return' ? t('panelReturnTitle') : t('panelOutboundTitle');
  const hint = direction === 'return' ? t('panelReturnHint') : t('panelOutboundHint');
  const groups = groupTransferRecords(records, direction);
  const body = groups.length
    ? groups.map((group) => renderDateGroup(group, direction)).join('')
    : `<p class="empty-state">${escapeHtml(t('noRecords'))}</p>`;
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

// Le barche note derivano dai record stessi (che già portano boatId e
// boatName dalla Cloud Function, functions/index.js:692,697): niente da
// leggere in più solo per popolare il filtro. Includiamo anche i record
// "revoked" (bozza o transfer non richiesto) per non far sparire dal filtro
// una barca i cui membri si sono tutti arrangiati da soli.
function knownBoats() {
  const byId = new Map();
  state.records.forEach((record) => {
    if (!record.boatId || byId.has(record.boatId)) return;
    byId.set(record.boatId, record.boatName || record.boatId);
  });
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((first, second) => first.name.localeCompare(second.name, 'it'));
}

// Il totale iscritti (Crew List) non è nei record: un membro che non ha mai
// aperto il modulo viaggio non genera alcun record. Lo leggiamo a parte, una
// sola volta per barca (l'organizzatore ha già accesso in lettura a
// boats/{boatId}/members — firestore.rules).
async function ensureBoatMemberCounts(boatIds) {
  const missing = boatIds.filter((boatId) => !(boatId in state.boatMemberCounts));
  if (!missing.length) return;
  await Promise.all(missing.map(async (boatId) => {
    try {
      const snapshot = await getDocs(collection(db, 'boats', boatId, 'members'));
      state.boatMemberCounts[boatId] = snapshot.size;
    } catch (error) {
      console.info('Numero di iscritti non disponibile per questa barca.', boatId, error?.code || error);
      state.boatMemberCounts[boatId] = null;
    }
  }));
  render();
}

// L'unica lista completa e affidabile delle barche: i record (transferOpsRecords)
// esistono solo per chi ha già aperto il modulo viaggio, quindi una barca
// completamente ferma non comparirebbe mai — proprio il caso che Silvio deve
// individuare per sollecitare lo skipper (richiesta del 29/09/2026). L'elenco
// completo richiede `list` su boats, permesso solo all'organizzatore.
async function ensureAllBoatsLoaded() {
  if (!state.isOrganizer || state.allBoats.length) return;
  try {
    const snapshot = await getDocs(collection(db, 'boats'));
    state.allBoats = snapshot.docs
      .map((entry) => ({ id: entry.id, name: entry.data()?.name || entry.id, skipperName: entry.data()?.skipperName || '' }))
      .sort((first, second) => first.name.localeCompare(second.name, 'it'));
    render();
  } catch (error) {
    console.info('Elenco barche non disponibile.', error?.code || error);
  }
}

// Stato dettagliato per persona e per tratta (richiesto/autonomo/non deciso),
// molto più preciso di transferOpsRecords: quella collezione non distingue
// "si arrangia da solo" da "non ha ancora deciso" (entrambi diventano un
// record "revoked" senza altri dati) — crewTravelStatus sì, ed è già
// leggibile in list dall'organizzatore per qualunque barca.
async function ensureBoatTravelStatus(boatIds) {
  const missing = boatIds.filter((boatId) => !(boatId in state.boatTravelStatus));
  if (!missing.length) return;
  await Promise.all(missing.map(async (boatId) => {
    try {
      const snapshot = await getDocs(collection(db, 'boats', boatId, 'crewTravelStatus'));
      state.boatTravelStatus[boatId] = snapshot.docs.map((entry) => entry.data());
    } catch (error) {
      console.info('Stato viaggio non disponibile per questa barca.', boatId, error?.code || error);
      state.boatTravelStatus[boatId] = [];
    }
  }));
  render();
}

// Per ogni tratta: quante persone hanno chiesto il transfer, quante si
// arrangiano da sole, quante restano da sollecitare (non hanno ancora
// deciso, oppure non hanno mai aperto il modulo viaggio).
function boatTravelBreakdown(boatId) {
  const statuses = state.boatTravelStatus[boatId] || [];
  const total = state.boatMemberCounts[boatId];
  const countFor = (key) => ({
    requested: statuses.filter((entry) => entry[key] === 'requested').length,
    independent: statuses.filter((entry) => entry[key] === 'not_requested').length,
  });
  const outbound = countFor('outboundTransfer');
  const inbound = countFor('returnTransfer');
  const pendingFor = (counted) => Number.isInteger(total) ? Math.max(0, total - counted.requested - counted.independent) : null;
  return {
    total,
    outbound: { ...outbound, pending: pendingFor(outbound) },
    return: { ...inbound, pending: pendingFor(inbound) },
  };
}

function renderBoatStats() {
  if (!state.allBoats.length) return '';
  const boatIds = state.allBoats.map((boat) => boat.id);
  void ensureBoatMemberCounts(boatIds);
  void ensureBoatTravelStatus(boatIds);
  const totals = { members: 0, outboundRequested: 0, outboundPending: 0, returnRequested: 0, returnPending: 0 };
  const cards = state.allBoats.map((boat) => {
    const breakdown = boatTravelBreakdown(boat.id);
    if (Number.isInteger(breakdown.total)) totals.members += breakdown.total;
    totals.outboundRequested += breakdown.outbound.requested;
    totals.returnRequested += breakdown.return.requested;
    if (Number.isInteger(breakdown.outbound.pending)) totals.outboundPending += breakdown.outbound.pending;
    if (Number.isInteger(breakdown.return.pending)) totals.returnPending += breakdown.return.pending;
    const needsFollowUp = (breakdown.outbound.pending || 0) > 0 || (breakdown.return.pending || 0) > 0;
    const totalText = Number.isInteger(breakdown.total) ? String(breakdown.total) : '…';
    const legLine = (label, leg) => `<span>${escapeHtml(label)}: ${leg.requested} ${escapeHtml(t('boatStatRequestedShort'))} · ${leg.independent} ${escapeHtml(t('boatStatIndependentShort'))} · ${Number.isInteger(leg.pending) ? leg.pending : '…'} ${escapeHtml(t('boatStatPendingShort'))}</span>`;
    return `<article class="transfer-boat-stat${needsFollowUp ? ' transfer-boat-stat--pending' : ''}">
      <strong>${escapeHtml(boat.name)}</strong>
      <small>${boat.skipperName ? escapeHtml(t('boatStatSkipper').replace('{name}', boat.skipperName)) : ''} · ${totalText} ${escapeHtml(t('boatStatOnBoard'))}</small>
      ${legLine(t('inbound'), breakdown.outbound)}
      ${legLine(t('outbound'), breakdown.return)}
      ${needsFollowUp ? `<span class="transfer-boat-stat-flag">${escapeHtml(t('boatStatFollowUp'))}</span>` : ''}
    </article>`;
  }).join('');
  const summary = `<p class="field-hint">${escapeHtml(t('boatStatsSummary')
    .replace('{boats}', String(state.allBoats.length))
    .replace('{members}', String(totals.members))
    .replace('{outbound}', String(totals.outboundRequested))
    .replace('{return}', String(totals.returnRequested)))}</p>`;
  return `<section class="transfer-operator-card transfer-boat-stats" aria-label="${escapeHtml(t('boatStatsTitle'))}"><p class="eyebrow">${escapeHtml(t('boatStatsEyebrow'))}</p><h2>${escapeHtml(t('boatStatsTitle'))}</h2>${summary}<div class="transfer-boat-stat-grid">${cards}</div></section>`;
}

function boatFilterOptions() {
  const boats = knownBoats();
  const current = boats.some((boat) => boat.id === state.filters.boat) ? state.filters.boat : 'all';
  if (current !== state.filters.boat) state.filters.boat = 'all';
  return boats.map((boat) => `<option value="${escapeHtml(boat.id)}"${boat.id === state.filters.boat ? ' selected' : ''}>${escapeHtml(boat.name)}</option>`).join('');
}

function renderOperatorDashboard() {
  const filtered = state.records.filter(recordMatchesFilters);
  const stats = recordStats(state.records);
  const sheetUrl = state.isOrganizer ? safeSheetUrl(state.event?.transferSheetUrl) : '';
  const boats = knownBoats();
  const boatFilterField = boats.length
    ? `<label><span>${escapeHtml(t('filterBoat'))}</span><select name="boat"><option value="all">${escapeHtml(t('allBoats'))}</option>${boatFilterOptions()}</select></label>`
    : '';
  root.innerHTML = `<section class="transfer-operator-toolbar"><div><p class="eyebrow">${escapeHtml(t('operatorEyebrow'))}</p><h2>${escapeHtml(t('operatorTitle'))}</h2><p>${escapeHtml(t('operatorText'))}</p>${sheetUrl ? `<p><a class="transfer-sheet-link" href="${escapeHtml(sheetUrl)}" target="_blank" rel="noopener">${escapeHtml(t('sheet'))}</a></p>` : ''}</div><div class="transfer-operator-actions"><button class="button button-light" type="button" data-action="sign-out">${escapeHtml(t('signOut'))}</button></div></section><section class="transfer-operator-summary" aria-label="Riepilogo movimenti"><article><span>${escapeHtml(t('records'))}</span><strong>${stats.total}</strong></article><article><span>${escapeHtml(t('inbound'))}</span><strong>${stats.outbound}</strong></article><article><span>${escapeHtml(t('outbound'))}</span><strong>${stats.return}</strong></article><article><span>${escapeHtml(t('newStatus'))}</span><strong>${stats.pending}</strong></article><article><span>${escapeHtml(t('draftsLabel'))}</span><strong>${stats.drafts}</strong></article></section>${state.isOrganizer ? renderBoatStats() : ''}<section class="transfer-operator-card"><form class="transfer-operator-filters" data-filter-form><label><span>${escapeHtml(t('filterStatus'))}</span><select name="status"><option value="all">${escapeHtml(t('allStatuses'))}</option>${statusOptions(state.filters.status, FILTERABLE_STATUSES)}</select></label>${boatFilterField}<label><span>${escapeHtml(t('filterSearch'))}</span><input name="search" type="search" value="${escapeHtml(state.filters.search)}" autocomplete="off" /></label></form></section><div class="transfer-operator-groups">${renderGroupedRecords(filtered)}</div>${state.isOrganizer ? renderAccessManagement() : ''}`;
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
  if (state.isOrganizer || isManagedPasswordOperator(state.operator)) {
    renderOperatorDashboard();
    return;
  }
  renderAccessNotAssigned();
}

function sortByUpdatedAt(documents) {
  return [...documents].sort((left, right) => (dateValue(right.updatedAt)?.getTime() || 0) - (dateValue(left.updatedAt)?.getTime() || 0));
}

function listenToPrivateData() {
  clearSubscriptions();
  if (!state.user) return;

  // Un referente creato dalla regia può essere sospeso o riattivato senza
  // dover uscire. Le vecchie richieste e gli account Google non sono più
  // sottoscrivibili né abilitabili da questa pagina.
  if (!state.isOrganizer && isManagedPasswordAccount(state.operator)) {
    const ownRoleRef = doc(db, 'events', EVENT_ID, 'transferOperators', state.user.uid);
    state.unsubs.push(onSnapshot(ownRoleRef, (snapshot) => {
      const wasActive = isManagedPasswordOperator(state.operator);
      const nextOperator = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      const isActive = isManagedPasswordOperator(nextOperator);
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

  if (!state.isOrganizer && !isManagedPasswordOperator(state.operator)) return;

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
  const pricingRef = doc(db, 'events', EVENT_ID, 'transferPricing', 'default');
  state.unsubs.push(onSnapshot(pricingRef, (snapshot) => {
    state.transferPricing = snapshot.exists() ? snapshot.data() : null;
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
  state.accessRequests = [];
  state.transferOperators = [];
  state.transferPricing = null;
  state.records = [];
  state.boatMemberCounts = {};
  state.allBoats = [];
  state.boatTravelStatus = {};
  render();

  if (!state.user) {
    state.loading = false;
    render();
    return;
  }
  simplifyReservedAreaNavigation();

  try {
    // Il documento evento resta leggibile solo agli organizzatori: per un
    // referente transfer il suo rifiuto e' previsto, non e' un errore di area.
    try {
      const eventSnapshot = await getDoc(doc(db, 'events', EVENT_ID));
      state.event = eventSnapshot.exists() ? eventSnapshot.data() : null;
      state.isOrganizer = Boolean(state.event?.organizerIds?.includes(state.user.uid));
      if (state.isOrganizer) void ensureAllBoatsLoaded();
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
    try {
      const operatorSnapshot = await getDoc(doc(db, 'events', EVENT_ID, 'transferOperators', state.user.uid));
      state.operator = operatorSnapshot.exists() ? { id: operatorSnapshot.id, ...operatorSnapshot.data() } : null;
    } catch (operatorError) {
      // Un Google non organizzatore o un account equipaggio non sono un
      // referente transfer: mostriamo l'uscita chiara, non un errore tecnico.
      console.info('Accesso transfer senza credenziali operative.', operatorError.code || operatorError);
      state.operator = null;
    }
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

function messageForOperator(key, name) {
  return t(key).replace('{name}', name || '—');
}

async function deleteLegacyRequest(requestId, button) {
  if (!state.user || !state.isOrganizer || !requestId) return;
  if (!window.confirm(t('deleteLegacyRequestConfirm'))) return;
  displayMessage('access-management', '');
  if (button) button.disabled = true;
  try {
    await deleteDoc(doc(db, 'events', EVENT_ID, 'transferAccessRequests', requestId));
    displayMessage('access-management', t('deleteLegacyRequestSuccess'));
  } catch (error) {
    console.error('Impossibile eliminare la vecchia richiesta transfer.', error?.code || error);
    displayMessage('access-management', t('approvalError'), true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteLegacyOperator(operatorId, button) {
  if (!state.user || !state.isOrganizer || !operatorId) return;
  if (!window.confirm(t('deleteLegacyOperatorConfirm'))) return;
  displayMessage('access-management', '');
  if (button) button.disabled = true;
  try {
    await deleteDoc(doc(db, 'events', EVENT_ID, 'transferOperators', operatorId));
    displayMessage('access-management', t('deleteLegacyOperatorSuccess'));
  } catch (error) {
    console.error('Impossibile rimuovere il vecchio accesso transfer.', error?.code || error);
    displayMessage('access-management', t('approvalError'), true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function saveTransferPricing(form) {
  if (!state.user || !state.isOrganizer) return;
  const values = new FormData(form);
  const tpsPricePerPersonCents = toEuroCents(values.get('tpsPrice'));
  const pmoPricePerPersonCents = toEuroCents(values.get('pmoPrice'));
  const minimumBillablePersons = Math.round(Number(normalizeEuroInputString(values.get('minimumPersons'))));
  const submit = form.querySelector('button[type="submit"]');
  if (!Number.isInteger(minimumBillablePersons) || minimumBillablePersons < 1) {
    displayMessage('pricing', t('pricingError'), true);
    return;
  }
  displayMessage('pricing', '');
  if (submit) submit.disabled = true;
  try {
    await setDoc(doc(db, 'events', EVENT_ID, 'transferPricing', 'default'), {
      tpsPricePerPersonCents,
      pmoPricePerPersonCents,
      minimumBillablePersons,
      updatedAt: serverTimestamp(),
      updatedBy: state.user.uid,
    });
    displayMessage('pricing', t('pricingSaved'));
  } catch (error) {
    console.error('Impossibile salvare il prezzo del transfer.', error?.code || error);
    displayMessage('pricing', t('pricingError'), true);
  } finally {
    if (submit) submit.disabled = false;
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
  if (action === 'sign-in-organizer') {
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
  if (action === 'delete-legacy-request') await deleteLegacyRequest(button.dataset.requestId, button);
  if (action === 'delete-legacy-operator') await deleteLegacyOperator(button.dataset.operatorId, button);
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
  if (values.has('boat')) {
    const boatValue = String(values.get('boat') || 'all');
    state.filters.boat = boatValue === 'all' || knownBoats().some((boat) => boat.id === boatValue) ? boatValue : 'all';
  }
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
  const pricingForm = event.target.closest('[data-transfer-pricing-form]');
  if (pricingForm) {
    event.preventDefault();
    saveTransferPricing(pricingForm);
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

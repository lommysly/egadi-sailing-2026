import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getFirestore, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { getBlob, getMetadata, getStorage, ref as storageRef, uploadBytesResumable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';
import { getMissingCharterFields, getMissingSkipperProfileFields, isBoatReadyForPdf, isCharterReady, isSkipperProfileCharterReady, openCapitaneriaPdf } from './crew-pdf.js?v=20260915-skipper-documents-v1';
import { createCrewInviteIdentity, normalizeCrewPhone } from './crew-identity.js';
import { canUsePrivateArea, privateAreaBlockMessage } from './private-area-access.js?v=20260914-en2';
import { DEFAULT_CREW_ROLE, fillRoleFields, roleConfirmationText, roleFromFields } from './crew-roles.js?v=20260914-en2';

const eventId = 'egadi-2026';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
const signInCard = document.querySelector('#signInCard');
const accountCard = document.querySelector('#accountCard');
const registerSection = document.querySelector('#registra-barca');
const dashboard = document.querySelector('#dashboard');
const signInButton = document.querySelector('#signInButton');
const authMessage = document.querySelector('#authMessage');
const PAYMENT_PROFILE_ID = 'default';
const COST_PLAN_ID = 'default';
const SKIPPER_PROFILE_ID = 'default';
const SKIPPER_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;
const SKIPPER_DOCUMENT_KINDS = Object.freeze({
  sailingLicense: Object.freeze({ storageType: 'sailing-license', label: 'patente nautica', downloadName: 'patente-nautica' }),
  radioCertificate: Object.freeze({ storageType: 'radio-certificate', label: 'certificato radio', downloadName: 'certificato-radio' }),
});
const SKIPPER_DOCUMENT_CONTENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal', profileField: 'paypalEnabled', detailsField: 'paypalDetails' },
  { id: 'satispay', label: 'Satispay', profileField: 'satispayEnabled', detailsField: 'satispayDetails' },
  { id: 'revolut', label: 'Revolut', profileField: 'revolutEnabled', detailsField: 'revolutDetails' },
  { id: 'bankTransfer', label: 'Bonifico', profileField: 'bankTransferEnabled' },
];
const FLEET_BOAT_TYPES = new Set(['Catamarano', 'Monoscafo', 'Gommone', 'Altro']);
const FLEET_BERTH_PREFERENCES = new Set(['not_specified', 'cabin_female', 'cabin_male', 'cabin_mixed', 'dinette', 'other']);
const LEGACY_CREW_CABIN_USES = new Set(['not_specified', 'skipper', 'crew']);
const BERTH_RATE_TYPES = [
  { id: 'double_cabin', label: 'Posto in cabina da 2 posti', rateKey: 'doubleCabinCents', defaultReason: 'Quota posto in cabina da 2 posti', count: (totals) => totals.doubleCabins * 2 },
  { id: 'single_cabin', label: 'Posto in cabina da 1 posto', rateKey: 'singleCabinCents', defaultReason: 'Quota posto in cabina da 1 posto', count: (totals) => totals.singleCabins },
  { id: 'dinette', label: 'Posto in dinette trasformabile', rateKey: 'dinetteCents', defaultReason: 'Quota posto in dinette trasformabile', count: (totals) => totals.dinetteBerths },
  { id: 'other', label: 'Altro posto letto', rateKey: 'otherBerthCents', defaultReason: 'Quota altro posto letto', count: (totals) => totals.otherCrewBerths },
];
// Etichette tecniche chiuse: consentono di mostrare a ciascuno solo le
// proprie voci, senza dedurle dalla causale libera del messaggio WhatsApp.
const PAYMENT_CONTRIBUTION_ITEM_LABELS = Object.freeze({
  berth_base: 'Quota posto consigliata',
  berth_double_cabin: 'Posto in cabina da 2 posti',
  berth_single_cabin: 'Posto in cabina da 1 posto',
  berth_dinette: 'Posto in dinette trasformabile',
  berth_other: 'Altro posto letto',
  starter_pack: 'Starter Pack',
  linen_towels: 'Lenzuola e asciugamani',
  protection_insurance: 'Assicurazione cauzione',
  provisions: 'Cambusa',
  fuel: 'Gasolio per la navigazione',
  transfer: 'Transfer da/per il porto',
  shore_dinner: 'Cena a terra programmata',
  mooring_fee: 'Porto / ormeggio programmato',
  other: 'Altra voce',
});
const PAYMENT_CONTRIBUTION_ITEM_IDS = new Set(Object.keys(PAYMENT_CONTRIBUTION_ITEM_LABELS));
const PROJECTION_BERTH_TYPES = Object.freeze({
  to_define: 'Da definire',
  double_cabin: 'Cabina da 2 posti',
  single_cabin: 'Cabina da 1 posto',
  dinette: 'Dinette trasformabile',
  other: 'Altro posto letto',
});
const CONTRIBUTION_ITEM_STATES = new Map([
  ['to_define', 'Da definire'],
  ['included', 'Compreso nella quota'],
  ['extra', 'Da richiedere a parte'],
  ['local', 'Da regolare a parte / da dividere'],
  ['not_applicable', 'Non previsto'],
]);
const DEFAULT_CONTRIBUTION_ITEMS = [
  { id: 'berth', label: 'Quota posto in barca' },
  { id: 'starter_pack', label: 'Starter Pack · servizi selezionati' },
  { id: 'linen_towels', label: 'Lenzuola e asciugamani · voce tecnica Starter Pack' },
  { id: 'protection_insurance', label: 'Assicurazione cauzione' },
  { id: 'provisions', label: 'Cambusa' },
  { id: 'fuel', label: 'Gasolio per la navigazione' },
  { id: 'transfer', label: 'Transfer da/per il porto' },
  { id: 'shore_dinner', label: 'Cena a terra programmata' },
  { id: 'mooring_fee', label: 'Porto / ormeggio programmato' },
  { id: 'refundable_deposit', label: 'Cauzione rimborsabile' },
];
const AUTOMATIC_COST_PLAN_ITEM_IDS = new Set(['starter_pack', 'linen_towels', 'protection_insurance', 'refundable_deposit']);
const DINETTE_RATE_MODES = new Set(['percentage', 'fixed']);
const STARTER_PACK_RATE_MODES = new Set(['total_divided', 'fixed_per_person']);
const PROTECTION_INSURANCE_RATE_MODES = new Set(['total_divided', 'fixed_per_person']);
const BERTH_ROUNDING_MODES = new Set(['automatic', 'ceil_increment', 'manual_up']);
const BERTH_ROUNDING_INCREMENT_CENTS = new Set([100, 500, 1000]);
const FREE_SUPPORT_ROLES = new Set(['co_skipper', 'hostess', 'collaborator']);
const STARTER_PACK_ITEMS = Object.freeze([
  { id: 'bed_linen', label: 'Lenzuola' },
  { id: 'bath_towels', label: 'Asciugamani' },
  { id: 'bath_kit', label: 'Kit bagno / consumabili' },
  { id: 'beach_towel', label: 'Telo mare' },
  { id: 'outboard', label: 'Fuoribordo' },
  { id: 'final_cleaning', label: 'Pulizie finali' },
  { id: 'sup', label: 'SUP' },
  { id: 'egadi_navigation_permit', label: 'Permesso / contributo di navigazione Egadi' },
  { id: 'tender', label: 'Tender, se previsto dal charter' },
]);
const STARTER_PACK_ITEM_IDS = new Set(STARTER_PACK_ITEMS.map((item) => item.id));
const DEFAULT_STARTER_PACK_ITEM_IDS = Object.freeze(['bed_linen', 'bath_towels', 'outboard', 'sup']);
const DEFAULT_COST_PLAN_DESCRIPTIONS = Object.freeze({
  starterPackDescription: 'Lenzuola e asciugamani, SUP e fuoribordo.',
  protectionInsuranceDescription: 'Copertura assicurativa della cauzione, separata dalla quota del posto.',
  refundableDepositDescription: 'Cauzione cash all’imbarco: restituzione dopo il check-out del charter; in caso di danno, dopo la chiusura della pratica.',
});
const DEFAULT_CONTRIBUTION_DESCRIPTIONS = Object.freeze({
  berth: 'Il valore dipende dalla sistemazione assegnata dallo skipper.',
  starter_pack: DEFAULT_COST_PLAN_DESCRIPTIONS.starterPackDescription,
  linen_towels: 'Gestita dentro lo Starter Pack.',
  protection_insurance: DEFAULT_COST_PLAN_DESCRIPTIONS.protectionInsuranceDescription,
  provisions: 'Cambusa da dividere tra chi partecipa.',
  fuel: 'Gasolio effettivamente consumato: si calcola a parte al rientro.',
  transfer: 'Transfer aeroporto ↔ porto, andata e ritorno: sempre fuori dallo Starter Pack.',
  shore_dinner: 'Cena a terra, solo se organizzata per quella serata.',
  mooring_fee: 'Porto, ormeggio o boa: solo se non già compresi.',
  refundable_deposit: DEFAULT_COST_PLAN_DESCRIPTIONS.refundableDepositDescription,
});

function normalizeStarterPackItems(value, { fallbackToDefault = false } = {}) {
  const selected = Array.isArray(value)
    ? value.filter((itemId) => typeof itemId === 'string' && STARTER_PACK_ITEM_IDS.has(itemId))
    : [];
  const unique = [...new Set(selected)];
  if (unique.length || Array.isArray(value) || !fallbackToDefault) return unique;
  return [...DEFAULT_STARTER_PACK_ITEM_IDS];
}

function starterPackItemsLabel(value) {
  const labels = normalizeStarterPackItems(value)
    .map((itemId) => STARTER_PACK_ITEMS.find((item) => item.id === itemId)?.label)
    .filter(Boolean);
  return labels.length ? labels.join(', ') : 'servizi da definire con lo skipper';
}

function starterPackDescriptionFor(value) {
  return `Comprende: ${starterPackItemsLabel(value)}.`;
}

function contributionDescriptionFor(itemId, starterPackItems = []) {
  if (itemId === 'starter_pack') return `${starterPackDescriptionFor(starterPackItems)} Si regola solo in contanti a bordo.`;
  return DEFAULT_CONTRIBUTION_DESCRIPTIONS[itemId] || '';
}
const DEFAULT_RULES_SUMMARY = [
  '1. Seguo sempre le decisioni dello skipper su sicurezza, manovre, meteo, rotta, rada e porto.',
  '2. Partecipo al briefing pratico e uso le dotazioni di sicurezza quando richiesto.',
  '3. In navigazione mi muovo con prudenza: una mano per me e una per la barca.',
  '4. In emergenza avviso subito lo skipper e seguo le istruzioni senza improvvisare.',
  '5. Non uso gas, tender, radio di bordo, verricello dell’ancora, motore o dotazioni senza autorizzazione.',
  '6. Uso con cura acqua, corrente, WC, cucina e rifiuti; rispetto cabine, spazi comuni, silenzio e orari.',
  '7. Niente droghe; alcol con responsabilità; fumo solo nelle zone comunicate dallo skipper.',
  '8. Avviso se mi allontano, tengo in ordine bagagli e oggetti e collaboro alla vita comune della barca.',
].join('\n');
const DEFAULT_FULL_RULES = [
  'REGOLAMENTO DI BORDO · EGADI SAILING EXPERIENCE 2026',
  '',
  'Premessa',
  'Questo regolamento si applica alla vita a bordo della barca indicata nell’invito. Meteo, rotta, rada (sosta o notte con la barca ancorata fuori dal porto), porto e programma possono cambiare: la sicurezza viene prima del programma. Le condizioni specifiche della barca, del charter e del porto vengono confermate dallo skipper.',
  '',
  '1. Skipper e decisioni di navigazione',
  'Le decisioni su sicurezza, manovre, navigazione, rada e porto spettano allo skipper. In caso di dubbio chiedi prima di agire; non prendere iniziative che possano mettere a rischio persone, barca o ambiente.',
  '',
  '2. Sicurezza e movimenti a bordo',
  'In navigazione una mano per te e una per la barca. Cammina piano, non correre a piedi nudi e usa scarpe idonee quando richiesto. Fai attenzione al boma (la barra orizzontale della vela), alle cime in tensione (corde che tirano), ai winch (tamburi che avvolgono le cime), alle gallocce dove sono fissate, agli oblò, alle scalette, ai ponti bagnati e agli oggetti in movimento. Bagagli e oggetti personali devono restare ordinati e assicurati.',
  '',
  '3. Briefing pratico ed emergenze',
  'Partecipa al briefing pratico svolto a bordo su giubbotti, life line (cavi di sicurezza), zattera di salvataggio, estintori, radio VHF, gas, procedure per una persona caduta in acqua e dotazioni reali della barca. Indossa il giubbotto quando richiesto. Se una persona cade in acqua, avvisa subito, indicala senza perderla di vista e segui le istruzioni dello skipper.',
  '',
  '4. Dotazioni, risorse e WC',
  'Non usare gas, tender (il piccolo gommone di servizio), radio VHF, verricello dell’ancora, motore o altre dotazioni senza autorizzazione e istruzioni. Non lasciare ricariche incustodite o in carica durante la notte salvo indicazione dello skipper. Acqua ed elettricità sono risorse limitate: usa docce, rubinetti e dispositivi con attenzione. Nel WC va solo materiale biologico; niente carta, salviette, assorbenti o altri oggetti.',
  '',
  '5. Salute e comportamento responsabile',
  'Non fare nulla che possa mettere in pericolo te stesso o gli altri. Le droghe sono vietate; l’alcol va consumato con responsabilità, soprattutto prima o durante manovre, tender e navigazione. Comunica in privato allo skipper allergie, intolleranze, esigenze alimentari o informazioni utili alla sicurezza. Porta eventuali farmaci personali secondo le indicazioni del tuo medico o farmacista.',
  '',
  '6. Rispetto e vita comune',
  'Rispetta cabine e spazi personali: non entrare senza permesso. Mantieni puliti e ordinati gli spazi comuni, rispetta il silenzio e il riposo degli altri, usa cuffie o un volume discreto. Cambusa, cucina, riordino e pulizia si gestiscono con collaborazione equa: chi cucina non deve restare da solo con tutto il resto.',
  '',
  '7. Fumo, rifiuti e rispetto dell’ambiente',
  'Fuma solo nelle zone indicate dallo skipper e dal charter; mai sottocoperta. Usa il posacenere e non gettare mai mozziconi o rifiuti in mare. Rispetta anche i vicini di rada, il porto e le aree marine protette.',
  '',
  '8. Tender, uscite e orari',
  'Usa il tender solo se autorizzato e con le istruzioni ricevute. Avvisa sempre qualcuno se ti allontani dalla barca, soprattutto di sera o di notte. Rispetta gli orari comunicati per imbarco, partenze, rientri e incontri. Eventuali turni di guardia o navigazione notturna esistono solo se annunciati espressamente dallo skipper.',
  '',
  '9. Preparazione personale',
  'Porta documento valido, borsa morbida invece di trolley, abbigliamento a strati per vento e sera, protezione solare, cappellino, scarpe con suola chiara/non-marking e una piccola borsa stagna per le uscite a terra. Le istruzioni della barca prevalgono su questa lista generale.',
  '',
  '10. Spesa a bordo, costi e condizioni specifiche',
  'Cambusa, extra, eventuali quote e condizioni del charter vengono comunicati dallo skipper della singola barca prima di qualsiasi richiesta. La conferma online attesta la lettura integrale di questo testo; non sostituisce il briefing pratico obbligatorio a bordo.',
  '',
  '11. Cauzione rimborsabile',
  'La cauzione si consegna in contanti all’imbarco e resta custodita dal charter. Dopo il check-out viene restituita se non emergono danni. Se invece si verifica un danno, il charter può trattenere la somma necessaria finché non conclude la perizia; l’eventuale parte residua viene restituita quando la pratica assicurativa è chiusa.',
].join('\n');
const DEFAULT_RULES_SUMMARY_EN = [
  '1. I always follow the skipper’s decisions on safety, manoeuvres, weather, route, anchorage and harbour.',
  '2. I take part in the practical briefing and use safety equipment whenever requested.',
  '3. While under way, I move carefully: one hand for myself and one for the boat.',
  '4. In an emergency, I alert the skipper immediately and follow instructions without improvising.',
  '5. I do not use gas, the tender, the VHF radio, the windlass (anchor motor), engine or other equipment without permission.',
  '6. I use water, power, heads, galley and waste facilities with care; I respect cabins, shared spaces, quiet hours and timings.',
  '7. No drugs; alcohol responsibly; smoking only in areas specified by the skipper.',
  '8. I let the crew know if I leave the boat, keep my belongings secure and contribute to life on board.',
].join('\n');
const DEFAULT_FULL_RULES_EN = [
  'BOARD RULES · EGADI SAILING EXPERIENCE 2026',
  '',
  'Introduction',
  'These rules apply to life on board the boat named in the invitation. Weather, route, anchorage (staying outside a harbour with the boat secured or anchored), harbour and programme may change: safety always takes priority over the programme. The skipper confirms the specific arrangements for the boat, charter and harbour.',
  '',
  '1. Skipper and navigation decisions',
  'The skipper is responsible for decisions about safety, manoeuvres, navigation, anchorage and harbour. If you are unsure, ask before acting. Do not take any initiative that could put people, the boat or the environment at risk.',
  '',
  '2. Safety and moving around on board',
  'While under way, keep one hand for yourself and one for the boat. Walk slowly, do not run barefoot, and wear suitable footwear when asked. Watch out for the boom (the horizontal bar at the base of a sail), loaded lines (ropes under tension), winches (drums that tighten lines), cleats where lines are secured, hatches, ladders, wet decks and moving objects. Luggage and personal belongings must be kept tidy and secured.',
  '',
  '3. Practical briefing and emergencies',
  'Take part in the practical briefing on board covering lifejackets, lifelines (safety lines), the liferaft, extinguishers, the VHF radio, gas, procedures for someone overboard and the boat’s actual equipment. Wear a lifejacket when asked. If someone goes overboard, raise the alarm immediately, keep pointing to the person without losing sight of them, and follow the skipper’s instructions.',
  '',
  '4. Equipment, resources and heads',
  'Do not use gas, the tender (the small service dinghy), the VHF radio, the windlass (the anchor motor), the engine or other equipment without permission and instruction. Do not leave chargers unattended or charging overnight unless the skipper says otherwise. Water and electricity are limited resources: use showers, taps and devices carefully. Only biological waste goes into the heads—never paper, wipes, sanitary products or other objects.',
  '',
  '5. Health and responsible behaviour',
  'Do nothing that could endanger yourself or others. Drugs are not allowed. Alcohol must be consumed responsibly, especially before or during manoeuvres, tender trips and sailing. Tell the skipper privately about allergies, intolerances, dietary needs or anything relevant to safety. Bring any personal medication according to your doctor’s or pharmacist’s advice.',
  '',
  '6. Respect and shared life',
  'Respect cabins and personal space: do not enter without permission. Keep shared spaces clean and tidy, respect quiet time and other people’s rest, and use headphones or a considerate volume. Provisions, cooking, tidying and cleaning are shared fairly: the person cooking should not be left to handle everything else alone.',
  '',
  '7. Smoking, waste and the marine environment',
  'Smoke only in the areas specified by the skipper and charter company, never below deck. Use an ashtray and never throw cigarette ends or waste into the sea. Respect neighbouring boats at anchor, the harbour and marine protected areas.',
  '',
  '8. Tender, trips ashore and timings',
  'Use the tender only with permission and after receiving instructions. Always tell someone if you leave the boat, especially in the evening or at night. Respect the announced times for boarding, departures, returns and meet-ups. Any watch system or night sailing only applies if the skipper expressly announces it.',
  '',
  '9. Personal preparation',
  'Bring a valid document, a soft bag rather than a rigid suitcase, layers for wind and evenings, sunscreen, a hat, light-soled non-marking shoes and a small dry bag for trips ashore. Instructions for the specific boat take priority over this general list.',
  '',
  '10. Provisions, costs and boat-specific arrangements',
  'Provisions, extras, any contributions and charter conditions are communicated by the skipper of each boat before any request is made. Online acceptance confirms that you have read this text in full; it does not replace the compulsory practical briefing on board.',
  '',
  '11. Refundable deposit',
  'The deposit is handed over in cash at boarding and held by the charter company. It is returned after check-out if no damage is found. If damage occurs, the charter company may retain the amount needed until its assessment is complete; any remaining balance is returned when the insurance process is closed.',
].join('\n');
let activeBoat = null;
let activeMembers = [];
let activePayments = [];
let activeInvites = [];
let activeProjections = [];
let activePaymentProfile = null;
let activeContributionPlan = null;
let activeCostPlan = null;
let activeBriefing = null;
let activeAcceptances = [];
let activeSkipperProfile = null;
let activeSkipperDocumentCopies = emptySkipperDocumentCopies('idle');
let skipperDocumentsEpoch = 0;
const activeSkipperDocumentUploads = new Map();
let skipperAnnouncementCount = 0;
let stopBoatSubscription = null;
let stopMemberSubscription = null;
let stopPaymentSubscription = null;
let stopPaymentProfileSubscription = null;
let stopContributionPlanSubscription = null;
let stopCostPlanSubscription = null;
let stopInviteSubscription = null;
let stopProjectionSubscription = null;
let stopBriefingSubscription = null;
let stopAnnouncementSubscription = null;
let stopAcceptanceSubscription = null;
let stopSkipperProfileSubscription = null;
let creatingBoat = false;
let editingBoatId = null;
let editingMemberId = null;
let editingProjectionId = null;
// Una quota già comunicata non deve cambiare mentre si aggiorna il posto.
// Questo stato apre invece, in modo esplicito, l'unico percorso che consente
// di rivedere l'accordo economico della persona.
let editingInvitedPricing = false;
let linkingLegacyInviteId = null;
const fleetPublicationInProgress = new Set();
let fleetAvailabilitySyncInProgress = false;
const SKIPPER_DASHBOARD_HASHES = Object.freeze({
  overview: 'skipper-panorama',
  crew: 'skipper-equipaggio',
  profile: 'skipper-profilo',
  money: 'skipper-conti',
  boat: 'skipper-barca',
  board: 'skipper-bacheca',
});
const SKIPPER_DASHBOARD_LABELS = Object.freeze({
  overview: 'Panoramica',
  crew: 'Equipaggio',
  profile: 'Il tuo dossier',
  money: 'Quote e conti',
  boat: 'Barca e flotta',
  board: 'Regole e avvisi',
});
const BRIEFING_RULE_FIELDS = Object.freeze([
  'rulesTitle',
  'rulesSummary',
  'rulesText',
  'rulesTitleEn',
  'rulesSummaryEn',
  'rulesTextEn',
]);
const BRIEFING_TRIP_FIELDS = Object.freeze([
  'meetingPoint',
  'boardingAt',
  'departureAt',
  'returnAt',
  'scheduleNote',
  'scheduleNoteEn',
]);
const SKIPPER_FINANCE_VIEWS = Object.freeze({
  overview: 'overview',
  setup: 'setup',
  request: 'request',
  review: 'review',
});
let skipperDashboardView = 'overview';
let skipperDashboardInitialized = false;
let skipperFinanceDashboardInitialized = false;

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function emptySkipperDocumentCopies(state = 'checking') {
  return Object.fromEntries(Object.keys(SKIPPER_DOCUMENT_KINDS).map((key) => [key, {
    state,
    metadata: null,
    progress: null,
  }]));
}

function skipperDocumentReference(boatId, documentKey) {
  const documentDefinition = SKIPPER_DOCUMENT_KINDS[documentKey];
  if (!documentDefinition || !boatId) return null;
  return storageRef(storage, `boats/${boatId}/skipper-documents/${documentDefinition.storageType}/current`);
}

function isCurrentSkipperDocumentContext(boatId, uid, epoch) {
  return activeBoat?.id === boatId
    && auth.currentUser?.uid === uid
    && skipperDocumentsEpoch === epoch;
}

function documentCopyIsUploaded(documentKey) {
  return activeSkipperDocumentCopies?.[documentKey]?.state === 'uploaded';
}

function skipperDocumentExtension(contentType) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  return 'pdf';
}

function getStorageErrorMessage(error, fallbackMessage) {
  console.error('Egadi Storage:', error);
  if (error?.code === 'storage/unauthorized') {
    return 'Operazione non autorizzata. Esci e rientra con l’account Google associato alla barca, poi riprova.';
  }
  if (error?.code === 'storage/quota-exceeded') {
    return 'Lo spazio documenti non è disponibile in questo momento. Riprova più tardi.';
  }
  if (error?.code === 'storage/retry-limit-exceeded' || error?.code === 'storage/unavailable') {
    return 'Connessione ai documenti non disponibile. Controlla la rete e riprova.';
  }
  return fallbackMessage;
}

function renderSkipperDocumentCopies() {
  const hasActiveSkipperDocumentUpload = activeSkipperDocumentUploads.size > 0;
  Object.entries(SKIPPER_DOCUMENT_KINDS).forEach(([documentKey, definition]) => {
    const copy = activeSkipperDocumentCopies?.[documentKey] || { state: 'idle' };
    const card = document.querySelector(`[data-skipper-document-card="${documentKey}"]`);
    const state = document.querySelector(`[data-skipper-document-state="${documentKey}"]`);
    const uploadButton = document.querySelector(`[data-skipper-document-upload="${documentKey}"]`);
    const downloadButton = document.querySelector(`[data-skipper-document-download="${documentKey}"]`);
    const input = document.querySelector(`[data-skipper-document-input="${documentKey}"]`);
    const isUploading = copy.state === 'uploading';
    const isUploaded = copy.state === 'uploaded';
    const stateText = {
      idle: 'Accedi alla tua barca per gestire la copia privata.',
      checking: 'Controllo della copia privata…',
      missing: `Manca la copia della ${definition.label}.`,
      uploaded: 'Copia privata archiviata. Non è stata inviata al charter.',
      error: 'Non riesco a verificare la copia. Ricarica la pagina e riprova.',
    }[copy.state] || 'Controllo della copia privata…';
    const uploadText = isUploading
      ? `Caricamento ${Math.max(0, Math.min(100, Math.round(copy.progress || 0)))}%`
      : isUploaded ? 'Sostituisci copia' : 'Scegli e carica copia';

    if (state) state.textContent = isUploading ? `Caricamento privato in corso: ${Math.max(0, Math.min(100, Math.round(copy.progress || 0)))}%.` : stateText;
    if (uploadButton) {
      uploadButton.textContent = uploadText;
      uploadButton.disabled = hasActiveSkipperDocumentUpload || !activeBoat;
    }
    if (downloadButton) downloadButton.disabled = !isUploaded || isUploading;
    if (input) input.disabled = hasActiveSkipperDocumentUpload || !activeBoat;
    if (card) {
      card.classList.toggle('is-uploaded', isUploaded);
      card.classList.toggle('is-uploading', isUploading);
      card.classList.toggle('is-error', copy.state === 'error');
    }
  });
}

function resetSkipperDocumentCopies(state = 'idle') {
  skipperDocumentsEpoch += 1;
  activeSkipperDocumentUploads.forEach((task) => task.cancel());
  activeSkipperDocumentUploads.clear();
  activeSkipperDocumentCopies = emptySkipperDocumentCopies(state);
  document.querySelectorAll('[data-skipper-document-input]').forEach((input) => {
    input.value = '';
  });
  renderSkipperDocumentCopies();
}

async function refreshSkipperDocumentCopies(boatId = activeBoat?.id) {
  const uid = auth.currentUser?.uid;
  if (!boatId || !uid) {
    resetSkipperDocumentCopies('idle');
    return;
  }
  const epoch = skipperDocumentsEpoch + 1;
  skipperDocumentsEpoch = epoch;
  activeSkipperDocumentCopies = emptySkipperDocumentCopies('checking');
  renderSkipperDocumentCopies();

  const copies = await Promise.all(Object.keys(SKIPPER_DOCUMENT_KINDS).map(async (documentKey) => {
    try {
      const metadata = await getMetadata(skipperDocumentReference(boatId, documentKey));
      return [documentKey, { state: 'uploaded', metadata, progress: null }];
    } catch (error) {
      if (error?.code === 'storage/object-not-found') {
        return [documentKey, { state: 'missing', metadata: null, progress: null }];
      }
      console.error('Egadi Storage metadata:', error);
      return [documentKey, { state: 'error', metadata: null, progress: null }];
    }
  }));

  if (!isCurrentSkipperDocumentContext(boatId, uid, epoch)) return;
  activeSkipperDocumentCopies = Object.fromEntries(copies);
  renderSkipperDocumentCopies();
  renderSkipperProfileStatus();
  updateCharterReadiness();
  renderSkipperDashboardOverview();
}

function validateSkipperDocumentFile(file) {
  if (!file) return 'Scegli prima una copia da caricare.';
  if (!SKIPPER_DOCUMENT_CONTENT_TYPES.has(file.type)) {
    return 'Sono accettati soltanto PDF, JPG o PNG. Se il file è in un altro formato, esportalo prima in uno di questi.';
  }
  if (file.size <= 0) return 'Il file selezionato è vuoto. Scegline un altro.';
  if (file.size > SKIPPER_DOCUMENT_MAX_BYTES) return 'La copia supera 8 MB. Riduci il file e riprova.';
  return '';
}

async function uploadSkipperDocumentCopy(documentKey, file) {
  const message = document.querySelector('#skipperProfileMessage');
  const documentDefinition = SKIPPER_DOCUMENT_KINDS[documentKey];
  const boatId = activeBoat?.id;
  const uid = auth.currentUser?.uid;
  if (blockPrivateAction(message) || !documentDefinition || !boatId || !uid) return;
  if (activeSkipperDocumentUploads.has(documentKey)) return;
  if (activeSkipperDocumentUploads.size > 0) {
    setMessage(message, 'Attendi che il caricamento in corso sia concluso prima di gestire l’altra copia.', true);
    return;
  }

  const validationMessage = validateSkipperDocumentFile(file);
  if (validationMessage) {
    setMessage(message, validationMessage, true);
    return;
  }
  if (documentCopyIsUploaded(documentKey) && !window.confirm(`Vuoi sostituire la copia privata della ${documentDefinition.label}? La copia precedente non resterà disponibile nell’area.`)) return;

  const epoch = skipperDocumentsEpoch;
  const documentReference = skipperDocumentReference(boatId, documentKey);
  const uploadTask = uploadBytesResumable(documentReference, file, {
    contentType: file.type,
    contentDisposition: 'attachment',
    cacheControl: 'private, max-age=0, no-store',
    customMetadata: {
      documentType: documentDefinition.storageType,
      schema: '1',
    },
  });
  activeSkipperDocumentUploads.set(documentKey, uploadTask);
  activeSkipperDocumentCopies = {
    ...activeSkipperDocumentCopies,
    [documentKey]: { state: 'uploading', metadata: null, progress: 0 },
  };
  renderSkipperDocumentCopies();
  setMessage(message, `Carico privatamente la copia della ${documentDefinition.label}…`);
  uploadTask.on('state_changed', (snapshot) => {
    if (!isCurrentSkipperDocumentContext(boatId, uid, epoch)) return;
    activeSkipperDocumentCopies = {
      ...activeSkipperDocumentCopies,
      [documentKey]: {
        state: 'uploading',
        metadata: null,
        progress: snapshot.totalBytes ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0,
      },
    };
    renderSkipperDocumentCopies();
  });

  try {
    await uploadTask;
    if (!isCurrentSkipperDocumentContext(boatId, uid, epoch)) return;
    setMessage(message, `Copia della ${documentDefinition.label} archiviata privatamente. Ricorda di allegarla al charter solo nel canale concordato.`);
    await refreshSkipperDocumentCopies(boatId);
  } catch (error) {
    if (error?.code === 'storage/canceled') return;
    if (isCurrentSkipperDocumentContext(boatId, uid, epoch)) {
      setMessage(message, getStorageErrorMessage(error, `Non riesco a caricare la copia della ${documentDefinition.label}. Riprova.`), true);
      await refreshSkipperDocumentCopies(boatId);
    }
  } finally {
    if (activeSkipperDocumentUploads.get(documentKey) === uploadTask) activeSkipperDocumentUploads.delete(documentKey);
    if (activeBoat?.id === boatId && auth.currentUser?.uid === uid) renderSkipperDocumentCopies();
  }
}

async function downloadSkipperDocumentCopy(documentKey) {
  const message = document.querySelector('#skipperProfileMessage');
  const documentDefinition = SKIPPER_DOCUMENT_KINDS[documentKey];
  const boatId = activeBoat?.id;
  const uid = auth.currentUser?.uid;
  if (blockPrivateAction(message) || !documentDefinition || !boatId || !uid || !documentCopyIsUploaded(documentKey)) return;
  const epoch = skipperDocumentsEpoch;
  const downloadButton = document.querySelector(`[data-skipper-document-download="${documentKey}"]`);
  if (downloadButton) downloadButton.disabled = true;
  setMessage(message, `Preparo la copia privata della ${documentDefinition.label}…`);
  try {
    const blob = await getBlob(skipperDocumentReference(boatId, documentKey), SKIPPER_DOCUMENT_MAX_BYTES);
    if (!isCurrentSkipperDocumentContext(boatId, uid, epoch)) return;
    const contentType = activeSkipperDocumentCopies?.[documentKey]?.metadata?.contentType;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${documentDefinition.downloadName}.${skipperDocumentExtension(contentType)}`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setMessage(message, 'Download avviato. Invia la copia al charter soltanto attraverso il canale concordato.');
  } catch (error) {
    if (isCurrentSkipperDocumentContext(boatId, uid, epoch)) {
      setMessage(message, getStorageErrorMessage(error, 'Non riesco a scaricare la copia privata. Riprova.'), true);
    }
  } finally {
    if (activeBoat?.id === boatId && auth.currentUser?.uid === uid) renderSkipperDocumentCopies();
  }
}

function skipperDashboardViewFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  return Object.entries(SKIPPER_DASHBOARD_HASHES)
    .find(([, value]) => value === hash)?.[0] || 'overview';
}

function skipperDashboardIcon(kind) {
  const paths = {
    crew: '<path d="M8.5 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1.25a2.5 2.5 0 1 0 0-5"/><path d="M2.75 18.5a5.75 5.75 0 0 1 11.5 0M14.25 13.25a5 5 0 0 1 3 4.6"/>',
    profile: '<circle cx="12" cy="8" r="3.25"/><path d="M5.25 20a6.75 6.75 0 0 1 13.5 0M17.5 4.5l1 1 1.75-1.75"/>',
    money: '<rect x="3.5" y="5.25" width="17" height="13.5" rx="2"/><path d="M3.5 9.5h17M15.5 14.25h2.25"/>',
    boat: '<path d="M3 14.5h18l-2.25 4.25H5.25L3 14.5Z"/><path d="M12 3.5v11M12 4l5.25 7H12M11.75 6.25 7 11h4.75"/>',
    board: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5"/>',
    setup: '<path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/><circle cx="12" cy="12" r="4.5"/>',
    request: '<path d="m4 4 16 8-16 8 3-8-3-8Z"/><path d="M7 12h9"/>',
    review: '<path d="M4 19.5V11M10 19.5V4.5M16 19.5V8M22 19.5H2"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[kind] || paths.board}</svg>`;
}

function financeDashboardCard({ view, title, detail, icon }) {
  const button = document.createElement('button');
  button.className = 'dashboard-hub-card finance-dashboard-card';
  button.type = 'button';
  button.dataset.financeView = view;
  button.setAttribute('aria-controls', `skipperFinancePanel-${view}`);

  const iconTarget = document.createElement('span');
  iconTarget.className = 'dashboard-hub-icon';
  iconTarget.innerHTML = skipperDashboardIcon(icon);
  const label = document.createElement('span');
  label.className = 'dashboard-hub-label';
  label.textContent = title;
  const description = document.createElement('small');
  description.textContent = detail;
  button.append(iconTarget, label, description);
  return button;
}

function financeDashboardBackButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'text-button finance-dashboard-back';
  button.dataset.financeView = SKIPPER_FINANCE_VIEWS.overview;
  button.textContent = '← Quote e conti';
  return button;
}

function createFinanceDashboardPanel({ view, eyebrow, title, lead }) {
  const panel = document.createElement('section');
  panel.id = `skipperFinancePanel-${view}`;
  panel.className = 'finance-dashboard-panel';
  panel.dataset.financePanel = view;
  panel.hidden = true;

  const heading = document.createElement('div');
  heading.className = 'finance-dashboard-panel-heading';
  heading.append(financeDashboardBackButton());
  const eyebrowTarget = document.createElement('p');
  eyebrowTarget.className = 'eyebrow';
  eyebrowTarget.textContent = eyebrow;
  const titleTarget = document.createElement('h4');
  titleTarget.tabIndex = -1;
  titleTarget.textContent = title;
  const leadTarget = document.createElement('p');
  leadTarget.className = 'panel-lead';
  leadTarget.textContent = lead;
  heading.append(eyebrowTarget, titleTarget, leadTarget);

  const content = document.createElement('div');
  content.className = 'finance-dashboard-panel-content';
  panel.append(heading, content);
  return { panel, content, titleTarget };
}

function setupSkipperFinanceDashboard() {
  if (skipperFinanceDashboardInitialized) return;
  const moneyPanel = document.querySelector('#paymentProfileForm')?.closest('.dashboard-panel');
  const financeOverview = document.querySelector('#skipperFinanceOverview');
  const paymentProfileForm = document.querySelector('#paymentProfileForm');
  const costPlanPanel = document.querySelector('#costPlanPanel');
  const contributionCatalogPanel = document.querySelector('#contributionCatalogPanel');
  const paymentForm = document.querySelector('#paymentForm');
  const paymentList = document.querySelector('#paymentList');
  if (!moneyPanel || !financeOverview || !paymentProfileForm || !costPlanPanel || !contributionCatalogPanel || !paymentForm || !paymentList) return;

  const initialChildren = Array.from(moneyPanel.children);
  const overviewIndex = initialChildren.indexOf(financeOverview);
  const catalogIndex = initialChildren.indexOf(contributionCatalogPanel);
  const paymentFormIndex = initialChildren.indexOf(paymentForm);
  const profileIntro = initialChildren.slice(0, overviewIndex);
  const requestIntro = initialChildren.slice(catalogIndex + 1, paymentFormIndex);

  const financeDashboard = document.createElement('section');
  financeDashboard.id = 'skipperFinanceDashboard';
  financeDashboard.className = 'skipper-finance-dashboard-shell';
  financeDashboard.setAttribute('aria-label', 'Contributi e conti');

  const overviewPanel = document.createElement('section');
  overviewPanel.id = 'skipperFinancePanel-overview';
  overviewPanel.className = 'finance-dashboard-panel finance-dashboard-hub-panel';
  overviewPanel.dataset.financePanel = SKIPPER_FINANCE_VIEWS.overview;

  const overviewHeading = document.createElement('div');
  overviewHeading.className = 'finance-dashboard-panel-heading';
  const overviewEyebrow = document.createElement('p');
  overviewEyebrow.className = 'eyebrow';
  overviewEyebrow.textContent = 'Area economica privata';
  const overviewTitle = document.createElement('h4');
  overviewTitle.textContent = 'I conti della barca, un passaggio alla volta.';
  const overviewLead = document.createElement('p');
  overviewLead.className = 'panel-lead';
  overviewLead.textContent = 'Qui inserisci le spese, prepari messaggi personali e segni i contributi che hai verificato. Il sito non incassa denaro.';
  overviewHeading.append(overviewEyebrow, overviewTitle, overviewLead);

  const hub = document.createElement('div');
  hub.className = 'dashboard-hub finance-dashboard-hub';
  hub.setAttribute('aria-label', 'Azioni per contributi e conti');
  hub.append(
    financeDashboardCard({
      view: SKIPPER_FINANCE_VIEWS.setup,
      title: 'Imposta',
      detail: 'Metodi di pagamento, spese della barca e cosa è incluso.',
      icon: 'setup',
    }),
    financeDashboardCard({
      view: SKIPPER_FINANCE_VIEWS.request,
      title: 'Richiedi',
      detail: 'Prepara un messaggio personale e apri WhatsApp.',
      icon: 'request',
    }),
    financeDashboardCard({
      view: SKIPPER_FINANCE_VIEWS.review,
      title: 'Controlla',
      detail: 'Riepilogo delle richieste e dei contributi verificati.',
      icon: 'review',
    }),
  );
  overviewPanel.append(overviewHeading, hub);

  const setupPanel = createFinanceDashboardPanel({
    view: SKIPPER_FINANCE_VIEWS.setup,
    eyebrow: '1 · Imposta',
    title: 'Prepara il quadro economico',
    lead: 'Queste informazioni restano nella tua area skipper: l’equipaggio non vede i metodi di incasso né il totale delle spese da recuperare.',
  });
  const requestPanel = createFinanceDashboardPanel({
    view: SKIPPER_FINANCE_VIEWS.request,
    eyebrow: '2 · Richiedi',
    title: 'Prepara una richiesta',
    lead: 'Scegli persona, importo, causale e metodo. WhatsApp apre il messaggio già pronto; il pagamento resta fuori dal sito.',
  });
  const reviewPanel = createFinanceDashboardPanel({
    view: SKIPPER_FINANCE_VIEWS.review,
    eyebrow: '3 · Controlla',
    title: 'Segui richieste e accrediti',
    lead: 'Riepiloga le spese della barca, ricontrolla le richieste inviate e conferma un contributo solo dopo averlo verificato davvero.',
  });

  const profileLead = profileIntro.find((element) => element.classList.contains('panel-lead'));
  const requestLead = requestIntro.find((element) => element.classList.contains('panel-lead'));
  profileIntro.filter((element) => element !== profileLead).forEach((element) => element.remove());
  requestIntro.filter((element) => element !== requestLead).forEach((element) => element.remove());
  if (profileLead) setupPanel.content.append(profileLead);
  // Si definiscono prima le quote, poi gli extra e soltanto alla fine i
  // canali con cui proporre un contributo: evita di parlare di incasso prima
  // di sapere quale cifra comunicare.
  setupPanel.content.append(costPlanPanel, contributionCatalogPanel, paymentProfileForm);
  if (requestLead) requestPanel.content.append(requestLead);
  requestPanel.content.append(paymentForm);
  reviewPanel.content.append(financeOverview, paymentList);
  Array.from(moneyPanel.children)
    .filter((element) => element.classList.contains('board-divider'))
    .forEach((element) => element.remove());

  financeDashboard.append(overviewPanel, setupPanel.panel, requestPanel.panel, reviewPanel.panel);
  moneyPanel.append(financeDashboard);

  financeDashboard.addEventListener('click', (event) => {
    const button = event.target.closest('[data-finance-view]');
    if (!button || !financeDashboard.contains(button)) return;
    const nextView = button.dataset.financeView;
    if (!SKIPPER_FINANCE_VIEWS[nextView]) return;
    setSkipperFinanceDashboardView(nextView, { focus: nextView !== SKIPPER_FINANCE_VIEWS.overview });
  });

  skipperFinanceDashboardInitialized = true;
  setSkipperFinanceDashboardView(SKIPPER_FINANCE_VIEWS.overview);
}

function setSkipperFinanceDashboardView(nextView, { focus = false } = {}) {
  if (!skipperFinanceDashboardInitialized) return;
  const view = SKIPPER_FINANCE_VIEWS[nextView] ? nextView : SKIPPER_FINANCE_VIEWS.overview;
  const financeDashboard = document.querySelector('#skipperFinanceDashboard');
  if (!financeDashboard) return;
  if (view === SKIPPER_FINANCE_VIEWS.setup) {
    const costPlanPanel = document.querySelector('#costPlanPanel');
    if (costPlanPanel) costPlanPanel.open = true;
  }
  financeDashboard.querySelectorAll('[data-finance-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.financePanel !== view;
  });
  financeDashboard.querySelectorAll('[data-finance-view]').forEach((button) => {
    if (button.dataset.financeView === view && view !== SKIPPER_FINANCE_VIEWS.overview) {
      button.setAttribute('aria-current', 'step');
    } else {
      button.removeAttribute('aria-current');
    }
  });
  if (focus && view !== SKIPPER_FINANCE_VIEWS.overview) {
    financeDashboard.querySelector(`[data-finance-panel="${view}"] h4`)?.focus();
  }
}

function setupSkipperDashboard() {
  if (skipperDashboardInitialized) return;
  const grid = dashboard?.querySelector('.dashboard-grid');
  const crewPanel = document.querySelector('#memberForm')?.closest('.dashboard-panel');
  const profilePanel = document.querySelector('#skipperProfileForm')?.closest('.dashboard-panel');
  const moneyPanel = document.querySelector('#paymentProfileForm')?.closest('.dashboard-panel');
  const boatPanel = document.querySelector('#fleetProfileForm')?.closest('.dashboard-panel');
  const boardPanel = document.querySelector('#briefingForm')?.closest('.dashboard-panel');
  if (!dashboard || !grid || !crewPanel || !profilePanel || !moneyPanel || !boatPanel || !boardPanel) return;

  crewPanel.dataset.skipperPanel = 'crew';
  profilePanel.dataset.skipperPanel = 'profile';
  moneyPanel.dataset.skipperPanel = 'money';
  boatPanel.dataset.skipperPanel = 'boat';
  boardPanel.dataset.skipperPanel = 'board';

  const overview = document.createElement('section');
  overview.id = 'skipperDashboardOverview';
  overview.className = 'dashboard-overview skipper-dashboard-overview';
  overview.setAttribute('aria-label', 'Panoramica area skipper');
  overview.innerHTML = `
    <div class="dashboard-overview-heading">
      <div>
        <p class="eyebrow">Area skipper</p>
        <h3>Gestisci la barca,<br /><em>una cosa alla volta.</em></h3>
      </div>
      <p>Equipaggio, conti, dati della barca e regole di sicurezza: apri l’area che ti serve.</p>
    </div>
    <div class="dashboard-hub" aria-label="Aree skipper">
      <button class="dashboard-hub-card dashboard-hub-card-crew" type="button" data-skipper-view="crew">
        <span class="dashboard-hub-icon">${skipperDashboardIcon('crew')}</span><span class="dashboard-hub-label">Equipaggio</span>
        <strong data-skipper-summary="crew">Carico i posti…</strong><small data-skipper-detail="crew">Inviti, elenco per il charter e PDF.</small>
      </button>
      <button class="dashboard-hub-card dashboard-hub-card-profile" type="button" data-skipper-view="profile">
        <span class="dashboard-hub-icon">${skipperDashboardIcon('profile')}</span><span class="dashboard-hub-label">Il tuo dossier</span>
        <strong data-skipper-summary="profile">Carico i tuoi documenti…</strong><small data-skipper-detail="profile">Anagrafica, patente e certificato radio.</small>
      </button>
      <button class="dashboard-hub-card dashboard-hub-card-money" type="button" data-skipper-view="money">
        <span class="dashboard-hub-icon">${skipperDashboardIcon('money')}</span><span class="dashboard-hub-label">Contributi e conti</span>
        <strong data-skipper-summary="money">Carico i conti…</strong><small data-skipper-detail="money">Metodi, importi, spese e richieste.</small>
      </button>
      <button class="dashboard-hub-card dashboard-hub-card-boat" type="button" data-skipper-view="boat">
        <span class="dashboard-hub-icon">${skipperDashboardIcon('boat')}</span><span class="dashboard-hub-label">Barca e flotta</span>
        <strong data-skipper-summary="boat">Carico la barca…</strong><small data-skipper-detail="boat">Sistemazioni e visibilità pubblica.</small>
      </button>
      <button class="dashboard-hub-card dashboard-hub-card-board" type="button" data-skipper-view="board">
        <span class="dashboard-hub-icon">${skipperDashboardIcon('board')}</span><span class="dashboard-hub-label">Regole e bacheca</span>
        <strong data-skipper-summary="board">Carico le regole…</strong><small data-skipper-detail="board">Sicurezza, orari e comunicazioni.</small>
      </button>
    </div>
    <div class="dashboard-next-step"><div><span>Prossimo passo</span><strong id="skipperNextActionText">Preparo la tua panoramica.</strong></div><button id="skipperNextActionButton" class="button button-primary" type="button" data-skipper-view="crew">Apri</button></div>
  `;

  const navigation = document.createElement('nav');
  navigation.id = 'skipperDashboardNavigation';
  navigation.className = 'dashboard-view-navigation';
  navigation.setAttribute('aria-label', 'Sezioni area skipper');
  navigation.innerHTML = Object.entries(SKIPPER_DASHBOARD_LABELS)
    .map(([view, label]) => `<button type="button" data-skipper-view="${view}">${view === 'overview' ? '← ' : ''}${label}</button>`)
    .join('');

  grid.before(overview, navigation);
  setupSkipperFinanceDashboard();
  dashboard.addEventListener('click', (event) => {
    const button = event.target.closest('[data-skipper-view]');
    if (!button || !dashboard.contains(button)) return;
    const view = button.dataset.skipperView;
    if (!SKIPPER_DASHBOARD_HASHES[view]) return;
    const nextHash = `#${SKIPPER_DASHBOARD_HASHES[view]}`;
    if (window.location.hash === nextHash) {
      setSkipperDashboardView(view);
    } else {
      window.location.hash = nextHash;
    }
  });
  window.addEventListener('hashchange', () => setSkipperDashboardView(skipperDashboardViewFromHash()));
  skipperDashboardInitialized = true;
  setSkipperDashboardView(skipperDashboardViewFromHash());
  renderSkipperDashboardOverview();
}

function setSkipperDashboardView(nextView) {
  if (!skipperDashboardInitialized) return;
  const view = SKIPPER_DASHBOARD_HASHES[nextView] ? nextView : 'overview';
  skipperDashboardView = view;
  const overview = document.querySelector('#skipperDashboardOverview');
  const navigation = document.querySelector('#skipperDashboardNavigation');
  const grid = dashboard.querySelector('.dashboard-grid');
  const capacityStatus = document.querySelector('#capacityStatus');
  const editBoatButton = document.querySelector('#editBoatButton');
  overview.hidden = view !== 'overview';
  navigation.hidden = view === 'overview';
  grid.hidden = view === 'overview';
  grid.classList.toggle('dashboard-grid-single-view', view !== 'overview');
  grid.querySelectorAll('[data-skipper-panel]').forEach((panel) => {
    panel.hidden = view === 'overview' || panel.dataset.skipperPanel !== view;
  });
  if (capacityStatus) capacityStatus.hidden = !['overview', 'crew'].includes(view);
  if (editBoatButton) editBoatButton.hidden = !['overview', 'boat'].includes(view);
  document.querySelectorAll('#skipperDashboardNavigation [data-skipper-view]').forEach((button) => {
    const current = button.dataset.skipperView === view;
    button.toggleAttribute('aria-current', current);
  });
  if (view === 'money') setSkipperFinanceDashboardView(SKIPPER_FINANCE_VIEWS.overview);
}

function setSkipperDashboardMetric(name, value, detail) {
  const valueTarget = document.querySelector(`[data-skipper-summary="${name}"]`);
  const detailTarget = document.querySelector(`[data-skipper-detail="${name}"]`);
  if (valueTarget) valueTarget.textContent = value;
  if (detailTarget) detailTarget.textContent = detail;
}

function currentBriefingAcceptanceCount() {
  return activeAcceptances.filter((acceptance) => acceptance.rulesVersion === (activeBriefing?.rulesVersion || 1)
    && (activeBriefing?.fullRulesRequired !== true || acceptance.fullRulesRead === true)).length;
}

function briefingFieldValue(form, field) {
  const input = form?.elements.namedItem(field);
  if (!input) return '';
  if (input instanceof RadioNodeList) return input.value || '';
  if (input.type === 'checkbox') return input.checked ? 'true' : 'false';
  return input.value || '';
}

function briefingFieldChanged(form, field) {
  if (!activeBriefing) return true;
  const current = briefingFieldValue(form, field);
  const previous = field.endsWith('At') ? toDateTimeLocal(activeBriefing[field]) : activeBriefing[field];
  return String(previous ?? '') !== String(current ?? '');
}

function briefingRulesChanged(form) {
  // I documenti legacy possono non avere l'obbligo di lettura integrale.
  // Al primo salvataggio quel passaggio diventa parte delle regole e richiede
  // quindi una nuova accettazione, anche se nessun campo visibile è cambiato.
  return !activeBriefing
    || activeBriefing.fullRulesRequired !== true
    || BRIEFING_RULE_FIELDS.some((field) => briefingFieldChanged(form, field));
}

function briefingTripChanged(form) {
  return !activeBriefing || BRIEFING_TRIP_FIELDS.some((field) => briefingFieldChanged(form, field));
}

function renderBoardRulesOverview() {
  const overview = document.querySelector('#boardRulesOverview');
  const form = document.querySelector('#briefingForm');
  const editor = document.querySelector('#rulesEditor');
  const editorSummary = document.querySelector('#rulesEditorSummary');
  const editorLead = document.querySelector('#rulesEditorLead');
  const rulesButton = form?.querySelector('[data-board-save="rules"]');
  const tripButton = document.querySelector('#saveTripUpdateButton');
  const hasRules = Boolean(activeBriefing?.rulesText);
  const accepted = currentBriefingAcceptanceCount();

  if (overview) {
    if (hasRules) {
      const acceptanceText = accepted === 1
        ? '1 persona ha già confermato la lettura.'
        : `${accepted} persone hanno già confermato la lettura.`;
      overview.innerHTML = `<div class="board-rules-overview-icon" aria-hidden="true">✓</div><div class="board-rules-overview-copy"><p class="eyebrow">Regole di bordo · attive</p><h4>${escapeHtml(activeBriefing.rulesTitle || 'Regolamento di bordo')}</h4><p>${escapeHtml(acceptanceText)} L’equipaggio le legge prima di compilare la Crew List.</p><div class="board-rules-overview-meta"><span>Briefing pratico a bordo</span><span>Testo inglese ${hasOfficialEnglishBriefing() ? 'disponibile' : 'da preparare se serve'}</span></div></div>`;
    } else {
      overview.innerHTML = '<div class="board-rules-overview-icon is-pending" aria-hidden="true">!</div><div class="board-rules-overview-copy"><p class="eyebrow">Regole di bordo · da attivare</p><h4>Prepara il testo che la tua barca condividerà</h4><p>L’equipaggio potrà leggere, confermare e poi compilare la Crew List soltanto dopo l’attivazione.</p><div class="board-rules-overview-meta"><span>Nessuna data da approvare</span><span>Briefing pratico sempre a bordo</span></div></div>';
    }
  }

  if (editorSummary) editorSummary.textContent = hasRules
    ? 'Modifica il regolamento già attivo'
    : 'Prepara il regolamento da leggere prima dell’imbarco';
  if (editorLead) editorLead.textContent = hasRules
    ? 'Modifica qui soltanto il patto di bordo. Se cambi questo testo, chi lo ha già accettato dovrà rileggerlo; gli orari si aggiornano più sotto senza toccare le conferme.'
    : 'Questo è il patto condiviso della barca. Il briefing pratico su giubbotti, dotazioni e procedure reali si farà insieme a bordo.';
  if (rulesButton) rulesButton.textContent = hasRules ? 'Salva modifiche al regolamento' : 'Attiva regolamento di bordo';
  if (tripButton) tripButton.disabled = !hasRules;
  if (editor && !hasRules) editor.open = true;
}

function updateRulesEditorChangeWarning() {
  const form = document.querySelector('#briefingForm');
  const warning = document.querySelector('#rulesChangeWarning');
  if (!form || !warning) return;
  const rulesChanged = Boolean(activeBriefing && briefingRulesChanged(form));
  warning.hidden = !rulesChanged;
  if (!rulesChanged) return;
  const accepted = currentBriefingAcceptanceCount();
  warning.textContent = accepted
    ? `Stai modificando le regole già lette da ${accepted} ${accepted === 1 ? 'persona' : 'persone'}. Dopo il salvataggio dovranno rileggerle e confermarle prima di usare la loro area.`
    : 'Stai modificando il regolamento attivo. Dopo il salvataggio le nuove persone leggeranno questo testo prima della Crew List.';
}

function renderSkipperDashboardOverview() {
  if (!skipperDashboardInitialized) return;
  const capacity = crewSeatLimit();
  const allocated = allocatedCrewSeatCount();
  const pendingInvites = activeInvites.filter((invite) => invite.status === 'pending').length;
  const completedProfiles = activeMembers.length;
  const projectedCrew = activeProjections.length;
  setSkipperDashboardMetric(
    'crew',
    capacity ? `${allocated} di ${capacity} posti` : 'Posti da configurare',
    `${completedProfiles} schede completate · ${pendingInvites} link pronti · ${projectedCrew} proiezioni`,
  );

  const skipperProfileMissing = getMissingSkipperProfileFields(activeSkipperProfile, activeSkipperDocumentCopies);
  setSkipperDashboardMetric(
    'profile',
    isSkipperProfileCharterReady(activeSkipperProfile, activeSkipperDocumentCopies) ? 'Dossier pronto' : 'Dossier da completare',
    isSkipperProfileCharterReady(activeSkipperProfile, activeSkipperDocumentCopies)
      ? 'Anagrafica, abilitazioni e copie private aggiornate.'
      : `${skipperProfileMissing.length} ${skipperProfileMissing.length === 1 ? 'voce da controllare' : 'voci da controllare'} per il charter.`,
  );

  const costPlan = normalizeCostPlan(activeCostPlan);
  const costModel = activeCostPlan ? costPlanQuoteModel(costPlan) : null;
  const pricingMessage = costModel ? automaticCostPlanPricingMessage(costModel) : '';
  const automaticPricingReady = Boolean(costModel && !pricingMessage);
  const targetCents = automaticPricingReady ? costModel.berthRecoveryCents : 0;
  const verifiedCents = activePayments
    .filter((payment) => payment.status === 'verified' && paymentCountsTowardCostPlan(payment))
    .reduce((total, payment) => total + paymentCostRecoveryCents(payment), 0);
  const pendingPayments = activePayments.filter(isPendingPayment).length;
  const collectionMethods = availablePaymentMethods().length;
  setSkipperDashboardMetric(
    'money',
    targetCents ? `${formatCurrency(targetCents / 100)} quota posto da recuperare` : automaticPricingReady ? 'Quote posto da preparare' : 'Completa il preventivo',
    automaticPricingReady
      ? `${collectionMethods} metodi attivi · ${pendingPayments} richieste da verificare · ${formatCurrency(verifiedCents / 100)} quote posto verificate`
      : pricingMessage || 'Inserisci i dati della barca per preparare le quote.',
  );

  const totalBerths = declaredTotalBerths(activeBoat);
  const fleetVisibility = activeBoat?.fleetShowAvailability === false
    ? 'Posti liberi privati nella flotta.'
    : 'Partecipazione e posti liberi pubblicati nella flotta.';
  setSkipperDashboardMetric(
    'boat',
    totalBerths ? `${totalBerths} posti totali a bordo` : 'Configura la barca',
    `${effectiveParticipantCapacity(activeBoat)} posti per partecipanti · ${fleetVisibility}`,
  );

  const currentAcceptanceCount = currentBriefingAcceptanceCount();
  setSkipperDashboardMetric(
    'board',
    activeBriefing?.rulesText ? 'Regole attive' : 'Regole da attivare',
    `${currentAcceptanceCount} conferme · ${skipperAnnouncementCount} comunicazioni pubblicate`,
  );

  renderSkipperFinanceOverview();
  const nextActionText = document.querySelector('#skipperNextActionText');
  const nextActionButton = document.querySelector('#skipperNextActionButton');
  if (!nextActionText || !nextActionButton) return;
  if (!isSkipperProfileCharterReady(activeSkipperProfile, activeSkipperDocumentCopies)) {
    nextActionText.textContent = 'Completa prima il tuo dossier charter: dati, abilitazioni e le due copie private richieste devono essere pronti.';
    nextActionButton.textContent = 'Apri il mio dossier';
    nextActionButton.dataset.skipperView = 'profile';
  } else if (!activeBriefing?.rulesText) {
    nextActionText.textContent = 'Attiva prima le regole di bordo: è il passaggio che permette all’equipaggio di leggere e confermare il patto della barca.';
    nextActionButton.textContent = 'Apri le regole';
    nextActionButton.dataset.skipperView = 'board';
  } else if (!collectionMethods) {
    nextActionText.textContent = 'Configura almeno un metodo di incasso prima di creare richieste personali.';
    nextActionButton.textContent = 'Apri quote e conti';
    nextActionButton.dataset.skipperView = 'money';
  } else if (!allocated) {
    nextActionText.textContent = 'La barca è configurata. Ora puoi riservare il primo posto.';
    nextActionButton.textContent = 'Invita una persona';
    nextActionButton.dataset.skipperView = 'crew';
  } else {
    nextActionText.textContent = 'Tutto è aggiornato. Scegli cosa vuoi fare adesso.';
    nextActionButton.textContent = 'Gestisci equipaggio';
    nextActionButton.dataset.skipperView = 'crew';
  }
}

function contributionConfigSummary(itemId, { deposit = false } = {}) {
  const item = contributionCatalog().find((candidate) => candidate.id === itemId);
  if (!activeContributionPlan || !item) {
    return {
      value: 'Da configurare',
      detail: deposit
        ? 'Indica l’importo a persona e come sarà regolata all’imbarco.'
        : 'Definisci se la voce è compresa, richiesta a parte o regolata separatamente.',
    };
  }
  const amount = item.amountCents > 0 ? `${formatCurrency(item.amountCents / 100)} a persona` : 'Importo da definire';
  if (item.state === 'included') return { value: 'Compreso nella quota', detail: 'Nessuna richiesta separata prevista.' };
  if (item.state === 'not_applicable') return { value: 'Non previsto', detail: 'Non entra nel riepilogo personale.' };
  if (item.state === 'extra') {
    return deposit
      ? { value: amount, detail: 'Configurazione da correggere: la cauzione va regolata all’imbarco, non richiesta via WhatsApp.' }
      : { value: amount, detail: 'Voce separata, richiedibile con messaggio personale.' };
  }
  if (item.state === 'local') {
    return {
      value: amount,
      detail: deposit
        ? 'Da portare e regolare all’imbarco; rimborsabile secondo charter e skipper.'
        : 'Da regolare separatamente o da dividere a bordo.',
    };
  }
  return {
    value: 'Da definire',
    detail: deposit
      ? 'Non è inclusa nell’importo del posto né nel totale delle spese della barca.'
      : 'Non è ancora inclusa né richiesta a parte.',
  };
}

function paymentTotalsForDashboard(amountForPayment = paymentAmountCents) {
  const payments = activePayments.filter((payment) => payment.status !== 'cancelled');
  const paymentCents = (payment) => Math.max(0, Number(amountForPayment(payment)) || 0);
  return {
    requestedCents: payments.reduce((total, payment) => total + paymentCents(payment), 0),
    verifiedCents: payments
      .filter((payment) => payment.status === 'verified')
      .reduce((total, payment) => total + paymentCents(payment), 0),
    pendingCents: payments
      .filter(isPendingPayment)
      .reduce((total, payment) => total + paymentCents(payment), 0),
  };
}

function financeAllocationText(targetCents, projectedCents, requestedCents, verifiedCents, { cash = false, hasTarget = true } = {}) {
  if (!hasTarget) {
    const projected = projectedCents ? formatCurrency(projectedCents / 100) : 'nessuna scheda';
    return cash
      ? `Obiettivo da definire · previsto nelle schede: ${projected} · cash a bordo.`
      : `Obiettivo da definire · previsto nelle schede: ${projected} · una richiesta non è ancora un incasso.`;
  }
  const target = targetCents;
  const projected = projectedCents ? formatCurrency(projectedCents / 100) : 'nessuna scheda';
  const targetText = formatCurrency(targetCents / 100);
  const assignedDelta = projectedCents - targetCents;
  const assignedText = assignedDelta === 0
    ? `Previsto: ${projected}; obiettivo coperto.`
    : assignedDelta > 0
      ? `Previsto: ${projected}; ${formatCurrency(assignedDelta / 100)} oltre l’obiettivo da riallocare.`
      : `Previsto: ${projected}; mancano ${formatCurrency(Math.abs(assignedDelta) / 100)}.`;
  if (cash) return `Obiettivo: ${targetText} · ${assignedText} · cash a bordo: questo prospetto non registra il contante ricevuto.`;
  const balanceCents = verifiedCents - target;
  const verifiedStatus = balanceCents > 0
    ? `${formatCurrency(balanceCents / 100)} oltre l’obiettivo da riallocare.`
    : balanceCents === 0
      ? 'obiettivo coperto con gli accrediti verificati.'
      : `ancora da ricevere: ${formatCurrency(Math.abs(balanceCents) / 100)}.`;
  const verifiedText = `Richiesto: ${formatCurrency(requestedCents / 100)} · verificato: ${formatCurrency(verifiedCents / 100)} · ${verifiedStatus}`;
  return `Obiettivo: ${targetText} · ${assignedText} · ${verifiedText}`;
}

function renderSkipperFinanceOverview(planOverride = activeCostPlan) {
  const overview = document.querySelector('#skipperFinanceOverview');
  if (!overview) return;
  const hasPlan = Boolean(planOverride);
  const plan = normalizeCostPlan(planOverride);
  const model = hasPlan ? costPlanQuoteModel(plan) : null;
  const starterPackItems = normalizeStarterPackItems(activeContributionPlan?.starterPackItems, {
    fallbackToDefault: !Array.isArray(activeContributionPlan?.starterPackItems),
  });
  const starterPackDescription = starterPackDescriptionFor(starterPackItems);
  const projections = activeProjections.map((projection) => projectionCostBreakdown(projection));
  const projectedBerthCents = projections.reduce((total, projection) => total + projection.normalized.berthCents, 0);
  const projectedInsuranceCents = projections.reduce((total, projection) => total + projection.normalized.protectionInsuranceCents, 0);
  const projectedStarterPackCashCents = projections.reduce((total, projection) => total + projection.starterPackCents, 0);
  const projectedDepositCashCents = projections.reduce((total, projection) => total + projection.refundableDepositCents, 0);
  const recoveryPayments = paymentTotalsForDashboard(paymentCostRecoveryCents);
  const insurancePayments = paymentTotalsForDashboard(paymentProtectionInsuranceCents);
  const allPayments = paymentTotalsForDashboard(paymentAmountCents);
  const berthCostTargetCents = model?.berthRecoveryCents || 0;
  const onlineRecoveryTargetCents = model?.allocatedRecoveryCents || 0;
  const insuranceTargetCents = model?.protectionInsuranceTargetCents || 0;
  const starterTargetCents = model?.starterPackTargetCents || 0;
  const depositTargetCents = model?.refundableDepositTotalCents || 0;
  const starterIncluded = model?.starterPackIncludedInCharter === true;
  const pricingMessage = model ? automaticCostPlanPricingMessage(model) : '';
  const automaticPricingReady = Boolean(hasPlan && !pricingMessage);
  const totalContributionTargetCents = automaticPricingReady
    ? onlineRecoveryTargetCents
      + starterTargetCents
      + insuranceTargetCents
    : 0;
  const projectedContributionCents = projectedBerthCents
    + projectedStarterPackCashCents
    + projectedInsuranceCents;
  const coverageDetail = !hasPlan
    ? 'Inserisci costi e ospiti paganti per confrontare la quota proposta con il fabbisogno reale.'
    : !automaticPricingReady
      ? pricingMessage
      : !totalContributionTargetCents
        ? 'Inserisci costi e ospiti paganti per confrontare la quota proposta con il fabbisogno reale.'
      : `Previsto nelle schede: ${formatCurrency(projectedContributionCents / 100)} · quota posto, Pack cash e assicurazione; cauzione esclusa perché rimborsabile. ${model.roundingReserveCents > 0 ? `Riserva da arrotondamento: ${formatCurrency(model.roundingReserveCents / 100)}.` : model.roundingReserveCents < 0 ? `Da coprire nelle quote posto: ${formatCurrency(Math.abs(model.roundingReserveCents) / 100)}.` : 'Quote posto in pareggio.'}`;
  const onlineRecoveryDetail = financeAllocationText(
    onlineRecoveryTargetCents,
    projectedBerthCents,
    recoveryPayments.requestedCents,
    recoveryPayments.verifiedCents,
    { hasTarget: automaticPricingReady },
  );
  const breakEven = automaticPricingReady && model?.standardBerthCents
    ? `${formatCurrency(model.standardBerthCents / 100)} a persona`
    : 'Da calcolare';
  const breakEvenDetail = automaticPricingReady && model?.standardBerthCents
    ? model.dinettePayingParticipants
      ? `Pareggio cabina ${formatCurrency(model.calculatedStandardBerthCents / 100)} · quota proposta ${formatCurrency(model.standardBerthCents / 100)} · dinette ${formatCurrency(model.dinetteBerthCents / 100)}.`
      : `Pareggio ${formatCurrency(model.calculatedStandardBerthCents / 100)} · quota proposta per ${model.payingParticipants} ospiti paganti: ${formatCurrency(model.standardBerthCents / 100)}. È quella applicata alle nuove schede finché non scegli un’eccezione personale.`
    : 'Questo numero diventa la quota proposta alle nuove schede quando il preventivo è completo.';
  const starterTitle = !hasPlan || !model?.starterPackSourceSelected
    ? 'Starter Pack · origine da scegliere'
    : starterIncluded
      ? 'Starter Pack · totale cash · già nel charter'
      : 'Starter Pack · totale cash · esterno al charter';
  const starterValue = !hasPlan || !automaticPricingReady
    ? 'Da compilare'
    : starterTargetCents > 0
      ? formatCurrency(starterTargetCents / 100)
      : 'Non previsto';
  const starterDetailBase = financeAllocationText(starterTargetCents, projectedStarterPackCashCents, 0, 0, {
      cash: true,
      hasTarget: automaticPricingReady && starterTargetCents > 0,
    });
  const starterDetail = !hasPlan
    ? 'Indica prima origine, importo e riparto dello Starter Pack.'
    : !model?.starterPackSourceSelected
      ? 'Scegli se è già nel charter oppure esterno: fino ad allora il sito non propone quote automatiche.'
      : starterIncluded
      ? `${starterPackDescription} · Parte del totale charter: è già escluso dalla quota cabina e si raccoglie in contanti a bordo. ${starterDetailBase}`
        : starterDetailBase;
  const insuranceValue = !hasPlan || !automaticPricingReady
    ? 'Da compilare'
    : insuranceTargetCents > 0
      ? formatCurrency(insuranceTargetCents / 100)
      : 'Non prevista';
  const insuranceDetail = automaticPricingReady && insuranceTargetCents > 0
    ? financeAllocationText(insuranceTargetCents, projectedInsuranceCents, insurancePayments.requestedCents, insurancePayments.verifiedCents, { hasTarget: true })
    : 'Nessuna assicurazione cauzione è stata aggiunta al preventivo.';
  overview.innerHTML = `
    <div class="finance-overview-heading"><p class="eyebrow">Contabilità della barca</p><p>Qui gli importi sono totali, tranne la quota cabina che è per persona. In <strong>Imposta</strong> trovi sia il totale da versare con il metodo concordato sia i contanti da portare a bordo. Una richiesta WhatsApp non è un incasso: il residuo scende soltanto dopo la verifica manuale.</p></div>
    <div class="finance-overview-grid">
      <article class="finance-overview-card"><span>Quote da organizzare · totale</span><strong>${escapeHtml(automaticPricingReady ? formatCurrency(totalContributionTargetCents / 100) : 'Da completare')}</strong><small>${escapeHtml(coverageDetail)}</small></article>
      <article class="finance-overview-card"><span>Quote posto da richiedere · totale</span><strong>${escapeHtml(automaticPricingReady ? formatCurrency(onlineRecoveryTargetCents / 100) : 'Da completare')}</strong><small>${escapeHtml(`${onlineRecoveryDetail} Costi reali attraverso i posti: ${formatCurrency(berthCostTargetCents / 100)}.`)}</small></article>
      <article class="finance-overview-card"><span>Posto cabina standard · persona</span><strong>${escapeHtml(breakEven)}</strong><small>${escapeHtml(breakEvenDetail)}</small></article>
      <article class="finance-overview-card finance-overview-card-extras"><span>${escapeHtml(starterTitle)}</span><strong>${escapeHtml(starterValue)}</strong><small>${escapeHtml(starterDetail)}</small></article>
      <article class="finance-overview-card finance-overview-card-extras"><span>Assicurazione cauzione · totale</span><strong>${escapeHtml(insuranceValue)}</strong><small>${escapeHtml(insuranceDetail)}</small></article>
      <article class="finance-overview-card finance-overview-card-deposit"><span>Cauzione rimborsabile · totale cash</span><strong>${escapeHtml(hasPlan ? formatCurrency(depositTargetCents / 100) : 'Da definire')}</strong><small>${escapeHtml(financeAllocationText(depositTargetCents, projectedDepositCashCents, 0, 0, { cash: true, hasTarget: hasPlan }))} <a class="rules-reference-link" href="#skipper-bacheca">Leggi la regola sulla cauzione</a></small></article>
      <article class="finance-overview-card finance-overview-card-projection"><span>Richieste personali</span><strong>${escapeHtml(formatCurrency(allPayments.requestedCents / 100))}</strong><small>${escapeHtml(`${activeProjections.length} ${activeProjections.length === 1 ? 'scheda equipaggio' : 'schede equipaggio'} · ${formatCurrency(allPayments.pendingCents / 100)} in attesa di verifica · ${formatCurrency(allPayments.verifiedCents / 100)} verificati. Extra programmati restano fuori dal pareggio finché non vengono classificati come spesa della barca.`)}</small></article>
    </div>
  `;
}

function setupBriefingEditor() {
  const form = document.querySelector('#briefingForm');
  const fullRules = form?.elements.rulesText;
  const fullRulesLabel = fullRules?.closest('label');
  if (!form || !fullRules || !fullRulesLabel || form.elements.rulesSummary || form.elements.rulesTextEn) return;

  const labelText = Array.from(fullRulesLabel.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (labelText) labelText.textContent = 'Regolamento di bordo da leggere prima dell’ingresso';
  fullRules.maxLength = 9000;
  fullRules.defaultValue = DEFAULT_FULL_RULES;
  fullRules.value = DEFAULT_FULL_RULES;
  const fullRulesHint = fullRulesLabel.querySelector('.field-hint');
  if (fullRulesHint) fullRulesHint.textContent = 'Questo è il testo integrale che l’equipaggio legge e scorre prima dell’accettazione. Il briefing pratico su giubbotti, dotazioni e procedure reali viene poi fatto insieme a bordo.';

  const summaryLabel = document.createElement('label');
  const summary = document.createElement('textarea');
  const hint = document.createElement('small');
  summary.name = 'rulesSummary';
  summary.required = true;
  summary.maxLength = 1800;
  summary.rows = 9;
  summary.value = DEFAULT_RULES_SUMMARY;
  summary.defaultValue = DEFAULT_RULES_SUMMARY;
  hint.className = 'field-hint';
  hint.textContent = 'Una piccola mappa per orientarsi: non sostituisce il regolamento completo sottostante.';
  summaryLabel.append('Punti essenziali prima dell’accettazione', summary, hint);
  fullRulesLabel.before(summaryLabel);

  const englishDetails = document.createElement('details');
  englishDetails.className = 'briefing-translation-editor';
  const englishSummary = document.createElement('summary');
  englishSummary.textContent = 'Testo inglese ufficiale · necessario per l’equipaggio non italofono';
  const englishLead = document.createElement('p');
  englishLead.className = 'panel-lead';
  englishLead.textContent = 'Questa è la versione che verrà letta e accettata in inglese. Verifica ogni modifica prima di pubblicarla: non viene generata o tradotta automaticamente dal sito.';
  const englishFields = document.createElement('div');
  englishFields.className = 'compact-form';

  const englishTitleLabel = document.createElement('label');
  const englishTitle = document.createElement('input');
  englishTitle.name = 'rulesTitleEn';
  englishTitle.maxLength = 120;
  englishTitle.value = 'Board Rules · Egadi 2026';
  englishTitle.defaultValue = englishTitle.value;
  englishTitleLabel.append('Official English briefing title', englishTitle);

  const englishSummaryLabel = document.createElement('label');
  const englishSummaryText = document.createElement('textarea');
  englishSummaryText.name = 'rulesSummaryEn';
  englishSummaryText.maxLength = 1800;
  englishSummaryText.rows = 9;
  englishSummaryText.value = DEFAULT_RULES_SUMMARY_EN;
  englishSummaryText.defaultValue = DEFAULT_RULES_SUMMARY_EN;
  englishSummaryLabel.append('English summary before acceptance', englishSummaryText);

  const englishRulesLabel = document.createElement('label');
  const englishRulesText = document.createElement('textarea');
  englishRulesText.name = 'rulesTextEn';
  englishRulesText.maxLength = 9000;
  englishRulesText.rows = 22;
  englishRulesText.value = DEFAULT_FULL_RULES_EN;
  englishRulesText.defaultValue = DEFAULT_FULL_RULES_EN;
  const englishHint = document.createElement('small');
  englishHint.className = 'field-hint';
  englishHint.textContent = 'Use clear, approved English for the actual boat, charter and skipper arrangements. Do not leave an English crew member with an automatic or incomplete translation.';
  englishRulesLabel.append('Full official English rules', englishRulesText, englishHint);

  const englishScheduleNoteLabel = document.createElement('label');
  const englishScheduleNote = document.createElement('input');
  englishScheduleNote.name = 'scheduleNoteEn';
  englishScheduleNote.maxLength = 400;
  englishScheduleNote.placeholder = 'E.g. provisions already on board; route adapted to the weather';
  englishScheduleNoteLabel.append('Operational note in English · optional', englishScheduleNote);

  englishFields.append(englishTitleLabel, englishSummaryLabel, englishRulesLabel, englishScheduleNoteLabel);
  englishDetails.append(englishSummary, englishLead, englishFields);
  fullRulesLabel.after(englishDetails);
}

function getAuthErrorMessage(error) {
  if (error.code === 'auth/unauthorized-domain') return 'Questo indirizzo del sito non è ancora autorizzato in Firebase.';
  if (error.code === 'auth/operation-not-allowed') return 'L’accesso con Google non è abilitato nel progetto Firebase.';
  return 'Accesso non completato. Riprova tra poco.';
}

function getFirestoreErrorMessage(error, fallbackMessage) {
  // Il codice è sufficiente per capire il ramo da verificare senza esporre
  // dettagli dei dati personali o delle Rules nella pagina pubblica.
  console.error('Egadi Firestore:', error);
  if (error?.code === 'permission-denied') {
    return 'Operazione non autorizzata. Esci e rientra scegliendo l’account Google che deve essere skipper, poi riprova.';
  }
  if (error?.code === 'unavailable') {
    return 'Connessione a Firestore non disponibile. Controlla la rete e riprova.';
  }
  return fallbackMessage;
}

function getCostPlanSaveErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Non riesco a salvare il preventivo. Controlla di essere nell’area della tua barca e riprova; se il problema resta, non modificare altri importi e avvisa lo skipper o l’organizzatore.';
  }
  return getFirestoreErrorMessage(error, 'Non riesco a salvare il preventivo barca.');
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

function asNonNegativeInteger(value, maximum = 12) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= maximum ? numericValue : 0;
}

function participantCapacityFromTotal(totalBerths) {
  return totalBerths >= 2 ? totalBerths - 1 : 0;
}

function declaredTotalBerths(boat) {
  const storedTotal = asNonNegativeInteger(boat?.totalBerths, 31);
  if (storedTotal >= 2) return storedTotal;
  const layoutTotal = berthLayoutTotals(boat?.berthLayout).physicalBerths;
  if (layoutTotal >= 2) return layoutTotal;
  const legacyParticipantCapacity = asNonNegativeInteger(boat?.capacity, 30);
  return legacyParticipantCapacity ? legacyParticipantCapacity + 1 : 0;
}

function effectiveParticipantCapacity(boat) {
  const totalBerths = declaredTotalBerths(boat);
  if (totalBerths >= 2) return participantCapacityFromTotal(totalBerths);
  const capacity = asNonNegativeInteger(boat?.capacity, 30);
  return capacity;
}

function needsCapacityAlignment(boat) {
  const storedCapacity = asNonNegativeInteger(boat?.capacity, 30);
  const totalBerths = declaredTotalBerths(boat);
  return totalBerths >= 2 && storedCapacity !== participantCapacityFromTotal(totalBerths);
}

function capacityAlignmentMessage(boat) {
  const totalBerths = declaredTotalBerths(boat);
  const capacity = effectiveParticipantCapacity(boat);
  return `Configurazione da confermare: il layout indica ${totalBerths} persone totali, skipper incluso, quindi ${capacity} partecipanti. Apri “Modifica questa barca” e salva prima di inviare altri inviti.`;
}

function toEuroCents(value) {
  const rawValue = String(value ?? '').trim().replace(',', '.');
  if (!rawValue) return 0;
  const amount = Number(rawValue);
  return Number.isFinite(amount) && amount >= 0 && amount <= 10_000 ? Math.round(amount * 100) : 0;
}

function euroInputValue(cents) {
  return cents > 0 ? (cents / 100).toFixed(2) : '';
}

function normalizeBerthRates(rates = {}) {
  return {
    doubleCabinCents: asNonNegativeInteger(rates?.doubleCabinCents, 1_000_000),
    singleCabinCents: asNonNegativeInteger(rates?.singleCabinCents, 1_000_000),
    dinetteCents: asNonNegativeInteger(rates?.dinetteCents, 1_000_000),
    otherBerthCents: asNonNegativeInteger(rates?.otherBerthCents, 1_000_000),
  };
}

function normalizeCostPlanDescription(value, fallback) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 320);
  return normalized || fallback;
}

function crewFacingDescriptionValidationMessage(entries) {
  const forbidden = /https?:\/\/|www\.|@[A-Za-z0-9._-]+\.[A-Za-z]{2,}|\b[A-Za-z]{2}\d{2}[A-Za-z0-9]{11,30}\b|[+]?\d[\d -]{6,}\d|paypal|satispay|revolut|iban|bonifico|causale/i;
  const unsafe = entries.find((entry) => forbidden.test(String(entry.value || '')));
  if (!unsafe) return '';
  return `Nel dettaglio “${unsafe.label}” non inserire link, email, telefono, IBAN, causali o metodi di pagamento: questi restano nel profilo privato e nel messaggio WhatsApp.`;
}

function defaultCostPlan() {
  const payingParticipants = Math.max(1, effectiveParticipantCapacity(activeBoat) || 1);
  return {
    charterCents: 0,
    skipperFlightTrainCents: 0,
    skipperCarCents: 0,
    skipperLocalTransferCents: 0,
    otherRecoverableCents: 0,
    starterPackTotalCents: 0,
    starterPackRateMode: 'total_divided',
    starterPackFixedPerPersonCents: 0,
    // Per una nuova barca non si può presumere dove sia il Pack: una scelta
    // implicita potrebbe farlo recuperare due volte.
    starterPackIncludedInCharter: null,
    protectionInsuranceTotalCents: 0,
    protectionInsuranceRateMode: 'total_divided',
    protectionInsuranceFixedPerPersonCents: 0,
    refundableDepositTotalCents: 0,
    payingParticipants,
    depositParticipants: payingParticipants,
    dinettePayingParticipants: maximumDinettePayingParticipants(payingParticipants),
    dinetteRateMode: 'percentage',
    dinetteWeightPercent: 65,
    dinetteFixedCents: 0,
    berthRoundingMode: 'automatic',
    berthRoundingIncrementCents: 0,
    manualStandardBerthCents: 0,
    ...DEFAULT_COST_PLAN_DESCRIPTIONS,
  };
}

function maximumPayingParticipants() {
  return Math.max(1, effectiveParticipantCapacity(activeBoat) || 30);
}

function maximumDepositParticipants() {
  return maximumPayingParticipants();
}

function maximumDinettePayingParticipants(payingParticipants = maximumPayingParticipants()) {
  const dinetteBerths = berthLayoutTotals(activeBoat?.berthLayout).dinetteBerths;
  return Math.min(dinetteBerths, asNonNegativeInteger(payingParticipants, maximumPayingParticipants()));
}

function normalizeDinetteWeightPercent(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 100 ? numericValue : 65;
}

function normalizeDinetteRateMode(value) {
  return DINETTE_RATE_MODES.has(value) ? value : 'percentage';
}

function normalizeStarterPackRateMode(value) {
  return STARTER_PACK_RATE_MODES.has(value) ? value : 'total_divided';
}

function normalizeProtectionInsuranceRateMode(value) {
  return PROTECTION_INSURANCE_RATE_MODES.has(value) ? value : 'total_divided';
}

function normalizeBerthRoundingMode(value) {
  return BERTH_ROUNDING_MODES.has(value) ? value : 'automatic';
}

function normalizeBerthRoundingIncrementCents(value) {
  const numericValue = Number(value);
  return BERTH_ROUNDING_INCREMENT_CENTS.has(numericValue) ? numericValue : 100;
}

function roundUpToIncrement(cents, incrementCents) {
  if (!cents || incrementCents < 1) return 0;
  return Math.ceil(cents / incrementCents) * incrementCents;
}

function normalizeCostPlan(plan = {}) {
  const defaults = defaultCostPlan();
  const payingParticipants = asNonNegativeInteger(plan?.payingParticipants, maximumPayingParticipants());
  const normalizedPayingParticipants = payingParticipants || defaults.payingParticipants;
  const rawDepositParticipants = Number(plan?.depositParticipants);
  const depositParticipants = Number.isInteger(rawDepositParticipants) && rawDepositParticipants >= 1
    ? asNonNegativeInteger(rawDepositParticipants, maximumDepositParticipants())
    : normalizedPayingParticipants;
  const maxDinetteParticipants = maximumDinettePayingParticipants(normalizedPayingParticipants);
  const rawDinetteParticipants = Number(plan?.dinettePayingParticipants);
  const dinettePayingParticipants = Number.isInteger(rawDinetteParticipants) && rawDinetteParticipants >= 0
    ? asNonNegativeInteger(rawDinetteParticipants, maxDinetteParticipants)
    : Math.min(defaults.dinettePayingParticipants, maxDinetteParticipants);
  const starterPackRateMode = normalizeStarterPackRateMode(plan?.starterPackRateMode);
  const protectionInsuranceRateMode = normalizeProtectionInsuranceRateMode(plan?.protectionInsuranceRateMode);
  const berthRoundingMode = normalizeBerthRoundingMode(plan?.berthRoundingMode);
  const starterPackTotalCents = starterPackRateMode === 'total_divided'
    ? asNonNegativeInteger(plan?.starterPackTotalCents, 1_000_000)
    : 0;
  const starterPackFixedPerPersonCents = starterPackRateMode === 'fixed_per_person'
    ? asNonNegativeInteger(plan?.starterPackFixedPerPersonCents, 1_000_000)
    : 0;
  const protectionInsuranceTotalCents = protectionInsuranceRateMode === 'total_divided'
    ? asNonNegativeInteger(plan?.protectionInsuranceTotalCents, 1_000_000)
    : 0;
  const protectionInsuranceFixedPerPersonCents = protectionInsuranceRateMode === 'fixed_per_person'
    ? asNonNegativeInteger(plan?.protectionInsuranceFixedPerPersonCents, 1_000_000)
    : 0;
  return {
    charterCents: asNonNegativeInteger(plan?.charterCents, 1_000_000),
    skipperFlightTrainCents: asNonNegativeInteger(plan?.skipperFlightTrainCents, 1_000_000),
    skipperCarCents: asNonNegativeInteger(plan?.skipperCarCents, 1_000_000),
    skipperLocalTransferCents: asNonNegativeInteger(plan?.skipperLocalTransferCents, 1_000_000),
    otherRecoverableCents: asNonNegativeInteger(plan?.otherRecoverableCents, 1_000_000),
    starterPackTotalCents,
    starterPackRateMode,
    starterPackFixedPerPersonCents,
    starterPackIncludedInCharter: plan?.starterPackIncludedInCharter === true,
    starterPackSourceSelected: typeof plan?.starterPackIncludedInCharter === 'boolean',
    protectionInsuranceTotalCents,
    protectionInsuranceRateMode,
    protectionInsuranceFixedPerPersonCents,
    refundableDepositTotalCents: asNonNegativeInteger(plan?.refundableDepositTotalCents, 1_000_000),
    payingParticipants: normalizedPayingParticipants,
    depositParticipants: depositParticipants || normalizedPayingParticipants,
    dinettePayingParticipants,
    dinetteRateMode: normalizeDinetteRateMode(plan?.dinetteRateMode),
    dinetteWeightPercent: normalizeDinetteWeightPercent(plan?.dinetteWeightPercent),
    dinetteFixedCents: asNonNegativeInteger(plan?.dinetteFixedCents, 1_000_000),
    berthRoundingMode,
    berthRoundingIncrementCents: berthRoundingMode === 'ceil_increment'
      ? normalizeBerthRoundingIncrementCents(plan?.berthRoundingIncrementCents)
      : 0,
    manualStandardBerthCents: berthRoundingMode === 'manual_up'
      ? asNonNegativeInteger(plan?.manualStandardBerthCents, 1_000_000)
      : 0,
    // La lista selezionata vive nel piano quote V4, non nel preventivo
    // privato. La teniamo qui solo mentre il form prepara il salvataggio.
    starterPackItems: normalizeStarterPackItems(plan?.starterPackItems),
    starterPackDescription: Array.isArray(plan?.starterPackItems)
      ? starterPackDescriptionFor(plan.starterPackItems)
      : normalizeCostPlanDescription(
        plan?.starterPackDescription,
        DEFAULT_COST_PLAN_DESCRIPTIONS.starterPackDescription,
      ),
    protectionInsuranceDescription: normalizeCostPlanDescription(
      plan?.protectionInsuranceDescription,
      DEFAULT_COST_PLAN_DESCRIPTIONS.protectionInsuranceDescription,
    ),
    refundableDepositDescription: normalizeCostPlanDescription(
      plan?.refundableDepositDescription,
      DEFAULT_COST_PLAN_DESCRIPTIONS.refundableDepositDescription,
    ),
  };
}

function costPlanForStorage(plan) {
  const normalized = normalizeCostPlan(plan);
  return {
    charterCents: normalized.charterCents,
    skipperFlightTrainCents: normalized.skipperFlightTrainCents,
    skipperCarCents: normalized.skipperCarCents,
    skipperLocalTransferCents: normalized.skipperLocalTransferCents,
    otherRecoverableCents: normalized.otherRecoverableCents,
    starterPackTotalCents: normalized.starterPackTotalCents,
    starterPackRateMode: normalized.starterPackRateMode,
    starterPackFixedPerPersonCents: normalized.starterPackFixedPerPersonCents,
    starterPackIncludedInCharter: normalized.starterPackIncludedInCharter,
    protectionInsuranceTotalCents: normalized.protectionInsuranceTotalCents,
    protectionInsuranceRateMode: normalized.protectionInsuranceRateMode,
    protectionInsuranceFixedPerPersonCents: normalized.protectionInsuranceFixedPerPersonCents,
    refundableDepositTotalCents: normalized.refundableDepositTotalCents,
    payingParticipants: normalized.payingParticipants,
    depositParticipants: normalized.depositParticipants,
    dinettePayingParticipants: normalized.dinettePayingParticipants,
    dinetteWeightPercent: normalized.dinetteWeightPercent,
    dinetteRateMode: normalized.dinetteRateMode,
    dinetteFixedCents: normalized.dinetteFixedCents,
    berthRoundingMode: normalized.berthRoundingMode,
    berthRoundingIncrementCents: normalized.berthRoundingIncrementCents,
    manualStandardBerthCents: normalized.manualStandardBerthCents,
    // Campi V7 mantenuti per compatibilità, ma non vengono più mostrati come
    // testo libero nell'area equipaggio.
    starterPackDescription: starterPackDescriptionFor(normalized.starterPackItems),
    protectionInsuranceDescription: DEFAULT_COST_PLAN_DESCRIPTIONS.protectionInsuranceDescription,
    refundableDepositDescription: DEFAULT_COST_PLAN_DESCRIPTIONS.refundableDepositDescription,
  };
}

function costPlanTotalCents(plan = activeCostPlan) {
  const normalized = normalizeCostPlan(plan);
  return normalized.charterCents
    + normalized.skipperFlightTrainCents
    + normalized.skipperCarCents
    + normalized.skipperLocalTransferCents
    + normalized.otherRecoverableCents;
}

function evenlyAllocatedAmount(totalCents, participants) {
  const perPersonCents = totalCents > 0 && participants > 0
    ? Math.round(totalCents / participants)
    : 0;
  const allocatedCents = perPersonCents * participants;
  return {
    perPersonCents,
    allocatedCents,
    roundingDeltaCents: allocatedCents - totalCents,
  };
}

function rateModeAllocation({ rateMode, totalCents, fixedPerPersonCents, participants, included = false }) {
  if (included) {
    return {
      perPersonCents: 0,
      targetCents: 0,
      allocatedCents: 0,
      roundingDeltaCents: 0,
      includedInCharter: true,
    };
  }
  if (rateMode === 'fixed_per_person') {
    const perPersonCents = fixedPerPersonCents;
    return {
      perPersonCents,
      targetCents: perPersonCents * participants,
      allocatedCents: perPersonCents * participants,
      roundingDeltaCents: 0,
      includedInCharter: false,
    };
  }
  const allocation = evenlyAllocatedAmount(totalCents, participants);
  return {
    ...allocation,
    targetCents: totalCents,
    includedInCharter: false,
  };
}

function percentageDinetteAllocation(standardBerthCents, standardPayingParticipants, dinettePayingParticipants, dinetteWeightPercent) {
  const dinetteBerthCents = standardBerthCents > 0
    ? Math.round((standardBerthCents * dinetteWeightPercent) / 100)
    : 0;
  return {
    standardBerthCents,
    dinetteBerthCents,
    allocatedRecoveryCents: (standardBerthCents * standardPayingParticipants)
      + (dinetteBerthCents * dinettePayingParticipants),
  };
}

function minimumPercentageDinetteAllocation(berthRecoveryCents, standardPayingParticipants, dinettePayingParticipants, dinetteWeightPercent) {
  const weightedUnitsInHundredths = (standardPayingParticipants * 100)
    + (dinettePayingParticipants * dinetteWeightPercent);
  if (berthRecoveryCents < 1 || weightedUnitsInHundredths < 1) {
    return percentageDinetteAllocation(0, standardPayingParticipants, dinettePayingParticipants, dinetteWeightPercent);
  }
  let standardBerthCents = Math.max(1, Math.ceil((berthRecoveryCents * 100) / weightedUnitsInHundredths));
  let allocation = percentageDinetteAllocation(
    standardBerthCents,
    standardPayingParticipants,
    dinettePayingParticipants,
    dinetteWeightPercent,
  );
  // La dinette viene arrotondata al centesimo: alziamo la cabina di un
  // centesimo finché il totale non lascia neppure un centesimo scoperto.
  while (allocation.allocatedRecoveryCents < berthRecoveryCents) {
    standardBerthCents += 1;
    allocation = percentageDinetteAllocation(
      standardBerthCents,
      standardPayingParticipants,
      dinettePayingParticipants,
      dinetteWeightPercent,
    );
  }
  return allocation;
}

function costPlanQuoteModel(plan = activeCostPlan) {
  if (!plan) return null;
  const normalized = normalizeCostPlan(plan);
  const standardPayingParticipants = Math.max(0, normalized.payingParticipants - normalized.dinettePayingParticipants);
  const dinetteWeight = normalized.dinetteWeightPercent / 100;
  const recoveryCents = costPlanTotalCents(normalized);
  const usesFixedDinetteRate = normalized.dinetteRateMode === 'fixed';
  const starterPackAllocation = rateModeAllocation({
    rateMode: normalized.starterPackRateMode,
    totalCents: normalized.starterPackTotalCents,
    fixedPerPersonCents: normalized.starterPackFixedPerPersonCents,
    participants: normalized.payingParticipants,
  });
  const protectionInsuranceAllocation = rateModeAllocation({
    rateMode: normalized.protectionInsuranceRateMode,
    totalCents: normalized.protectionInsuranceTotalCents,
    fixedPerPersonCents: normalized.protectionInsuranceFixedPerPersonCents,
    participants: normalized.payingParticipants,
  });
  const starterPackIncludedInCharter = normalized.starterPackIncludedInCharter;
  const starterPackSourceSelected = normalized.starterPackSourceSelected === true;
  const berthRecoveryCents = recoveryCents - (starterPackIncludedInCharter ? starterPackAllocation.targetCents : 0);
  const starterPackExceedsCharter = starterPackIncludedInCharter
    && starterPackAllocation.targetCents > normalized.charterCents;
  const fixedDinetteTotalCents = normalized.dinetteFixedCents * normalized.dinettePayingParticipants;
  const fixedDinetteError = usesFixedDinetteRate && (
    normalized.dinettePayingParticipants < 1
    || standardPayingParticipants < 1
    || normalized.dinetteFixedCents < 1
    || fixedDinetteTotalCents >= berthRecoveryCents
  );
  const weightedUnits = standardPayingParticipants + (normalized.dinettePayingParticipants * dinetteWeight);
  const calculatedPercentageAllocation = !usesFixedDinetteRate && !starterPackExceedsCharter
    ? minimumPercentageDinetteAllocation(
      berthRecoveryCents,
      standardPayingParticipants,
      normalized.dinettePayingParticipants,
      normalized.dinetteWeightPercent,
    )
    : null;
  const calculatedStandardBerthCents = berthRecoveryCents > 0 && !starterPackExceedsCharter && !fixedDinetteError
    ? usesFixedDinetteRate
      ? Math.ceil((berthRecoveryCents - fixedDinetteTotalCents) / standardPayingParticipants)
      : calculatedPercentageAllocation.standardBerthCents
    : 0;
  const calculatedDinetteBerthCents = !starterPackExceedsCharter && !fixedDinetteError
    ? usesFixedDinetteRate
      ? normalized.dinetteFixedCents
      : calculatedPercentageAllocation.dinetteBerthCents
    : 0;
  const manualAllocation = normalized.berthRoundingMode === 'manual_up' && !usesFixedDinetteRate
    ? percentageDinetteAllocation(
      normalized.manualStandardBerthCents,
      standardPayingParticipants,
      normalized.dinettePayingParticipants,
      normalized.dinetteWeightPercent,
    )
    : null;
  const manualAllocatedRecoveryCents = normalized.berthRoundingMode === 'manual_up'
    ? usesFixedDinetteRate
      ? (normalized.manualStandardBerthCents * standardPayingParticipants) + fixedDinetteTotalCents
      : manualAllocation.allocatedRecoveryCents
    : 0;
  const manualAllocationShortfallCents = normalized.berthRoundingMode === 'manual_up'
    ? Math.max(0, berthRecoveryCents - manualAllocatedRecoveryCents)
    : 0;
  const manualStandardBerthError = normalized.berthRoundingMode === 'manual_up' && (
    normalized.manualStandardBerthCents < 1
    || manualAllocationShortfallCents > 0
  );
  const standardBerthCents = manualStandardBerthError
    ? calculatedStandardBerthCents
    : normalized.berthRoundingMode === 'ceil_increment'
      ? roundUpToIncrement(calculatedStandardBerthCents, normalized.berthRoundingIncrementCents)
      : normalized.berthRoundingMode === 'manual_up'
        ? normalized.manualStandardBerthCents
        : calculatedStandardBerthCents;
  const calculatedAllocation = (calculatedStandardBerthCents * standardPayingParticipants)
    + (calculatedDinetteBerthCents * normalized.dinettePayingParticipants);
  const unroundedDinetteBerthCents = !starterPackExceedsCharter && !fixedDinetteError && !usesFixedDinetteRate
    ? percentageDinetteAllocation(
      standardBerthCents,
      standardPayingParticipants,
      normalized.dinettePayingParticipants,
      normalized.dinetteWeightPercent,
    ).dinetteBerthCents
    : 0;
  const dinetteBerthCents = !starterPackExceedsCharter && !fixedDinetteError
    ? usesFixedDinetteRate
      ? normalized.dinetteFixedCents
      : normalized.berthRoundingMode === 'ceil_increment'
        ? roundUpToIncrement(unroundedDinetteBerthCents, normalized.berthRoundingIncrementCents)
        : unroundedDinetteBerthCents
    : 0;
  const calculatedAllocatedRecoveryCents = calculatedAllocation;
  const allocatedRecoveryCents = (standardBerthCents * standardPayingParticipants)
    + (dinetteBerthCents * normalized.dinettePayingParticipants);
  const refundableDepositAllocation = evenlyAllocatedAmount(
    normalized.refundableDepositTotalCents,
    normalized.depositParticipants,
  );
  return {
    ...normalized,
    recoveryCents,
    berthRecoveryCents,
    starterPackExceedsCharter,
    standardPayingParticipants,
    weightedUnits,
    fixedDinetteTotalCents,
    fixedDinetteError,
    calculatedStandardBerthCents,
    calculatedDinetteBerthCents,
    calculatedAllocatedRecoveryCents,
    calculatedAllocationShortfallCents: Math.max(0, berthRecoveryCents - calculatedAllocatedRecoveryCents),
    manualAllocatedRecoveryCents,
    manualAllocationShortfallCents,
    manualStandardBerthError,
    standardBerthCents,
    dinetteBerthCents,
    allocatedRecoveryCents,
    roundingDeltaCents: allocatedRecoveryCents - berthRecoveryCents,
    roundingReserveCents: allocatedRecoveryCents - berthRecoveryCents,
    starterPackPerPersonCents: starterPackAllocation.perPersonCents,
    starterPackTargetCents: starterPackAllocation.targetCents,
    starterPackAllocatedCents: starterPackAllocation.allocatedCents,
    starterPackRoundingDeltaCents: starterPackAllocation.roundingDeltaCents,
    starterPackIncludedInCharter,
    starterPackSourceSelected,
    protectionInsurancePerPersonCents: protectionInsuranceAllocation.perPersonCents,
    protectionInsuranceTargetCents: protectionInsuranceAllocation.targetCents,
    protectionInsuranceAllocatedCents: protectionInsuranceAllocation.allocatedCents,
    protectionInsuranceRoundingDeltaCents: protectionInsuranceAllocation.roundingDeltaCents,
    refundableDepositPerPersonCents: refundableDepositAllocation.perPersonCents,
    refundableDepositAllocatedCents: refundableDepositAllocation.allocatedCents,
    refundableDepositRoundingDeltaCents: refundableDepositAllocation.roundingDeltaCents,
  };
}

function fixedDinetteConfigurationMessage(model) {
  if (!model?.fixedDinetteError) return '';
  if (model.dinettePayingParticipants < 1) return 'Per usare un prezzo fisso, indica almeno un posto dinette pagante.';
  if (model.standardPayingParticipants < 1) return 'Con il prezzo fisso serve almeno un ospite in cabina: altrimenti non c’è una quota cabina da ricavare.';
  if (model.dinetteFixedCents < 1) return 'Inserisci un prezzo fisso della dinette maggiore di zero.';
  return 'Il totale delle dinette lascerebbe la cabina gratuita: riduci il prezzo dinette oppure aumenta i costi della barca.';
}

function berthRoundingConfigurationMessage(model) {
  if (!model?.manualStandardBerthError) return '';
  if (model.manualStandardBerthCents < 1) {
    return 'Indica la quota cabina che vuoi comunicare oppure torna al calcolo automatico.';
  }
  if (model.manualAllocationShortfallCents > 0) {
    return `Con questa quota mancherebbero ${formatCurrency(model.manualAllocationShortfallCents / 100)} per coprire i costi: scegli almeno ${formatCurrency(model.calculatedStandardBerthCents / 100)} per cabina.`;
  }
  return `La quota cabina scelta non può essere inferiore al pareggio di ${formatCurrency(model.calculatedStandardBerthCents / 100)}.`;
}

function automaticCostPlanPricingMessage(model) {
  return costPlanRateModeValidationMessage(model)
    || fixedDinetteConfigurationMessage(model)
    || berthRoundingConfigurationMessage(model);
}

function costPlanRateModeValidationMessage(model) {
  if (!model) return '';
  if (!model.starterPackSourceSelected) {
    return 'Scegli prima se lo Starter Pack è già nel totale charter oppure è un costo esterno: così non viene recuperato due volte.';
  }
  if (model.starterPackRateMode === 'fixed_per_person' && model.starterPackFixedPerPersonCents < 1) {
    return 'Indica la quota fissa dello Starter Pack per persona oppure scegli il totale da dividere.';
  }
  if (model.protectionInsuranceRateMode === 'fixed_per_person' && model.protectionInsuranceFixedPerPersonCents < 1) {
    return 'Indica la quota fissa dell’assicurazione per persona oppure scegli il totale da dividere.';
  }
  if (model.starterPackExceedsCharter) {
    return 'Lo Starter Pack dichiarato come già compreso nel charter non può superare il solo costo charter.';
  }
  return '';
}

function costPlanBaseContribution(plan = activeCostPlan) {
  const model = costPlanQuoteModel(plan);
  if (!model || automaticCostPlanPricingMessage(model) || !model.standardBerthCents) return null;
  const hasPriceAdjustment = model.berthRoundingMode !== 'automatic';
  return {
    id: 'cost:base',
    label: hasPriceAdjustment ? 'Quota cabina proposta' : 'Quota cabina di pareggio',
    cents: model.standardBerthCents,
    defaultReason: 'Quota cabina · recupero costi barca e skipper',
    accountingCategory: 'cost_recovery',
  };
}

function costPlanContributionTypes(plan = activeCostPlan) {
  const model = costPlanQuoteModel(plan);
  if (!model || automaticCostPlanPricingMessage(model)) return [];
  const types = [];
  const standard = costPlanBaseContribution(model);
  if (standard) types.push(standard);
  if (model.dinettePayingParticipants > 0 && model.dinetteBerthCents > 0) {
    types.push({
      id: 'cost:dinette',
      label: model.dinetteRateMode === 'fixed'
        ? 'Quota dinette calcolata · prezzo fisso'
        : `Quota dinette calcolata · ${model.dinetteWeightPercent}% cabina`,
      cents: model.dinetteBerthCents,
      defaultReason: 'Quota posto in dinette trasformabile · recupero costi barca e skipper',
      accountingCategory: 'cost_recovery',
    });
  }
  if (model.protectionInsurancePerPersonCents > 0) {
    types.push({
      id: 'cost:protection_insurance',
      label: 'Assicurazione cauzione calcolata',
      cents: model.protectionInsurancePerPersonCents,
      defaultReason: 'Assicurazione cauzione',
      accountingCategory: 'other',
    });
  }
  return types;
}

function costPlanProjectionPreset(berthType, plan = activeCostPlan) {
  const model = costPlanQuoteModel(plan);
  // Finché non è chiaro se il Pack è già nel charter, la quota automatica
  // sarebbe ambigua. Manteniamo quindi il listino come semplice fallback.
  if (!model || automaticCostPlanPricingMessage(model)) return null;
  const berthCents = berthType === 'dinette'
    ? model.dinetteBerthCents
    : (berthType === 'double_cabin' || berthType === 'single_cabin' ? model.standardBerthCents : 0);
  if (!berthCents && !model.starterPackPerPersonCents && !model.protectionInsurancePerPersonCents && !model.refundableDepositPerPersonCents) return null;
  return {
    berthCents,
    starterPackCents: model.starterPackPerPersonCents,
    protectionInsuranceCents: model.protectionInsurancePerPersonCents,
    refundableDepositCents: model.refundableDepositPerPersonCents,
  };
}

function dashboardProjectionPreset(berthType, { contributesToCosts = true } = {}) {
  const calculated = costPlanProjectionPreset(berthType);
  const berth = berthRateType(berthType);
  const listinoCents = berth && activeBoat
    ? normalizeBerthRates(activeBoat.berthRates)[berth.rateKey]
    : 0;
  // Il preventivo è la sorgente delle nuove quote: così il valore visibile
  // nella dashboard coincide con quello proposto nella scheda equipaggio.
  // Il listino storico resta solo un fallback finché il preventivo non ha
  // ancora abbastanza dati per ricavare una quota.
  const defaultBerthCents = calculated?.berthCents || listinoCents || 0;
  return {
    berthCents: contributesToCosts ? defaultBerthCents : 0,
    starterPackCents: contributesToCosts ? calculated?.starterPackCents || 0 : 0,
    protectionInsuranceCents: contributesToCosts ? calculated?.protectionInsuranceCents || 0 : 0,
    refundableDepositCents: calculated?.refundableDepositCents || 0,
  };
}

function projectionPricingMode(projection) {
  // Le schede create prima della Dashboard economica sono accordi storici: non
  // vengono mai ricalcolate automaticamente soltanto perché il sito cambia.
  return projection?.pricingMode === 'dashboard' ? 'dashboard' : 'custom';
}

function effectiveProjectionPricing(projection) {
  const normalized = normalizeProjection(projection?.id, projection);
  // Prima dell'invito la proiezione è un preventivo vivo. Al momento
  // dell'invito i valori vengono invece registrati nello stesso documento,
  // così skipper ed equipaggio leggono la medesima cifra.
  if (normalized.pricingMode !== 'dashboard' || normalized.status === 'invited') return normalized;
  return {
    ...normalized,
    ...dashboardProjectionPreset(normalized.berthType, normalized),
  };
}

function normalizeContributionPlan(plan = {}) {
  const sourceItems = plan?.items && typeof plan.items === 'object' ? plan.items : {};
  // Il Pack viene sempre regolato in contanti a bordo: anche se il suo costo
  // nasce nel charter, non deve confondersi con una richiesta online.
  const starterPackItems = normalizeStarterPackItems(plan?.starterPackItems, {
    fallbackToDefault: !Array.isArray(plan?.starterPackItems),
  });
  const items = Object.fromEntries(DEFAULT_CONTRIBUTION_ITEMS.map((item) => {
    const source = sourceItems[item.id] || {};
    const forcedStates = {
      starter_pack: 'local',
      linen_towels: 'included',
      refundable_deposit: 'local',
    };
    const state = forcedStates[item.id]
      || (CONTRIBUTION_ITEM_STATES.has(source.state) ? source.state : 'to_define');
    const amountCents = state === 'extra' || state === 'local'
      ? asNonNegativeInteger(source.amountCents, 1_000_000)
      : 0;
    return [item.id, {
      state,
      amountCents,
      // Descrizione calcolata localmente: non viene mai scritta nel documento
      // leggibile dall'equipaggio.
      description: contributionDescriptionFor(item.id, starterPackItems),
    }];
  }));
  return { items, starterPackItems, starterPackSettlementMode: 'cash_on_board' };
}

function contributionCatalog(plan = activeContributionPlan) {
  const normalized = normalizeContributionPlan(plan);
  const model = costPlanQuoteModel();
  return DEFAULT_CONTRIBUTION_ITEMS.map((item) => {
    const value = { ...item, ...normalized.items[item.id] };
    if (item.id === 'starter_pack') {
      return {
        ...value,
        state: 'local',
        amountCents: model ? model.starterPackPerPersonCents : value.amountCents,
        description: contributionDescriptionFor(item.id, normalized.starterPackItems),
      };
    }
    if (item.id === 'linen_towels') return { ...value, state: 'included', amountCents: 0 };
    if (item.id === 'protection_insurance') {
      return model ? {
        ...value,
        state: 'extra',
        amountCents: model.protectionInsurancePerPersonCents,
        description: contributionDescriptionFor(item.id, normalized.starterPackItems),
      } : value;
    }
    if (item.id === 'refundable_deposit') {
      return {
        ...value,
        state: 'local',
        amountCents: model ? model.refundableDepositPerPersonCents : value.amountCents,
        description: contributionDescriptionFor(item.id, normalized.starterPackItems),
      };
    }
    return value;
  });
}

function contributionPlanForCostPlan(plan, contributionPlan = activeContributionPlan) {
  const normalizedPlan = normalizeCostPlan(plan);
  const model = costPlanQuoteModel(normalizedPlan);
  const normalizedContributionPlan = normalizeContributionPlan(contributionPlan);
  const starterPackItems = Array.isArray(plan?.starterPackItems)
    ? normalizeStarterPackItems(plan.starterPackItems)
    : normalizedContributionPlan.starterPackItems;
  const items = Object.fromEntries(DEFAULT_CONTRIBUTION_ITEMS.map((item) => {
    const source = normalizedContributionPlan.items[item.id];
    return [item.id, { state: source.state, amountCents: source.amountCents }];
  }));
  items.starter_pack = {
    state: 'local',
    amountCents: model?.starterPackPerPersonCents || 0,
  };
  items.linen_towels = {
    state: 'included',
    amountCents: 0,
  };
  items.protection_insurance = {
    state: 'extra',
    amountCents: model?.protectionInsurancePerPersonCents || 0,
  };
  items.refundable_deposit = {
    state: 'local',
    amountCents: model?.refundableDepositPerPersonCents || 0,
  };
  return normalizeContributionPlan({ items, starterPackItems, starterPackSettlementMode: 'cash_on_board' });
}

function contributionPlanForStorage(plan) {
  const normalized = normalizeContributionPlan(plan);
  return {
    items: Object.fromEntries(DEFAULT_CONTRIBUTION_ITEMS.map((item) => [item.id, {
      state: normalized.items[item.id].state,
      amountCents: normalized.items[item.id].amountCents,
    }])),
    starterPackItems: normalized.starterPackItems,
    starterPackSettlementMode: 'cash_on_board',
  };
}

function extraContributionTypes(plan = activeContributionPlan) {
  return contributionCatalog(plan)
    .filter((item) => item.state === 'extra' && !AUTOMATIC_COST_PLAN_ITEM_IDS.has(item.id))
    .map((item) => ({
      id: `extra:${item.id}`,
      label: item.label,
      cents: item.amountCents,
      defaultReason: item.id === 'refundable_deposit'
        ? 'Cauzione rimborsabile · restituzione esterna da concordare'
        : item.label,
    }));
}

function normalizeAccommodationLabel(value, maximumLength = 120) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}

function normalizeAccommodationLabels(value, maximumItems = 12, maximumLength = 100) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/)
      : [];
  return source
    .slice(0, maximumItems)
    .map((item) => normalizeAccommodationLabel(item, maximumLength));
}

function nonEmptyAccommodationLabels(labels = []) {
  return labels.filter(Boolean);
}

function normalizeBerthLayout(layout = {}) {
  const doubleCabins = asNonNegativeInteger(layout?.doubleCabins);
  const singleCabins = asNonNegativeInteger(layout?.singleCabins);
  const dinetteBerths = asNonNegativeInteger(layout?.dinetteBerths);
  const otherCrewBerths = asNonNegativeInteger(layout?.otherCrewBerths);
  const rawCrewCabinCount = Number(layout?.crewCabinCount);
  const hasExplicitCrewCabinCount = Number.isInteger(rawCrewCabinCount)
    && rawCrewCabinCount >= 0
    && rawCrewCabinCount <= 12;
  // Le barche già salvate avevano il solo flag booleano. Un vecchio layout
  // continua quindi a significare una cabina equipaggio da un posto.
  const hasLegacyCrewCabin = layout?.hasCrewCabin === true
    || (LEGACY_CREW_CABIN_USES.has(layout?.crewCabinUse) && layout.crewCabinUse !== 'not_specified');
  const crewCabinCount = hasExplicitCrewCabinCount
    ? rawCrewCabinCount
    : hasLegacyCrewCabin ? 1 : 0;
  return {
    doubleCabins,
    singleCabins,
    dinetteBerths,
    crewCabinCount,
    // Conservato per i record e i client precedenti; il numero è ora la fonte
    // autorevole e permette di descrivere anche due cabine equipaggio.
    hasCrewCabin: crewCabinCount > 0,
    bathroomCount: asNonNegativeInteger(layout?.bathroomCount),
    otherCrewBerths,
    doubleCabinLabels: normalizeAccommodationLabels(layout?.doubleCabinLabels).slice(0, doubleCabins),
    crewCabinLabels: normalizeAccommodationLabels(layout?.crewCabinLabels).slice(0, crewCabinCount),
    dinetteDescription: normalizeAccommodationLabel(layout?.dinetteDescription),
    otherBerthsDescription: normalizeAccommodationLabel(layout?.otherBerthsDescription),
  };
}

function berthLayoutTotals(layout) {
  const normalized = normalizeBerthLayout(layout);
  const standardBerths = (normalized.doubleCabins * 2)
    + normalized.singleCabins
    + normalized.dinetteBerths
    + normalized.otherCrewBerths;
  const physicalBerths = standardBerths + normalized.crewCabinCount;
  const skipperBerths = physicalBerths > 0 ? 1 : 0;
  const participantBerths = Math.max(0, physicalBerths - skipperBerths);
  return {
    ...normalized,
    physicalBerths,
    skipperBerths,
    participantBerths,
  };
}

function hasAccommodationDetails(layout) {
  const totals = berthLayoutTotals(layout);
  return totals.physicalBerths > 0;
}

function describeBerthLayout(layout) {
  const totals = berthLayoutTotals(layout);
  if (!hasAccommodationDetails(totals) && !totals.bathroomCount) return '';
  const parts = [];
  const doubleLabels = nonEmptyAccommodationLabels(totals.doubleCabinLabels);
  const crewLabels = nonEmptyAccommodationLabels(totals.crewCabinLabels);
  if (totals.doubleCabins) {
    parts.push(`${totals.doubleCabins} ${totals.doubleCabins === 1 ? 'cabina da 2 posti' : 'cabine da 2 posti'}${doubleLabels.length ? ` (${doubleLabels.join(', ')})` : ''}`);
  }
  if (totals.singleCabins) parts.push(`${totals.singleCabins} ${totals.singleCabins === 1 ? 'cabina da 1 posto' : 'cabine da 1 posto'}`);
  if (totals.dinetteBerths) {
    parts.push(`${totals.dinetteBerths} ${totals.dinetteBerths === 1 ? 'posto in dinette trasformabile' : 'posti in dinette trasformabile'}${totals.dinetteDescription ? ` (${totals.dinetteDescription})` : ''}`);
  }
  if (totals.crewCabinCount) {
    parts.push(`${totals.crewCabinCount} ${totals.crewCabinCount === 1 ? 'cabina equipaggio / marinaio' : 'cabine equipaggio / marinaio'}${crewLabels.length ? ` (${crewLabels.join(', ')})` : ''}`);
  }
  if (totals.otherCrewBerths) {
    parts.push(`${totals.otherCrewBerths} ${totals.otherCrewBerths === 1 ? 'altro posto letto fisso' : 'altri posti letto fissi'}${totals.otherBerthsDescription ? ` (${totals.otherBerthsDescription})` : ''}`);
  }
  if (totals.bathroomCount) parts.push(`${totals.bathroomCount} ${totals.bathroomCount === 1 ? 'bagno a bordo' : 'bagni a bordo'}`);
  return parts.join(' · ');
}

function readBerthLayout(form) {
  return normalizeBerthLayout({
    doubleCabins: form.elements.doubleCabins?.value,
    singleCabins: form.elements.singleCabins?.value,
    dinetteBerths: form.elements.dinetteBerths?.value,
    crewCabinCount: form.elements.crewCabinCount?.value,
    hasCrewCabin: form.elements.hasCrewCabin?.checked === true,
    bathroomCount: form.elements.bathroomCount?.value,
    otherCrewBerths: form.elements.otherCrewBerths?.value,
    doubleCabinLabels: form.elements.doubleCabinLabels?.value,
    crewCabinLabels: form.elements.crewCabinLabels?.value,
    dinetteDescription: form.elements.dinetteDescription?.value,
    otherBerthsDescription: form.elements.otherBerthsDescription?.value,
  });
}

function fillBerthLayoutForm(form, layout) {
  const normalized = normalizeBerthLayout(layout);
  form.elements.doubleCabins.value = String(normalized.doubleCabins);
  form.elements.singleCabins.value = String(normalized.singleCabins);
  form.elements.dinetteBerths.value = String(normalized.dinetteBerths);
  if (form.elements.crewCabinCount) form.elements.crewCabinCount.value = String(normalized.crewCabinCount);
  form.elements.bathroomCount.value = normalized.bathroomCount ? String(normalized.bathroomCount) : '';
  form.elements.otherCrewBerths.value = String(normalized.otherCrewBerths);
  if (form.elements.doubleCabinLabels) form.elements.doubleCabinLabels.value = normalized.doubleCabinLabels.join('\n');
  if (form.elements.crewCabinLabels) form.elements.crewCabinLabels.value = normalized.crewCabinLabels.join('\n');
  if (form.elements.dinetteDescription) form.elements.dinetteDescription.value = normalized.dinetteDescription;
  if (form.elements.otherBerthsDescription) form.elements.otherBerthsDescription.value = normalized.otherBerthsDescription;
}

function readBerthRates(form) {
  return normalizeBerthRates({
    doubleCabinCents: toEuroCents(form.elements.doubleCabinRate?.value),
    singleCabinCents: toEuroCents(form.elements.singleCabinRate?.value),
    dinetteCents: toEuroCents(form.elements.dinetteRate?.value),
    otherBerthCents: toEuroCents(form.elements.otherBerthRate?.value),
  });
}

function fillBerthRatesForm(form, rates) {
  const normalized = normalizeBerthRates(rates);
  form.elements.doubleCabinRate.value = euroInputValue(normalized.doubleCabinCents);
  form.elements.singleCabinRate.value = euroInputValue(normalized.singleCabinCents);
  form.elements.dinetteRate.value = euroInputValue(normalized.dinetteCents);
  form.elements.otherBerthRate.value = euroInputValue(normalized.otherBerthCents);
}

function describeTotalBerths(totalBerths, layout = {}) {
  if (totalBerths < 2) return '';
  const normalizedLayout = normalizeBerthLayout(layout);
  const participantCapacity = participantCapacityFromTotal(totalBerths);
  const totalLabel = totalBerths === 1 ? 'posto totale a bordo' : 'posti totali a bordo';
  const participantLabel = participantCapacity === 1 ? 'posto assegnabile a un partecipante' : 'posti assegnabili ai partecipanti';
  const skipperDetail = normalizedLayout.crewCabinCount
    ? 'uno è riservato allo skipper nella cabina equipaggio'
    : 'uno è riservato allo skipper';
  const additionalCrewCabins = normalizedLayout.crewCabinCount === 2
    ? '; l’altra cabina equipaggio è conteggiata tra i posti assegnabili'
    : normalizedLayout.crewCabinCount > 2
      ? `; le altre ${normalizedLayout.crewCabinCount - 1} cabine equipaggio sono conteggiate tra i posti assegnabili`
      : '';
  return `${totalBerths} ${totalLabel}: ${skipperDetail}${additionalCrewCabins}; restano ${participantCapacity} ${participantLabel}, con o senza importo previsto.`;
}

function describeBerthCapacity(totals) {
  return describeTotalBerths(totals.physicalBerths, totals);
}

function syncTotalBerthsFromLayout() {
  const form = document.querySelector('#boatForm');
  if (!form) return;
  const physicalBerths = berthLayoutTotals(readBerthLayout(form)).physicalBerths;
  const totalInput = form.elements.totalBerths;
  if (physicalBerths >= 2 && (!totalInput.value || totalInput.dataset.autoFromLayout === 'true')) {
    totalInput.value = String(physicalBerths);
    totalInput.dataset.autoFromLayout = 'true';
  }
}

function describeBerthRates(rates) {
  const normalized = normalizeBerthRates(rates);
  const labels = {
    doubleCabinCents: 'cabina da 2 posti',
    singleCabinCents: 'cabina da 1 posto',
    dinetteCents: 'dinette trasformabile',
    otherBerthCents: 'altro posto letto',
  };
  return Object.entries(labels)
    .filter(([key]) => normalized[key] > 0)
    .map(([key, label]) => `${label} ${formatCurrency(normalized[key] / 100)} a persona`)
    .join(' · ');
}

function renderBerthLayoutSummary() {
  const form = document.querySelector('#boatForm');
  const summary = document.querySelector('#berthLayoutSummary');
  if (!form || !summary) return;
  const layout = readBerthLayout(form);
  const totals = berthLayoutTotals(layout);
  const totalBerths = asNonNegativeInteger(form.elements.totalBerths?.value, 31);
  summary.classList.remove('is-error');
  const description = describeBerthLayout(layout);
  if (totalBerths < 2) {
    summary.textContent = 'Inserisci il numero totale delle persone a bordo, skipper compreso.';
    return;
  }

  if (totals.physicalBerths && totals.physicalBerths !== totalBerths) {
    summary.classList.add('is-error');
    summary.textContent = `${description}. La configurazione descrive ${totals.physicalBerths} posti totali a bordo, mentre sopra hai indicato ${totalBerths}. Correggi il totale oppure la configurazione: non aggiungere posti fittizi in “altri posti letto”.`;
    return;
  }

  const totalDescription = describeTotalBerths(totalBerths, layout);
  summary.textContent = description
    ? `${description}. ${totalDescription}.`
    : `${totalDescription}. Se vuoi, completa anche la configurazione reale di cabine e dinette.`;
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
  form.elements.availableSeats.value = String(Math.max(0, crewSeatLimit() - allocatedCrewSeatCount()));
  form.elements.berthPreference.value = declaredFleetBerthPreference(activeBoat);
  form.elements.showAvailability.checked = isFleetAvailabilityPublic(activeBoat);
}

async function syncPublicFleetAvailabilityFromCrew() {
  const boat = activeBoat;
  if (!boat?.id || !boat.publicFleetId || !auth.currentUser || boat.skipperId !== auth.currentUser.uid
    || !isFleetAvailabilityPublic(boat) || fleetAvailabilitySyncInProgress) return;
  const availableSeats = Math.max(0, crewSeatLimit() - allocatedCrewSeatCount());
  if (declaredFleetAvailability(boat) === availableSeats) return;
  fleetAvailabilitySyncInProgress = true;
  try {
    const nextBoat = await saveBoatAndPublicFleet(boat.id, boat, {
      fleetAvailableSeats: availableSeats,
      updatedAt: serverTimestamp(),
    });
    if (activeBoat?.id === boat.id) {
      activeBoat = nextBoat;
      renderFleetProfileForm();
    }
  } catch (error) {
    console.error('Egadi disponibilità flotta:', error);
  } finally {
    fleetAvailabilitySyncInProgress = false;
  }
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
    setMessage(message, getFirestoreErrorMessage(error, 'Non riesco ad aggiungere automaticamente la barca alla flotta. Riprova tra poco.'), true);
  } finally {
    fleetPublicationInProgress.delete(boat.id);
  }
}

function resetPrivateView() {
  resetSkipperDocumentCopies('idle');
  activeBoat = null;
  activeMembers = [];
  activePayments = [];
  activeInvites = [];
  activeProjections = [];
  activePaymentProfile = null;
  activeContributionPlan = null;
  activeCostPlan = null;
  activeBriefing = null;
  activeAcceptances = [];
  activeSkipperProfile = null;
  skipperAnnouncementCount = 0;
  creatingBoat = false;
  editingBoatId = null;
  editingMemberId = null;
  editingProjectionId = null;
  linkingLegacyInviteId = null;
  fleetPublicationInProgress.clear();
  fleetAvailabilitySyncInProgress = false;
  stopBoatSubscription?.();
  stopMemberSubscription?.();
  stopPaymentSubscription?.();
  stopPaymentProfileSubscription?.();
  stopContributionPlanSubscription?.();
  stopCostPlanSubscription?.();
  stopInviteSubscription?.();
  stopProjectionSubscription?.();
  stopBriefingSubscription?.();
  stopAnnouncementSubscription?.();
  stopAcceptanceSubscription?.();
  stopSkipperProfileSubscription?.();
  stopBoatSubscription = null;
  stopMemberSubscription = null;
  stopPaymentSubscription = null;
  stopPaymentProfileSubscription = null;
  stopContributionPlanSubscription = null;
  stopCostPlanSubscription = null;
  stopInviteSubscription = null;
  stopProjectionSubscription = null;
  stopBriefingSubscription = null;
  stopAnnouncementSubscription = null;
  stopAcceptanceSubscription = null;
  stopSkipperProfileSubscription = null;
  const skipperProfileForm = document.querySelector('#skipperProfileForm');
  if (skipperProfileForm) {
    skipperProfileForm.reset();
    skipperProfileForm.dataset.editing = '';
  }
  const skipperProfileStatus = document.querySelector('#skipperProfileStatus');
  if (skipperProfileStatus) skipperProfileStatus.replaceChildren();
  const skipperProfileMessage = document.querySelector('#skipperProfileMessage');
  if (skipperProfileMessage) setMessage(skipperProfileMessage, '');
  dashboard.hidden = true;
  registerSection.hidden = true;
  renderSkipperDashboardOverview();
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

function formatCurrency(amount, locale = 'it') {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'it-IT', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

function defaultPaymentProfile() {
  return {
    collectorName: auth.currentUser?.displayName || '',
    paypalEnabled: false,
    satispayEnabled: false,
    revolutEnabled: false,
    bankTransferEnabled: false,
    paymentDetails: {
      paypal: '',
      satispay: '',
      revolut: '',
      bankTransfer: { iban: '', accountHolder: '' },
    },
  };
}

function normalizePaymentText(value, maximum = 500) {
  return String(value || '').trim().slice(0, maximum);
}

function normalizeIban(value) {
  return normalizePaymentText(value, 34).replace(/\s+/g, '').toUpperCase();
}

function normalizePaymentDetails(details = {}) {
  return {
    paypal: normalizePaymentText(details?.paypal),
    satispay: normalizePaymentText(details?.satispay),
    revolut: normalizePaymentText(details?.revolut),
    bankTransfer: {
      iban: normalizeIban(details?.bankTransfer?.iban),
      accountHolder: normalizePaymentText(details?.bankTransfer?.accountHolder, 100),
    },
  };
}

function readPaymentDetails(form) {
  return normalizePaymentDetails({
    paypal: form.elements.paypalDetails?.value,
    satispay: form.elements.satispayDetails?.value,
    revolut: form.elements.revolutDetails?.value,
    bankTransfer: {
      iban: form.elements.bankIban?.value,
      accountHolder: form.elements.bankAccountHolder?.value,
    },
  });
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function isValidPaymentDetail(method, details) {
  if (method.id === 'paypal' || method.id === 'satispay') return isHttpsUrl(details[method.id]);
  if (method.id === 'revolut') return isHttpsUrl(details.revolut) || /^@[a-zA-Z0-9._-]{3,50}$/.test(details.revolut);
  const bankTransfer = details.bankTransfer || {};
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(bankTransfer.iban || '')
    && String(bankTransfer.accountHolder || '').trim().length >= 2;
}

function paymentDetailValidationMessage(method) {
  if (method.id === 'paypal') return 'Inserisci un link PayPal HTTPS valido.';
  if (method.id === 'satispay') return 'Inserisci un link Satispay HTTPS valido.';
  if (method.id === 'revolut') return 'Inserisci un link Revolut HTTPS oppure un Revtag che inizia con @.';
  return 'Per il bonifico inserisci IBAN e intestatario.';
}

function renderPaymentProfileDetailVisibility(form) {
  PAYMENT_METHODS.forEach((method) => {
    const detail = form.querySelector(`[data-payment-method-detail="${method.id}"]`);
    const enabled = form.elements.namedItem(method.profileField)?.checked === true;
    if (detail) detail.hidden = !enabled;
  });
}

function availablePaymentMethods() {
  const profile = activePaymentProfile || defaultPaymentProfile();
  return PAYMENT_METHODS.filter((method) => profile[method.profileField] === true
    && isValidPaymentDetail(method, profile.paymentDetails));
}

function paymentMethodsFor(payment) {
  const selectedMethods = payment.paymentMethods || payment.methods || {};
  return PAYMENT_METHODS.filter((method) => selectedMethods[method.id] === true);
}

function paymentAmount(payment) {
  if (Number.isInteger(payment.amountCents)) return payment.amountCents / 100;
  return Number(payment.amount) || 0;
}

function paymentAmountCents(payment) {
  if (Number.isInteger(payment.amountCents)) return payment.amountCents;
  return Math.round(paymentAmount(payment) * 100);
}

function paymentRecipientId(payment) {
  return String(payment?.recipientId || payment?.memberId || payment?.payerInviteId || '');
}

function paymentAllocation(payment) {
  const amountCents = paymentAmountCents(payment);
  const allocation = payment?.allocation;
  const berthCents = Number(allocation?.berthCents);
  const protectionInsuranceCents = Number(allocation?.protectionInsuranceCents);
  if (Number.isInteger(berthCents) && berthCents >= 0
    && Number.isInteger(protectionInsuranceCents) && protectionInsuranceCents >= 0
    && berthCents + protectionInsuranceCents === amountCents) {
    return { berthCents, protectionInsuranceCents, explicit: true };
  }
  const itemId = String(payment?.contributionItemId || '');
  if (itemId === 'berth' || itemId.startsWith('berth_')) {
    return { berthCents: amountCents, protectionInsuranceCents: 0, explicit: false };
  }
  if (itemId === 'protection_insurance') {
    return { berthCents: 0, protectionInsuranceCents: amountCents, explicit: false };
  }
  return { berthCents: 0, protectionInsuranceCents: 0, explicit: false };
}

function paymentBerthCents(payment) {
  return paymentAllocation(payment).berthCents;
}

function paymentProtectionInsuranceCents(payment) {
  return paymentAllocation(payment).protectionInsuranceCents;
}

function paymentCoreCents(payment) {
  const allocation = paymentAllocation(payment);
  return allocation.berthCents + allocation.protectionInsuranceCents;
}

function paymentCostRecoveryCents(payment) {
  const allocation = paymentAllocation(payment);
  if (allocation.explicit) return allocation.berthCents;
  const berthCents = allocation.berthCents;
  if (berthCents > 0) return berthCents;
  return payment.accountingCategory === 'cost_recovery' ? paymentAmountCents(payment) : 0;
}

function paymentCountsTowardCostPlan(payment) {
  return paymentCostRecoveryCents(payment) > 0;
}

function isManualPaymentReceipt(payment) {
  return payment?.entryType === 'manual_receipt';
}

function paymentInstallmentLabel(payment) {
  if (isManualPaymentReceipt(payment) && payment?.installmentType === 'advance') return 'Acconto già ricevuto';
  if (payment?.installmentType === 'balance') return 'Saldo richiesto';
  if (payment?.installmentType === 'full') return 'Quota richiesta';
  if (payment?.installmentType === 'advance') return 'Acconto richiesto';
  if (payment?.installmentType === 'extra') return 'Voce separata';
  return payment?.status === 'verified' ? 'Versamento storico verificato' : 'Richiesta personale';
}

function paymentMethodTags(payment) {
  const methods = paymentMethodsFor(payment);
  if (!methods.length) return '';
  return `<div class="payment-method-tags">${methods.map((method) => `<span class="payment-method-tag">${method.label}</span>`).join('')}</div>`;
}

function paymentStatusLabel(payment) {
  if (isManualPaymentReceipt(payment)) return 'Registrato e verificato';
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
    const profile = activePaymentProfile || defaultPaymentProfile();
    const hasEnabledMethod = PAYMENT_METHODS.some((method) => profile[method.profileField] === true);
    options.innerHTML = `<p class="field-hint">${hasEnabledMethod ? 'Completa e salva i dati del metodo di incasso prima di usarlo in una richiesta.' : 'Salva prima almeno un metodo di incasso.'}</p>`;
    return;
  }
  options.innerHTML = methods.map((method) => {
    const checked = selected.size ? selected.has(method.id) : true;
    return `<label class="payment-method-choice"><input name="paymentMethod" type="checkbox" value="${method.id}"${checked ? ' checked' : ''} /> <span>${method.label}</span></label>`;
  }).join('');
}

function ensurePaymentAccountingCategoryField() {
  const form = document.querySelector('#paymentForm');
  const optionalInput = form?.elements.isOptional;
  if (!form || !optionalInput || form.elements.accountingCategory) return;
  const label = document.createElement('label');
  label.className = 'consent-field';
  const input = document.createElement('input');
  input.name = 'accountingCategory';
  input.type = 'checkbox';
  input.value = 'cost_recovery';
  label.append(input, ' Conta questo contributo nel totale delle spese della barca.');
  const hint = document.createElement('p');
  hint.className = 'field-hint';
  hint.textContent = 'Selezionalo solo per gli importi che recuperano charter e costi dello skipper. Cambusa, assicurazione, transfer o altri extra restano fuori da questo totale.';
  optionalInput.closest('label')?.after(label, hint);
}

function renderPaymentProfile(profile) {
  activePaymentProfile = {
    ...defaultPaymentProfile(),
    ...(profile || {}),
    paymentDetails: normalizePaymentDetails(profile?.paymentDetails),
  };
  const form = document.querySelector('#paymentProfileForm');
  const collectorName = form.elements.namedItem('collectorName');
  if (collectorName) collectorName.value = activePaymentProfile.collectorName || '';
  PAYMENT_METHODS.forEach((method) => {
    const input = form.elements.namedItem(method.profileField);
    if (input) input.checked = activePaymentProfile[method.profileField] === true;
    const detailsInput = method.detailsField && form.elements.namedItem(method.detailsField);
    if (detailsInput) detailsInput.value = activePaymentProfile.paymentDetails[method.id] || '';
  });
  form.elements.bankIban.value = activePaymentProfile.paymentDetails.bankTransfer.iban || '';
  form.elements.bankAccountHolder.value = activePaymentProfile.paymentDetails.bankTransfer.accountHolder || '';
  renderPaymentProfileDetailVisibility(form);
  renderPaymentMethodOptions();
  renderSkipperDashboardOverview();
}

function fillCostPlanForm(plan = activeCostPlan) {
  const form = document.querySelector('#costPlanForm');
  if (!form) return;
  const normalized = normalizeCostPlan(plan);
  form.elements.charterCost.value = euroInputValue(normalized.charterCents);
  form.elements.skipperFlightTrainCost.value = euroInputValue(normalized.skipperFlightTrainCents);
  form.elements.skipperCarCost.value = euroInputValue(normalized.skipperCarCents);
  form.elements.skipperLocalTransferCost.value = euroInputValue(normalized.skipperLocalTransferCents);
  form.elements.otherRecoverableCost.value = euroInputValue(normalized.otherRecoverableCents);
  form.elements.starterPackIncludedInCharter.value = normalized.starterPackSourceSelected
    ? String(normalized.starterPackIncludedInCharter)
    : '';
  form.elements.starterPackRateMode.value = normalized.starterPackRateMode;
  form.elements.starterPackTotal.value = euroInputValue(normalized.starterPackTotalCents);
  form.elements.starterPackFixedPrice.value = euroInputValue(normalized.starterPackFixedPerPersonCents);
  form.elements.protectionInsuranceRateMode.value = normalized.protectionInsuranceRateMode;
  form.elements.protectionInsuranceTotal.value = euroInputValue(normalized.protectionInsuranceTotalCents);
  form.elements.protectionInsuranceFixedPrice.value = euroInputValue(normalized.protectionInsuranceFixedPerPersonCents);
  form.elements.refundableDepositTotal.value = euroInputValue(normalized.refundableDepositTotalCents);
  form.elements.payingParticipants.max = String(maximumPayingParticipants());
  form.elements.payingParticipants.value = String(normalized.payingParticipants);
  form.elements.depositParticipants.max = String(maximumDepositParticipants());
  form.elements.depositParticipants.value = String(normalized.depositParticipants);
  const maxDinetteParticipants = maximumDinettePayingParticipants(normalized.payingParticipants);
  form.elements.dinettePayingParticipants.max = String(maxDinetteParticipants);
  form.elements.dinettePayingParticipants.value = String(normalized.dinettePayingParticipants);
  form.elements.dinetteRateMode.value = normalized.dinetteRateMode;
  form.elements.dinetteRatePercent.value = String(normalized.dinetteWeightPercent);
  form.elements.dinetteFixedPrice.value = euroInputValue(normalized.dinetteFixedCents);
  form.elements.berthRoundingMode.value = normalized.berthRoundingMode;
  form.elements.berthRoundingIncrement.value = String(normalized.berthRoundingIncrementCents || 100);
  form.elements.manualStandardBerthPrice.value = euroInputValue(normalized.manualStandardBerthCents);
  const selectedStarterPackItems = normalizeStarterPackItems(activeContributionPlan?.starterPackItems, {
    fallbackToDefault: !Array.isArray(activeContributionPlan?.starterPackItems),
  });
  form.querySelectorAll('[name="starterPackItems"]').forEach((input) => {
    input.checked = selectedStarterPackItems.includes(input.value);
  });
  syncCostPlanDinetteFieldAvailability();
  syncCostPlanRateMode();
  syncCostPlanBerthPricingMode();
  syncCostPlanDepositParticipantAvailability();
}

function syncCostPlanDinettePricingMode() {
  const form = document.querySelector('#costPlanForm');
  if (!form) return;
  const hasDinette = maximumDinettePayingParticipants(
    asNonNegativeInteger(form.elements.payingParticipants?.value, maximumPayingParticipants()) || maximumPayingParticipants(),
  ) > 0;
  const fixedRate = normalizeDinetteRateMode(form.elements.dinetteRateMode?.value) === 'fixed';
  form.querySelectorAll('[data-dinette-rate-percent]').forEach((field) => {
    field.hidden = !hasDinette || fixedRate;
  });
  form.querySelectorAll('[data-dinette-rate-fixed]').forEach((field) => {
    field.hidden = !hasDinette || !fixedRate;
  });
}

function syncCostPlanRateMode() {
  const form = document.querySelector('#costPlanForm');
  if (!form) return;
  const starterPackRateMode = normalizeStarterPackRateMode(form.elements.starterPackRateMode?.value);
  form.querySelectorAll('[data-starter-pack-total]').forEach((field) => {
    field.hidden = starterPackRateMode !== 'total_divided';
  });
  form.querySelectorAll('[data-starter-pack-fixed]').forEach((field) => {
    field.hidden = starterPackRateMode !== 'fixed_per_person';
  });
  const protectionInsuranceRateMode = normalizeProtectionInsuranceRateMode(form.elements.protectionInsuranceRateMode?.value);
  form.querySelectorAll('[data-protection-insurance-total]').forEach((field) => {
    field.hidden = protectionInsuranceRateMode !== 'total_divided';
  });
  form.querySelectorAll('[data-protection-insurance-fixed]').forEach((field) => {
    field.hidden = protectionInsuranceRateMode !== 'fixed_per_person';
  });
}

function syncCostPlanBerthPricingMode() {
  const form = document.querySelector('#costPlanForm');
  if (!form) return;
  const mode = normalizeBerthRoundingMode(form.elements.berthRoundingMode?.value);
  form.querySelectorAll('[data-berth-rounding-increment]').forEach((field) => {
    field.hidden = mode !== 'ceil_increment';
  });
  form.querySelectorAll('[data-manual-standard-berth]').forEach((field) => {
    field.hidden = mode !== 'manual_up';
  });
  const model = costPlanQuoteModel(readCostPlanForm());
  const manualInput = form.elements.manualStandardBerthPrice;
  if (manualInput && model.calculatedStandardBerthCents > 0) {
    manualInput.min = (model.calculatedStandardBerthCents / 100).toFixed(2);
  }
}

function syncCostPlanDinetteFieldAvailability() {
  const form = document.querySelector('#costPlanForm');
  if (!form) return;
  const payingParticipants = asNonNegativeInteger(form.elements.payingParticipants?.value, maximumPayingParticipants());
  const maxDinetteParticipants = maximumDinettePayingParticipants(payingParticipants || maximumPayingParticipants());
  const dinetteInput = form.elements.dinettePayingParticipants;
  dinetteInput.max = String(maxDinetteParticipants);
  if (asNonNegativeInteger(dinetteInput.value, maximumPayingParticipants()) > maxDinetteParticipants) {
    dinetteInput.value = String(maxDinetteParticipants);
  }
  if (maxDinetteParticipants === 0) {
    dinetteInput.value = '0';
    form.elements.dinetteRateMode.value = 'percentage';
    form.elements.dinetteFixedPrice.value = '';
  }
  form.querySelectorAll('[data-dinette-calculator]').forEach((field) => {
    field.hidden = maxDinetteParticipants === 0;
  });
  syncCostPlanDinettePricingMode();
}

function syncCostPlanDepositParticipantAvailability() {
  const form = document.querySelector('#costPlanForm');
  if (!form) return;
  const input = form.elements.depositParticipants;
  if (!input) return;
  const maximum = maximumDepositParticipants();
  input.max = String(maximum);
  const value = asNonNegativeInteger(input.value, maximum);
  if (value < 1 || value > maximum) {
    const payingParticipants = asNonNegativeInteger(form.elements.payingParticipants?.value, maximumPayingParticipants());
    input.value = String(Math.max(1, Math.min(maximum, payingParticipants || 1)));
  }
}

function readCostPlanForm() {
  const form = document.querySelector('#costPlanForm');
  const dinetteRateMode = normalizeDinetteRateMode(form?.elements.dinetteRateMode?.value);
  const starterPackSource = form?.elements.starterPackIncludedInCharter?.value;
  const starterPackIncludedInCharter = starterPackSource === 'true'
    ? true
    : starterPackSource === 'false'
      ? false
      : null;
  const starterPackRateMode = normalizeStarterPackRateMode(form?.elements.starterPackRateMode?.value);
  const protectionInsuranceRateMode = normalizeProtectionInsuranceRateMode(form?.elements.protectionInsuranceRateMode?.value);
  const berthRoundingMode = normalizeBerthRoundingMode(form?.elements.berthRoundingMode?.value);
  const starterPackItems = normalizeStarterPackItems(
    [...(form?.querySelectorAll('[name="starterPackItems"]:checked') || [])].map((input) => input.value),
  );
  return {
    charterCents: toEuroCents(form?.elements.charterCost?.value),
    skipperFlightTrainCents: toEuroCents(form?.elements.skipperFlightTrainCost?.value),
    skipperCarCents: toEuroCents(form?.elements.skipperCarCost?.value),
    skipperLocalTransferCents: toEuroCents(form?.elements.skipperLocalTransferCost?.value),
    otherRecoverableCents: toEuroCents(form?.elements.otherRecoverableCost?.value),
    starterPackRateMode,
    starterPackIncludedInCharter,
    starterPackTotalCents: starterPackRateMode === 'total_divided'
      ? toEuroCents(form?.elements.starterPackTotal?.value)
      : 0,
    starterPackFixedPerPersonCents: starterPackRateMode === 'fixed_per_person'
      ? toEuroCents(form?.elements.starterPackFixedPrice?.value)
      : 0,
    protectionInsuranceRateMode,
    protectionInsuranceTotalCents: protectionInsuranceRateMode === 'total_divided'
      ? toEuroCents(form?.elements.protectionInsuranceTotal?.value)
      : 0,
    protectionInsuranceFixedPerPersonCents: protectionInsuranceRateMode === 'fixed_per_person'
      ? toEuroCents(form?.elements.protectionInsuranceFixedPrice?.value)
      : 0,
    refundableDepositTotalCents: toEuroCents(form?.elements.refundableDepositTotal?.value),
    payingParticipants: asNonNegativeInteger(form?.elements.payingParticipants?.value, maximumPayingParticipants()),
    depositParticipants: asNonNegativeInteger(form?.elements.depositParticipants?.value, maximumDepositParticipants()),
    dinettePayingParticipants: asNonNegativeInteger(
      form?.elements.dinettePayingParticipants?.value,
      maximumDinettePayingParticipants(asNonNegativeInteger(form?.elements.payingParticipants?.value, maximumPayingParticipants())),
    ),
    dinetteRateMode,
    dinetteWeightPercent: normalizeDinetteWeightPercent(form?.elements.dinetteRatePercent?.value),
    dinetteFixedCents: dinetteRateMode === 'fixed'
      ? toEuroCents(form?.elements.dinetteFixedPrice?.value)
      : 0,
    berthRoundingMode,
    berthRoundingIncrementCents: berthRoundingMode === 'ceil_increment'
      ? normalizeBerthRoundingIncrementCents(form?.elements.berthRoundingIncrement?.value)
      : 0,
    manualStandardBerthCents: berthRoundingMode === 'manual_up'
      ? toEuroCents(form?.elements.manualStandardBerthPrice?.value)
      : 0,
    starterPackItems,
    starterPackDescription: starterPackDescriptionFor(starterPackItems),
    protectionInsuranceDescription: DEFAULT_COST_PLAN_DESCRIPTIONS.protectionInsuranceDescription,
    refundableDepositDescription: DEFAULT_COST_PLAN_DESCRIPTIONS.refundableDepositDescription,
  };
}

function renderCostPlanSummary() {
  const summary = document.querySelector('#costPlanSummary');
  if (!summary) return;
  const plan = normalizeCostPlan(readCostPlanForm());
  const model = costPlanQuoteModel(plan);
  const totalCents = model.recoveryCents;
  const verifiedCents = activePayments
    .filter((payment) => payment.status === 'verified' && paymentCountsTowardCostPlan(payment))
    .reduce((total, payment) => total + paymentCostRecoveryCents(payment), 0);
  const pendingCents = activePayments
    .filter((payment) => isPendingPayment(payment) && paymentCountsTowardCostPlan(payment))
    .reduce((total, payment) => total + paymentCostRecoveryCents(payment), 0);
  const legacyVerifiedCount = activePayments
    .filter((payment) => payment.status === 'verified' && !payment.accountingCategory)
    .length;
  const legacyNote = legacyVerifiedCount
    ? ` ${legacyVerifiedCount} ${legacyVerifiedCount === 1 ? 'accredito verificato precedente non è classificato' : 'accrediti verificati precedenti non sono classificati'} e resta fuori dal bilancio.`
    : '';
  const hasAnyTotal = totalCents > 0
    || model.starterPackTargetCents > 0
    || model.protectionInsuranceTargetCents > 0
    || model.refundableDepositTotalCents > 0
    || model.dinetteFixedCents > 0;
  if (!hasAnyTotal) {
    summary.innerHTML = `<p class="cost-result-intro"><strong>Inserisci i totali della barca per vedere le quote.</strong> Il calcolo usa ${model.payingParticipants} ${model.payingParticipants === 1 ? 'ospite pagante' : 'ospiti paganti'} e lascia lo skipper fuori.</p>`;
    return;
  }
  const rateModeMessage = costPlanRateModeValidationMessage(model);
  if (rateModeMessage) {
    summary.innerHTML = `<p class="cost-result-intro"><strong>Completa una voce prima di salvare.</strong> ${escapeHtml(rateModeMessage)}</p>`;
    return;
  }
  const fixedDinetteMessage = fixedDinetteConfigurationMessage(model);
  if (fixedDinetteMessage) {
    summary.innerHTML = `<p class="cost-result-intro"><strong>Controlla il prezzo della dinette.</strong> ${escapeHtml(fixedDinetteMessage)}</p>`;
    return;
  }
  const berthRoundingMessage = berthRoundingConfigurationMessage(model);
  if (berthRoundingMessage) {
    summary.innerHTML = `<p class="cost-result-intro"><strong>Controlla la quota cabina.</strong> ${escapeHtml(berthRoundingMessage)}</p>`;
    return;
  }
  const perPerson = (cents) => cents > 0 ? `${formatCurrency(cents / 100)} a persona` : 'Non prevista';
  const starterValue = perPerson(model.starterPackPerPersonCents);
  const starterDetail = model.starterPackIncludedInCharter
    ? model.starterPackPerPersonCents > 0
      ? `${model.starterPackDescription} · Parte del totale charter: è già escluso dalla quota cabina e si raccoglie in contanti a bordo.`
      : 'È dentro il costo charter, ma non hai ancora indicato il suo valore.'
    : model.starterPackPerPersonCents > 0
      ? `${model.starterPackDescription} · Costo esterno al charter, da raccogliere in contanti a bordo.`
      : 'Nessuna quota Starter Pack separata.';
  const insuranceValue = perPerson(model.protectionInsurancePerPersonCents);
  const insuranceDetail = model.protectionInsurancePerPersonCents > 0
    ? `${model.protectionInsuranceDescription} · separata dalla quota cabina.`
    : 'Nessuna assicurazione è stata aggiunta al preventivo.';
  const depositValue = model.refundableDepositPerPersonCents > 0
    ? `${formatCurrency(model.refundableDepositPerPersonCents / 100)} a persona`
    : 'Da definire';
  const depositDetail = model.refundableDepositPerPersonCents > 0
    ? `${model.refundableDepositDescription} · in contanti all’imbarco, rimborsabile.`
    : 'È separata dalle quote e dai pagamenti online.';
  const standardPaymentCents = model.standardBerthCents + model.protectionInsurancePerPersonCents;
  const dinettePaymentCents = model.dinetteBerthCents + model.protectionInsurancePerPersonCents;
  const standardCashAtBoardCents = model.starterPackPerPersonCents + model.refundableDepositPerPersonCents;
  const priceModeDetail = model.berthRoundingMode === 'ceil_increment'
    ? `Quota arrotondata per eccesso al prossimo ${formatCurrency(model.berthRoundingIncrementCents / 100)}.`
    : model.berthRoundingMode === 'manual_up'
      ? 'Quota cabina scelta dallo skipper.'
      : 'Quota calcolata esattamente al centesimo.';
  const roundingReserveText = model.roundingReserveCents > 0
    ? `Le quote proposte raccolgono ${formatCurrency(model.roundingReserveCents / 100)} in più dei costi da recuperare: è una riserva da riallocare nella cassa comune, non un guadagno.`
    : model.roundingReserveCents < 0
      ? `Le quote proposte lasciano ${formatCurrency(Math.abs(model.roundingReserveCents) / 100)} da coprire: aumenta la quota cabina prima di inviare gli inviti.`
      : 'Le quote proposte sono in pareggio con i costi da recuperare.';
  const roundingNotes = [
    [model.starterPackRoundingDeltaCents, 'Starter Pack'],
    [model.protectionInsuranceRoundingDeltaCents, 'assicurazione'],
    [model.refundableDepositRoundingDeltaCents, 'cauzione rimborsabile'],
  ]
    .filter(([delta]) => delta)
    .map(([delta, label]) => `${label} ${delta > 0 ? '+' : ''}${formatCurrency(delta / 100)}`);
  const roundingNote = roundingNotes.length ? ` Arrotondamenti: ${roundingNotes.join(' · ')}.` : '';
  const projectedDinetteCount = activeProjections
    .filter((projection) => projection.contributesToCosts !== false && projection.berthType === 'dinette')
    .length;
  const projectedPayingCount = activeProjections
    .filter((projection) => projection.contributesToCosts !== false)
    .length;
  const projectedDepositCount = activeProjections
    .filter((projection) => normalizedProjectionAmount(projection.refundableDepositCents) > 0)
    .length;
  const checkNotes = [
    `Il calcolo divide le spese tra ${model.payingParticipants} ospiti paganti; nell’elenco provvisorio ce ne sono ${projectedPayingCount}.`,
    model.dinettePayingParticipants > 0
      ? `Dinette nel calcolo: ${model.dinettePayingParticipants}; assegnate finora: ${projectedDinetteCount}.`
      : '',
    `Cauzione divisa per ${model.depositParticipants} ${model.depositParticipants === 1 ? 'persona' : 'persone'}; schede con cauzione previste: ${projectedDepositCount}.`,
    roundingNote,
    legacyNote,
  ].filter(Boolean).join(' ');
  // Gli accrediti verificati qui sono solo quelli delle richieste online.
  // Se il Pack è già nel charter, la sua parte resta cash e non deve far
  // apparire come un falso residuo da ricevere online.
  const onlineRecoveryTargetCents = model.allocatedRecoveryCents;
  const onlineBalanceCents = verifiedCents - onlineRecoveryTargetCents;
  const onlineBalance = onlineBalanceCents === 0
    ? 'Quota online coperta dagli accrediti verificati.'
    : onlineBalanceCents > 0
      ? `${formatCurrency(onlineBalanceCents / 100)} oltre la quota online da riallocare.`
      : `${formatCurrency(Math.abs(onlineBalanceCents) / 100)} ancora da ricevere online.`;
  const starterCashCheck = model.starterPackTargetCents > 0
    ? `Starter Pack cash previsto: ${formatCurrency(model.starterPackTargetCents / 100)}${model.starterPackIncludedInCharter ? ', già dentro il charter e scorporato dalla quota cabina.' : ', esterno al charter.'}`
    : 'Nessuno Starter Pack cash è stato configurato.';
  summary.innerHTML = `
    <div class="cost-result-heading"><div><span>Quote per persona</span><strong>Le voci sono separate; i tre totali d’azione sono qui sotto.</strong></div><small>La cauzione è sempre separata e rimborsabile.</small></div>
    <div class="cost-result-grid">
      <article class="cost-result-card"><span>Costo cabina standard</span><strong>${escapeHtml(perPerson(model.standardBerthCents))}</strong><small>${escapeHtml(`${priceModeDetail} L’assicurazione si aggiunge nel totale da versare.`)}</small></article>
      <article class="cost-result-card"><span>Costo posto dinette</span><strong>${escapeHtml(model.dinettePayingParticipants > 0 ? perPerson(model.dinetteBerthCents) : 'Non previsto')}</strong><small>${escapeHtml(model.dinettePayingParticipants > 0 ? `Si aggiunge l’assicurazione nel totale da versare. ${model.dinetteRateMode === 'fixed' ? 'Prezzo fisso scelto.' : `È il ${model.dinetteWeightPercent}% della quota cabina.`}` : 'Nessun posto dinette nel calcolo.')}</small></article>
      <article class="cost-result-card cost-result-card-local"><span>Starter Pack · cosa comprende</span><strong>${escapeHtml(starterValue)}</strong><small>${escapeHtml(starterDetail)}</small></article>
      <article class="cost-result-card"><span>Assicurazione sulla cauzione</span><strong>${escapeHtml(insuranceValue)}</strong><small>${escapeHtml(insuranceDetail)}</small></article>
      <article class="cost-result-card cost-result-card-deposit"><span>Cauzione rimborsabile · cash all’imbarco</span><strong>${escapeHtml(depositValue)}</strong><small>${escapeHtml(model.refundableDepositPerPersonCents > 0 ? `${model.refundableDepositDescription} · Non è un costo finale: viene restituita secondo charter.` : depositDetail)}</small></article>
    </div>
    <div class="cost-result-actions">
      <div class="cost-result-actions-heading"><strong>Cosa chiedere e cosa portare</strong><small>Questi sono gli importi conclusivi, pronti per il messaggio WhatsApp.</small></div>
      <article class="cost-result-card cost-result-card-action"><span>Totale da bonificare / versare · cabina standard</span><strong>${escapeHtml(perPerson(standardPaymentCents))}</strong><small>${escapeHtml(`Posto cabina ${formatCurrency(model.standardBerthCents / 100)} + assicurazione ${formatCurrency(model.protectionInsurancePerPersonCents / 100)}. Il metodo scelto (bonifico, PayPal, Satispay o Revolut) arriva nel messaggio WhatsApp.`)}</small></article>
      <article class="cost-result-card cost-result-card-action"><span>Totale da bonificare / versare · dinette</span><strong>${escapeHtml(model.dinettePayingParticipants > 0 ? perPerson(dinettePaymentCents) : 'Non prevista')}</strong><small>${escapeHtml(model.dinettePayingParticipants > 0 ? `Posto dinette ${formatCurrency(model.dinetteBerthCents / 100)} + assicurazione ${formatCurrency(model.protectionInsurancePerPersonCents / 100)}.` : 'Nessun posto dinette nel calcolo.')}</small></article>
      <article class="cost-result-card cost-result-card-action cost-result-card-action-cash"><span>Totale da portare in contanti · ogni ospite</span><strong>${escapeHtml(perPerson(standardCashAtBoardCents))}</strong><small>${escapeHtml(`Starter Pack ${formatCurrency(model.starterPackPerPersonCents / 100)} + cauzione rimborsabile ${formatCurrency(model.refundableDepositPerPersonCents / 100)}. La cauzione non è un costo finale.`)}</small></article>
    </div>
    <details class="cost-result-check"><summary>Controllo delle quote e dell’arrotondamento</summary><p>Costi reali da recuperare attraverso i posti: <strong>${escapeHtml(formatCurrency(model.berthRecoveryCents / 100))}</strong> · pareggio cabina: <strong>${escapeHtml(formatCurrency(model.calculatedStandardBerthCents / 100))}</strong> · quota cabina proposta: <strong>${escapeHtml(formatCurrency(model.standardBerthCents / 100))}</strong> · ${escapeHtml(priceModeDetail)} ${escapeHtml(roundingReserveText)}</p><p>Quote posto da richiedere: <strong>${escapeHtml(formatCurrency(onlineRecoveryTargetCents / 100))}</strong> · richieste in attesa: <strong>${escapeHtml(formatCurrency(pendingCents / 100))}</strong> · accrediti verificati: <strong>${escapeHtml(formatCurrency(verifiedCents / 100))}</strong> · ${escapeHtml(onlineBalance)}</p><p>${escapeHtml(starterCashCheck)} ${escapeHtml(checkNotes)}</p></details>
  `;
}

function renderCostPlan(plan) {
  activeCostPlan = plan ? normalizeCostPlan(plan) : null;
  fillCostPlanForm(activeCostPlan);
  renderCostPlanSummary();
  renderContributionCatalogForm();
  renderPaymentBerthOptions();
  applyProjectionBerthPreset();
  renderSkipperFinanceOverview(activeCostPlan);
  renderSkipperDashboardOverview();
}

function formatDate(value, locale = 'it') {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'it-IT').format(new Date(`${value}T00:00:00`));
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

function inviteLocale(invite) {
  return invite?.preferredLocale === 'en' ? 'en' : 'it';
}

function participantPrivacyUrl(invite) {
  const url = new URL('privacy.html', window.location.href);
  url.searchParams.set('lang', inviteLocale(invite));
  return url.toString();
}

function participantUrl(invite) {
  if (!invite?.accessKey) return '';
  const url = new URL('participant.html', window.location.href);
  url.searchParams.set('invite', invite.id);
  url.searchParams.set('boat', activeBoat.id);
  url.searchParams.set('key', invite.accessKey);
  url.searchParams.set('lang', inviteLocale(invite));
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
  const privacyUrl = participantPrivacyUrl(invite);
  const message = inviteLocale(invite) === 'en'
    ? `Hi ${invite.displayName}, here is your personal test invitation to the Egadi private area. Open the link, confirm your WhatsApp number and choose a six-digit personal code: ${personalUrl}\n\nBefore activating access, please read Privacy & data: ${privacyUrl}\n\nThe private area is still being tested. Until the final privacy notice is published, please use fictitious data only.`
    : `Ciao ${invite.displayName}, ecco il tuo invito personale di prova per l’area Egadi. Apri il link, conferma il numero WhatsApp e scegli un codice personale di 6 cifre: ${personalUrl}\n\nPrima di attivarlo puoi leggere Privacy e dati: ${privacyUrl}\n\nL’area è in test: fino alla pubblicazione dell’informativa finale inserisci esclusivamente dati fittizi.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function inviteForRecipient(recipientId) {
  return activeInvites.find((candidate) => candidate.id === recipientId) || null;
}

function paymentRecipientWhatsappNumber(recipientId) {
  const invite = inviteForRecipient(recipientId);
  if (invite?.whatsappNumber) return normalizeWhatsAppNumber(invite.whatsappNumber);
  const member = activeMembers.find((candidate) => candidate.id === recipientId);
  return normalizeWhatsAppNumber(member?.phone || '');
}

function selectedPaymentProfileDetails(payment, profile = activePaymentProfile, locale = 'it') {
  const details = normalizePaymentDetails(profile?.paymentDetails);
  return paymentMethodsFor(payment)
    .map((method) => {
      if (!isValidPaymentDetail(method, details)) return '';
      if (method.id === 'bankTransfer') {
        const bankTransferLabel = locale === 'en' ? 'Bank transfer' : method.label;
        const accountHolderLabel = locale === 'en' ? 'Account holder' : 'Intestatario';
        return `${bankTransferLabel}:\n${accountHolderLabel}: ${details.bankTransfer.accountHolder}\nIBAN: ${details.bankTransfer.iban}`;
      }
      return `${method.label}: ${details[method.id]}`;
    })
    .filter(Boolean);
}

function isBerthOrInsurancePayment(payment) {
  return String(payment?.contributionItemId || '').startsWith('berth_')
    || payment?.contributionItemId === 'protection_insurance';
}

function starterPackContentsForPaymentMessage(value, locale) {
  const englishLabels = {
    bed_linen: 'bed linen',
    bath_towels: 'bath towels',
    bath_kit: 'bath kit / essentials',
    beach_towel: 'beach towel',
    outboard: 'outboard engine',
    final_cleaning: 'final cleaning',
    sup: 'SUP',
    egadi_navigation_permit: 'Egadi navigation permit / contribution',
    tender: 'tender, if included by the charter',
  };
  const labels = normalizeStarterPackItems(value)
    .map((itemId) => locale === 'en'
      ? englishLabels[itemId]
      : STARTER_PACK_ITEMS.find((item) => item.id === itemId)?.label)
    .filter(Boolean);
  if (!labels.length) return '';
  return locale === 'en' ? `includes ${labels.join(', ')}` : `include ${labels.join(', ')}`;
}

function paymentTripBreakdownMessage(payment, locale) {
  if (!isBerthOrInsurancePayment(payment)) return '';
  const recipientId = payment.recipientId || payment.memberId || payment.payerInviteId;
  const projection = projectionForPaymentRecipient(recipientId);
  if (!projection) return '';

  const summary = projectionCostBreakdown(projection);
  const { normalized, payableCents, starterPackCents, refundableDepositCents } = summary;
  const berthCents = normalized.berthCents;
  const insuranceCents = normalized.protectionInsuranceCents;
  const balance = projectionPaymentBalance(projection);
  const requestCents = paymentAmountCents(payment);
  const cashAtBoardCents = starterPackCents + refundableDepositCents;
  if (!berthCents && !insuranceCents && !starterPackCents && !refundableDepositCents) return '';

  const euro = (cents) => formatCurrency(cents / 100, locale);
  const starterPackItems = normalizeStarterPackItems(activeContributionPlan?.starterPackItems, {
    fallbackToDefault: !Array.isArray(activeContributionPlan?.starterPackItems),
  });
  const starterPackContents = starterPackContentsForPaymentMessage(starterPackItems, locale);
  const quoteRows = [];
  if (berthCents > 0) {
    quoteRows.push(locale === 'en'
      ? `• Berth: ${euro(berthCents)}`
      : `• Posto/cabina: ${euro(berthCents)}`);
  }
  if (insuranceCents > 0) {
    quoteRows.push(locale === 'en'
      ? `• Deposit-protection insurance: ${euro(insuranceCents)}`
      : `• Assicurazione sulla cauzione: ${euro(insuranceCents)}`);
  }
  if (starterPackCents > 0) {
    quoteRows.push(locale === 'en'
      ? `• Starter Pack: ${euro(starterPackCents)} · cash on board${starterPackContents ? ` (${starterPackContents})` : ''}`
      : `• Starter Pack: ${euro(starterPackCents)} · contanti a bordo${starterPackContents ? ` (${starterPackContents})` : ''}`);
  }

  const balanceRows = payableCents > 0
    ? (locale === 'en'
      ? [
        `• Agreed contribution (berth + insurance): ${euro(payableCents)}`,
        `• Already paid and verified: ${euro(balance.verifiedCents)}`,
        `• Pay now with this request: ${euro(requestCents)}`,
      ]
      : [
        `• Quota concordata (posto + assicurazione): ${euro(payableCents)}`,
        `• Già versato e verificato: ${euro(balance.verifiedCents)}`,
        `• Da versare ora con questa richiesta: ${euro(requestCents)}`,
      ])
    : [];
  if (balance.pendingCents > 0) {
    balanceRows.push(locale === 'en'
      ? `• Requests already sent: ${euro(balance.pendingCents)} · they do not reduce the balance until verified.`
      : `• Richieste già inviate: ${euro(balance.pendingCents)} · non riducono il saldo finché non sono verificate.`);
  }
  const depositLines = refundableDepositCents > 0
    ? (locale === 'en'
      ? [
        `• Refundable security deposit: ${euro(refundableDepositCents)} · cash at boarding`,
        `Cash at boarding: ${euro(cashAtBoardCents)} in total${starterPackCents > 0 ? ` (${euro(starterPackCents)} Starter Pack + ${euro(refundableDepositCents)} refundable deposit)` : ''}.`,
        'The refundable deposit is not a cost: it remains separate and is handled by the charter according to the onboard rules.',
      ]
      : [
        `• Cauzione rimborsabile: ${euro(refundableDepositCents)} · contanti all’imbarco`,
        `Contanti all’imbarco: ${euro(cashAtBoardCents)} in totale${starterPackCents > 0 ? ` (${euro(starterPackCents)} Starter Pack + ${euro(refundableDepositCents)} cauzione rimborsabile)` : ''}.`,
        'La cauzione rimborsabile non è un costo: resta separata ed è gestita dal charter secondo le regole di bordo.',
      ])
    : [];
  const heading = locale === 'en'
    ? 'Summary of your place (for reference, not a second request):'
    : 'Riepilogo del tuo posto (promemoria, non è una seconda richiesta):';
  return `\n\n${[heading, ...quoteRows, ...balanceRows, ...depositLines].filter(Boolean).join('\n')}`;
}

function paymentWhatsappMessage(payment, { messageDetails = '', profile = activePaymentProfile } = {}) {
  const recipientId = payment.recipientId || payment.memberId || payment.payerInviteId;
  const locale = inviteLocale(inviteForRecipient(recipientId));
  const amount = formatCurrency(paymentAmount(payment), locale);
  const reason = payment.reason || (locale === 'en' ? 'your weekend contribution' : 'il contributo del weekend');
  const tripBreakdown = paymentTripBreakdownMessage(payment, locale);
  const dueDate = payment.dueDate
    ? (locale === 'en' ? `\nIf possible, please complete it by ${formatDate(payment.dueDate, locale)}.` : `\nSe possibile entro il ${formatDate(payment.dueDate, locale)}.`)
    : '';
  const methods = paymentMethodsFor(payment).map((method) => locale === 'en' && method.id === 'bankTransfer' ? 'Bank transfer' : method.label);
  const methodText = methods.length
    ? (locale === 'en' ? `\n\nYou can choose whichever method suits you: ${methods.join(', ')}.` : `\n\nPuoi scegliere il metodo che preferisci: ${methods.join(', ')}.`)
    : (locale === 'en' ? '\n\nMessage me here and we can choose the most convenient method together.' : '\n\nScrivimi qui e scegliamo insieme il metodo più comodo.');
  const details = [
    ...selectedPaymentProfileDetails(payment, profile, locale),
    String(messageDetails || '').trim(),
  ].filter(Boolean);
  const detailsText = details.length
    ? (locale === 'en' ? `\n\nPayment details:\n${details.join('\n\n')}` : `\n\nDettagli per il pagamento:\n${details.join('\n\n')}`)
    : (locale === 'en' ? '\n\nFor details of the method you choose, reply to me here on WhatsApp.' : '\n\nPer i dettagli del metodo scelto, rispondimi qui su WhatsApp.');
  return locale === 'en'
    ? `Hi ${recipientName(recipientId)} 🌊\n\nFor ${reason}, pay now: ${amount}.${dueDate}${methodText}${detailsText}${tripBreakdown}\n\nThe website does not receive payments. Once you have paid, please message me here so I can check the actual transfer. Thank you! ⛵`
    : `Ciao ${recipientName(recipientId)} 🌊\n\nPer ${reason}, da versare ora: ${amount}.${dueDate}${methodText}${detailsText}${tripBreakdown}\n\nIl sito non riceve denaro: dopo il contributo avvisami qui, così controllo l’accredito reale. Grazie! ⛵`;
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

async function createInviteRecord({ displayName, whatsappNumber, preferredLocale = 'it', inviteId = null, existingInvite = null }) {
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
    id: existingInvite?.id || inviteId || createInviteId(),
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
    preferredLocale: preferredLocale === 'en' ? 'en' : 'it',
  };
}

async function createInviteFromProjection(projection) {
  const preferredLocale = projection.preferredLocale === 'en' ? 'en' : 'it';
  if (preferredLocale === 'en' && !hasOfficialEnglishBriefing()) {
    const error = new Error('Briefing inglese mancante.');
    error.code = 'english-briefing-required';
    throw error;
  }
  const invite = await createInviteRecord({
    displayName: projection.displayName,
    whatsappNumber: projection.whatsappNumber,
    preferredLocale,
    inviteId: projection.id,
  });
  const batch = writeBatch(db);
  batch.set(doc(db, 'boats', activeBoat.id, 'invites', invite.id), {
    ...invite,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });
  // La proiezione può provenire da una pagina precedente allo schema V3.
  // Al passaggio a invito viene normalizzata una sola volta, insieme agli
  // importi effettivi che la persona vedrà nella propria area.
  const normalizedProjection = normalizeProjection(projection.id, projection);
  const currentPricing = effectiveProjectionPricing(normalizedProjection);
  batch.update(doc(db, 'boats', activeBoat.id, 'crewProjections', projection.id), {
    pricingMode: currentPricing.pricingMode,
    contributesToCosts: currentPricing.contributesToCosts,
    berthCents: currentPricing.berthCents,
    starterPackCents: currentPricing.starterPackCents,
    protectionInsuranceCents: currentPricing.protectionInsuranceCents,
    refundableDepositCents: currentPricing.refundableDepositCents,
    status: 'invited',
    inviteId: invite.id,
    invitedAt: serverTimestamp(),
    // La quota concordata diventa una fotografia dell'invito anche quando
    // nasce da un'eccezione: da qui in poi la dashboard non la cambia da sola.
    pricingSnapshotAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
  });
  await batch.commit();
  return invite;
}

async function reissueInvite(invite) {
  const renewedInvite = await createInviteRecord({
    displayName: invite.displayName,
    whatsappNumber: invite.whatsappNumber,
    preferredLocale: inviteLocale(invite),
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
  if (!select) return;
  const selectedRecipientId = select.value;
  // Una richiesta personale è leggibile soltanto dal titolare di un invito.
  // Le righe inserite manualmente per il PDF del charter restano quindi
  // fuori da questo selettore: non devono portare a un permission-denied né
  // trasformare l'eccezione manuale in un canale di incasso.
  const inviteIds = new Set(activeInvites.map((invite) => invite.id));
  const membersWithInvite = activeMembers.filter((member) => inviteIds.has(member.id));
  const manualMembers = activeMembers.filter((member) => !inviteIds.has(member.id));
  const members = membersWithInvite.map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(memberName(member))} · Crew</option>`).join('');
  const pendingInvites = activeInvites.filter((invite) => invite.status !== 'revoked' && !activeMembers.some((member) => member.id === invite.id));
  const invites = pendingInvites.map((invite) => `<option value="${escapeHtml(invite.id)}">${escapeHtml(invite.displayName)} · Invito da completare</option>`).join('');
  if (!members && !invites) {
    select.innerHTML = '<option value="">Prima crea un invito personale</option>';
    renderPaymentBerthOptions();
    renderPaymentBalancePreview();
    return;
  }
  select.innerHTML = '<option value="">Seleziona una persona</option>'
    + (invites ? `<optgroup label="Inviti personali">${invites}</optgroup>` : '')
    + (members ? `<optgroup label="Crew con accesso personale">${members}</optgroup>` : '')
    + (manualMembers.length ? `<optgroup label="Solo Crew List · nessuna richiesta WhatsApp"><option disabled>${manualMembers.length} ${manualMembers.length === 1 ? 'persona inserita manualmente' : 'persone inserite manualmente'}</option></optgroup>` : '');
  if ([...select.options].some((option) => option.value === selectedRecipientId)) {
    select.value = selectedRecipientId;
  }
  renderPaymentBerthOptions();
  renderPaymentBalancePreview();
}

function renderPaymentBalancePreview() {
  const preview = document.querySelector('#paymentBalancePreview');
  const recipientId = document.querySelector('#paymentMember')?.value || '';
  const projection = projectionForPaymentRecipient(recipientId);
  if (!preview || !projection) {
    if (preview) {
      preview.hidden = true;
      preview.replaceChildren();
    }
    return;
  }
  const balance = projectionPaymentBalance(projection);
  if (balance.expectedCents < 1) {
    preview.hidden = true;
    preview.replaceChildren();
    return;
  }
  const euro = (cents) => formatCurrency(cents / 100);
  const pending = balance.pendingCents > 0
    ? `<span>Richieste già inviate: ${euro(balance.pendingCents)}. Non riducono il saldo finché l'accredito non è verificato.</span>`
    : '';
  const warning = balance.overpaidCents > 0
    ? `<span>Eccedenza da verificare: ${euro(balance.overpaidCents)}.</span>`
    : '';
  preview.hidden = false;
  preview.innerHTML = `<strong>Situazione di ${escapeHtml(projection.displayName)}</strong><span>Quota concordata: ${euro(balance.expectedCents)} · già ricevuto e verificato: ${euro(balance.verifiedCents)} · saldo da richiedere: ${euro(balance.remainingCents)}.</span>${pending}${warning}`;
}

function contributionStateOptions(item) {
  if (item.id === 'starter_pack') {
    return item.state === 'included'
      ? '<option value="included" selected>Nel charter · cash a bordo</option>'
      : '<option value="local" selected>Solo contanti a bordo</option>';
  }
  if (item.id === 'linen_towels') return '<option value="included" selected>Compreso nello Starter Pack</option>';
  if (item.id === 'refundable_deposit') return '<option value="local" selected>Contanti all’imbarco</option>';
  return [...CONTRIBUTION_ITEM_STATES.entries()]
    .map(([value, label]) => `<option value="${value}"${value === item.state ? ' selected' : ''}>${label}</option>`)
    .join('');
}

function contributionCatalogRow(item) {
  const automatic = AUTOMATIC_COST_PLAN_ITEM_IDS.has(item.id);
  const stateHint = item.id === 'starter_pack'
    ? item.state === 'included'
      ? '<small>Gestito dalla Dashboard economica. È una parte del costo charter, già esclusa dalla quota cabina e da raccogliere in contanti a bordo.</small>'
      : '<small>Gestito dalla Dashboard economica. Si regola solo in contanti a bordo; non crea richieste WhatsApp.</small>'
    : item.id === 'linen_towels'
      ? '<small>Già incluso nello Starter Pack: non va richiesto una seconda volta.</small>'
      : item.id === 'protection_insurance'
        ? '<small>La quota per persona arriva dal totale assicurazione nel Preventivo barca; può essere richiesta separatamente.</small>'
        : item.id === 'refundable_deposit'
          ? '<small>Gestita dal Preventivo barca: sempre rimborsabile, in contanti all’imbarco e mai in una richiesta WhatsApp.</small>'
          : '';
  const amountLabel = automatic ? '€ a persona · calcolato' : '€ a persona · richiesto a parte / regolato separatamente';
  return `<article class="contribution-catalog-row" data-contribution-id="${escapeHtml(item.id)}"><div class="contribution-catalog-label">${escapeHtml(item.label)}${stateHint}</div><label>Gestione<select data-contribution-state${automatic ? ' disabled' : ''}>${contributionStateOptions(item)}</select></label><label>${amountLabel}<input data-contribution-amount type="number" min="0" max="10000" step="0.01" inputmode="decimal" value="${euroInputValue(item.amountCents)}" placeholder="Es. 30,00"${automatic ? ' disabled' : ''} /></label></article>`;
}

function syncContributionCatalogRow(row) {
  if (AUTOMATIC_COST_PLAN_ITEM_IDS.has(row?.dataset.contributionId)) return;
  const state = row?.querySelector('[data-contribution-state]')?.value;
  const amount = row?.querySelector('[data-contribution-amount]');
  if (!amount) return;
  const canSetAmount = state === 'extra' || state === 'local';
  amount.disabled = !canSetAmount;
  amount.title = canSetAmount
    ? 'Importo indicativo facoltativo per persona.'
    : 'L’importo è disponibile solo per voci richieste a parte o regolate separatamente.';
  if (!canSetAmount) amount.value = '';
}

function renderContributionCatalogForm(items = contributionCatalog()) {
  const rows = document.querySelector('#contributionCatalogRows');
  if (!rows) return;
  // Lenzuola e asciugamani sono una riga tecnica: nel V4 vengono raccontati
  // dentro lo Starter Pack, così non sembrano una seconda spesa.
  rows.innerHTML = items.filter((item) => item.id !== 'linen_towels').map(contributionCatalogRow).join('');
  rows.querySelectorAll('[data-contribution-id]').forEach(syncContributionCatalogRow);
}

function readContributionPlanForm() {
  const rows = [...document.querySelectorAll('#contributionCatalogRows [data-contribution-id]')];
  const current = normalizeContributionPlan(activeContributionPlan);
  const items = { ...current.items };
  rows.forEach((row) => {
    const itemId = row.dataset.contributionId;
    items[itemId] = {
      state: row.querySelector('[data-contribution-state]')?.value,
      amountCents: toEuroCents(row.querySelector('[data-contribution-amount]')?.value),
    };
  });
  return normalizeContributionPlan({
    items,
    starterPackItems: current.starterPackItems,
    starterPackSettlementMode: 'cash_on_board',
  });
}

function contributionPlanWithEditedExtras(latestPlan, submittedPlan, costPlan = null) {
  const latest = normalizeContributionPlan(latestPlan);
  const submitted = normalizeContributionPlan(submittedPlan);
  const items = { ...latest.items };
  DEFAULT_CONTRIBUTION_ITEMS
    .filter((item) => !AUTOMATIC_COST_PLAN_ITEM_IDS.has(item.id))
    .forEach((item) => {
      items[item.id] = submitted.items[item.id];
    });
  return costPlan
    ? contributionPlanForCostPlan(costPlan, { items, starterPackItems: latest.starterPackItems })
    : normalizeContributionPlan({ items, starterPackItems: latest.starterPackItems, starterPackSettlementMode: 'cash_on_board' });
}

function berthRateType(typeId) {
  return BERTH_RATE_TYPES.find((type) => type.id === typeId) || null;
}

function extraContributionType(typeId) {
  return extraContributionTypes().find((type) => type.id === typeId) || null;
}

function costPlanContributionType(typeId) {
  return costPlanContributionTypes().find((type) => type.id === typeId) || null;
}

function contributionItemIdForPaymentSelection(typeId) {
  const berthItemIds = {
    double_cabin: 'berth_double_cabin',
    single_cabin: 'berth_single_cabin',
    dinette: 'berth_dinette',
    other: 'berth_other',
  };
  if (berthItemIds[typeId]) return berthItemIds[typeId];
  if (typeId === 'to_define') return 'berth_base';
  if (typeId === 'cost:base') return 'berth_base';
  if (typeId === 'cost:dinette') return 'berth_dinette';
  if (typeId === 'cost:protection_insurance') return 'protection_insurance';
  if (typeof typeId === 'string' && typeId.startsWith('extra:')) {
    const itemId = typeId.slice('extra:'.length);
    return PAYMENT_CONTRIBUTION_ITEM_IDS.has(itemId) && !AUTOMATIC_COST_PLAN_ITEM_IDS.has(itemId) ? itemId : 'other';
  }
  return 'other';
}

function projectionForPaymentRecipient(recipientId) {
  return activeProjections.find((projection) => projection.id === recipientId) || null;
}

function assignedPaymentTypes(recipientId) {
  const projection = projectionForPaymentRecipient(recipientId);
  if (!projection || projection.contributesToCosts === false) return [];
  const pricing = effectiveProjectionPricing(projection);
  const balance = projectionPaymentBalance(projection);
  const types = [];
  if (balance.remainingCents > 0) {
    const remainingBerthCents = Math.max(0, pricing.berthCents - balance.verifiedBerthCents);
    const remainingInsuranceCents = Math.max(0, pricing.protectionInsuranceCents - balance.verifiedInsuranceCents);
    const remainingAllocation = {
      berthCents: remainingBerthCents,
      protectionInsuranceCents: remainingInsuranceCents,
    };
    types.push({
      id: 'assigned:balance',
      label: balance.verifiedCents > 0 ? 'Saldo della persona' : 'Quota concordata della persona',
      cents: balance.remainingCents,
      defaultReason: balance.verifiedCents > 0
        ? `Saldo quota · ${projectionBerthLabel(projection.berthType)}`
        : `Quota concordata · ${projectionBerthLabel(projection.berthType)}`,
      contributionItemId: remainingBerthCents > 0
        ? contributionItemIdForPaymentSelection(projection.berthType)
        : 'protection_insurance',
      accountingCategory: remainingBerthCents > 0 ? 'cost_recovery' : 'other',
      installmentType: balance.verifiedCents > 0 ? 'balance' : 'full',
      allocation: remainingAllocation,
    });
  }
  if (pricing.berthCents > 0) {
    const remainingBerthCents = Math.max(0, pricing.berthCents - balance.verifiedBerthCents);
    if (remainingBerthCents > 0) {
    types.push({
      id: 'assigned:berth',
      label: `Quota posto residua · ${projectionBerthLabel(projection.berthType)}`,
      cents: remainingBerthCents,
      defaultReason: `Quota posto · ${projectionBerthLabel(projection.berthType)}`,
      contributionItemId: contributionItemIdForPaymentSelection(projection.berthType),
      accountingCategory: 'cost_recovery',
      installmentType: 'advance',
      allocation: { berthCents: remainingBerthCents, protectionInsuranceCents: 0 },
    });
    }
  }
  if (pricing.protectionInsuranceCents > 0) {
    const remainingInsuranceCents = Math.max(0, pricing.protectionInsuranceCents - balance.verifiedInsuranceCents);
    if (remainingInsuranceCents > 0) {
    types.push({
      id: 'assigned:protection_insurance',
      label: 'Assicurazione cauzione residua',
      cents: remainingInsuranceCents,
      defaultReason: 'Assicurazione cauzione',
      contributionItemId: 'protection_insurance',
      accountingCategory: 'other',
      installmentType: 'advance',
      allocation: { berthCents: 0, protectionInsuranceCents: remainingInsuranceCents },
    });
    }
  }
  return types;
}

function assignedPaymentType(typeId, recipientId) {
  return assignedPaymentTypes(recipientId).find((type) => type.id === typeId) || null;
}

function paymentContributionItemIdForSelection(typeId, recipientId) {
  return assignedPaymentType(typeId, recipientId)?.contributionItemId
    || contributionItemIdForPaymentSelection(typeId);
}

function paymentContributionItemLabel(payment) {
  return PAYMENT_CONTRIBUTION_ITEM_LABELS[payment?.contributionItemId] || '';
}

function coreAllocationForPaymentSelection(typeId, recipientId, amountCents) {
  const projection = projectionForPaymentRecipient(recipientId);
  const assigned = assignedPaymentType(typeId, recipientId);
  if (assigned) {
    if (assigned.id === 'assigned:balance' && projection) {
      const balance = projectionPaymentBalance(projection);
      const remainingBerthCents = Math.max(0, balance.expectedBerthCents - balance.verifiedBerthCents);
      return {
        berthCents: Math.min(amountCents, remainingBerthCents),
        protectionInsuranceCents: Math.max(0, amountCents - remainingBerthCents),
      };
    }
    if (assigned.id === 'assigned:berth') return { berthCents: amountCents, protectionInsuranceCents: 0 };
    if (assigned.id === 'assigned:protection_insurance') return { berthCents: 0, protectionInsuranceCents: amountCents };
  }
  if (typeId === 'cost:protection_insurance') return { berthCents: 0, protectionInsuranceCents: amountCents };
  const itemId = contributionItemIdForPaymentSelection(typeId);
  if (itemId === 'berth' || itemId.startsWith('berth_')) return { berthCents: amountCents, protectionInsuranceCents: 0 };
  return null;
}

function paymentInstallmentTypeForSelection(typeId, recipientId, amountCents) {
  const allocation = coreAllocationForPaymentSelection(typeId, recipientId, amountCents);
  if (!allocation) return 'extra';
  const assigned = assignedPaymentType(typeId, recipientId);
  if (assigned?.installmentType) return assigned.installmentType;
  const projection = projectionForPaymentRecipient(recipientId);
  const expectedCents = projection ? projectionPaymentBalance(projection).expectedCents : 0;
  return allocation.berthCents + allocation.protectionInsuranceCents === expectedCents ? 'full' : 'advance';
}

function renderPaymentBerthOptions() {
  const select = document.querySelector('#paymentBerthType');
  if (!select) return;
  const selectedType = select.value || 'custom';
  const recipientId = document.querySelector('#paymentMember')?.value || '';
  const assignedTypes = assignedPaymentTypes(recipientId);
  const totals = berthLayoutTotals(activeBoat?.berthLayout);
  const rates = normalizeBerthRates(activeBoat?.berthRates);
  const assignedOptions = assignedTypes.map((type) => (
    `<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)} · ${formatCurrency(type.cents / 100)}</option>`
  )).join('');
  const berthOptions = BERTH_RATE_TYPES
    .map((type) => ({ ...type, count: type.count(totals), cents: rates[type.rateKey] }))
    .filter((type) => type.count > 0)
    .map((type) => {
      const placeLabel = type.count === 1 ? '1 posto' : `${type.count} posti`;
      const priceLabel = type.cents > 0 ? `${formatCurrency(type.cents / 100)} a persona` : 'quota da indicare';
      return `<option value="${type.id}">${type.label} · ${placeLabel} · ${priceLabel}</option>`;
    }).join('');
  const extraOptions = extraContributionTypes().map((type) => {
    const priceLabel = type.cents > 0 ? `${formatCurrency(type.cents / 100)} a persona` : 'importo da indicare';
    return `<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)} · ${priceLabel}</option>`;
  }).join('');
  const calculatedOptions = costPlanContributionTypes();
  const calculatedOption = calculatedOptions.length
    ? `<optgroup label="Quota di pareggio · controllo dashboard">${calculatedOptions.map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)} · ${formatCurrency(type.cents / 100)} a persona</option>`).join('')}</optgroup>`
    : '';
  select.innerHTML = '<option value="custom">Importo libero / altra voce</option>'
    + (assignedOptions ? `<optgroup label="Quota assegnata alla persona">${assignedOptions}</optgroup>` : '')
    + (berthOptions ? `<optgroup label="Listino barca manuale · override esplicito">${berthOptions}</optgroup>` : '')
    + calculatedOption
    + (extraOptions ? `<optgroup label="Voci da richiedere a parte">${extraOptions}</optgroup>` : '');
  select.value = (assignedPaymentType(selectedType, recipientId) || berthRateType(selectedType) || extraContributionType(selectedType) || costPlanContributionType(selectedType)) && [...select.options].some((option) => option.value === selectedType)
    ? selectedType
    : 'custom';
}

function applyPaymentBerthPreset() {
  const form = document.querySelector('#paymentForm');
  if (!form || !activeBoat) return;
  const selectedType = form.elements.berthType?.value;
  const assignedType = assignedPaymentType(selectedType, form.elements.recipientId?.value || '');
  const berthType = berthRateType(selectedType);
  const extraType = extraContributionType(selectedType);
  const costPlanType = costPlanContributionType(selectedType);
  if (!assignedType && !berthType && !extraType && !costPlanType) return;
  const amount = form.elements.amount;
  const reason = form.elements.reason;
  let cents = 0;
  let defaultReason = '';
  let accountingCategoryValue = 'other';
  if (assignedType) {
    cents = assignedType.cents;
    defaultReason = assignedType.defaultReason;
    accountingCategoryValue = assignedType.accountingCategory;
  } else if (berthType) {
    const totals = berthLayoutTotals(activeBoat.berthLayout);
    if (berthType.count(totals) < 1) return;
    cents = normalizeBerthRates(activeBoat.berthRates)[berthType.rateKey];
    defaultReason = berthType.defaultReason;
    accountingCategoryValue = 'cost_recovery';
  } else if (extraType) {
    cents = extraType.cents;
    defaultReason = extraType.defaultReason;
  } else {
    cents = costPlanType.cents;
    defaultReason = costPlanType.defaultReason;
    accountingCategoryValue = costPlanType.accountingCategory;
  }
  if (cents > 0 && (!amount.value || amount.dataset.autoBerthRate === 'true')) {
    amount.value = euroInputValue(cents);
    amount.dataset.autoBerthRate = 'true';
  } else if (cents === 0 && amount.dataset.autoBerthRate === 'true') {
    amount.value = '';
    delete amount.dataset.autoBerthRate;
  }
  if (!reason.value.trim() || reason.dataset.autoBerthReason === 'true') {
    reason.value = defaultReason;
    reason.dataset.autoBerthReason = 'true';
  }
  const accountingCategory = form.elements.accountingCategory;
  if ((assignedType || berthType || extraType || costPlanType) && accountingCategory) {
    const shouldRecoverCosts = accountingCategoryValue === 'cost_recovery';
    accountingCategory.checked = shouldRecoverCosts;
    accountingCategory.dataset.autoCostRecovery = shouldRecoverCosts ? 'true' : 'false';
  } else if (accountingCategory?.dataset.autoCostRecovery === 'true') {
    accountingCategory.checked = false;
    delete accountingCategory.dataset.autoCostRecovery;
  }
}

function normalizeMember(id, member) {
  if (member.firstName || member.lastName) return { id, ...member };
  const [firstName = '', ...lastNameParts] = String(member.displayName || '').trim().split(/\s+/);
  return { id, ...member, firstName, lastName: lastNameParts.join(' ') };
}

function projectionBerthLabel(type) {
  return PROJECTION_BERTH_TYPES[type] || PROJECTION_BERTH_TYPES.to_define;
}

function normalizeCabinGroupId(value) {
  const cabinGroupId = String(value || '').trim();
  return /^double-[1-9][0-9]*$/.test(cabinGroupId) ? cabinGroupId : '';
}

function doubleCabinGroups(boat = activeBoat) {
  const layout = normalizeBerthLayout(boat?.berthLayout);
  const total = layout.doubleCabins;
  return Array.from({ length: total }, (_, index) => ({
    id: `double-${index + 1}`,
    label: layout.doubleCabinLabels[index]
      ? `Cabina da 2 posti · ${layout.doubleCabinLabels[index]}`
      : `Cabina da 2 posti ${index + 1}`,
  }));
}

function cabinGroupLabel(cabinGroupId) {
  const group = doubleCabinGroups().find((candidate) => candidate.id === cabinGroupId);
  return group?.label || 'Cabina da 2 posti da riallocare';
}

function projectionCabinGroupId(projection) {
  const normalized = normalizeProjection(projection?.id, projection);
  return normalized.berthType === 'double_cabin'
    ? normalizeCabinGroupId(normalized.cabinGroupId)
    : '';
}

function cabinGroupOccupants(cabinGroupId, excludedProjectionId = null) {
  if (!cabinGroupId) return [];
  return activeProjections.filter((projection) => projection.id !== excludedProjectionId
    && projectionCabinGroupId(projection) === cabinGroupId);
}

function projectionCabinAssignmentText(projection) {
  const cabinGroupId = projectionCabinGroupId(projection);
  if (!cabinGroupId) {
    return projection.berthType === 'double_cabin'
      ? 'Cabina da 2 posti da assegnare'
      : '';
  }
  const groupIsAvailable = doubleCabinGroups().some((group) => group.id === cabinGroupId);
  if (!groupIsAvailable) return `${cabinGroupLabel(cabinGroupId)}: verifica la configurazione della barca`;
  const companions = cabinGroupOccupants(cabinGroupId, projection.id);
  if (!companions.length) return `${cabinGroupLabel(cabinGroupId)} · 1 posto ancora libero`;
  if (companions.length === 1) return `${cabinGroupLabel(cabinGroupId)} · con ${companions[0].displayName}`;
  return `${cabinGroupLabel(cabinGroupId)} · occupazione da verificare`;
}

function cabinGroupOptionsHtml(currentGroupId = '', excludedProjectionId = null) {
  const options = ['<option value="">Da assegnare</option>'];
  doubleCabinGroups().forEach((group) => {
    const occupants = cabinGroupOccupants(group.id, excludedProjectionId);
    const isCurrent = group.id === currentGroupId;
    const isFull = occupants.length >= 2 && !isCurrent;
    const names = occupants.length
      ? ` · ${occupants.map((projection) => projection.displayName).join(', ')}`
      : '';
    options.push(`<option value="${escapeHtml(group.id)}"${isCurrent ? ' selected' : ''}${isFull ? ' disabled' : ''}>${escapeHtml(group.label)} · ${occupants.length}/2${escapeHtml(names)}</option>`);
  });
  return options.join('');
}

function syncProjectionCabinGroupField() {
  const form = document.querySelector('#projectionForm');
  const field = document.querySelector('#projectionCabinSlotField');
  const select = form?.elements.cabinGroupId;
  if (!form || !field || !select) return;
  const isDoubleCabin = form.elements.berthType?.value === 'double_cabin';
  field.hidden = !isDoubleCabin;
  if (!isDoubleCabin) {
    select.value = '';
    return;
  }
  const currentGroupId = normalizeCabinGroupId(select.value);
  select.innerHTML = cabinGroupOptionsHtml(currentGroupId, editingProjectionId);
  if (!doubleCabinGroups().length) {
    select.innerHTML = '<option value="">Nessuna cabina da 2 posti configurata</option>';
    select.disabled = true;
    return;
  }
  select.disabled = false;
}

function validateProjectionCabinGroup(projection, projectionId = null) {
  if (projection.berthType !== 'double_cabin') return '';
  const cabinGroupId = normalizeCabinGroupId(projection.cabinGroupId);
  if (!cabinGroupId) return '';
  if (!doubleCabinGroups().some((group) => group.id === cabinGroupId)) {
    return 'La cabina selezionata non esiste più nella configurazione della barca.';
  }
  if (cabinGroupOccupants(cabinGroupId, projectionId).length >= 2) {
    return `${cabinGroupLabel(cabinGroupId)} ha già due persone assegnate.`;
  }
  return '';
}

function projectionsOutsideDoubleCabinLayout(layout) {
  const maximum = berthLayoutTotals(layout).doubleCabins;
  return activeProjections.filter((projection) => {
    const cabinGroupId = projectionCabinGroupId(projection);
    const position = Number(cabinGroupId.replace('double-', ''));
    return Number.isInteger(position) && position > maximum;
  });
}

function normalizedProjectionAmount(value) {
  return asNonNegativeInteger(value, 1_000_000);
}

function projectionContributesToCosts(projection) {
  return projection?.contributesToCosts !== false;
}

function normalizeProjection(id, projection = {}) {
  const firstName = String(projection.firstName || '').trim();
  const lastName = String(projection.lastName || '').trim();
  const displayName = String(projection.displayName || `${firstName} ${lastName}`).trim();
  const contributesToCosts = projectionContributesToCosts(projection);
  const berthType = PROJECTION_BERTH_TYPES[projection.berthType] ? projection.berthType : 'to_define';
  return {
    id,
    ...projection,
    firstName,
    lastName,
    displayName,
    plannedRole: String(projection.plannedRole || DEFAULT_CREW_ROLE).trim() || DEFAULT_CREW_ROLE,
    berthType,
    cabinGroupId: berthType === 'double_cabin' ? normalizeCabinGroupId(projection.cabinGroupId) : '',
    contributesToCosts,
    pricingMode: projectionPricingMode(projection),
    berthCents: contributesToCosts ? normalizedProjectionAmount(projection.berthCents) : 0,
    starterPackCents: contributesToCosts ? normalizedProjectionAmount(projection.starterPackCents) : 0,
    protectionInsuranceCents: contributesToCosts ? normalizedProjectionAmount(projection.protectionInsuranceCents) : 0,
    // La cauzione è rimborsabile e separata: un ruolo gratuito può doverla
    // comunque portare, anche quando non partecipa alle quote della barca.
    refundableDepositCents: normalizedProjectionAmount(projection.refundableDepositCents),
    status: projection.status === 'invited' ? 'invited' : 'projected',
  };
}

function projectionPayableCents(projection) {
  const normalized = effectiveProjectionPricing(projection);
  return normalized.berthCents + normalized.protectionInsuranceCents;
}

function projectionCostBreakdown(projection) {
  const normalized = effectiveProjectionPricing(projection);
  const items = [
    { label: 'Posto/cabina', cents: normalized.berthCents },
    { label: 'Assicurazione cauzione', cents: normalized.protectionInsuranceCents },
  ];
  const payableCents = items.reduce((total, item) => total + item.cents, 0);
  return {
    normalized,
    items,
    payableCents,
    hasPayableEstimate: items.some((item) => item.cents > 0),
    starterPackCents: normalized.starterPackCents,
    refundableDepositCents: normalized.refundableDepositCents,
  };
}

function projectionPaymentBalance(projection) {
  const cost = projectionCostBreakdown(projection);
  const records = activePayments.filter((payment) => payment.status !== 'cancelled'
    && paymentRecipientId(payment) === projection?.id
    && paymentCoreCents(payment) > 0);
  const verified = records.filter((payment) => payment.status === 'verified');
  const pending = records.filter(isPendingPayment);
  const sumAllocation = (payments, amountForPayment) => payments
    .reduce((total, payment) => total + amountForPayment(payment), 0);
  const verifiedBerthCents = sumAllocation(verified, paymentBerthCents);
  const verifiedInsuranceCents = sumAllocation(verified, paymentProtectionInsuranceCents);
  const verifiedCents = verifiedBerthCents + verifiedInsuranceCents;
  const pendingCents = sumAllocation(pending, paymentCoreCents);
  const advanceCents = sumAllocation(
    verified.filter((payment) => payment.installmentType === 'advance'),
    paymentCoreCents,
  );
  const expectedCents = cost.payableCents;
  return {
    expectedCents,
    expectedBerthCents: cost.normalized.berthCents,
    expectedInsuranceCents: cost.normalized.protectionInsuranceCents,
    verifiedCents,
    verifiedBerthCents,
    verifiedInsuranceCents,
    pendingCents,
    pendingCount: pending.length,
    advanceCents,
    remainingCents: Math.max(0, expectedCents - verifiedCents),
    overpaidCents: Math.max(0, verifiedCents - expectedCents),
  };
}

function projectionPaymentBalanceMarkup(projection) {
  const balance = projectionPaymentBalance(projection);
  if (balance.expectedCents < 1) return '';
  const euro = (cents) => formatCurrency(cents / 100);
  const advance = balance.advanceCents > 0
    ? `<span>Di cui acconti verificati<b>${euro(balance.advanceCents)}</b></span>`
    : '';
  const pending = balance.pendingCents > 0
    ? `<span>Richieste già inviate<b>${euro(balance.pendingCents)}</b></span>`
    : '';
  const warning = balance.overpaidCents > 0
    ? `<span class="projection-payment-balance-warning">Eccedenza da verificare: ${euro(balance.overpaidCents)}. Il saldo non va sotto zero.</span>`
    : balance.pendingCents > 0
      ? `<span class="projection-payment-balance-warning">Le richieste aperte non riducono il saldo finché l'accredito non è verificato.</span>`
      : '';
  return `<div class="projection-payment-balance"><span>Situazione contributi · Starter Pack e cauzione restano separati</span><span>Quota concordata<b>${euro(balance.expectedCents)}</b></span><span>Già ricevuto e verificato<b>${euro(balance.verifiedCents)}</b></span>${advance}<span class="projection-payment-balance-open">Saldo da richiedere<b>${euro(balance.remainingCents)}</b></span>${pending}${warning}</div>`;
}

function manualReceiptAllocation(projection, target, amountCents) {
  if (target === 'berth') return { berthCents: amountCents, protectionInsuranceCents: 0 };
  if (target === 'insurance') return { berthCents: 0, protectionInsuranceCents: amountCents };
  const balance = projectionPaymentBalance(projection);
  const remainingBerthCents = Math.max(0, balance.expectedBerthCents - balance.verifiedBerthCents);
  const berthCents = Math.min(amountCents, remainingBerthCents);
  return { berthCents, protectionInsuranceCents: amountCents - berthCents };
}

function localDateForForm() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function openManualReceiptPanel(projection) {
  const panel = document.querySelector('#manualReceiptPanel');
  const form = document.querySelector('#manualReceiptForm');
  const person = document.querySelector('#manualReceiptPerson');
  if (!panel || !form || !person) return;
  const balance = projectionPaymentBalance(projection);
  form.reset();
  form.elements.recipientId.value = projection.id;
  form.elements.receivedOn.value = localDateForForm();
  person.textContent = `${projection.displayName} · quota concordata ${formatCurrency(balance.expectedCents / 100)} · saldo attuale ${formatCurrency(balance.remainingCents / 100)}.`;
  setMessage(document.querySelector('#manualReceiptMessage'), '');
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.elements.amount.focus({ preventScroll: true });
}

function prepareProjectionBalanceRequest(projection) {
  const form = document.querySelector('#paymentForm');
  if (!form) return;
  setSkipperDashboardView('money');
  setSkipperFinanceDashboardView(SKIPPER_FINANCE_VIEWS.request);
  renderPaymentRecipientOptions();
  form.elements.recipientId.value = projection.id;
  renderPaymentBerthOptions();
  form.elements.berthType.value = 'assigned:balance';
  applyPaymentBerthPreset();
  renderPaymentBalancePreview();
  setMessage(document.querySelector('#paymentFormMessage'), `Saldo pronto per ${projection.displayName}: controlla importo e metodi prima di aprire WhatsApp.`);
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.elements.amount.focus({ preventScroll: true });
}

function starterPackQuoteText(cents, { fallback = 'da definire' } = {}) {
  if (cents > 0) return `${formatCurrency(cents / 100)} in contanti a bordo`;
  return fallback;
}

function projectionAmountOrPending(cents) {
  return cents > 0 ? formatCurrency(cents / 100) : 'da definire';
}

function projectionQuoteSummary(projection) {
  const summary = projectionCostBreakdown(projection);
  if (!summary.normalized.contributesToCosts) {
    const deposit = summary.refundableDepositCents > 0
      ? ` Cauzione rimborsabile ${formatCurrency(summary.refundableDepositCents / 100)} separata, da regolare a bordo.`
      : ' Cauzione rimborsabile da definire, separata e da regolare a bordo.';
    return `Esente da quota posto, Starter Pack e assicurazione.${deposit}`;
  }
  const parts = summary.items
    .map((item) => `${item.label} ${projectionAmountOrPending(item.cents)}`)
    .join(' · ');
  const total = summary.hasPayableEstimate
    ? formatCurrency(summary.payableCents / 100)
    : 'da definire';
  const cashAtBoardCents = summary.starterPackCents + summary.refundableDepositCents;
  const cashAtBoard = cashAtBoardCents > 0
    ? formatCurrency(cashAtBoardCents / 100)
    : 'da definire';
  return `Totale da bonificare / versare ${total} (${parts}) · Totale contanti all’imbarco ${cashAtBoard} (Starter Pack ${starterPackQuoteText(summary.starterPackCents, { fallback: 'da definire' })} + cauzione rimborsabile ${projectionAmountOrPending(summary.refundableDepositCents)}).`;
}

function projectionMatchesInvite(projection, inviteId) {
  return projection?.status === 'invited'
    && projection.id === inviteId
    && projection.inviteId === inviteId;
}

function isLegacyInviteLinkable(invite) {
  if (!invite?.createdAt?.toDate) return false;
  if (invite.status === 'active') return true;
  return invite.status === 'pending'
    && Boolean(invite.expiresAt?.toDate)
    && invite.expiresAt.toDate() > new Date()
    && typeof invite.accessKey === 'string'
    && invite.accessKey.length === 48;
}

function projectionInvite(projection) {
  if (!projectionMatchesInvite(projection, projection?.id)) return null;
  return activeInvites.find((invite) => invite.id === projection.inviteId) || null;
}

function projectionStatusLabel(projection) {
  const invite = projectionInvite(projection);
  if (!invite) return 'Scheda salvata · invito WhatsApp da creare';
  if (invite.status === 'active') {
    return activeMembers.some((member) => member.id === invite.id)
      ? 'Accesso attivo · anagrafica completata'
      : 'Accesso attivo · dati charter da completare';
  }
  const expired = invite.expiresAt?.toDate && invite.expiresAt.toDate() < new Date();
  return expired ? 'Invito scaduto · genera un nuovo link' : 'Link pronto da inviare';
}

function crewSeatLimit() {
  return effectiveParticipantCapacity(activeBoat);
}

function allocatedCrewSeatCount() {
  const seatIds = new Set(activeProjections.map((projection) => projection.id));
  activeInvites.filter((invite) => invite.status !== 'revoked' && !seatIds.has(invite.id)).forEach((invite) => seatIds.add(invite.id));
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
    status.textContent = 'Definisci i posti per partecipanti prima di inviare gli inviti.';
    return;
  }
  if (needsCapacityAlignment(activeBoat)) {
    status.textContent = capacityAlignmentMessage(activeBoat);
    return;
  }
  const available = Math.max(0, limit - allocated);
  const projected = activeProjections.length;
  status.textContent = 'Posti partecipanti: ' + allocated + ' di ' + limit + ' occupati o riservati'
    + (projected ? ` · ${projected} nelle schede dell’equipaggio` : '') + '. '
    + (available ? available + ' ancora disponibili.' : 'Nessun posto ancora disponibile.');
}

function renderProjectionSummary() {
  const summary = document.querySelector('#projectionSummary');
  if (!summary) return;
  if (!activeProjections.length) {
    summary.replaceChildren();
    return;
  }
  const payableCents = activeProjections.reduce((total, projection) => total + projectionPayableCents(projection), 0);
  const starterPackCashCents = activeProjections
    .reduce((total, projection) => total + projectionCostBreakdown(projection).starterPackCents, 0);
  const refundableDepositCents = activeProjections
    .reduce((total, projection) => total + projectionCostBreakdown(projection).refundableDepositCents, 0);
  const invitationReady = activeProjections.filter((projection) => !projectionInvite(projection)).length;
  const invited = activeProjections.length - invitationReady;
  const historicalInvites = activeInvites.filter((invite) => invite.status !== 'revoked' && !activeProjections.some((projection) => projectionInvite(projection)?.id === invite.id)).length;
  const title = document.createElement('strong');
  title.className = 'projection-summary-title';
  title.textContent = payableCents > 0
    ? `Richieste personali previste: ${formatCurrency(payableCents / 100)}`
    : 'Richieste personali: importi da definire';
  const detail = document.createElement('span');
  detail.className = 'projection-summary-detail';
  detail.textContent = `${activeProjections.length} ${activeProjections.length === 1 ? 'posto riservato' : 'posti riservati'} · ${invitationReady} ${invitationReady === 1 ? 'invito da creare' : 'inviti da creare'}${invited ? ` · ${invited} ${invited === 1 ? 'link già creato' : 'link già creati'}` : ''}${historicalInvites ? ` · ${historicalInvites} ${historicalInvites === 1 ? 'scheda da completare' : 'schede da completare'}` : ''}.`;
  const note = document.createElement('small');
  note.className = 'projection-summary-note';
  const starterPackNote = starterPackCashCents > 0
    ? `Starter Pack previsti: ${formatCurrency(starterPackCashCents / 100)}, solo contanti a bordo.`
    : costPlanQuoteModel() && automaticCostPlanPricingMessage(costPlanQuoteModel())
      ? 'Completa l’origine dello Starter Pack prima di proporre gli importi automatici.'
      : costPlanQuoteModel()?.starterPackIncludedInCharter === true
      ? 'Starter Pack già nel costo charter: indica la sua quota cash per persona prima di invitare.'
      : 'Starter Pack da definire.';
  const depositNote = refundableDepositCents > 0
    ? ` Cauzioni rimborsabili previste: ${formatCurrency(refundableDepositCents / 100)}, separate e da regolare a bordo.`
    : ' Le cauzioni rimborsabili restano separate e da regolare a bordo.';
  note.textContent = starterPackNote + depositNote;
  summary.replaceChildren(title, detail, note);
}

function projectionPreviewItem(form, fieldName, label) {
  const input = form?.elements[fieldName];
  const rawValue = String(input?.value || '').trim();
  return {
    label,
    defined: rawValue.length > 0,
    cents: toEuroCents(rawValue),
  };
}

function renderProjectionCostPreview() {
  const form = document.querySelector('#projectionForm');
  const preview = document.querySelector('#projectionCostPreview');
  if (!form || !preview) return;
  const usesCustomPricing = projectionFormUsesCustomPricing(form);
  const keepsInvitationPricing = !usesCustomPricing && isEditingInvitedDashboardProjection();
  const dashboardPricing = dashboardProjectionPreset(form.elements.berthType?.value, {
    contributesToCosts: form.elements.contributesToCosts?.checked === true,
  });
  const currentCostModel = costPlanQuoteModel();
  const dashboardPricingReady = Boolean(currentCostModel && !automaticCostPlanPricingMessage(currentCostModel));
  const pricingItem = (fieldName, label, fallbackCents) => (usesCustomPricing || keepsInvitationPricing)
    ? projectionPreviewItem(form, fieldName, label)
    : { label, defined: fallbackCents > 0, cents: fallbackCents };
  if (form.elements.contributesToCosts?.checked !== true) {
    const deposit = pricingItem('refundableDepositAmount', 'Cauzione rimborsabile', dashboardPricing.refundableDepositCents);
    const depositText = deposit.defined
      ? ` Cauzione rimborsabile: ${formatCurrency(deposit.cents / 100)}, separata e da regolare all’imbarco.`
      : ' Cauzione rimborsabile: da definire, separata e da regolare all’imbarco.';
    const source = usesCustomPricing
      ? 'Stai impostando un’eccezione personale.'
      : keepsInvitationPricing
        ? 'La cauzione è quella già fissata con l’invito.'
        : dashboardPricingReady
          ? 'Segue la dashboard per la sola cauzione.'
          : 'Il preventivo non è completo: la cauzione resta separata.';
    preview.textContent = `Persona esente da quota posto, Starter Pack e assicurazione.${depositText} ${source} Non crea una richiesta o un pagamento.`;
    return;
  }
  const payableItems = [
    pricingItem('berthAmount', 'Posto/cabina', dashboardPricing.berthCents),
    pricingItem('protectionInsuranceAmount', 'Assicurazione', dashboardPricing.protectionInsuranceCents),
  ];
  const starterPack = pricingItem('starterPackAmount', 'Starter Pack', dashboardPricing.starterPackCents);
  const deposit = pricingItem('refundableDepositAmount', 'Cauzione rimborsabile', dashboardPricing.refundableDepositCents);
  const payableCents = payableItems.reduce((total, item) => total + item.cents, 0);
  const missing = payableItems.filter((item) => !item.defined).map((item) => item.label);
  const details = payableItems.map((item) => `${item.label}: ${item.defined ? formatCurrency(item.cents / 100) : 'da definire'}`).join(' · ');
  const total = missing.length
    ? `Totale da bonificare / versare finora: ${formatCurrency(payableCents / 100)}`
    : `Totale da bonificare / versare: ${formatCurrency(payableCents / 100)}`;
  const missingText = missing.length ? ` · Da definire: ${missing.join(', ')}.` : '.';
  const cashAtBoardCents = starterPack.cents + deposit.cents;
  const cashAtBoardText = ` Totale da portare in contanti: ${cashAtBoardCents > 0 ? formatCurrency(cashAtBoardCents / 100) : 'da definire'} (Starter Pack ${starterPackQuoteText(starterPack.cents, { fallback: 'da definire' })} + cauzione rimborsabile ${deposit.defined ? formatCurrency(deposit.cents / 100) : 'da definire'}).`;
  const source = usesCustomPricing
    ? 'Eccezione personale: questi importi restano fissi finché non li modifichi.'
    : keepsInvitationPricing
      ? 'Quota della dashboard fissata con l’invito: non cambia da sola se modifichi i conti.'
      : dashboardPricingReady
        ? 'Quota proposta dalla dashboard: segue i conti della barca fino alla creazione dell’invito.'
        : 'Il preventivo non è completo: per ora il sito usa solo il listino base della barca.';
  preview.textContent = `${total} (${details})${missingText}${cashAtBoardText} ${source} Non crea una richiesta o un pagamento.`;
}

function resetMemberForm() {
  const form = document.querySelector('#memberForm');
  form.reset();
  editingMemberId = null;
  document.querySelector('#memberSubmitButton').textContent = 'Aggiungi persona';
  document.querySelector('#cancelMemberEdit').hidden = true;
}

function resetProjectionForm() {
  const form = document.querySelector('#projectionForm');
  if (!form) return;
  editingProjectionId = null;
  editingInvitedPricing = false;
  form.elements.preferredLocale.disabled = false;
  setProjectionIdentityFieldsLocked(false);
  form.reset();
  delete form.elements.contributesToCosts.dataset.userChoice;
  syncProjectionCostParticipation();
  linkingLegacyInviteId = null;
  document.querySelector('#projectionSubmitButton').textContent = 'Salva la scheda e riserva il posto';
  document.querySelector('#cancelProjectionEdit').hidden = true;
  document.querySelector('#cancelProjectionEdit').textContent = 'Annulla modifica';
  const title = document.querySelector('#projectionTitle');
  if (title) title.textContent = 'Nuovo partecipante';
  const newProjectionButton = document.querySelector('#newProjectionButton');
  if (newProjectionButton) newProjectionButton.hidden = true;
  const legacyLinkHint = document.querySelector('#projectionLegacyLinkHint');
  if (legacyLinkHint) {
    legacyLinkHint.hidden = true;
    legacyLinkHint.textContent = '';
  }
  syncProjectionCabinGroupField();
  renderProjectionCostPreview();
}

function retainSavedProjectionLocally(projection) {
  const saved = normalizeProjection(projection.id, projection);
  activeProjections = [
    ...activeProjections.filter((candidate) => candidate.id !== saved.id),
    saved,
  ].sort((first, second) => first.displayName.localeCompare(second.displayName, 'it'));
  return saved;
}

function showSavedProjectionForm(projection, message) {
  const form = document.querySelector('#projectionForm');
  if (!form) return;
  const saved = normalizeProjection(projection.id, projection);
  const invite = projectionInvite(saved);
  editingProjectionId = saved.id;
  editingInvitedPricing = false;
  linkingLegacyInviteId = null;
  form.elements.preferredLocale.disabled = false;
  setProjectionIdentityFieldsLocked(false);
  fillProjectionForm(saved);
  setProjectionIdentityFieldsLocked(Boolean(invite));
  form.elements.preferredLocale.disabled = Boolean(invite);
  document.querySelector('#projectionSubmitButton').textContent = 'Salva la scheda';
  document.querySelector('#cancelProjectionEdit').hidden = true;
  document.querySelector('#cancelProjectionEdit').textContent = 'Annulla modifica';
  const title = document.querySelector('#projectionTitle');
  if (title) title.textContent = `Scheda di ${saved.displayName}`;
  const newProjectionButton = document.querySelector('#newProjectionButton');
  if (newProjectionButton) newProjectionButton.hidden = false;
  setMessage(document.querySelector('#projectionFormMessage'), message);
}

function startNewProjection() {
  const message = document.querySelector('#projectionFormMessage');
  if (needsCapacityAlignment(activeBoat)) {
    setMessage(message, capacityAlignmentMessage(activeBoat), true);
    return;
  }
  if (isCrewCapacityReached()) {
    setMessage(message, 'Hai già riservato tutti i posti per partecipanti indicati per questa barca.', true);
    return;
  }
  const current = editingProjection();
  if (current && !window.confirm(`Vuoi preparare una nuova scheda? Le modifiche non salvate a ${current.displayName} non verranno conservate.`)) return;
  resetProjectionForm();
  setMessage(message, 'Nuova scheda partecipante: compila solo il nominativo che vuoi aggiungere.');
  document.querySelector('#projectionForm').elements.firstName.focus({ preventScroll: true });
}

function cancelProjectionEdit() {
  const current = editingProjection();
  if (current && !linkingLegacyInviteId) {
    showSavedProjectionForm(current, `Modifiche non salvate annullate. Stai guardando la scheda di ${current.displayName}.`);
    return;
  }
  resetProjectionForm();
}

function setBoatFormDefaults(user) {
  const skipperField = document.querySelector('#boatForm [name="skipperName"]');
  if (skipperField && !skipperField.value) skipperField.value = user?.displayName || '';
  renderBerthLayoutSummary();
}

function resetBoatForm(user) {
  const form = document.querySelector('#boatForm');
  form.reset();
  delete form.elements.totalBerths.dataset.autoFromLayout;
  editingBoatId = null;
  document.querySelector('#boatSubmitButton').textContent = 'Registra la barca';
  document.querySelector('#cancelBoatEdit').hidden = true;
  setBoatFormDefaults(user);
  renderBerthLayoutSummary();
}

function openBoatEdit() {
  if (!activeBoat) return;
  const form = document.querySelector('#boatForm');
  form.reset();
  for (const [field, value] of Object.entries(activeBoat)) {
    const input = form.elements.namedItem(field);
    if (input) input.value = value ?? '';
  }
  fillBerthLayoutForm(form, activeBoat.berthLayout);
  fillBerthRatesForm(form, activeBoat.berthRates);
  const totalBerths = declaredTotalBerths(activeBoat);
  form.elements.totalBerths.value = totalBerths ? String(totalBerths) : '';
  delete form.elements.totalBerths.dataset.autoFromLayout;
  renderBerthLayoutSummary();
  creatingBoat = true;
  editingBoatId = activeBoat.id;
  document.querySelector('#boatSubmitButton').textContent = 'Salva modifiche';
  document.querySelector('#cancelBoatEdit').hidden = false;
  dashboard.hidden = true;
  registerSection.hidden = false;
  registerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSkipperProfile(profile) {
  activeSkipperProfile = profile || null;
  const form = document.querySelector('#skipperProfileForm');
  if (!form) return;

  if (profile && form.dataset.editing !== 'true') {
    for (const [field, value] of Object.entries(profile)) {
      const input = form.elements.namedItem(field);
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = value || '';
    }
  }

  renderSkipperProfileStatus();
}

function renderSkipperProfileStatus() {
  const profile = activeSkipperProfile;
  const status = document.querySelector('#skipperProfileStatus');
  if (!status) return;

  const missing = getMissingSkipperProfileFields(profile, activeSkipperDocumentCopies);
  const ready = isSkipperProfileCharterReady(profile, activeSkipperDocumentCopies);
  if (ready) {
    status.innerHTML = '<span class="skipper-profile-status-icon" aria-hidden="true">✓</span><div><strong>Dossier charter pronto</strong><span>La tua riga entra nella Crew List. Le due copie restano private e puoi scaricarle quando devi allegarle al charter.</span></div>';
  } else if (!profile) {
    status.innerHTML = '<span class="skipper-profile-status-icon is-pending" aria-hidden="true">!</span><div><strong>Il tuo dossier è ancora vuoto</strong><span>Compila qui anagrafica e abilitazioni, poi archivia le due copie richieste dal charter. Non compariranno mai alla flotta o all’equipaggio.</span></div>';
  } else {
    status.innerHTML = `<span class="skipper-profile-status-icon is-pending" aria-hidden="true">!</span><div><strong>Ci sono ancora ${missing.length} ${missing.length === 1 ? 'voce da completare' : 'voci da completare'}</strong><span>Completa i dati, gli stati e le due copie private: poi il PDF potrà inserire anche lo skipper e il riepilogo per il charter.</span></div>`;
  }
  updateCharterReadiness();
  renderSkipperDashboardOverview();
}

function updateCharterReadiness() {
  const generatePdfButton = document.querySelector('#generatePdfButton');
  const readiness = document.querySelector('#charterReadiness');
  const incomplete = activeMembers.filter((member) => !isCharterReady(member));
  const boatMissing = !isBoatReadyForPdf(activeBoat);
  const skipperProfileMissing = !isSkipperProfileCharterReady(activeSkipperProfile, activeSkipperDocumentCopies);
  const overCapacity = activeBoat && activeMembers.length > crewSeatLimit();
  generatePdfButton.disabled = !activeBoat || activeMembers.length === 0 || incomplete.length > 0 || boatMissing || skipperProfileMissing || overCapacity;
  readiness.textContent = !activeBoat
    ? 'Registra prima la barca per preparare il PDF.'
    : boatMissing
      ? 'Completa bandiera e comandante della barca per attivare il PDF.'
      : skipperProfileMissing
        ? 'Completa prima il dossier dello skipper: anagrafica, abilitazioni, stati e le due copie private richieste dal charter.'
      : overCapacity
        ? 'La Crew List supera i posti per partecipanti indicati per la barca.'
      : activeMembers.length === 0
        ? 'Aggiungi almeno una persona per preparare il PDF.'
    : incomplete.length
      ? `${incomplete.length} ${incomplete.length === 1 ? 'persona ha' : 'persone hanno'} dati mancanti o consenso da confermare.`
      : 'Crew List completa: il PDF è pronto per il charter.';
}

function projectionActionButton(attribute, id, label, icon, tone = '') {
  const classes = ['projection-action', 'projection-action-icon-only'];
  if (tone) classes.push(`projection-action-${tone}`);
  return `<button class="${classes.join(' ')}" type="button" data-${attribute}="${escapeHtml(id)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><span class="projection-action-icon" aria-hidden="true">${icon}</span></button>`;
}

function projectionCabinControl(projection) {
  if (projection.berthType !== 'double_cabin') return '';
  const cabinGroupId = projectionCabinGroupId(projection);
  if (!doubleCabinGroups().length) {
    return '<span class="projection-cabin-note">Configura prima le cabine da 2 posti della barca.</span>';
  }
  return `<label class="projection-cabin-control">Cabina<select data-cabin-group="${escapeHtml(projection.id)}" aria-label="Cabina assegnata a ${escapeHtml(projection.displayName)}">${cabinGroupOptionsHtml(cabinGroupId, projection.id)}</select></label>`;
}

function projectionCardActions(projection, invite) {
  const actions = [
    projectionActionButton('edit-projection', projection.id, `Modifica piano di ${projection.displayName}`, '✎'),
  ];
  const balance = projectionPaymentBalance(projection);
  if (balance.expectedCents > 0) {
    actions.push(projectionActionButton('register-manual-receipt', projection.id, `Registra un acconto già ricevuto per ${projection.displayName}`, '+'));
  }
  if (!invite) {
    actions.push(projectionActionButton('send-projection', projection.id, `Crea invito WhatsApp per ${projection.displayName}`, '↗', 'primary'));
    actions.push(projectionActionButton('release-projection', projection.id, `Libera il posto di ${projection.displayName}`, '×', 'release'));
    return actions.join('');
  }
  actions.push(projectionActionButton('edit-projection-pricing', projection.id, `Rivedi la quota concordata di ${projection.displayName}`, '€'));
  if (balance.remainingCents > 0) {
    actions.push(projectionActionButton('request-projection-balance', projection.id, `Prepara la richiesta di saldo per ${projection.displayName}`, '€', 'primary'));
  }
  if (projection.pricingMode === 'dashboard') {
    actions.push(projectionActionButton('refresh-projection-pricing', projection.id, `Aggiorna gli importi di ${projection.displayName} dalla dashboard attuale`, '⟳'));
  }
  if (invite.status === 'pending' && invite.accessKey) {
    actions.push(projectionActionButton('copy-invite', invite.id, `Copia il link personale di ${projection.displayName}`, '⧉'));
    actions.push(projectionActionButton('whatsapp-invite', invite.id, `Apri WhatsApp per ${projection.displayName}`, '↗', 'primary'));
  }
  actions.push(projectionActionButton('reissue-invite', invite.id, `Revoca e genera un nuovo link per ${projection.displayName}`, '↻', 'release'));
  return actions.join('');
}

function renderProjectionCard(projection) {
  const invite = projectionInvite(projection);
  const cost = projectionCostBreakdown(projection);
  const quote = projectionQuoteSummary(projection);
  const isExemptFromCosts = projection.contributesToCosts === false;
  const currentCostModel = costPlanQuoteModel();
  const dashboardPricingReady = Boolean(currentCostModel && !automaticCostPlanPricingMessage(currentCostModel));
  const pricingSource = isExemptFromCosts
    ? 'Ruolo gratuito'
    : cost.normalized.pricingMode === 'dashboard'
      ? projection.status === 'invited'
        ? 'Quota della dashboard · fissata con l’invito'
        : dashboardPricingReady
          ? 'Quota proposta dalla dashboard'
          : 'Listino base · preventivo da completare'
      : 'Eccezione personale · importi fissi';
  const total = isExemptFromCosts
    ? 'Esente'
    : cost.hasPayableEstimate
      ? formatCurrency(cost.payableCents / 100)
      : 'Da definire';
  const starterPack = isExemptFromCosts
    ? 'Non previsto per il ruolo gratuito'
    : cost.starterPackCents > 0
      ? `${formatCurrency(cost.starterPackCents / 100)} · solo contanti a bordo`
      : 'Da definire · solo contanti a bordo';
  const deposit = cost.refundableDepositCents > 0
    ? `${formatCurrency(cost.refundableDepositCents / 100)} · separata, a bordo`
    : 'Da definire · separata, a bordo';
  const cabinAssignment = projectionCabinAssignmentText(projection);
  const assignment = `<b>Ruolo previsto:</b> ${escapeHtml(projection.plannedRole)} · <b>Sistemazione:</b> ${escapeHtml(projectionBerthLabel(projection.berthType))}${cabinAssignment ? ` · <b>Cabina:</b> ${escapeHtml(cabinAssignment)}` : ''}`;
  return `<article class="projection-row projection-card"><div class="projection-row-person"><strong>${escapeHtml(projection.displayName)}</strong><span class="projection-row-assignment">${assignment}</span><small>${escapeHtml(projectionStatusLabel(projection))}</small>${projectionCabinControl(projection)}</div><div class="projection-row-cost"><span class="projection-row-cost-label">Importo previsto · non è un pagamento</span><strong>${escapeHtml(total)}</strong><span class="projection-row-cost-breakdown">${escapeHtml(quote)}</span>${projectionPaymentBalanceMarkup(projection)}<span class="projection-row-deposit"><b>${escapeHtml(pricingSource)}</b></span><span class="projection-row-deposit"><b>Starter Pack:</b> ${escapeHtml(starterPack)}</span><span class="projection-row-deposit"><b>Cauzione rimborsabile:</b> ${escapeHtml(deposit)}</span></div><div class="projection-actions" role="group" aria-label="Azioni per ${escapeHtml(projection.displayName)}">${projectionCardActions(projection, invite)}</div></article>`;
}

function renderLegacyInviteCard(invite) {
  const expired = invite.expiresAt?.toDate && invite.expiresAt.toDate() < new Date();
  const linkReady = invite.status === 'pending' && !expired && invite.accessKey;
  const linkable = isLegacyInviteLinkable(invite);
  const status = invite.status === 'active'
    ? 'Accesso attivo · completa comunque la scheda equipaggio'
    : expired
      ? 'Invito scaduto · rinnova il link prima di completare la scheda'
      : 'Invito già creato · completa la scheda persona';
  const actions = [];
  if (linkable) actions.push(projectionActionButton('link-legacy-invite', invite.id, `Completa la scheda di ${invite.displayName}`, '✎', 'primary'));
  if (linkReady) {
    actions.push(projectionActionButton('copy-invite', invite.id, `Copia il link personale di ${invite.displayName}`, '⧉'));
    actions.push(projectionActionButton('whatsapp-invite', invite.id, `Apri WhatsApp per ${invite.displayName}`, '↗'));
  }
  if (invite.status !== 'revoked') actions.push(projectionActionButton('reissue-invite', invite.id, `Revoca e genera un nuovo link per ${invite.displayName}`, '↻', 'release'));
  const instruction = linkable
    ? 'Aggiungi cognome, ruolo, sistemazione, cabina e importo previsto: il link personale resta identico.'
    : 'Questo invito storico non è più collegabile: il suo accesso resta invariato.';
  return `<article class="projection-row projection-card projection-card-legacy"><div class="projection-row-person"><strong>${escapeHtml(invite.displayName)}</strong><span class="projection-row-assignment"><b>Ruolo:</b> da definire · <b>Sistemazione:</b> da definire</span><small>${escapeHtml(status)}</small></div><div class="projection-row-cost"><span class="projection-row-cost-label">Scheda da completare</span><strong>Importo da definire</strong><span class="projection-row-cost-breakdown">${escapeHtml(instruction)}</span></div><div class="projection-actions" role="group" aria-label="Azioni per ${escapeHtml(invite.displayName)}">${actions.join('')}</div></article>`;
}

function renderProjections({ syncFleet = true } = {}) {
  const list = document.querySelector('#projectionList');
  if (!list) return;
  renderProjectionSummary();
  const legacyInvites = activeInvites.filter((invite) => invite.status !== 'revoked'
    && !activeProjections.some((projection) => projectionMatchesInvite(projection, invite.id)));
  const cards = [
    ...activeProjections.map(renderProjectionCard),
    ...legacyInvites.map(renderLegacyInviteCard),
  ];
  list.innerHTML = cards.length
    ? cards.join('')
    : '<p class="empty-state">Nessun posto ancora riservato nell’elenco provvisorio.</p>';
  syncProjectionCabinGroupField();
  renderCapacityStatus();
  renderSkipperDashboardOverview();
  if (syncFleet) void syncPublicFleetAvailabilityFromCrew();
}

function renderMembers() {
  const list = document.querySelector('#memberList');
  if (!activeMembers.length) {
    list.innerHTML = '<p class="empty-state">Nessuna persona ancora inserita.</p>';
    renderPaymentRecipientOptions();
    renderCapacityStatus();
    updateCharterReadiness();
    renderSkipperDashboardOverview();
    void syncPublicFleetAvailabilityFromCrew();
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
  renderSkipperDashboardOverview();
  void syncPublicFleetAvailabilityFromCrew();
}

function renderInvites() {
  const list = document.querySelector('#inviteList');
  if (list) list.replaceChildren();
  renderPaymentRecipientOptions();
  renderCapacityStatus();
  renderSkipperDashboardOverview();
  void syncPublicFleetAvailabilityFromCrew();
}

function renderPayments(snapshot) {
  const list = document.querySelector('#paymentList');
  if (snapshot.empty) {
    activePayments = [];
    list.innerHTML = '<p class="empty-state">Nessuna richiesta preparata.</p>';
    renderCostPlanSummary();
    renderProjections({ syncFleet: false });
    renderPaymentRecipientOptions();
    renderSkipperDashboardOverview();
    return;
  }
  activePayments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  list.innerHTML = activePayments.map((payment) => {
    const recipientId = payment.recipientId || payment.memberId || payment.payerInviteId;
    const name = recipientName(recipientId);
    const amount = formatCurrency(paymentAmount(payment));
    const manualReceipt = isManualPaymentReceipt(payment);
    const reason = manualReceipt
      ? paymentInstallmentLabel(payment)
      : `${paymentInstallmentLabel(payment)} · ${payment.reason || 'Contributo weekend'}${payment.isOptional ? ' · Facoltativo' : ''}`;
    const dueDate = manualReceipt
      ? payment.receivedOn ? ` · ricevuto il ${formatDate(payment.receivedOn)}` : ''
      : payment.dueDate ? ` · Entro ${formatDate(payment.dueDate)}` : '';
    const status = paymentStatusLabel(payment);
    const canUpdateStatus = !manualReceipt && isPendingPayment(payment);
    const statusActions = canUpdateStatus
      ? `<button class="text-button" type="button" data-verify-payment="${escapeHtml(payment.id)}">Conferma accredito</button><button class="text-button" type="button" data-cancel-payment="${escapeHtml(payment.id)}">Annulla richiesta</button>`
      : '';
    const inviteAction = activeInvites.some((invite) => invite.id === recipientId && invite.status === 'pending' && invite.accessKey)
      ? `<button class="text-button" type="button" data-whatsapp-invite="${escapeHtml(recipientId)}">Invia invito</button>`
      : '';
    const paymentMessageAction = !manualReceipt && paymentRecipientWhatsappNumber(recipientId)
      ? `<button class="text-button" type="button" data-whatsapp-payment="${escapeHtml(payment.id)}">Apri WhatsApp</button>`
      : '';
    const legacyInstructions = payment.instructions ? `<span>${escapeHtml(payment.instructions)}</span>` : '';
    const methods = manualReceipt
      ? '<span>Registrazione manuale verificata dallo skipper: non contiene link o coordinate di pagamento.</span>'
      : paymentMethodTags(payment) || '<span>Metodo da concordare nello scambio WhatsApp.</span>';
    const accountingTag = paymentCountsTowardCostPlan(payment)
      ? '<span class="payment-accounting-tag">Spese della barca</span>'
      : '';
    const contributionLabel = paymentContributionItemLabel(payment);
    const contributionTag = contributionLabel
      ? `<span class="payment-contribution-tag">${escapeHtml(contributionLabel)}</span>`
      : '';
    const copyAction = manualReceipt ? '' : `<button class="text-button" type="button" data-copy-payment="${escapeHtml(payment.id)}">Copia messaggio</button>`;
    return `<article class="payment-row"><div><strong>${escapeHtml(name)} · ${amount}</strong><span>${escapeHtml(reason)}${escapeHtml(dueDate)}</span>${contributionTag}${accountingTag}${methods}${legacyInstructions}</div><div class="payment-action"><span class="payment-status">${escapeHtml(status)}</span>${paymentMessageAction}${copyAction}${inviteAction}${statusActions}</div></article>`;
  }).join('');
  renderCostPlanSummary();
  renderProjections({ syncFleet: false });
  renderPaymentRecipientOptions();
  renderSkipperDashboardOverview();
}

function renderBriefingForm() {
  const form = document.querySelector('#briefingForm');
  if (!form) return;
  if (!activeBriefing || form.dataset.editing === 'true') {
    renderBoardRulesOverview();
    updateRulesEditorChangeWarning();
    return;
  }
  for (const [field, value] of Object.entries(activeBriefing)) {
    const input = form.elements.namedItem(field);
    if (!input) continue;
    input.value = input.type === 'datetime-local' ? toDateTimeLocal(value) : value || '';
  }
  // Una bacheca italiana già attiva non deve trasformarsi in bilingue solo
  // perché l'editor propone una bozza inglese quando si crea una nuova barca.
  // Se nel documento non esiste il testo EN, i suoi campi restano davvero
  // vuoti e un salvataggio di orari non cambia il regolamento.
  ['rulesTitleEn', 'rulesSummaryEn', 'rulesTextEn', 'scheduleNoteEn'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(activeBriefing, field)) return;
    const input = form.elements.namedItem(field);
    if (!input) return;
    input.value = '';
    input.defaultValue = '';
  });
  if (typeof activeBriefing.rulesSummary !== 'string' || !activeBriefing.rulesSummary.trim()) {
    form.elements.rulesSummary.value = DEFAULT_RULES_SUMMARY;
  }
  form.dataset.loadedVersion = String(activeBriefing.rulesVersion || 1);
  document.querySelector('#rulesEditor').open = false;
  renderBoardRulesOverview();
  updateRulesEditorChangeWarning();
}

function hasOfficialEnglishBriefing() {
  return Boolean(typeof activeBriefing?.rulesTitleEn === 'string' && activeBriefing.rulesTitleEn.trim()
    && typeof activeBriefing?.rulesSummaryEn === 'string' && activeBriefing.rulesSummaryEn.trim()
    && typeof activeBriefing?.rulesTextEn === 'string' && activeBriefing.rulesTextEn.trim()
    && typeof activeBriefing?.scheduleNoteEn === 'string');
}

function renderBriefingStatus() {
  const status = document.querySelector('#briefingStatus');
  if (!activeBriefing?.rulesText) {
    status.textContent = 'Attiva il regolamento: le persone lo leggeranno e lo confermeranno prima di compilare la Crew List.';
    renderBoardRulesOverview();
    updateRulesEditorChangeWarning();
    renderSkipperDashboardOverview();
    return;
  }
  const version = activeBriefing.rulesVersion || 1;
  const accepted = activeAcceptances.filter((item) => item.rulesVersion === version
    && (activeBriefing.fullRulesRequired !== true || item.fullRulesRead === true)).length;
  const hasOfficialEnglish = hasOfficialEnglishBriefing();
  status.textContent = `Regole attive. ${accepted} ${accepted === 1 ? 'persona ha' : 'persone hanno'} confermato la lettura.${hasOfficialEnglish ? ' Testo inglese ufficiale disponibile.' : ' La versione inglese va completata solo se inviti una persona in inglese.'}`;
  renderBoardRulesOverview();
  updateRulesEditorChangeWarning();
  renderSkipperDashboardOverview();
}

function renderAnnouncements(snapshot) {
  const list = document.querySelector('#announcementList');
  skipperAnnouncementCount = snapshot.size ?? snapshot.docs?.length ?? 0;
  if (snapshot.empty) {
    list.innerHTML = '<p class="empty-state">Nessuna comunicazione pubblicata.</p>';
    renderSkipperDashboardOverview();
    return;
  }
  list.innerHTML = snapshot.docs.map((item) => {
    const announcement = item.data();
    const date = formatDateTime(announcement.createdAt);
    const important = announcement.isImportant ? '<span class="announcement-important">Importante</span>' : '';
    return `<article class="announcement-row"><strong>${escapeHtml(announcement.title || 'Comunicazione dello skipper')}</strong><span>${escapeHtml(announcement.message || '')}</span><span class="announcement-meta">${important}${escapeHtml(date || 'Appena pubblicato')}</span></article>`;
  }).join('');
  renderSkipperDashboardOverview();
}

function subscribeToBoat(boat) {
  const boatContextChanged = activeBoat?.id !== boat.id;
  const documentsNeedInitialLoad = Object.values(activeSkipperDocumentCopies).some((copy) => copy.state === 'idle');
  activeBoat = boat;
  if (boatContextChanged || documentsNeedInitialLoad) {
    resetSkipperDocumentCopies('checking');
    void refreshSkipperDocumentCopies(boat.id);
  }
  registerSection.hidden = true;
  dashboard.hidden = false;
  setupSkipperDashboard();
  setSkipperDashboardView(skipperDashboardViewFromHash());
  document.querySelector('#boatTitle').textContent = boat.name;
  const berthTotals = berthLayoutTotals(boat.berthLayout);
  const totalBerths = declaredTotalBerths(boat);
  const participantCapacity = effectiveParticipantCapacity(boat);
  const totalBerthsText = totalBerths ? `${totalBerths} posti totali a bordo` : 'posti totali da completare';
  document.querySelector('#boatMeta').textContent = boat.model + ' · ' + totalBerthsText + ' · ' + participantCapacity + ' posti partecipanti · ' + boat.homePort;
  const accommodation = document.querySelector('#boatAccommodation');
  const accommodationDescription = describeBerthLayout(boat.berthLayout);
  const accommodationCapacity = describeBerthCapacity(berthTotals);
  const rateDescription = describeBerthRates(boat.berthRates);
  accommodation.hidden = !accommodationDescription && !rateDescription;
  accommodation.textContent = accommodationDescription
    ? `Sistemazioni private: ${accommodationDescription}. ${accommodationCapacity}.${rateDescription ? ` Quote per persona: ${rateDescription}.` : ''}`
    : rateDescription ? `Quote private per persona: ${rateDescription}.` : '';
  renderFleetProfileForm();
  renderCostPlan(null);
  renderContributionCatalogForm();
  renderPaymentBerthOptions();
  void publishExistingBoatToFleet(boat);
  stopMemberSubscription?.();
  stopPaymentSubscription?.();
  stopPaymentProfileSubscription?.();
  stopContributionPlanSubscription?.();
  stopCostPlanSubscription?.();
  stopInviteSubscription?.();
  stopProjectionSubscription?.();
  stopBriefingSubscription?.();
  stopAnnouncementSubscription?.();
  stopAcceptanceSubscription?.();
  stopSkipperProfileSubscription?.();
  stopSkipperProfileSubscription = onSnapshot(doc(db, 'boats', boat.id, 'skipperProfile', SKIPPER_PROFILE_ID), (snapshot) => {
    renderSkipperProfile(snapshot.exists() ? snapshot.data() : null);
  }, () => {
    renderSkipperProfile(null);
    setMessage(document.querySelector('#skipperProfileMessage'), 'Impossibile leggere il dossier skipper.', true);
  });
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
  stopCostPlanSubscription = onSnapshot(doc(db, 'boats', boat.id, 'costPlan', COST_PLAN_ID), (snapshot) => {
    renderCostPlan(snapshot.exists() ? snapshot.data() : null);
  }, () => {
    renderCostPlan(null);
    setMessage(document.querySelector('#costPlanMessage'), 'Non riesco a leggere i conti della barca.', true);
  });
  stopContributionPlanSubscription = onSnapshot(doc(db, 'boats', boat.id, 'contributionPlan', 'default'), (snapshot) => {
    activeContributionPlan = snapshot.exists() ? snapshot.data() : null;
    renderContributionCatalogForm();
    renderPaymentBerthOptions();
    renderSkipperDashboardOverview();
  }, () => {
    activeContributionPlan = null;
    renderContributionCatalogForm();
    renderPaymentBerthOptions();
    renderSkipperDashboardOverview();
    setMessage(document.querySelector('#contributionCatalogMessage'), 'Impossibile leggere la composizione delle quote.', true);
  });
  stopPaymentSubscription = onSnapshot(query(collection(db, 'boats', boat.id, 'paymentRequests'), orderBy('createdAt', 'desc')), renderPayments, () => setMessage(document.querySelector('#paymentFormMessage'), 'Impossibile leggere le richieste.', true));
  stopInviteSubscription = onSnapshot(collection(db, 'boats', boat.id, 'invites'), (snapshot) => {
    activeInvites = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((first, second) => String(first.displayName || '').localeCompare(String(second.displayName || ''), 'it'));
    renderInvites();
    renderProjections();
    renderPayments({ empty: activePayments.length === 0, docs: activePayments.map((payment) => ({ id: payment.id, data: () => payment })) });
  }, () => setMessage(document.querySelector('#inviteFormMessage'), 'Impossibile leggere gli inviti personali.', true));
  stopProjectionSubscription = onSnapshot(collection(db, 'boats', boat.id, 'crewProjections'), (snapshot) => {
    activeProjections = snapshot.docs
      .map((item) => normalizeProjection(item.id, item.data()))
      .sort((first, second) => first.displayName.localeCompare(second.displayName, 'it'));
    renderProjections();
    renderCapacityStatus();
    renderSkipperDashboardOverview();
  }, () => setMessage(document.querySelector('#projectionFormMessage'), 'Non riesco a leggere l’elenco provvisorio dell’equipaggio.', true));
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
  // Ogni skipper ha una sola barca, salvata con il proprio UID come ID del
  // documento. La lettura puntuale evita una query-list che Firestore non può
  // autorizzare lo skipper associato alla singola barca.
  const boatRef = doc(db, 'boats', user.uid);
  stopBoatSubscription = onSnapshot(boatRef, (snapshot) => {
    if (creatingBoat) {
      return;
    }
    if (snapshot.exists()) {
      subscribeToBoat({ id: snapshot.id, ...snapshot.data() });
    } else {
      activeBoat = null;
      dashboard.hidden = true;
      registerSection.hidden = false;
    }
  }, (error) => {
    registerSection.hidden = false;
    // Per un nuovo skipper l'assenza del documento è prevista: mostra subito
    // la registrazione. Gli altri errori restano espliciti ma non tecnici.
    if (error?.code !== 'permission-denied') {
      setMessage(document.querySelector('#boatFormMessage'), getFirestoreErrorMessage(error, 'Non riesco a leggere la tua barca. Riprova tra poco.'), true);
    }
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

const boatForm = document.querySelector('#boatForm');
boatForm.querySelectorAll('[data-berth-layout-input]').forEach((input) => {
  input.addEventListener('input', () => {
    syncTotalBerthsFromLayout();
    renderBerthLayoutSummary();
  });
  input.addEventListener('change', () => {
    syncTotalBerthsFromLayout();
    renderBerthLayoutSummary();
  });
});
boatForm.elements.totalBerths.addEventListener('input', () => {
  delete boatForm.elements.totalBerths.dataset.autoFromLayout;
  renderBerthLayoutSummary();
});
renderBerthLayoutSummary();

boatForm.addEventListener('submit', async (event) => {
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
    const totalBerths = asNonNegativeInteger(fields.get('totalBerths'), 31);
    if (totalBerths < 2) {
      setMessage(document.querySelector('#boatFormMessage'), 'Indica almeno due posti totali a bordo: skipper incluso.', true);
      return;
    }
    const capacity = participantCapacityFromTotal(totalBerths);
    const berthLayout = readBerthLayout(form);
    const layoutTotals = berthLayoutTotals(berthLayout);
    if (layoutTotals.physicalBerths > 0 && layoutTotals.physicalBerths !== totalBerths) {
      setMessage(document.querySelector('#boatFormMessage'), `La configurazione descrive ${layoutTotals.physicalBerths} posti totali a bordo, ma sopra hai indicato ${totalBerths}. Correggi il totale oppure le sistemazioni reali: non aggiungere posti fittizi.`, true);
      return;
    }
    const projectionsOutsideLayout = projectionsOutsideDoubleCabinLayout(berthLayout);
    if (projectionsOutsideLayout.length) {
      const names = projectionsOutsideLayout.map((projection) => projection.displayName).join(', ');
      setMessage(document.querySelector('#boatFormMessage'), `Prima riassegna ${names}: la nuova configurazione non include più la loro cabina da 2 posti.`, true);
      return;
    }
    if (activeBoat && allocatedCrewSeatCount() > capacity) {
      setMessage(document.querySelector('#boatFormMessage'), `Hai già ${allocatedCrewSeatCount()} partecipanti o inviti attivi. Con ${totalBerths} posti totali puoi gestirne al massimo ${capacity}: libera prima un posto oppure mantieni una capienza maggiore.`, true);
      return;
    }
    // Alla prima registrazione i posti liberi partono dal totale dichiarato;
    // nelle modifiche successive resta invece la scelta già fatta dallo skipper.
    const previousAvailability = activeBoat ? declaredFleetAvailability(activeBoat) : capacity;
    const boatData = {
      name: fields.get('name').trim(), model: fields.get('model').trim(), boatType: fields.get('boatType'), totalBerths, capacity,
      homePort: fields.get('homePort').trim(), flag: fields.get('flag').trim(),
      skipperName: fields.get('skipperName').trim(), note: fields.get('note').trim(), berthLayout, berthRates: readBerthRates(form), skipperId: user.uid,
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
    setMessage(document.querySelector('#boatFormMessage'), getFirestoreErrorMessage(error, 'Non riesco a registrare la barca. Riprova tra poco.'), true);
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
  const availableSeats = Math.max(0, Math.min(capacity, crewSeatLimit() - allocatedCrewSeatCount()));
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

function projectionDraftFromFields(fields, id, existingProjection = null) {
  const firstName = String(fields.get('firstName') || '').trim();
  const lastName = String(fields.get('lastName') || '').trim();
  const berthType = PROJECTION_BERTH_TYPES[fields.get('berthType')] ? fields.get('berthType') : 'to_define';
  const frozenInvitation = existingProjection?.status === 'invited'
    ? normalizeProjection(id, existingProjection)
    : null;
  // La modifica ordinaria di una card con invito può spostare ruolo o
  // sistemazione, ma non può alterare in silenzio ciò che è stato concordato.
  const contributesToCosts = frozenInvitation
    ? frozenInvitation.contributesToCosts
    : fields.get('contributesToCosts') === 'on';
  const pricingMode = frozenInvitation
    ? frozenInvitation.pricingMode
    : fields.get('useCustomPricing') === 'on' ? 'custom' : 'dashboard';
  const dashboardPricing = dashboardProjectionPreset(berthType, { contributesToCosts });
  const defaultPricing = frozenInvitation
    ? {
      berthCents: contributesToCosts ? frozenInvitation.berthCents : 0,
      starterPackCents: contributesToCosts ? frozenInvitation.starterPackCents : 0,
      protectionInsuranceCents: contributesToCosts ? frozenInvitation.protectionInsuranceCents : 0,
      refundableDepositCents: frozenInvitation.refundableDepositCents,
    }
    : dashboardPricing;
  return {
    id,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    whatsappNumber: `+${normalizeWhatsAppNumber(fields.get('whatsappNumber'))}`,
    plannedRole: roleFromFields(fields, 'projectionRole'),
    berthType,
    cabinGroupId: berthType === 'double_cabin' ? normalizeCabinGroupId(fields.get('cabinGroupId')) : '',
    pricingMode,
    berthCents: frozenInvitation ? defaultPricing.berthCents : (pricingMode === 'custom' ? toEuroCents(fields.get('berthAmount')) : defaultPricing.berthCents),
    starterPackCents: frozenInvitation ? defaultPricing.starterPackCents : (pricingMode === 'custom' ? toEuroCents(fields.get('starterPackAmount')) : defaultPricing.starterPackCents),
    protectionInsuranceCents: frozenInvitation ? defaultPricing.protectionInsuranceCents : (pricingMode === 'custom' ? toEuroCents(fields.get('protectionInsuranceAmount')) : defaultPricing.protectionInsuranceCents),
    refundableDepositCents: frozenInvitation ? defaultPricing.refundableDepositCents : (pricingMode === 'custom' ? toEuroCents(fields.get('refundableDepositAmount')) : defaultPricing.refundableDepositCents),
    preferredLocale: fields.get('preferredLocale') === 'en' ? 'en' : 'it',
    contributesToCosts,
    contactConsent: frozenInvitation ? frozenInvitation.contactConsent === true : fields.get('contactConsent') === 'on',
  };
}

function projectionPricingUpdateFromFields(fields, id, existingProjection) {
  const current = normalizeProjection(id, existingProjection);
  const contributesToCosts = current.contributesToCosts;
  return {
    // Una revisione della quota diventa sempre un accordo esplicito della
    // persona, anche se prima il preventivo seguiva la dashboard economica.
    pricingMode: 'custom',
    contributesToCosts,
    berthCents: contributesToCosts ? toEuroCents(fields.get('berthAmount')) : 0,
    starterPackCents: contributesToCosts ? toEuroCents(fields.get('starterPackAmount')) : 0,
    protectionInsuranceCents: contributesToCosts ? toEuroCents(fields.get('protectionInsuranceAmount')) : 0,
    refundableDepositCents: toEuroCents(fields.get('refundableDepositAmount')),
  };
}

function legacyProjectionDraftFromInvite(invite) {
  const [firstName = '', ...lastNameParts] = String(invite.displayName || '').trim().split(/\s+/);
  return {
    firstName,
    lastName: lastNameParts.join(' '),
    whatsappNumber: String(invite.whatsappNumber || ''),
    plannedRole: DEFAULT_CREW_ROLE,
    berthType: 'to_define',
    cabinGroupId: '',
    berthCents: 0,
    starterPackCents: 0,
    protectionInsuranceCents: 0,
    refundableDepositCents: 0,
    pricingMode: 'dashboard',
    preferredLocale: inviteLocale(invite),
    contributesToCosts: true,
    contactConsent: false,
  };
}

function prepareLegacyInviteProjection(invite) {
  const form = document.querySelector('#projectionForm');
  if (!form) return;
  resetProjectionForm();
  const title = document.querySelector('#projectionTitle');
  if (title) title.textContent = `Completa la scheda di ${invite.displayName}`;
  linkingLegacyInviteId = invite.id;
  fillProjectionForm(legacyProjectionDraftFromInvite(invite));
  form.elements.preferredLocale.disabled = true;
  const legacyLinkHint = document.querySelector('#projectionLegacyLinkHint');
  if (legacyLinkHint) {
    legacyLinkHint.hidden = false;
    legacyLinkHint.textContent = `Stai aggiungendo ${invite.displayName} all’elenco provvisorio. Completa ruolo, sistemazione e importo previsto, poi salva: il link personale esistente non verrà creato, revocato o modificato.`;
  }
  document.querySelector('#projectionSubmitButton').textContent = 'Salva la scheda senza creare un nuovo invito';
  const cancelButton = document.querySelector('#cancelProjectionEdit');
  cancelButton.textContent = 'Annulla collegamento';
  cancelButton.hidden = false;
  const nameGuidance = /^[^\s]+$/.test(invite.displayName)
    ? `Il numero WhatsApp deve coincidere esattamente. Il nome “${invite.displayName}” resta invariato e qui puoi aggiungere il cognome.`
    : 'Nome e numero WhatsApp devono coincidere esattamente con l’invito esistente.';
  setMessage(document.querySelector('#projectionFormMessage'), `${nameGuidance} Poi salva posto e importo previsto.`);
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.elements.berthType.focus();
}

function fillProjectionForm(projection) {
  const form = document.querySelector('#projectionForm');
  if (!form) return;
  const normalized = normalizeProjection(projection.id, projection);
  const effective = effectiveProjectionPricing(normalized);
  form.elements.firstName.value = projection.firstName;
  form.elements.lastName.value = projection.lastName;
  form.elements.whatsappNumber.value = projection.whatsappNumber;
  fillRoleFields(form, 'projectionRole', projection.plannedRole);
  form.elements.berthType.value = normalized.berthType;
  form.elements.cabinGroupId.value = normalized.cabinGroupId || '';
  form.elements.berthAmount.value = euroInputValue(effective.berthCents);
  form.elements.starterPackAmount.value = euroInputValue(effective.starterPackCents);
  form.elements.protectionInsuranceAmount.value = euroInputValue(effective.protectionInsuranceCents);
  form.elements.refundableDepositAmount.value = euroInputValue(effective.refundableDepositCents);
  form.elements.useCustomPricing.checked = normalized.pricingMode === 'custom';
  form.elements.preferredLocale.value = normalized.preferredLocale === 'en' ? 'en' : 'it';
  form.elements.contributesToCosts.checked = normalized.contributesToCosts !== false;
  form.elements.contributesToCosts.dataset.userChoice = 'true';
  form.elements.contactConsent.checked = projection.contactConsent === true;
  syncProjectionCabinGroupField();
  syncProjectionCostParticipation();
  renderProjectionCostPreview();
}

function setProjectionIdentityFieldsLocked(locked) {
  const form = document.querySelector('#projectionForm');
  if (!form) return;
  ['firstName', 'lastName', 'whatsappNumber'].forEach((fieldName) => {
    if (form.elements[fieldName]) form.elements[fieldName].readOnly = locked;
  });
}

function applyProjectionCalculatedAmount(input, cents, dataKey) {
  if (!input) return;
  if (cents > 0 && (!input.value || input.dataset[dataKey] === 'true')) {
    input.value = euroInputValue(cents);
    input.dataset[dataKey] = 'true';
  } else if (cents === 0 && input.dataset[dataKey] === 'true') {
    input.value = '';
    delete input.dataset[dataKey];
  }
}

function projectionFormUsesCustomPricing(form = document.querySelector('#projectionForm')) {
  return form?.elements.useCustomPricing?.checked === true;
}

function editingProjection() {
  return editingProjectionId
    ? activeProjections.find((projection) => projection.id === editingProjectionId) || null
    : null;
}

function isEditingInvitedDashboardProjection() {
  const projection = editingProjection();
  return projection?.status === 'invited' && projection.pricingMode === 'dashboard';
}

function isEditingInvitedProjectionPricing() {
  return editingInvitedPricing && editingProjection()?.status === 'invited';
}

function syncProjectionCostParticipation() {
  const form = document.querySelector('#projectionForm');
  if (!form) return;
  const contributesToCosts = form.elements.contributesToCosts?.checked === true;
  const usesCustomPricing = projectionFormUsesCustomPricing(form);
  const keepsInvitationPricing = !usesCustomPricing && isEditingInvitedDashboardProjection();
  const pricingLocked = editingProjection()?.status === 'invited' && !isEditingInvitedProjectionPricing();
  const currentCostModel = costPlanQuoteModel();
  const dashboardPricingReady = Boolean(currentCostModel && !automaticCostPlanPricingMessage(currentCostModel));
  const contributionHint = document.querySelector('#projectionContributionHint');
  const automaticFields = [
    ['berthAmount', 'autoProjectionRate'],
    ['starterPackAmount', 'autoStarterPackRate'],
    ['protectionInsuranceAmount', 'autoProtectionInsuranceRate'],
  ];
  automaticFields.forEach(([fieldName, dataKey]) => {
    const input = form.elements[fieldName];
    if (!input) return;
    input.disabled = pricingLocked || !contributesToCosts || !usesCustomPricing;
    if (!contributesToCosts) {
      input.value = '';
      delete input.dataset[dataKey];
    }
  });
  const depositInput = form.elements.refundableDepositAmount;
  if (depositInput) depositInput.disabled = pricingLocked || !usesCustomPricing;
  if (form.elements.useCustomPricing) form.elements.useCustomPricing.disabled = pricingLocked;
  // La partecipazione ai costi cambia il significato dell'accordo. Dopo
  // l'invito resta quindi stabile: la revisione € può modificare importi,
  // non convertire accidentalmente una persona in ruolo gratuito.
  if (form.elements.contributesToCosts) {
    form.elements.contributesToCosts.disabled = editingProjection()?.status === 'invited';
  }
  if (contributionHint) {
    contributionHint.textContent = !contributesToCosts
      ? 'Questa persona è esente da quota posto, Starter Pack e assicurazione. La cauzione rimborsabile resta separata e può essere prevista.'
      : isEditingInvitedProjectionPricing()
        ? 'Stai rivedendo una quota già concordata: controlla ogni importo e salva solo dopo esserti accordato con la persona. La partecipazione ai costi resta quella già definita. La modifica non crea alcun pagamento.'
      : usesCustomPricing
        ? 'Questa persona usa un’eccezione: puoi modificare gli importi qui sotto senza cambiare la dashboard della barca.'
        : keepsInvitationPricing
          ? 'Questa quota è già fissata nell’invito. Per aggiornarla con la dashboard attuale, salva prima eventuali cambi di posto e usa l’icona ⟳ nella sua card dopo esserti accordato con la persona.'
          : dashboardPricingReady
            ? 'Questa persona segue automaticamente quota posto, Starter Pack, assicurazione e cauzione impostati nella dashboard.'
            : 'Completa prima il preventivo economico: fino ad allora il sito usa solo il listino base della barca e non propone il Pack automatico.';
  }
  renderProjectionCostPreview();
}

function syncProjectionRoleContributionDefault() {
  const form = document.querySelector('#projectionForm');
  if (!form) return;
  const checkbox = form.elements.contributesToCosts;
  if (!checkbox.dataset.userChoice) {
    checkbox.checked = !FREE_SUPPORT_ROLES.has(form.elements.projectionRolePreset?.value);
  }
  syncProjectionCostParticipation();
  applyProjectionBerthPreset();
}

function applyProjectionBerthPreset() {
  const form = document.querySelector('#projectionForm');
  syncProjectionCabinGroupField();
  if (!form || !activeBoat) {
    renderProjectionCostPreview();
    return;
  }
  const preset = dashboardProjectionPreset(form.elements.berthType?.value, {
    contributesToCosts: form.elements.contributesToCosts?.checked === true,
  });
  // Un importo inserito come eccezione, anche se è zero, non deve mai essere
  // ripopolato dalla dashboard. Lo stesso vale per una quota già fissata in un
  // invito: l'aggiornamento richiede il comando esplicito sulla sua card.
  if (!projectionFormUsesCustomPricing(form) && !isEditingInvitedDashboardProjection()) {
    applyProjectionCalculatedAmount(form.elements.berthAmount, preset.berthCents, 'autoProjectionRate');
    applyProjectionCalculatedAmount(form.elements.starterPackAmount, preset.starterPackCents, 'autoStarterPackRate');
    applyProjectionCalculatedAmount(form.elements.protectionInsuranceAmount, preset.protectionInsuranceCents, 'autoProtectionInsuranceRate');
    applyProjectionCalculatedAmount(form.elements.refundableDepositAmount, preset.refundableDepositCents, 'autoRefundableDepositRate');
  }
  syncProjectionCostParticipation();
  renderProjectionCostPreview();
}

document.querySelector('#projectionForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#projectionFormMessage');
  if (blockPrivateAction(message)) return;
  if (!activeBoat || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const legacyLinkRequested = Boolean(linkingLegacyInviteId);
  const legacyInvite = legacyLinkRequested
    ? activeInvites.find((candidate) => candidate.id === linkingLegacyInviteId)
    : null;
  if (legacyLinkRequested && (!legacyInvite || !isLegacyInviteLinkable(legacyInvite) || !legacyInvite.createdAt?.toDate)) {
    setMessage(message, 'Questo invito precedente non è più compatibile con l’elenco provvisorio. Il suo accesso non è stato modificato.', true);
    return;
  }
  if (legacyInvite && activeProjections.some((projection) => projectionMatchesInvite(projection, legacyInvite.id))) {
    setMessage(message, 'Questo invito è già collegato all’elenco provvisorio.', true);
    return;
  }
  if (!editingProjectionId && !legacyInvite && needsCapacityAlignment(activeBoat)) {
    setMessage(message, capacityAlignmentMessage(activeBoat), true);
    return;
  }
  if (!editingProjectionId && !legacyInvite && isCrewCapacityReached()) {
    setMessage(message, 'Hai già riservato tutti i posti per partecipanti indicati per questa barca.', true);
    return;
  }
  const normalizedNumber = normalizeWhatsAppNumber(fields.get('whatsappNumber'));
  if (!normalizedNumber) {
    setMessage(message, 'Inserisci il numero WhatsApp in formato internazionale, ad esempio +39 333 1234567.', true);
    return;
  }
  if (fields.get('contactConsent') !== 'on') {
    setMessage(message, 'Conferma di avere il consenso della persona prima di salvarne il contatto.', true);
    return;
  }
  const projectionId = editingProjectionId || legacyInvite?.id || createInviteId();
  const editingProjection = editingProjectionId
    ? activeProjections.find((candidate) => candidate.id === editingProjectionId)
    : null;
  if (editingProjectionId && !editingProjection) {
    setMessage(message, 'Questa scheda è stata modificata in un’altra sessione: aggiorna l’area e riprova.', true);
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  if (editingProjection && isEditingInvitedProjectionPricing()) {
    const pricing = projectionPricingUpdateFromFields(fields, projectionId, editingProjection);
    const payableCents = pricing.berthCents + pricing.protectionInsuranceCents;
    const confirmed = window.confirm(
      `Confermi la nuova quota per ${editingProjection.displayName}? Richiesta prevista ${formatCurrency(payableCents / 100)}; Starter Pack ${starterPackQuoteText(pricing.starterPackCents)}; cauzione rimborsabile ${formatCurrency(pricing.refundableDepositCents / 100)} separata. Non verrà creato alcun pagamento.`,
    );
    if (!confirmed) return;
    submitButton.disabled = true;
    try {
      await updateDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projectionId), {
        ...pricing,
        pricingSnapshotAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });
      const savedProjection = retainSavedProjectionLocally({
        ...editingProjection,
        ...pricing,
      });
      showSavedProjectionForm(savedProjection, `Quota aggiornata per ${editingProjection.displayName}. La card e la sua area personale mostrano ora lo stesso accordo; nessuna richiesta di pagamento è stata creata. Per aggiungere un’altra persona scegli “Nuovo partecipante”.`);
    } catch (error) {
      setMessage(message, getFirestoreErrorMessage(error, 'Non riesco ad aggiornare la quota concordata.'), true);
    } finally {
      submitButton.disabled = false;
    }
    return;
  }
  const projection = projectionDraftFromFields(fields, projectionId, editingProjection);
  const cabinGroupError = validateProjectionCabinGroup(projection, projectionId);
  if (cabinGroupError) {
    setMessage(message, cabinGroupError, true);
    return;
  }
  if (legacyInvite) {
    projection.preferredLocale = inviteLocale(legacyInvite);
    const legacyNameMatches = projection.displayName === legacyInvite.displayName
      || (/^[^\s]+$/.test(legacyInvite.displayName) && legacyInvite.displayName === projection.firstName);
    if (!legacyNameMatches || projection.whatsappNumber !== legacyInvite.whatsappNumber) {
      const identityError = /^[^\s]+$/.test(legacyInvite.displayName)
        ? `Il numero WhatsApp deve coincidere esattamente. Il nome “${legacyInvite.displayName}” resta invariato: puoi aggiungere il cognome, non sostituire il nome.`
        : 'Per riusare questo invito, nome e numero WhatsApp devono coincidere esattamente con quelli già presenti.';
      setMessage(message, `${identityError} Nessun accesso è stato modificato.`, true);
      return;
    }
  }
  const existingInvite = editingProjection ? projectionInvite(editingProjection) : null;
  if (existingInvite) {
    projection.firstName = editingProjection.firstName;
    projection.lastName = editingProjection.lastName;
    projection.displayName = editingProjection.displayName;
    projection.whatsappNumber = editingProjection.whatsappNumber;
    projection.preferredLocale = editingProjection.preferredLocale;
  }
  submitButton.disabled = true;
  try {
    let savedProjection;
    let savedMessage;
    if (editingProjectionId) {
      const update = {
        ...projection,
        status: editingProjection.status,
        inviteId: editingProjection.inviteId || null,
        invitedAt: editingProjection.invitedAt || null,
        // Le card precedenti alla fotografia vengono migrate senza ricalcolare
        // la quota; gli aggiornamenti ordinari successivi non toccano più
        // questo marcatore né gli importi.
        ...(editingProjection.status === 'invited' && !editingProjection.pricingSnapshotAt
          ? { pricingSnapshotAt: serverTimestamp() }
          : {}),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      };
      await updateDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projectionId), update);
      savedProjection = retainSavedProjectionLocally({ ...editingProjection, ...update });
      savedMessage = existingInvite
        ? 'Scheda aggiornata: il link personale e lo stato di accesso restano invariati.'
        : 'Scheda aggiornata: posto, ruolo, sistemazione e importo previsto restano associati alla stessa persona.';
    } else if (legacyInvite) {
      const created = {
        ...projection,
        status: 'invited',
        inviteId: legacyInvite.id,
        invitedAt: legacyInvite.createdAt,
        pricingSnapshotAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      };
      await setDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projectionId), created);
      savedProjection = retainSavedProjectionLocally(created);
      savedMessage = `Scheda equipaggio salvata per ${legacyInvite.displayName}: usa lo stesso ID dell’invito esistente, che non è stato creato, revocato o modificato.`;
    } else {
      const created = {
        ...projection,
        status: 'projected',
        inviteId: null,
        invitedAt: null,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      };
      await setDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projectionId), created);
      savedProjection = retainSavedProjectionLocally(created);
      savedMessage = 'Scheda salvata: controlla il riepilogo accanto alla persona e, quando vuoi, crea l’invito WhatsApp dalla stessa riga.';
    }
    showSavedProjectionForm(savedProjection, `${savedMessage} Per aggiungere un’altra persona scegli “Nuovo partecipante”.`);
  } catch (error) {
    setMessage(message, getFirestoreErrorMessage(error, 'Non riesco a salvare la scheda dell’equipaggio.'), true);
  } finally {
    submitButton.disabled = false;
  }
});

const projectionForm = document.querySelector('#projectionForm');
projectionForm.elements.berthType.addEventListener('change', applyProjectionBerthPreset);
projectionForm.elements.projectionRolePreset.addEventListener('change', syncProjectionRoleContributionDefault);
projectionForm.elements.contributesToCosts.addEventListener('change', () => {
  projectionForm.elements.contributesToCosts.dataset.userChoice = 'true';
  syncProjectionCostParticipation();
  applyProjectionBerthPreset();
});
projectionForm.elements.useCustomPricing.addEventListener('change', () => {
  applyProjectionBerthPreset();
  syncProjectionCostParticipation();
  renderProjectionCostPreview();
});
projectionForm.elements.berthAmount.addEventListener('input', () => {
  delete projectionForm.elements.berthAmount.dataset.autoProjectionRate;
});
const projectionAutomaticRateKeys = {
  starterPackAmount: 'autoStarterPackRate',
  protectionInsuranceAmount: 'autoProtectionInsuranceRate',
  refundableDepositAmount: 'autoRefundableDepositRate',
};
Object.entries(projectionAutomaticRateKeys).forEach(([fieldName, dataKey]) => {
  projectionForm.elements[fieldName].addEventListener('input', () => {
    delete projectionForm.elements[fieldName].dataset[dataKey];
  });
});
['berthAmount', 'starterPackAmount', 'protectionInsuranceAmount', 'refundableDepositAmount'].forEach((fieldName) => {
  projectionForm.elements[fieldName].addEventListener('input', renderProjectionCostPreview);
  projectionForm.elements[fieldName].addEventListener('change', renderProjectionCostPreview);
});
syncProjectionCostParticipation();
syncProjectionCabinGroupField();
document.querySelector('#newProjectionButton').addEventListener('click', startNewProjection);
document.querySelector('#cancelProjectionEdit').addEventListener('click', cancelProjectionEdit);

document.querySelector('#projectionList').addEventListener('click', async (event) => {
  const message = document.querySelector('#projectionFormMessage');
  if (blockPrivateAction(message) || !activeBoat || !auth.currentUser) return;
  const manualReceiptButton = event.target.closest('[data-register-manual-receipt]');
  if (manualReceiptButton) {
    const projection = activeProjections.find((candidate) => candidate.id === manualReceiptButton.dataset.registerManualReceipt);
    if (projection) openManualReceiptPanel(projection);
    return;
  }
  const balanceRequestButton = event.target.closest('[data-request-projection-balance]');
  if (balanceRequestButton) {
    const projection = activeProjections.find((candidate) => candidate.id === balanceRequestButton.dataset.requestProjectionBalance);
    if (projection && projectionInvite(projection)) prepareProjectionBalanceRequest(projection);
    return;
  }
  const legacyLinkButton = event.target.closest('[data-link-legacy-invite]');
  if (legacyLinkButton) {
    const invite = activeInvites.find((candidate) => candidate.id === legacyLinkButton.dataset.linkLegacyInvite);
    if (!invite || !isLegacyInviteLinkable(invite)) return;
    if (activeProjections.some((projection) => projectionMatchesInvite(projection, invite.id))) {
      setMessage(message, 'Questa persona è già presente nell’elenco provvisorio dell’equipaggio.', true);
      return;
    }
    prepareLegacyInviteProjection(invite);
    return;
  }
  const editButton = event.target.closest('[data-edit-projection]');
  if (editButton) {
    const projection = activeProjections.find((candidate) => candidate.id === editButton.dataset.editProjection);
    if (!projection) return;
    const invite = projectionInvite(projection);
    editingInvitedPricing = false;
    projectionForm.elements.preferredLocale.disabled = false;
    setProjectionIdentityFieldsLocked(false);
    fillProjectionForm(projection);
    editingProjectionId = projection.id;
    setProjectionIdentityFieldsLocked(Boolean(invite));
    projectionForm.elements.preferredLocale.disabled = Boolean(invite);
    syncProjectionCabinGroupField();
    syncProjectionCostParticipation();
    document.querySelector('#projectionSubmitButton').textContent = 'Salva la scheda';
    document.querySelector('#cancelProjectionEdit').hidden = false;
    document.querySelector('#newProjectionButton').hidden = true;
    document.querySelector('#projectionTitle').textContent = `Modifica la scheda di ${projection.displayName}`;
    setMessage(message, invite
      ? 'Puoi aggiornare ruolo, sistemazione, cabina e importi. Nome, WhatsApp, lingua e link personale restano invariati.'
      : 'Modifica posto, ruolo, sistemazione, cabina e importo previsto, poi salva.');
    projectionForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const editPricingButton = event.target.closest('[data-edit-projection-pricing]');
  if (editPricingButton) {
    const projection = activeProjections.find((candidate) => candidate.id === editPricingButton.dataset.editProjectionPricing);
    const invite = projection ? projectionInvite(projection) : null;
    if (!projection || !invite) return;
    fillProjectionForm(projection);
    editingProjectionId = projection.id;
    editingInvitedPricing = true;
    setProjectionIdentityFieldsLocked(true);
    projectionForm.elements.preferredLocale.disabled = true;
    projectionForm.elements.useCustomPricing.checked = true;
    const exception = projectionForm.querySelector('.projection-pricing-exception');
    if (exception) exception.open = true;
    syncProjectionCabinGroupField();
    syncProjectionCostParticipation();
    document.querySelector('#projectionSubmitButton').textContent = 'Aggiorna quota concordata';
    document.querySelector('#cancelProjectionEdit').hidden = false;
    document.querySelector('#newProjectionButton').hidden = true;
    document.querySelector('#projectionTitle').textContent = `Quota concordata di ${projection.displayName}`;
    setMessage(message, `Stai rivedendo solo la quota di ${projection.displayName}. I nuovi importi restano fissi e non generano un pagamento: salvali soltanto dopo esserti accordato con la persona.`);
    projectionForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    projectionForm.elements.berthAmount.focus();
    return;
  }
  const releaseButton = event.target.closest('[data-release-projection]');
  if (releaseButton) {
    const projection = activeProjections.find((candidate) => candidate.id === releaseButton.dataset.releaseProjection);
    if (!projection || projectionInvite(projection)) return;
    if (!window.confirm(`Liberare il posto riservato per ${projection.displayName}? Non è stato creato alcun invito.`)) return;
    releaseButton.disabled = true;
    try {
      await deleteDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projection.id));
      if (editingProjectionId === projection.id) resetProjectionForm();
      setMessage(message, 'Posto liberato: torna disponibile per una nuova scheda equipaggio.');
    } catch (error) {
      releaseButton.disabled = false;
      setMessage(message, getFirestoreErrorMessage(error, 'Non riesco a liberare questo posto.'), true);
    }
    return;
  }
  const sendButton = event.target.closest('[data-send-projection]');
  if (sendButton) {
    const projection = activeProjections.find((candidate) => candidate.id === sendButton.dataset.sendProjection);
    if (!projection || projectionInvite(projection)) return;
    sendButton.disabled = true;
    const whatsappWindow = window.open('', '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    try {
      const invite = await createInviteFromProjection(projection);
      const url = whatsappUrl(invite);
      if (whatsappWindow && url) {
        whatsappWindow.location.replace(url);
        setMessage(message, `Invito pronto per ${projection.displayName}: WhatsApp è aperto con il messaggio già preparato. La scheda resta collegata allo stesso posto, ruolo, sistemazione e importo previsto.`);
      } else {
        whatsappWindow?.close();
        setMessage(message, `Invito pronto per ${projection.displayName}: copia il link dalla sua card. La scheda resta collegata allo stesso posto, ruolo, sistemazione e importo previsto.`);
      }
    } catch (error) {
      whatsappWindow?.close();
      sendButton.disabled = false;
      const fallback = error.code === 'phone-already-assigned'
        ? 'Questo numero è già associato a una barca dell’evento. Verifica prima con l’organizzatore.'
        : error.code === 'english-briefing-required'
          ? 'Prima di creare un invito in inglese, pubblica dalla bacheca la versione inglese ufficiale del briefing di sicurezza.'
          : 'Non riesco a creare l’invito personale.';
      setMessage(message, getFirestoreErrorMessage(error, fallback), true);
    }
    return;
  }
  const refreshPricingButton = event.target.closest('[data-refresh-projection-pricing]');
  if (refreshPricingButton) {
    const projection = activeProjections.find((candidate) => candidate.id === refreshPricingButton.dataset.refreshProjectionPricing);
    if (!projection || projection.status !== 'invited' || projection.pricingMode !== 'dashboard') return;
    const confirmed = window.confirm(
      `Aggiornare gli importi fissati per ${projection.displayName} usando la Dashboard economica attuale? Questa modifica non crea una richiesta WhatsApp: avvisa prima la persona e usa poi le richieste personali solo per l’importo concordato.`,
    );
    if (!confirmed) return;
    refreshPricingButton.disabled = true;
    try {
      await updateDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projection.id), {
        ...dashboardProjectionPreset(projection.berthType, projection),
        pricingSnapshotAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });
      setMessage(message, `Importi aggiornati per ${projection.displayName}. La card e la sua area personale mostrano ora la stessa nuova quota; nessuna richiesta di pagamento è stata creata.`);
    } catch (error) {
      refreshPricingButton.disabled = false;
      setMessage(message, getFirestoreErrorMessage(error, 'Non riesco ad aggiornare gli importi fissati per questa persona.'), true);
    }
    return;
  }
  const reissueButton = event.target.closest('[data-reissue-invite]');
  if (reissueButton) {
    const reissueInviteRecord = activeInvites.find((candidate) => candidate.id === reissueButton.dataset.reissueInvite);
    if (!reissueInviteRecord) return;
    const confirmed = window.confirm(`Revocare l’accesso attuale di ${reissueInviteRecord.displayName} e inviare un nuovo link? Il vecchio codice personale smetterà di funzionare.`);
    if (!confirmed) return;
    reissueButton.disabled = true;
    const whatsappWindow = window.open('', '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    try {
      const renewedInvite = await reissueInvite(reissueInviteRecord);
      const url = whatsappUrl(renewedInvite);
      if (whatsappWindow && url) whatsappWindow.location.replace(url);
      else whatsappWindow?.close();
      setMessage(message, whatsappWindow && url
        ? 'Il vecchio accesso è stato revocato: WhatsApp è aperto con il nuovo link.'
        : 'Il vecchio accesso è stato revocato. Copia il nuovo link dalla card della persona.', !url);
    } catch (error) {
      whatsappWindow?.close();
      reissueButton.disabled = false;
      setMessage(message, 'Non riesco a revocare e generare il nuovo link. Se era aperta un’altra scheda, aggiorna l’area e usa il link più recente.', true);
    }
    return;
  }
  const invite = activeInvites.find((candidate) => candidate.id === event.target.closest('[data-copy-invite]')?.dataset.copyInvite
    || candidate.id === event.target.closest('[data-whatsapp-invite]')?.dataset.whatsappInvite);
  const copyButton = event.target.closest('[data-copy-invite]');
  if (copyButton && invite) {
    try {
      await navigator.clipboard.writeText(participantUrl(invite));
      setMessage(message, 'Link personale copiato.');
    } catch (error) {
      setMessage(message, 'Non riesco a copiare il link. Verifica i permessi del browser.', true);
    }
    return;
  }
  const whatsappButton = event.target.closest('[data-whatsapp-invite]');
  if (whatsappButton && invite) {
    const url = whatsappUrl(invite);
    if (url) window.open(url, '_blank', 'noopener');
    else setMessage(message, 'Il numero WhatsApp dell’invito non è nel formato internazionale richiesto.', true);
  }
});

document.querySelector('#projectionList').addEventListener('change', async (event) => {
  const message = document.querySelector('#projectionFormMessage');
  const select = event.target.closest('[data-cabin-group]');
  if (!select || blockPrivateAction(message) || !activeBoat || !auth.currentUser) return;
  const projection = activeProjections.find((candidate) => candidate.id === select.dataset.cabinGroup);
  if (!projection) return;
  const cabinGroupId = normalizeCabinGroupId(select.value);
  if (cabinGroupId === projectionCabinGroupId(projection)) return;
  const cabinGroupError = validateProjectionCabinGroup({ ...projection, cabinGroupId }, projection.id);
  if (cabinGroupError) {
    renderProjections();
    setMessage(message, cabinGroupError, true);
    return;
  }
  select.disabled = true;
  try {
    const update = {
      cabinGroupId,
      contributesToCosts: projection.contributesToCosts !== false,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
    };
    // Una card invitata precedente alla fotografia viene aggiornata senza
    // ricalcolare nulla: aggiungere solo la cabina deve restare possibile
    // anche per i dati V1/V2 già salvati.
    if (projection.status === 'invited' && !projection.pricingSnapshotAt) {
      const normalized = normalizeProjection(projection.id, projection);
      Object.assign(update, {
        pricingMode: normalized.pricingMode,
        contributesToCosts: normalized.contributesToCosts,
        berthCents: normalized.berthCents,
        starterPackCents: normalized.starterPackCents,
        protectionInsuranceCents: normalized.protectionInsuranceCents,
        refundableDepositCents: normalized.refundableDepositCents,
        pricingSnapshotAt: serverTimestamp(),
      });
    }
    await updateDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projection.id), update);
    setMessage(message, cabinGroupId
      ? `Hai assegnato ${projection.displayName} a ${cabinGroupLabel(cabinGroupId)}.`
      : `Cabina rimessa da assegnare per ${projection.displayName}.`);
  } catch (error) {
    select.disabled = false;
    renderProjections();
    setMessage(message, getFirestoreErrorMessage(error, 'Non riesco ad aggiornare la cabina assegnata.'), true);
  }
});

document.querySelector('#memberForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (blockPrivateAction(document.querySelector('#memberFormMessage'))) return;
  if (!activeBoat) return;
  if (!editingMemberId && needsCapacityAlignment(activeBoat)) {
    setMessage(document.querySelector('#memberFormMessage'), capacityAlignmentMessage(activeBoat), true);
    return;
  }
  if (!editingMemberId && isCrewCapacityReached()) {
    setMessage(document.querySelector('#memberFormMessage'), 'Hai già riservato tutti i posti per partecipanti indicati per questa barca.', true);
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
setupBriefingEditor();
const briefingForm = document.querySelector('#briefingForm');
briefingForm.addEventListener('input', () => {
  briefingForm.dataset.editing = 'true';
  updateRulesEditorChangeWarning();
});
briefingForm.addEventListener('change', updateRulesEditorChangeWarning);
briefingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (blockPrivateAction(document.querySelector('#briefingFormMessage'))) return;
  if (!activeBoat || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = event.submitter?.matches?.('[data-board-save]')
    ? event.submitter
    : form.querySelector('[data-board-save="rules"]');
  const saveIntent = submitButton?.dataset.boardSave || 'rules';
  const rulesTitle = fields.get('rulesTitle').trim();
  const rulesSummary = fields.get('rulesSummary').trim();
  const rulesText = fields.get('rulesText').trim();
  const rulesTitleEn = fields.get('rulesTitleEn').trim();
  const rulesSummaryEn = fields.get('rulesSummaryEn').trim();
  const rulesTextEn = fields.get('rulesTextEn').trim();
  const scheduleNoteEn = fields.get('scheduleNoteEn').trim();
  const englishFieldsHaveContent = [rulesTitleEn, rulesSummaryEn, rulesTextEn, scheduleNoteEn].some(Boolean);
  const englishCoreIsComplete = rulesTitleEn && rulesSummaryEn && rulesTextEn;
  if (englishFieldsHaveContent && !englishCoreIsComplete) {
    setMessage(document.querySelector('#briefingFormMessage'), 'Completa titolo, sintesi e regolamento inglese oppure lascia vuota l’intera sezione inglese. Non pubblicare una traduzione parziale.', true);
    return;
  }
  const briefingData = {
    rulesTitle,
    rulesSummary,
    rulesText,
    rulesTitleEn,
    rulesSummaryEn,
    rulesTextEn,
    fullRulesRequired: true,
    meetingPoint: fields.get('meetingPoint').trim(),
    boardingAt: fields.get('boardingAt'),
    departureAt: fields.get('departureAt'),
    returnAt: fields.get('returnAt'),
    scheduleNote: fields.get('scheduleNote').trim(),
    scheduleNoteEn,
  };
  // La conferma è legata al regolamento, non agli orari. Un cambio di
  // ritrovo, meteo o cambusa diventa un aggiornamento di bacheca e non deve
  // costringere l'equipaggio a riaccettare un testo che non è cambiato.
  const rulesChanged = briefingRulesChanged(form);
  const scheduleChanged = briefingTripChanged(form);
  if (!activeBriefing && saveIntent === 'schedule') {
    document.querySelector('#rulesEditor').open = true;
    setMessage(document.querySelector('#briefingFormMessage'), 'Prima attiva il regolamento di bordo: solo dopo puoi aggiornare orari e bacheca.', true);
    return;
  }
  if (activeBriefing && saveIntent === 'schedule' && rulesChanged) {
    document.querySelector('#rulesEditor').open = true;
    setMessage(document.querySelector('#briefingFormMessage'), 'Hai modificato anche il regolamento. Salva quelle modifiche dal pulsante “Salva modifiche al regolamento”, così l’equipaggio saprà che dovrà rileggerlo.', true);
    return;
  }
  if (activeBriefing && saveIntent === 'rules' && !rulesChanged && scheduleChanged) {
    setMessage(document.querySelector('#briefingFormMessage'), 'Hai aggiornato soltanto orari o informazioni del viaggio. Usa “Salva aggiornamento del viaggio”: non richiederà una nuova lettura delle regole.', true);
    return;
  }
  const currentAcceptanceCount = currentBriefingAcceptanceCount();
  if (activeBriefing && rulesChanged && currentAcceptanceCount > 0 && !window.confirm(`Stai cambiando le regole già confermate da ${currentAcceptanceCount} ${currentAcceptanceCount === 1 ? 'persona' : 'persone'}. Dopo il salvataggio dovranno rileggerle prima di usare la loro area. Vuoi continuare?`)) return;
  const currentRulesVersion = Number.isInteger(activeBriefing?.rulesVersion) ? activeBriefing.rulesVersion : 0;
  // `rulesVersion` resta un dettaglio tecnico per la Rule di sicurezza: non
  // viene mostrato all'equipaggio né usato come nome di una nuova edizione.
  const rulesVersion = activeBriefing ? currentRulesVersion + (rulesChanged ? 1 : 0) : 1;
  form.querySelectorAll('[data-board-save]').forEach((button) => { button.disabled = true; });
  setMessage(document.querySelector('#briefingFormMessage'), saveIntent === 'schedule' ? 'Aggiorno la bacheca del viaggio…' : 'Salvo il regolamento di bordo…');
  try {
    await setDoc(doc(db, 'boats', activeBoat.id, 'briefing', 'board'), {
      ...briefingData, rulesVersion, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid,
    });
    form.dataset.editing = '';
    const successMessage = !activeBriefing
      ? 'Regolamento di bordo pubblicato: l’equipaggio lo leggerà e lo accetterà prima di entrare nella barca.'
      : rulesChanged
        ? 'Regolamento aggiornato: chi lo aveva già accettato dovrà rileggerlo prima di usare l’area riservata.'
        : scheduleChanged
          ? 'Orari e informazioni aggiornati nella bacheca: non serve una nuova accettazione del regolamento.'
          : 'Regolamento e bacheca erano già aggiornati.';
    setMessage(document.querySelector('#briefingFormMessage'), successMessage);
  } catch (error) {
    setMessage(document.querySelector('#briefingFormMessage'), 'Non riesco a pubblicare la bacheca.', true);
  } finally {
    form.querySelectorAll('[data-board-save]').forEach((button) => { button.disabled = false; });
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
  if (!activeBoat || !isBoatReadyForPdf(activeBoat) || !isSkipperProfileCharterReady(activeSkipperProfile, activeSkipperDocumentCopies) || activeMembers.length > crewSeatLimit() || activeMembers.some((member) => !isCharterReady(member))) return;
  try {
    openCapitaneriaPdf({ boat: activeBoat, members: activeMembers, skipperProfile: activeSkipperProfile });
    setMessage(document.querySelector('#memberFormMessage'), 'Si apre la stampa: scegli “Salva come PDF” per scaricare il foglio.');
  } catch (error) {
    setMessage(document.querySelector('#memberFormMessage'), 'Impossibile aprire la stampa. Consenti le finestre popup e riprova.', true);
  }
});

const skipperProfileForm = document.querySelector('#skipperProfileForm');
skipperProfileForm.addEventListener('input', (event) => {
  if (event.target.matches('[data-skipper-document-input]')) return;
  skipperProfileForm.dataset.editing = 'true';
});
document.querySelectorAll('[data-skipper-document-upload]').forEach((button) => {
  button.addEventListener('click', () => {
    const documentKey = button.dataset.skipperDocumentUpload;
    document.querySelector(`[data-skipper-document-input="${documentKey}"]`)?.click();
  });
});
document.querySelectorAll('[data-skipper-document-input]').forEach((input) => {
  input.addEventListener('change', () => {
    const documentKey = input.dataset.skipperDocumentInput;
    const [file] = Array.from(input.files || []);
    input.value = '';
    void uploadSkipperDocumentCopy(documentKey, file);
  });
});
document.querySelectorAll('[data-skipper-document-download]').forEach((button) => {
  button.addEventListener('click', () => {
    void downloadSkipperDocumentCopy(button.dataset.skipperDocumentDownload);
  });
});
skipperProfileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (blockPrivateAction(document.querySelector('#skipperProfileMessage'))) return;
  if (!activeBoat || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const sailingLicenseExpiry = String(fields.get('sailingLicenseExpiry') || '');
  const radioCertificateExpiry = String(fields.get('radioCertificateExpiry') || '');
  if (sailingLicenseExpiry && sailingLicenseExpiry < '2026-10-11') {
    setMessage(document.querySelector('#skipperProfileMessage'), 'La patente nautica risulta scaduta prima della fine del viaggio. Verifica la data o lasciala vuota se non è prevista.', true);
    return;
  }
  if (radioCertificateExpiry && radioCertificateExpiry < '2026-10-11') {
    setMessage(document.querySelector('#skipperProfileMessage'), 'Il certificato radio risulta scaduto prima della fine del viaggio. Verifica la data o lasciala vuota se non è prevista.', true);
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  const profile = {
    firstName: String(fields.get('firstName') || '').trim(),
    lastName: String(fields.get('lastName') || '').trim(),
    birthDate: String(fields.get('birthDate') || ''),
    birthPlace: String(fields.get('birthPlace') || '').trim(),
    nationality: String(fields.get('nationality') || '').trim(),
    gender: String(fields.get('gender') || ''),
    documentType: String(fields.get('documentType') || ''),
    documentNumber: String(fields.get('documentNumber') || '').trim(),
    documentExpiry: String(fields.get('documentExpiry') || ''),
    email: String(fields.get('email') || '').trim(),
    phone: String(fields.get('phone') || '').trim(),
    sailingLicenseNumber: String(fields.get('sailingLicenseNumber') || '').trim(),
    sailingLicenseExpiry,
    radioCertificateType: String(fields.get('radioCertificateType') || ''),
    radioCertificateNumber: String(fields.get('radioCertificateNumber') || '').trim(),
    radioCertificateExpiry,
    identityDocumentStatus: String(fields.get('identityDocumentStatus') || ''),
    sailingLicenseStatus: String(fields.get('sailingLicenseStatus') || ''),
    radioCertificateStatus: String(fields.get('radioCertificateStatus') || ''),
    charterConsent: fields.get('charterConsent') === 'on',
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
  };
  submitButton.disabled = true;
  setMessage(document.querySelector('#skipperProfileMessage'), 'Salvo il dossier skipper…');
  try {
    await setDoc(doc(db, 'boats', activeBoat.id, 'skipperProfile', SKIPPER_PROFILE_ID), profile);
    form.dataset.editing = '';
    setMessage(document.querySelector('#skipperProfileMessage'), 'Dossier skipper salvato. Il PDF userà anche la tua riga nella Crew List e il riepilogo documentale per il charter.');
  } catch (error) {
    setMessage(document.querySelector('#skipperProfileMessage'), 'Non riesco a salvare il dossier skipper. Esci e rientra con l’account Google associato alla barca, poi riprova.', true);
  } finally {
    submitButton.disabled = false;
  }
});

const paymentProfileForm = document.querySelector('#paymentProfileForm');
paymentProfileForm.querySelectorAll('[data-payment-method-toggle]').forEach((input) => {
  input.addEventListener('change', () => renderPaymentProfileDetailVisibility(paymentProfileForm));
});

paymentProfileForm.addEventListener('submit', async (event) => {
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
  const paymentDetails = readPaymentDetails(form);
  const invalidMethod = enabledMethods.find((method) => !isValidPaymentDetail(method, paymentDetails));
  if (invalidMethod) {
    setMessage(document.querySelector('#paymentProfileMessage'), paymentDetailValidationMessage(invalidMethod), true);
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const profile = {
      collectorId: auth.currentUser.uid,
      collectorName,
      paypalEnabled: fields.get('paypalEnabled') === 'on',
      satispayEnabled: fields.get('satispayEnabled') === 'on',
      revolutEnabled: fields.get('revolutEnabled') === 'on',
      bankTransferEnabled: fields.get('bankTransferEnabled') === 'on',
      paymentDetails,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
    };
    await setDoc(doc(db, 'boats', activeBoat.id, 'collectionProfile', PAYMENT_PROFILE_ID), profile);
    activePaymentProfile = { ...defaultPaymentProfile(), ...profile };
    renderPaymentMethodOptions();
    setMessage(document.querySelector('#paymentProfileMessage'), 'Profilo di incasso salvato. I dettagli saranno aggiunti automaticamente alle richieste WhatsApp.');
  } catch (error) {
    setMessage(document.querySelector('#paymentProfileMessage'), 'Non riesco a salvare i metodi di incasso.', true);
  } finally {
    submitButton.disabled = false;
  }
});

const costPlanForm = document.querySelector('#costPlanForm');
function handleCostPlanFormChange(event) {
  if (event.target?.name === 'payingParticipants') {
    syncCostPlanDinetteFieldAvailability();
    syncCostPlanDepositParticipantAvailability();
  }
  if (event.target?.name === 'dinetteRateMode') syncCostPlanDinettePricingMode();
  if (event.target?.name === 'starterPackRateMode' || event.target?.name === 'protectionInsuranceRateMode') syncCostPlanRateMode();
  syncCostPlanBerthPricingMode();
  renderCostPlanSummary();
  renderSkipperFinanceOverview(readCostPlanForm());
}
costPlanForm.addEventListener('input', handleCostPlanFormChange);
costPlanForm.addEventListener('change', handleCostPlanFormChange);
costPlanForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#costPlanMessage');
  if (blockPrivateAction(message)) return;
  if (!activeBoat || !auth.currentUser) return;
  const plan = readCostPlanForm();
  if (plan.payingParticipants < 1) {
    setMessage(message, 'Indica almeno un partecipante che divide i costi: lo skipper è già escluso.', true);
    return;
  }
  if (plan.depositParticipants < 1) {
    setMessage(message, 'Indica almeno una persona che porta la cauzione rimborsabile.', true);
    return;
  }
  const model = costPlanQuoteModel(plan);
  const rateModeMessage = costPlanRateModeValidationMessage(model);
  if (rateModeMessage) {
    setMessage(message, rateModeMessage, true);
    return;
  }
  const fixedDinetteMessage = fixedDinetteConfigurationMessage(model);
  if (fixedDinetteMessage) {
    setMessage(message, fixedDinetteMessage, true);
    return;
  }
  const berthRoundingMessage = berthRoundingConfigurationMessage(model);
  if (berthRoundingMessage) {
    setMessage(message, berthRoundingMessage, true);
    return;
  }
  const submitButton = costPlanForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(message, 'Salvo il preventivo barca…');
  try {
    const boatId = activeBoat.id;
    const skipperId = auth.currentUser.uid;
    let savedContributionPlan = null;
    await runTransaction(db, async (transaction) => {
      const costPlanRef = doc(db, 'boats', boatId, 'costPlan', COST_PLAN_ID);
      const contributionPlanRef = doc(db, 'boats', boatId, 'contributionPlan', 'default');
      const latestContributionPlan = await transaction.get(contributionPlanRef);
      savedContributionPlan = contributionPlanForCostPlan(
        plan,
        latestContributionPlan.exists() ? latestContributionPlan.data() : null,
      );
      transaction.set(costPlanRef, {
        ...costPlanForStorage(plan),
        updatedAt: serverTimestamp(),
        updatedBy: skipperId,
      });
      transaction.set(contributionPlanRef, {
        ...contributionPlanForStorage(savedContributionPlan),
        updatedAt: serverTimestamp(),
        updatedBy: skipperId,
      });
    });
    activeCostPlan = normalizeCostPlan(plan);
    activeContributionPlan = savedContributionPlan;
    renderCostPlan(activeCostPlan);
    renderProjections();
    setMessage(message, 'Dashboard salvata: quote, Starter Pack e riepilogo per l’equipaggio sono stati aggiornati. Inviti già creati e accordi già fissati restano invariati.');
  } catch (error) {
    setMessage(message, getCostPlanSaveErrorMessage(error), true);
  } finally {
    submitButton.disabled = false;
  }
});

const contributionCatalogForm = document.querySelector('#contributionCatalogForm');
contributionCatalogForm.addEventListener('change', (event) => {
  const row = event.target.closest('[data-contribution-id]');
  if (row && event.target.matches('[data-contribution-state]')) syncContributionCatalogRow(row);
});

contributionCatalogForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#contributionCatalogMessage');
  if (blockPrivateAction(message)) return;
  if (!activeBoat || !auth.currentUser) return;
  const submitButton = contributionCatalogForm.querySelector('button[type="submit"]');
  const submittedPlan = readContributionPlanForm();
  submitButton.disabled = true;
  setMessage(message, 'Salvo la composizione delle quote…');
  try {
    const boatId = activeBoat.id;
    const skipperId = auth.currentUser.uid;
    const plan = await runTransaction(db, async (transaction) => {
      const contributionPlanRef = doc(db, 'boats', boatId, 'contributionPlan', 'default');
      const costPlanRef = doc(db, 'boats', boatId, 'costPlan', COST_PLAN_ID);
      const [latestContributionPlan, latestCostPlan] = await Promise.all([
        transaction.get(contributionPlanRef),
        transaction.get(costPlanRef),
      ]);
      // L'editor degli extra modifica solo le sue voci. Le quattro voci
      // automatiche vengono rilette dal preventivo corrente, così una scheda
      // rimasta aperta non può riportare indietro Starter Pack, assicurazione
      // o cauzione appena salvati dalla dashboard economica.
      const mergedPlan = contributionPlanWithEditedExtras(
        latestContributionPlan.exists() ? latestContributionPlan.data() : null,
        submittedPlan,
        latestCostPlan.exists() ? latestCostPlan.data() : null,
      );
      transaction.set(contributionPlanRef, {
        ...contributionPlanForStorage(mergedPlan),
        updatedAt: serverTimestamp(),
        updatedBy: skipperId,
      });
      return mergedPlan;
    });
    activeContributionPlan = plan;
    renderContributionCatalogForm();
    renderPaymentBerthOptions();
    renderSkipperDashboardOverview();
    setMessage(message, 'Composizione salvata. L’equipaggio vedrà solo voci, stato e eventuale importo: mai i tuoi dati di incasso.');
  } catch (error) {
    setMessage(message, getFirestoreErrorMessage(error, 'Non riesco a salvare la composizione delle quote.'), true);
  } finally {
    submitButton.disabled = false;
  }
});

const manualReceiptForm = document.querySelector('#manualReceiptForm');
manualReceiptForm.querySelector('[data-close-manual-receipt]').addEventListener('click', () => {
  manualReceiptForm.reset();
  document.querySelector('#manualReceiptPanel').hidden = true;
});
manualReceiptForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#manualReceiptMessage');
  if (blockPrivateAction(message) || !activeBoat || !auth.currentUser) return;
  const form = event.currentTarget;
  const recipientId = String(form.elements.recipientId.value || '');
  const projection = projectionForPaymentRecipient(recipientId);
  const amountCents = Math.round(Number(form.elements.amount.value) * 100);
  const receivedOn = String(form.elements.receivedOn.value || '');
  if (!projection || projection.contributesToCosts === false) {
    setMessage(message, 'Non trovo una quota personale a cui associare questo acconto.', true);
    return;
  }
  if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > 1_000_000) {
    setMessage(message, 'Inserisci un importo valido fino a 10.000 euro.', true);
    return;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(receivedOn)) {
    setMessage(message, 'Indica la data in cui hai ricevuto l’acconto.', true);
    return;
  }
  if (form.elements.verifiedBySkipper.checked !== true) {
    setMessage(message, 'Conferma di avere verificato personalmente il versamento.', true);
    return;
  }
  const allocation = manualReceiptAllocation(projection, form.elements.allocationTarget.value, amountCents);
  const collectorName = String(activePaymentProfile?.collectorName || auth.currentUser.displayName || 'Skipper').trim().slice(0, 100);
  const payment = {
    recipientId,
    memberId: recipientId,
    payerInviteId: recipientId,
    contributionItemId: allocation.berthCents > 0
      ? contributionItemIdForPaymentSelection(projection.berthType)
      : 'protection_insurance',
    amountCents,
    currency: 'EUR',
    reason: 'Acconto registrato',
    isOptional: false,
    accountingCategory: 'cost_recovery',
    dueDate: '',
    collectorId: auth.currentUser.uid,
    collectorName,
    paymentMethods: {},
    entryType: 'manual_receipt',
    installmentType: 'advance',
    allocation,
    receivedOn,
    status: 'verified',
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    verifiedAt: serverTimestamp(),
    verifiedBy: auth.currentUser.uid,
    cancelledAt: null,
    cancelledBy: null,
  };
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await addDoc(collection(db, 'boats', activeBoat.id, 'paymentRequests'), payment);
    form.reset();
    document.querySelector('#manualReceiptPanel').hidden = true;
    setMessage(document.querySelector('#projectionFormMessage'), `Acconto registrato per ${projection.displayName}. Il saldo si aggiorna solo perché l'accredito è stato verificato.`);
  } catch (error) {
    setMessage(message, getFirestoreErrorMessage(error, 'Non riesco a registrare questo acconto.'), true);
  } finally {
    submitButton.disabled = false;
  }
});

ensurePaymentAccountingCategoryField();
const paymentForm = document.querySelector('#paymentForm');
paymentForm.elements.recipientId.addEventListener('change', () => {
  // Un importo manuale appartiene alla persona precedente: non deve seguire
  // silenziosamente il nuovo destinatario soltanto perché si cambia select.
  paymentForm.elements.amount.value = '';
  paymentForm.elements.reason.value = '';
  delete paymentForm.elements.amount.dataset.autoBerthRate;
  delete paymentForm.elements.reason.dataset.autoBerthReason;
  delete paymentForm.elements.accountingCategory.dataset.autoCostRecovery;
  paymentForm.elements.accountingCategory.checked = false;
  renderPaymentBerthOptions();
  const assignedType = assignedPaymentTypes(paymentForm.elements.recipientId.value)[0];
  if (assignedType) paymentForm.elements.berthType.value = assignedType.id;
  applyPaymentBerthPreset();
  renderPaymentBalancePreview();
});
paymentForm.elements.berthType.addEventListener('change', () => {
  applyPaymentBerthPreset();
  renderPaymentBalancePreview();
});
paymentForm.elements.amount.addEventListener('input', () => {
  delete paymentForm.elements.amount.dataset.autoBerthRate;
});
paymentForm.elements.reason.addEventListener('input', () => {
  delete paymentForm.elements.reason.dataset.autoBerthReason;
});

paymentForm.addEventListener('submit', async (event) => {
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
  const selectedTypeId = String(fields.get('berthType') || 'custom');
  const allocation = coreAllocationForPaymentSelection(selectedTypeId, recipientId, amountCents);
  const payment = {
    recipientId,
    memberId: recipientId,
    payerInviteId: recipientId,
    contributionItemId: paymentContributionItemIdForSelection(selectedTypeId, recipientId),
    amountCents,
    currency: 'EUR',
    reason,
    isOptional: fields.get('isOptional') === 'on',
    accountingCategory: fields.get('accountingCategory') === 'cost_recovery' ? 'cost_recovery' : 'other',
    dueDate: String(fields.get('dueDate') || ''),
    collectorId: auth.currentUser.uid,
    collectorName,
    paymentMethods,
    entryType: 'request',
    installmentType: paymentInstallmentTypeForSelection(selectedTypeId, recipientId, amountCents),
    ...(allocation ? { allocation } : {}),
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
    delete form.elements.amount.dataset.autoBerthRate;
    delete form.elements.reason.dataset.autoBerthReason;
    delete form.elements.accountingCategory.dataset.autoCostRecovery;
    renderPaymentBerthOptions();
    renderPaymentBalancePreview();
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
      setMessage(document.querySelector('#paymentFormMessage'), 'Messaggio copiato con i dettagli privati dei metodi selezionati.');
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
    if (auth.currentUser?.uid !== user.uid) return;
    const isOrganizer = eventSnapshot.exists() && (eventSnapshot.data().organizerIds || []).includes(user.uid);
    document.querySelector('#accountStatus').textContent = isOrganizer ? 'Organizzatore configurato.' : 'Accesso skipper attivo. Per l’organizzatore: completa il documento iniziale nel README usando questo identificativo.';
  } catch (error) {
    if (auth.currentUser?.uid !== user.uid) return;
    document.querySelector('#accountStatus').textContent = 'Accesso skipper attivo.';
  }
  if (auth.currentUser?.uid !== user.uid) return;
  loadSkipperArea(user);
});

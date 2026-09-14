import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { getMissingCharterFields, isBoatReadyForPdf, isCharterReady, openCapitaneriaPdf } from './crew-pdf.js?v=20260913-berth-pricing1';
import { createCrewInviteIdentity, normalizeCrewPhone } from './crew-identity.js';
import { canUsePrivateArea, privateAreaBlockMessage } from './private-area-access.js?v=20260914-en2';
import { DEFAULT_CREW_ROLE, fillRoleFields, roleConfirmationText, roleFromFields } from './crew-roles.js?v=20260914-en2';

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
const COST_PLAN_ID = 'default';
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
  { id: 'starter_pack', label: 'Starter Pack · lenzuola/asciugamani, SUP e fuoribordo · solo contanti a bordo' },
  { id: 'linen_towels', label: 'Lenzuola e asciugamani · inclusi nello Starter Pack' },
  { id: 'protection_insurance', label: 'Assicurazione cauzione' },
  { id: 'provisions', label: 'Cambusa' },
  { id: 'fuel', label: 'Gasolio per la navigazione' },
  { id: 'transfer', label: 'Transfer da/per il porto' },
  { id: 'refundable_deposit', label: 'Cauzione rimborsabile' },
];
const AUTOMATIC_COST_PLAN_ITEM_IDS = new Set(['starter_pack', 'linen_towels', 'protection_insurance', 'refundable_deposit']);
const DINETTE_RATE_MODES = new Set(['percentage', 'fixed']);
const FREE_SUPPORT_ROLES = new Set(['co_skipper', 'hostess', 'collaborator']);
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
  'Spesa e cucina di bordo, extra, eventuali quote, cauzioni e condizioni del charter non sono stabiliti da questo regolamento generale: vengono comunicati separatamente dallo skipper della singola barca prima di qualsiasi richiesta. La conferma online attesta la lettura integrale di questo testo; non sostituisce il briefing pratico obbligatorio a bordo.',
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
  'Provisions, extras, any contributions, deposits and charter conditions are not set by these general rules. They are communicated separately by the skipper of each boat before any request is made. Online acceptance confirms that you have read this text in full; it does not replace the compulsory practical briefing on board.',
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
let creatingBoat = false;
let editingBoatId = null;
let editingMemberId = null;
let editingProjectionId = null;
let linkingLegacyInviteId = null;
const fleetPublicationInProgress = new Set();
let fleetAvailabilitySyncInProgress = false;
const SKIPPER_DASHBOARD_HASHES = Object.freeze({
  overview: 'skipper-panorama',
  crew: 'skipper-equipaggio',
  money: 'skipper-conti',
  boat: 'skipper-barca',
  board: 'skipper-bacheca',
});
const SKIPPER_DASHBOARD_LABELS = Object.freeze({
  overview: 'Panoramica',
  crew: 'Equipaggio',
  money: 'Quote e conti',
  boat: 'Barca e flotta',
  board: 'Briefing e bacheca',
});
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

function skipperDashboardViewFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  return Object.entries(SKIPPER_DASHBOARD_HASHES)
    .find(([, value]) => value === hash)?.[0] || 'overview';
}

function skipperDashboardIcon(kind) {
  const paths = {
    crew: '<path d="M8.5 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1.25a2.5 2.5 0 1 0 0-5"/><path d="M2.75 18.5a5.75 5.75 0 0 1 11.5 0M14.25 13.25a5 5 0 0 1 3 4.6"/>',
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
  setupPanel.content.append(paymentProfileForm, costPlanPanel, contributionCatalogPanel);
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
  const moneyPanel = document.querySelector('#paymentProfileForm')?.closest('.dashboard-panel');
  const boatPanel = document.querySelector('#fleetProfileForm')?.closest('.dashboard-panel');
  const boardPanel = document.querySelector('#briefingForm')?.closest('.dashboard-panel');
  if (!dashboard || !grid || !crewPanel || !moneyPanel || !boatPanel || !boardPanel) return;

  crewPanel.dataset.skipperPanel = 'crew';
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

  const costPlan = normalizeCostPlan(activeCostPlan);
  const targetCents = activeCostPlan ? costPlanTotalCents(costPlan) : 0;
  const verifiedCents = activePayments
    .filter((payment) => payment.status === 'verified' && paymentCountsTowardCostPlan(payment))
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const pendingPayments = activePayments.filter(isPendingPayment).length;
  const collectionMethods = availablePaymentMethods().length;
  setSkipperDashboardMetric(
    'money',
    targetCents ? `${formatCurrency(targetCents / 100)} da ripartire` : 'Quote da preparare',
    `${collectionMethods} metodi attivi · ${pendingPayments} richieste da verificare · ${formatCurrency(verifiedCents / 100)} verificati`,
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

  const currentAcceptanceCount = activeAcceptances.filter((acceptance) => acceptance.rulesVersion === (activeBriefing?.rulesVersion || 1)
    && (activeBriefing?.fullRulesRequired !== true || acceptance.fullRulesRead === true)).length;
  setSkipperDashboardMetric(
    'board',
    activeBriefing?.rulesText ? `Briefing v${activeBriefing.rulesVersion || 1} pubblicato` : 'Briefing da pubblicare',
    `${currentAcceptanceCount} conferme · ${skipperAnnouncementCount} comunicazioni pubblicate`,
  );

  renderSkipperFinanceOverview();
  const nextActionText = document.querySelector('#skipperNextActionText');
  const nextActionButton = document.querySelector('#skipperNextActionButton');
  if (!nextActionText || !nextActionButton) return;
  if (!activeBriefing?.rulesText) {
    nextActionText.textContent = 'Pubblica prima il briefing: è il passaggio che sblocca l’ingresso dell’equipaggio.';
    nextActionButton.textContent = 'Apri briefing';
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

function renderSkipperFinanceOverview() {
  const overview = document.querySelector('#skipperFinanceOverview');
  if (!overview) return;
  const plan = normalizeCostPlan(activeCostPlan);
  const model = activeCostPlan ? costPlanQuoteModel(plan) : null;
  const targetCents = model?.recoveryCents || 0;
  const verifiedCents = activePayments
    .filter((payment) => payment.status === 'verified' && paymentCountsTowardCostPlan(payment))
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const pendingCents = activePayments
    .filter((payment) => isPendingPayment(payment) && paymentCountsTowardCostPlan(payment))
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const projectedBerthCents = activeProjections
    .reduce((total, projection) => total + normalizedProjectionAmount(projection.berthCents), 0);
  const projectedInsuranceCents = activeProjections
    .reduce((total, projection) => total + normalizedProjectionAmount(projection.protectionInsuranceCents), 0);
  const projectedStarterPackCashCents = activeProjections
    .reduce((total, projection) => total + normalizedProjectionAmount(projection.starterPackCents), 0);
  const projectedDepositCashCents = activeProjections
    .reduce((total, projection) => total + normalizedProjectionAmount(projection.refundableDepositCents), 0);
  const projectedPayableCents = projectedBerthCents + projectedInsuranceCents;
  const recoveryValue = targetCents ? formatCurrency(targetCents / 100) : 'Da compilare';
  const recoveryDetail = !targetCents
    ? 'Solo charter e spese recuperabili dello skipper.'
    : verifiedCents > targetCents
      ? `${formatCurrency(verifiedCents / 100)} verificati · ${formatCurrency((verifiedCents - targetCents) / 100)} da riallocare.`
      : `${formatCurrency(verifiedCents / 100)} verificati · ${formatCurrency((targetCents - verifiedCents) / 100)} ancora da recuperare.${pendingCents ? ` ${formatCurrency(pendingCents / 100)} in attesa di verifica.` : ''}`;
  const fixedDinetteMessage = fixedDinetteConfigurationMessage(model);
  const cabinValue = fixedDinetteMessage
    ? 'Da correggere'
    : model?.standardBerthCents ? `${formatCurrency(model.standardBerthCents / 100)} a persona` : 'Da calcolare';
  const cabinDetail = fixedDinetteMessage
    ? fixedDinetteMessage
    : model?.standardBerthCents
      ? model.dinetteRateMode === 'fixed'
        ? `${model.standardPayingParticipants} quote cabina ricavate dal residuo · skipper escluso.`
        : `${model.standardPayingParticipants} quote cabina + ${model.dinettePayingParticipants} dinette al ${model.dinetteWeightPercent}% · skipper escluso.`
      : 'Inserisci i costi della barca e gli ospiti paganti per proporre la quota cabina.';
  const dinetteValue = fixedDinetteMessage
    ? 'Da correggere'
    : model?.dinettePayingParticipants && model?.dinetteBerthCents
      ? `${formatCurrency(model.dinetteBerthCents / 100)} a persona`
      : 'Non prevista';
  const dinetteDetail = fixedDinetteMessage
    ? fixedDinetteMessage
    : model?.dinettePayingParticipants
      ? model.dinetteRateMode === 'fixed'
        ? `Prezzo fisso · ${model.dinettePayingParticipants} ${model.dinettePayingParticipants === 1 ? 'posto' : 'posti'} nel preventivo.`
        : `${model.dinetteWeightPercent}% della quota cabina · ${model.dinettePayingParticipants} ${model.dinettePayingParticipants === 1 ? 'posto' : 'posti'} nel preventivo.`
      : 'La dinette non entra in questo preventivo.';
  const starterValue = model?.starterPackTotalCents
    ? `${formatCurrency(model.starterPackPerPersonCents / 100)} a persona`
    : 'Da definire';
  const insuranceValue = model?.protectionInsuranceTotalCents
    ? `${formatCurrency(model.protectionInsurancePerPersonCents / 100)} a persona`
    : 'Da definire';
  const depositValue = model?.refundableDepositTotalCents
    ? `${formatCurrency(model.refundableDepositPerPersonCents / 100)} a persona`
    : 'Da definire';
  const depositDetail = model?.refundableDepositTotalCents
    ? `Divisa tra ${model.depositParticipants} ${model.depositParticipants === 1 ? 'persona' : 'persone'}; separata, da portare in contanti e restituita secondo charter e skipper.`
    : 'Separata, da portare in contanti e restituita secondo charter e skipper.';
  const projectionValue = activeProjections.length
    ? `${formatCurrency(projectedPayableCents / 100)} previsti`
    : 'Nessuna previsione';
  const projectionDetail = activeProjections.length
    ? `${activeProjections.length} ${activeProjections.length === 1 ? 'posto riservato' : 'posti riservati'} · ${formatCurrency(projectedBerthCents / 100)} posti${projectedInsuranceCents ? ` · ${formatCurrency(projectedInsuranceCents / 100)} assicurazione` : ''}${projectedStarterPackCashCents ? ` · ${formatCurrency(projectedStarterPackCashCents / 100)} Starter Pack in contanti` : ''}${projectedDepositCashCents ? ` · ${formatCurrency(projectedDepositCashCents / 100)} cauzioni in contanti` : ''}. Non è un incasso.`
    : 'Aggiungi una persona nell’elenco provvisorio per stimare gli importi, senza inviare alcuna richiesta.';
  overview.innerHTML = `
    <div class="finance-overview-heading"><p class="eyebrow">I conti della barca</p><p>Il calcolo divide le spese reali tra chi partecipa ai costi. Il totale da recuperare è la tua “cassa skipper”; Starter Pack e cauzione si regolano in contanti a bordo. Il sito non trattiene denaro.</p></div>
    <div class="finance-overview-grid">
      <article class="finance-overview-card"><span>Totale da recuperare</span><strong>${escapeHtml(recoveryValue)}</strong><small>${escapeHtml(recoveryDetail)}</small></article>
      <article class="finance-overview-card"><span>Quota cabina calcolata</span><strong>${escapeHtml(cabinValue)}</strong><small>${escapeHtml(cabinDetail)}</small></article>
      <article class="finance-overview-card"><span>Quota dinette calcolata</span><strong>${escapeHtml(dinetteValue)}</strong><small>${escapeHtml(dinetteDetail)}</small></article>
      <article class="finance-overview-card finance-overview-card-projection"><span>Elenco provvisorio dell’equipaggio</span><strong>${escapeHtml(projectionValue)}</strong><small>${escapeHtml(projectionDetail)}</small></article>
      <article class="finance-overview-card finance-overview-card-extras"><span>Starter Pack · contanti a bordo</span><strong>${escapeHtml(starterValue)}</strong><small>Lenzuola e asciugamani, SUP e fuoribordo. Non appare nelle richieste WhatsApp.</small><strong>Assicurazione cauzione · ${escapeHtml(insuranceValue)}</strong><small>Separata dall’importo del posto; puoi richiederla con i metodi scelti.</small></article>
      <article class="finance-overview-card finance-overview-card-deposit"><span>Cauzione rimborsabile · contanti a bordo</span><strong>${escapeHtml(depositValue)}</strong><small>${escapeHtml(depositDetail)}</small></article>
    </div>
  `;
}

function setupBriefingEditor() {
  const form = document.querySelector('#briefingForm');
  const fullRules = form?.elements.rulesText;
  const fullRulesLabel = fullRules?.closest('label');
  if (!form || !fullRules || !fullRulesLabel || form.elements.rulesSummary || form.elements.rulesTextEn) return;

  const labelText = Array.from(fullRulesLabel.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (labelText) labelText.textContent = 'Regolamento completo obbligatorio';
  fullRules.maxLength = 9000;
  fullRules.defaultValue = DEFAULT_FULL_RULES;
  fullRules.value = DEFAULT_FULL_RULES;
  const fullRulesHint = fullRulesLabel.querySelector('.field-hint');
  if (fullRulesHint) fullRulesHint.textContent = 'Questo è il testo integrale che l’equipaggio deve leggere e scorrere prima dell’accettazione. Personalizza solo le indicazioni reali della barca, del charter e dello skipper.';

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
  hint.textContent = 'Questa sintesi orienta l’equipaggio, ma non sostituisce il regolamento completo sottostante.';
  summaryLabel.append('Sintesi da conoscere prima dell’accettazione', summary, hint);
  fullRulesLabel.before(summaryLabel);

  const englishDetails = document.createElement('details');
  englishDetails.className = 'briefing-translation-editor';
  const englishSummary = document.createElement('summary');
  englishSummary.textContent = 'Versione inglese ufficiale · necessaria per l’equipaggio non italofono';
  const englishLead = document.createElement('p');
  englishLead.className = 'panel-lead';
  englishLead.textContent = 'Questa è la versione che verrà letta e accettata in inglese. Verifica ogni modifica prima di pubblicarla: non viene generata o tradotta automaticamente dal sito.';
  const englishFields = document.createElement('div');
  englishFields.className = 'compact-form';

  const englishTitleLabel = document.createElement('label');
  const englishTitle = document.createElement('input');
  englishTitle.name = 'rulesTitleEn';
  englishTitle.maxLength = 120;
  englishTitle.value = 'Safety Briefing & Board Rules · Egadi 2026';
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

function defaultCostPlan() {
  const payingParticipants = Math.max(1, effectiveParticipantCapacity(activeBoat) || 1);
  return {
    charterCents: 0,
    skipperFlightTrainCents: 0,
    skipperCarCents: 0,
    skipperLocalTransferCents: 0,
    otherRecoverableCents: 0,
    starterPackTotalCents: 0,
    protectionInsuranceTotalCents: 0,
    refundableDepositTotalCents: 0,
    payingParticipants,
    depositParticipants: payingParticipants,
    dinettePayingParticipants: maximumDinettePayingParticipants(payingParticipants),
    dinetteRateMode: 'percentage',
    dinetteWeightPercent: 65,
    dinetteFixedCents: 0,
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
  return {
    charterCents: asNonNegativeInteger(plan?.charterCents, 1_000_000),
    skipperFlightTrainCents: asNonNegativeInteger(plan?.skipperFlightTrainCents, 1_000_000),
    skipperCarCents: asNonNegativeInteger(plan?.skipperCarCents, 1_000_000),
    skipperLocalTransferCents: asNonNegativeInteger(plan?.skipperLocalTransferCents, 1_000_000),
    otherRecoverableCents: asNonNegativeInteger(plan?.otherRecoverableCents, 1_000_000),
    starterPackTotalCents: asNonNegativeInteger(plan?.starterPackTotalCents, 1_000_000),
    protectionInsuranceTotalCents: asNonNegativeInteger(plan?.protectionInsuranceTotalCents, 1_000_000),
    refundableDepositTotalCents: asNonNegativeInteger(plan?.refundableDepositTotalCents, 1_000_000),
    payingParticipants: normalizedPayingParticipants,
    depositParticipants: depositParticipants || normalizedPayingParticipants,
    dinettePayingParticipants,
    dinetteRateMode: normalizeDinetteRateMode(plan?.dinetteRateMode),
    dinetteWeightPercent: normalizeDinetteWeightPercent(plan?.dinetteWeightPercent),
    dinetteFixedCents: asNonNegativeInteger(plan?.dinetteFixedCents, 1_000_000),
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

function costPlanQuoteModel(plan = activeCostPlan) {
  if (!plan) return null;
  const normalized = normalizeCostPlan(plan);
  const standardPayingParticipants = Math.max(0, normalized.payingParticipants - normalized.dinettePayingParticipants);
  const dinetteWeight = normalized.dinetteWeightPercent / 100;
  const recoveryCents = costPlanTotalCents(normalized);
  const usesFixedDinetteRate = normalized.dinetteRateMode === 'fixed';
  const fixedDinetteTotalCents = normalized.dinetteFixedCents * normalized.dinettePayingParticipants;
  const fixedDinetteError = usesFixedDinetteRate && (
    normalized.dinettePayingParticipants < 1
    || standardPayingParticipants < 1
    || normalized.dinetteFixedCents < 1
    || fixedDinetteTotalCents >= recoveryCents
  );
  const weightedUnits = standardPayingParticipants + (normalized.dinettePayingParticipants * dinetteWeight);
  const standardBerthCents = recoveryCents > 0 && !fixedDinetteError
    ? usesFixedDinetteRate
      ? Math.round((recoveryCents - fixedDinetteTotalCents) / standardPayingParticipants)
      : weightedUnits > 0
        ? Math.round(recoveryCents / weightedUnits)
        : 0
    : 0;
  const dinetteBerthCents = !fixedDinetteError
    ? usesFixedDinetteRate
      ? normalized.dinetteFixedCents
      : standardBerthCents > 0
        ? Math.round(standardBerthCents * dinetteWeight)
        : 0
    : 0;
  const allocatedRecoveryCents = (standardBerthCents * standardPayingParticipants)
    + (dinetteBerthCents * normalized.dinettePayingParticipants);
  const divideEvenly = (totalCents, participants = normalized.payingParticipants) => totalCents > 0 && participants > 0
    ? Math.round(totalCents / participants)
    : 0;
  return {
    ...normalized,
    recoveryCents,
    standardPayingParticipants,
    weightedUnits,
    fixedDinetteTotalCents,
    fixedDinetteError,
    standardBerthCents,
    dinetteBerthCents,
    allocatedRecoveryCents,
    roundingDeltaCents: allocatedRecoveryCents - recoveryCents,
    starterPackPerPersonCents: divideEvenly(normalized.starterPackTotalCents),
    protectionInsurancePerPersonCents: divideEvenly(normalized.protectionInsuranceTotalCents),
    refundableDepositPerPersonCents: divideEvenly(normalized.refundableDepositTotalCents, normalized.depositParticipants),
  };
}

function fixedDinetteConfigurationMessage(model) {
  if (!model?.fixedDinetteError) return '';
  if (model.dinettePayingParticipants < 1) return 'Per usare un prezzo fisso, indica almeno un posto dinette pagante.';
  if (model.standardPayingParticipants < 1) return 'Con il prezzo fisso serve almeno un ospite in cabina: altrimenti non c’è una quota cabina da ricavare.';
  if (model.dinetteFixedCents < 1) return 'Inserisci un prezzo fisso della dinette maggiore di zero.';
  return 'Il totale delle dinette lascerebbe la cabina gratuita: riduci il prezzo dinette oppure aumenta i costi della barca.';
}

function costPlanBaseContribution(plan = activeCostPlan) {
  const model = costPlanQuoteModel(plan);
  if (!model || !model.standardBerthCents) return null;
  return {
    id: 'cost:base',
    label: 'Quota cabina calcolata · recupero costi',
    cents: model.standardBerthCents,
    defaultReason: 'Quota cabina · recupero costi barca e skipper',
    accountingCategory: 'cost_recovery',
  };
}

function costPlanContributionTypes(plan = activeCostPlan) {
  const model = costPlanQuoteModel(plan);
  if (!model) return [];
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
  if (!model) return null;
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

function normalizeContributionPlan(plan = {}) {
  const sourceItems = plan?.items && typeof plan.items === 'object' ? plan.items : {};
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
    return [item.id, { state, amountCents }];
  }));
  return { items };
}

function contributionCatalog(plan = activeContributionPlan) {
  const normalized = normalizeContributionPlan(plan);
  const model = costPlanQuoteModel();
  return DEFAULT_CONTRIBUTION_ITEMS.map((item) => {
    const value = { ...item, ...normalized.items[item.id] };
    if (item.id === 'starter_pack') {
      return { ...value, state: 'local', amountCents: model ? model.starterPackPerPersonCents : value.amountCents };
    }
    if (item.id === 'linen_towels') return { ...value, state: 'included', amountCents: 0 };
    if (item.id === 'protection_insurance') {
      return model ? { ...value, state: 'extra', amountCents: model.protectionInsurancePerPersonCents } : value;
    }
    if (item.id === 'refundable_deposit') {
      return { ...value, state: 'local', amountCents: model ? model.refundableDepositPerPersonCents : value.amountCents };
    }
    return value;
  });
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

function paymentCountsTowardCostPlan(payment) {
  return payment.accountingCategory === 'cost_recovery';
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
  form.elements.starterPackTotal.value = euroInputValue(normalized.starterPackTotalCents);
  form.elements.protectionInsuranceTotal.value = euroInputValue(normalized.protectionInsuranceTotalCents);
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
  syncCostPlanDinetteFieldAvailability();
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
  return {
    charterCents: toEuroCents(form?.elements.charterCost?.value),
    skipperFlightTrainCents: toEuroCents(form?.elements.skipperFlightTrainCost?.value),
    skipperCarCents: toEuroCents(form?.elements.skipperCarCost?.value),
    skipperLocalTransferCents: toEuroCents(form?.elements.skipperLocalTransferCost?.value),
    otherRecoverableCents: toEuroCents(form?.elements.otherRecoverableCost?.value),
    starterPackTotalCents: toEuroCents(form?.elements.starterPackTotal?.value),
    protectionInsuranceTotalCents: toEuroCents(form?.elements.protectionInsuranceTotal?.value),
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
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const pendingCents = activePayments
    .filter((payment) => isPendingPayment(payment) && paymentCountsTowardCostPlan(payment))
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const legacyVerifiedCount = activePayments
    .filter((payment) => payment.status === 'verified' && !payment.accountingCategory)
    .length;
  const legacyNote = legacyVerifiedCount
    ? ` ${legacyVerifiedCount} ${legacyVerifiedCount === 1 ? 'accredito verificato precedente non è classificato' : 'accrediti verificati precedenti non sono classificati'} e resta fuori dal bilancio.`
    : '';
  const hasAnyTotal = totalCents > 0
    || model.starterPackTotalCents > 0
    || model.protectionInsuranceTotalCents > 0
    || model.refundableDepositTotalCents > 0
    || model.dinetteFixedCents > 0;
  if (!hasAnyTotal) {
    summary.textContent = `Inserisci i totali della barca. Lo skipper è escluso; al momento il calcolo divide per ${model.payingParticipants} ${model.payingParticipants === 1 ? 'ospite pagante' : 'ospiti paganti'}. La dinette, se presente, usa ${model.dinetteWeightPercent}% dell’importo cabina. Contributi verificati per le spese della barca: ${formatCurrency(verifiedCents / 100)}${pendingCents ? ` · ancora da verificare: ${formatCurrency(pendingCents / 100)}` : ''}.${legacyNote}`;
    return;
  }
  const balanceCents = verifiedCents - totalCents;
  const balance = balanceCents === 0
    ? 'Pareggio raggiunto con gli accrediti verificati.'
    : balanceCents > 0
      ? `Avanzo da riallocare: ${formatCurrency(balanceCents / 100)}. Non è un guadagno automatico.`
      : `Da recuperare: ${formatCurrency(Math.abs(balanceCents / 100))}.`;
  const fixedDinetteMessage = fixedDinetteConfigurationMessage(model);
  if (fixedDinetteMessage) {
    summary.textContent = `${fixedDinetteMessage} Nessuna quota automatica viene proposta finché il preventivo non torna coerente.`;
    return;
  }
  const berthFormula = model.dinettePayingParticipants > 0
    ? model.dinetteRateMode === 'fixed'
      ? `${model.standardPayingParticipants} quote cabina ricavate dal residuo dopo ${model.dinettePayingParticipants} dinette a ${formatCurrency(model.dinetteFixedCents / 100)}`
      : `${model.standardPayingParticipants} quote cabina + ${model.dinettePayingParticipants} dinette al ${model.dinetteWeightPercent}% = ${model.weightedUnits.toFixed(2).replace('.', ',')} quote equivalenti`
    : `${model.standardPayingParticipants} quote cabina`;
  const berthSummary = totalCents > 0
    ? `Totale da recuperare: ${formatCurrency(totalCents / 100)} su ${berthFormula}. Quota cabina standard: ${formatCurrency(model.standardBerthCents / 100)}; quota dinette: ${model.dinettePayingParticipants > 0 ? formatCurrency(model.dinetteBerthCents / 100) : 'non prevista'}.`
    : 'Nessun costo barca o skipper da recuperare nel preventivo.';
  const insuranceSummary = model.protectionInsuranceTotalCents > 0
    ? ` Assicurazione: ${formatCurrency(model.protectionInsurancePerPersonCents / 100)} per ospite pagante, separata e richiedibile.`
    : ' Assicurazione: da definire.';
  const starterSummary = model.starterPackTotalCents > 0
    ? ` Starter Pack: ${formatCurrency(model.starterPackPerPersonCents / 100)} per ospite pagante, solo contanti a bordo.`
    : ' Starter Pack: da definire, solo contanti a bordo.';
  const depositSummary = model.refundableDepositTotalCents > 0
    ? ` Cauzione rimborsabile: ${formatCurrency(model.refundableDepositPerPersonCents / 100)} per ${model.depositParticipants} ${model.depositParticipants === 1 ? 'persona' : 'persone'}, in contanti all’imbarco.`
    : ' Cauzione rimborsabile: da definire, separata e da regolare all’imbarco.';
  const roundedRecoveryNote = model.roundingDeltaCents
    ? ` Arrotondamento tecnico delle quote: ${model.roundingDeltaCents > 0 ? '+' : ''}${formatCurrency(model.roundingDeltaCents / 100)} da riallocare.`
    : '';
  const projectedDinetteCount = activeProjections
    .filter((projection) => projection.contributesToCosts !== false && projection.berthType === 'dinette')
    .length;
  const projectedPayingCount = activeProjections
    .filter((projection) => projection.contributesToCosts !== false)
    .length;
  const projectedDepositCount = activeProjections
    .filter((projection) => normalizedProjectionAmount(projection.refundableDepositCents) > 0)
    .length;
  const contributorProjectionNote = activeProjections.length && projectedPayingCount !== model.payingParticipants
    ? ` Nota: il calcolo divide per ${model.payingParticipants} ospiti paganti; nell’elenco provvisorio ce ne sono finora ${projectedPayingCount}. Aggiorna il numero quando la composizione è definita.`
    : '';
  const dinetteProjectionNote = activeProjections.length && projectedDinetteCount !== model.dinettePayingParticipants
    ? ` Attenzione: nel calcolo risultano ${model.dinettePayingParticipants} ${model.dinettePayingParticipants === 1 ? 'posto dinette pagante' : 'posti dinette paganti'}, mentre nell’elenco provvisorio ce ne sono ${projectedDinetteCount}; aggiorna il numero quando la composizione è definita.`
    : '';
  const depositProjectionNote = activeProjections.length && projectedDepositCount !== model.depositParticipants
    ? ` Nota: la cauzione è divisa per ${model.depositParticipants} ${model.depositParticipants === 1 ? 'persona' : 'persone'}, mentre nell’elenco provvisorio ce ne sono ${projectedDepositCount} con cauzione prevista; aggiorna il numero quando la composizione è definita.`
    : '';
  summary.textContent = `${berthSummary}${insuranceSummary}${starterSummary}${depositSummary} Contributi verificati per le spese della barca: ${formatCurrency(verifiedCents / 100)}${pendingCents ? ` · ${formatCurrency(pendingCents / 100)} in attesa di verifica` : ''}. Bilancio delle spese della barca: ${balance}${roundedRecoveryNote}${contributorProjectionNote}${dinetteProjectionNote}${depositProjectionNote}${legacyNote}`;
}

function renderCostPlan(plan) {
  activeCostPlan = plan ? normalizeCostPlan(plan) : null;
  fillCostPlanForm(activeCostPlan);
  renderCostPlanSummary();
  renderContributionCatalogForm();
  renderPaymentBerthOptions();
  applyProjectionBerthPreset();
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

function paymentWhatsappMessage(payment, { messageDetails = '', profile = activePaymentProfile } = {}) {
  const recipientId = payment.recipientId || payment.memberId || payment.payerInviteId;
  const locale = inviteLocale(inviteForRecipient(recipientId));
  const amount = formatCurrency(paymentAmount(payment), locale);
  const reason = payment.reason || (locale === 'en' ? 'your weekend contribution' : 'il contributo del weekend');
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
    ? `Hi ${recipientName(recipientId)} 🌊\n\nFor ${reason}, the contribution is ${amount}.${dueDate}${methodText}${detailsText}\n\nThe website does not receive payments. Once you have paid, please message me here so I can check the actual transfer. Thank you! ⛵`
    : `Ciao ${recipientName(recipientId)} 🌊\n\nPer ${reason}, il contributo è di ${amount}.${dueDate}${methodText}${detailsText}\n\nIl sito non riceve denaro: dopo il contributo avvisami qui, così controllo l’accredito reale. Grazie! ⛵`;
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
  batch.update(doc(db, 'boats', activeBoat.id, 'crewProjections', projection.id), {
    status: 'invited',
    inviteId: invite.id,
    invitedAt: serverTimestamp(),
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

function contributionStateOptions(item) {
  if (item.id === 'starter_pack') return '<option value="local" selected>Solo contanti a bordo</option>';
  if (item.id === 'linen_towels') return '<option value="included" selected>Compreso nello Starter Pack</option>';
  if (item.id === 'refundable_deposit') return '<option value="local" selected>Contanti all’imbarco</option>';
  return [...CONTRIBUTION_ITEM_STATES.entries()]
    .map(([value, label]) => `<option value="${value}"${value === item.state ? ' selected' : ''}>${label}</option>`)
    .join('');
}

function contributionCatalogRow(item) {
  const automatic = AUTOMATIC_COST_PLAN_ITEM_IDS.has(item.id);
  const stateHint = item.id === 'starter_pack'
    ? '<small>Gestito dal Preventivo barca: lenzuola e asciugamani, SUP e fuoribordo. Solo contanti a bordo; non crea richieste WhatsApp.</small>'
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
  rows.innerHTML = items.map(contributionCatalogRow).join('');
  rows.querySelectorAll('[data-contribution-id]').forEach(syncContributionCatalogRow);
}

function readContributionPlanForm() {
  const rows = [...document.querySelectorAll('#contributionCatalogRows [data-contribution-id]')];
  return normalizeContributionPlan({
    items: Object.fromEntries(rows.map((row) => [row.dataset.contributionId, {
      state: row.querySelector('[data-contribution-state]')?.value,
      amountCents: toEuroCents(row.querySelector('[data-contribution-amount]')?.value),
    }])),
  });
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
  if (typeId === 'cost:base') return 'berth_base';
  if (typeId === 'cost:dinette') return 'berth_dinette';
  if (typeId === 'cost:protection_insurance') return 'protection_insurance';
  if (typeof typeId === 'string' && typeId.startsWith('extra:')) {
    const itemId = typeId.slice('extra:'.length);
    return PAYMENT_CONTRIBUTION_ITEM_IDS.has(itemId) && !AUTOMATIC_COST_PLAN_ITEM_IDS.has(itemId) ? itemId : 'other';
  }
  return 'other';
}

function paymentContributionItemLabel(payment) {
  return PAYMENT_CONTRIBUTION_ITEM_LABELS[payment?.contributionItemId] || '';
}

function renderPaymentBerthOptions() {
  const select = document.querySelector('#paymentBerthType');
  if (!select) return;
  const selectedType = select.value || 'custom';
  const totals = berthLayoutTotals(activeBoat?.berthLayout);
  const rates = normalizeBerthRates(activeBoat?.berthRates);
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
    ? `<optgroup label="Preventivo automatico dalla Dashboard">${calculatedOptions.map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)} · ${formatCurrency(type.cents / 100)} a persona</option>`).join('')}</optgroup>`
    : '';
  select.innerHTML = '<option value="custom">Importo libero / altra voce</option>'
    + calculatedOption
    + (berthOptions ? `<optgroup label="Listino barca manuale">${berthOptions}</optgroup>` : '')
    + (extraOptions ? `<optgroup label="Voci da richiedere a parte">${extraOptions}</optgroup>` : '');
  select.value = (berthRateType(selectedType) || extraContributionType(selectedType) || costPlanContributionType(selectedType)) && [...select.options].some((option) => option.value === selectedType)
    ? selectedType
    : 'custom';
}

function applyPaymentBerthPreset() {
  const form = document.querySelector('#paymentForm');
  if (!form || !activeBoat) return;
  const selectedType = form.elements.berthType?.value;
  const berthType = berthRateType(selectedType);
  const extraType = extraContributionType(selectedType);
  const costPlanType = costPlanContributionType(selectedType);
  if (!berthType && !extraType && !costPlanType) return;
  const amount = form.elements.amount;
  const reason = form.elements.reason;
  let cents = 0;
  let defaultReason = '';
  if (berthType) {
    const totals = berthLayoutTotals(activeBoat.berthLayout);
    if (berthType.count(totals) < 1) return;
    cents = normalizeBerthRates(activeBoat.berthRates)[berthType.rateKey];
    defaultReason = berthType.defaultReason;
  } else if (extraType) {
    cents = extraType.cents;
    defaultReason = extraType.defaultReason;
  } else {
    cents = costPlanType.cents;
    defaultReason = costPlanType.defaultReason;
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
  if (costPlanType && accountingCategory) {
    const shouldRecoverCosts = costPlanType.accountingCategory === 'cost_recovery';
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
  const normalized = normalizeProjection(projection.id, projection);
  return normalized.berthCents + normalized.protectionInsuranceCents;
}

function projectionCostBreakdown(projection) {
  const normalized = normalizeProjection(projection.id, projection);
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
  const starter = summary.starterPackCents > 0
    ? ` · Starter Pack ${formatCurrency(summary.starterPackCents / 100)} in contanti a bordo`
    : ' · Starter Pack in contanti a bordo da definire';
  return `${parts} · Totale richiesta prevista ${total}${starter}`;
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
    ? `Riepilogo equipaggio: ${formatCurrency(payableCents / 100)} previsti`
    : 'Riepilogo equipaggio: importi da definire';
  const detail = document.createElement('span');
  detail.className = 'projection-summary-detail';
  detail.textContent = `${activeProjections.length} ${activeProjections.length === 1 ? 'posto riservato' : 'posti riservati'} · ${invitationReady} ${invitationReady === 1 ? 'invito da creare' : 'inviti da creare'}${invited ? ` · ${invited} ${invited === 1 ? 'link già creato' : 'link già creati'}` : ''}${historicalInvites ? ` · ${historicalInvites} ${historicalInvites === 1 ? 'scheda da completare' : 'schede da completare'}` : ''}.`;
  const note = document.createElement('small');
  note.className = 'projection-summary-note';
  const starterPackNote = starterPackCashCents > 0
    ? `Starter Pack previsti: ${formatCurrency(starterPackCashCents / 100)}, solo contanti a bordo.`
    : 'Starter Pack solo contanti a bordo.';
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
  if (form.elements.contributesToCosts?.checked !== true) {
    const deposit = projectionPreviewItem(form, 'refundableDepositAmount', 'Cauzione rimborsabile');
    const depositText = deposit.defined
      ? ` Cauzione rimborsabile: ${formatCurrency(deposit.cents / 100)}, separata e da regolare all’imbarco.`
      : ' Cauzione rimborsabile: da definire, separata e da regolare all’imbarco.';
    preview.textContent = `Persona esente da quota posto, Starter Pack e assicurazione.${depositText} Non crea una richiesta o un pagamento.`;
    return;
  }
  const payableItems = [
    projectionPreviewItem(form, 'berthAmount', 'Posto/cabina'),
    projectionPreviewItem(form, 'protectionInsuranceAmount', 'Assicurazione'),
  ];
  const starterPack = projectionPreviewItem(form, 'starterPackAmount', 'Starter Pack');
  const deposit = projectionPreviewItem(form, 'refundableDepositAmount', 'Cauzione rimborsabile');
  const payableCents = payableItems.reduce((total, item) => total + item.cents, 0);
  const missing = payableItems.filter((item) => !item.defined).map((item) => item.label);
  const details = payableItems.map((item) => `${item.label}: ${item.defined ? formatCurrency(item.cents / 100) : 'da definire'}`).join(' · ');
  const total = missing.length
    ? `Richiesta prevista finora: ${formatCurrency(payableCents / 100)}`
    : `Richiesta prevista: ${formatCurrency(payableCents / 100)}`;
  const missingText = missing.length ? ` · Da definire: ${missing.join(', ')}.` : '.';
  const depositText = deposit.defined
    ? ` Cauzione rimborsabile: ${formatCurrency(deposit.cents / 100)}, separata e da regolare all’imbarco.`
    : ' Cauzione rimborsabile: da definire, separata e da regolare all’imbarco.';
  const starterPackText = starterPack.defined
    ? ` Starter Pack: ${formatCurrency(starterPack.cents / 100)}, solo contanti a bordo.`
    : ' Starter Pack: da definire, solo contanti a bordo.';
  preview.textContent = `${total} (${details})${missingText}${starterPackText}${depositText} Non crea una richiesta o un pagamento.`;
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
  form.elements.preferredLocale.disabled = false;
  setProjectionIdentityFieldsLocked(false);
  form.reset();
  delete form.elements.contributesToCosts.dataset.userChoice;
  syncProjectionCostParticipation();
  editingProjectionId = null;
  linkingLegacyInviteId = null;
  document.querySelector('#projectionSubmitButton').textContent = 'Salva la scheda e riserva il posto';
  document.querySelector('#cancelProjectionEdit').hidden = true;
  document.querySelector('#cancelProjectionEdit').textContent = 'Annulla modifica';
  const legacyLinkHint = document.querySelector('#projectionLegacyLinkHint');
  if (legacyLinkHint) {
    legacyLinkHint.hidden = true;
    legacyLinkHint.textContent = '';
  }
  syncProjectionCabinGroupField();
  renderProjectionCostPreview();
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
  if (!invite) {
    actions.push(projectionActionButton('send-projection', projection.id, `Crea invito WhatsApp per ${projection.displayName}`, '↗', 'primary'));
    actions.push(projectionActionButton('release-projection', projection.id, `Libera il posto di ${projection.displayName}`, '×', 'release'));
    return actions.join('');
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
  return `<article class="projection-row projection-card"><div class="projection-row-person"><strong>${escapeHtml(projection.displayName)}</strong><span class="projection-row-assignment">${assignment}</span><small>${escapeHtml(projectionStatusLabel(projection))}</small>${projectionCabinControl(projection)}</div><div class="projection-row-cost"><span class="projection-row-cost-label">Importo previsto · non è un pagamento</span><strong>${escapeHtml(total)}</strong><span class="projection-row-cost-breakdown">${escapeHtml(quote)}</span><span class="projection-row-deposit"><b>Starter Pack:</b> ${escapeHtml(starterPack)}</span><span class="projection-row-deposit"><b>Cauzione rimborsabile:</b> ${escapeHtml(deposit)}</span></div><div class="projection-actions" role="group" aria-label="Azioni per ${escapeHtml(projection.displayName)}">${projectionCardActions(projection, invite)}</div></article>`;
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

function renderProjections() {
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
  void syncPublicFleetAvailabilityFromCrew();
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
    renderSkipperDashboardOverview();
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
    const accountingTag = paymentCountsTowardCostPlan(payment)
      ? '<span class="payment-accounting-tag">Spese della barca</span>'
      : '';
    const contributionLabel = paymentContributionItemLabel(payment);
    const contributionTag = contributionLabel
      ? `<span class="payment-contribution-tag">${escapeHtml(contributionLabel)}</span>`
      : '';
    return `<article class="payment-row"><div><strong>${escapeHtml(name)} · ${amount}</strong><span>${escapeHtml(reason)}${escapeHtml(dueDate)}</span>${contributionTag}${accountingTag}${methods}${legacyInstructions}</div><div class="payment-action"><span class="payment-status">${escapeHtml(status)}</span>${paymentMessageAction}<button class="text-button" type="button" data-copy-payment="${escapeHtml(payment.id)}">Copia messaggio</button>${inviteAction}${statusActions}</div></article>`;
  }).join('');
  renderCostPlanSummary();
  renderSkipperDashboardOverview();
}

function renderBriefingForm() {
  const form = document.querySelector('#briefingForm');
  if (!activeBriefing || form.dataset.editing === 'true') return;
  for (const [field, value] of Object.entries(activeBriefing)) {
    const input = form.elements.namedItem(field);
    if (!input) continue;
    input.value = input.type === 'datetime-local' ? toDateTimeLocal(value) : value || '';
  }
  if (typeof activeBriefing.rulesSummary !== 'string' || !activeBriefing.rulesSummary.trim()) {
    form.elements.rulesSummary.value = DEFAULT_RULES_SUMMARY;
  }
  form.dataset.loadedVersion = String(activeBriefing.rulesVersion || 1);
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
    status.textContent = 'Pubblica il briefing obbligatorio per attivare l’ingresso dell’equipaggio nella propria area.';
    renderSkipperDashboardOverview();
    return;
  }
  const version = activeBriefing.rulesVersion || 1;
  const accepted = activeAcceptances.filter((item) => item.rulesVersion === version
    && (activeBriefing.fullRulesRequired !== true || item.fullRulesRead === true)).length;
  const hasOfficialEnglish = hasOfficialEnglishBriefing();
  status.textContent = `Briefing di sicurezza versione ${version} pubblicato. ${accepted} ${accepted === 1 ? 'persona ha' : 'persone hanno'} completato l’accettazione.${hasOfficialEnglish ? ' Versione inglese ufficiale disponibile.' : ' Versione inglese ufficiale non ancora pubblicata.'}`;
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
  activeBoat = boat;
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
  // autorizzare in base a una Rule proprietaria per singolo documento.
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

function projectionDraftFromFields(fields, id) {
  const firstName = String(fields.get('firstName') || '').trim();
  const lastName = String(fields.get('lastName') || '').trim();
  const berthType = PROJECTION_BERTH_TYPES[fields.get('berthType')] ? fields.get('berthType') : 'to_define';
  return {
    id,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    whatsappNumber: `+${normalizeWhatsAppNumber(fields.get('whatsappNumber'))}`,
    plannedRole: roleFromFields(fields, 'projectionRole'),
    berthType,
    cabinGroupId: berthType === 'double_cabin' ? normalizeCabinGroupId(fields.get('cabinGroupId')) : '',
    berthCents: toEuroCents(fields.get('berthAmount')),
    starterPackCents: toEuroCents(fields.get('starterPackAmount')),
    protectionInsuranceCents: toEuroCents(fields.get('protectionInsuranceAmount')),
    refundableDepositCents: toEuroCents(fields.get('refundableDepositAmount')),
    preferredLocale: fields.get('preferredLocale') === 'en' ? 'en' : 'it',
    contributesToCosts: fields.get('contributesToCosts') === 'on',
    contactConsent: fields.get('contactConsent') === 'on',
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
    preferredLocale: inviteLocale(invite),
    contributesToCosts: true,
    contactConsent: false,
  };
}

function prepareLegacyInviteProjection(invite) {
  const form = document.querySelector('#projectionForm');
  if (!form) return;
  resetProjectionForm();
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
  form.elements.firstName.value = projection.firstName;
  form.elements.lastName.value = projection.lastName;
  form.elements.whatsappNumber.value = projection.whatsappNumber;
  fillRoleFields(form, 'projectionRole', projection.plannedRole);
  form.elements.berthType.value = projection.berthType;
  form.elements.cabinGroupId.value = projection.cabinGroupId || '';
  form.elements.berthAmount.value = euroInputValue(projection.berthCents);
  form.elements.starterPackAmount.value = euroInputValue(projection.starterPackCents);
  form.elements.protectionInsuranceAmount.value = euroInputValue(projection.protectionInsuranceCents);
  form.elements.refundableDepositAmount.value = euroInputValue(projection.refundableDepositCents);
  form.elements.preferredLocale.value = projection.preferredLocale === 'en' ? 'en' : 'it';
  form.elements.contributesToCosts.checked = projection.contributesToCosts !== false;
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

function syncProjectionCostParticipation() {
  const form = document.querySelector('#projectionForm');
  if (!form) return;
  const contributesToCosts = form.elements.contributesToCosts?.checked === true;
  const contributionHint = document.querySelector('#projectionContributionHint');
  const automaticFields = [
    ['berthAmount', 'autoProjectionRate'],
    ['starterPackAmount', 'autoStarterPackRate'],
    ['protectionInsuranceAmount', 'autoProtectionInsuranceRate'],
  ];
  automaticFields.forEach(([fieldName, dataKey]) => {
    const input = form.elements[fieldName];
    if (!input) return;
    input.disabled = !contributesToCosts;
    if (!contributesToCosts) {
      input.value = '';
      delete input.dataset[dataKey];
    }
  });
  const depositInput = form.elements.refundableDepositAmount;
  if (depositInput) depositInput.disabled = false;
  if (contributionHint) {
    contributionHint.textContent = contributesToCosts
      ? 'Questa persona partecipa alle quote: il preventivo può proporre importi modificabili.'
      : 'Questa persona è esente da quota posto, Starter Pack e assicurazione. La cauzione rimborsabile resta separata e può essere prevista.';
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
  if (form.elements.contributesToCosts?.checked !== true) {
    const model = costPlanQuoteModel();
    applyProjectionCalculatedAmount(
      form.elements.refundableDepositAmount,
      model?.refundableDepositPerPersonCents || 0,
      'autoRefundableDepositRate',
    );
    syncProjectionCostParticipation();
    return;
  }
  const type = berthRateType(form.elements.berthType?.value);
  if (!type) {
    renderProjectionCostPreview();
    return;
  }
  const calculated = costPlanProjectionPreset(type.id);
  const cents = calculated?.berthCents || normalizeBerthRates(activeBoat.berthRates)[type.rateKey];
  applyProjectionCalculatedAmount(form.elements.berthAmount, cents, 'autoProjectionRate');
  if (calculated) {
    applyProjectionCalculatedAmount(form.elements.starterPackAmount, calculated.starterPackCents, 'autoStarterPackRate');
    applyProjectionCalculatedAmount(form.elements.protectionInsuranceAmount, calculated.protectionInsuranceCents, 'autoProtectionInsuranceRate');
    applyProjectionCalculatedAmount(form.elements.refundableDepositAmount, calculated.refundableDepositCents, 'autoRefundableDepositRate');
  }
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
  const projection = projectionDraftFromFields(fields, projectionId);
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
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    if (editingProjectionId) {
      await updateDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projectionId), {
        ...projection,
        status: editingProjection.status,
        inviteId: editingProjection.inviteId || null,
        invitedAt: editingProjection.invitedAt || null,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });
      setMessage(message, existingInvite
        ? 'Scheda aggiornata: il link personale e lo stato di accesso restano invariati.'
        : 'Scheda aggiornata: posto, ruolo, sistemazione e importo previsto restano associati alla stessa persona.');
    } else if (legacyInvite) {
      await setDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projectionId), {
        ...projection,
        status: 'invited',
        inviteId: legacyInvite.id,
        invitedAt: legacyInvite.createdAt,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });
      setMessage(message, `Scheda equipaggio salvata per ${legacyInvite.displayName}: usa lo stesso ID dell’invito esistente, che non è stato creato, revocato o modificato.`);
    } else {
      await setDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projectionId), {
        ...projection,
        status: 'projected',
        inviteId: null,
        invitedAt: null,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });
      setMessage(message, 'Scheda salvata: controlla il riepilogo accanto alla persona e, quando vuoi, crea l’invito WhatsApp dalla stessa riga.');
    }
    resetProjectionForm();
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
document.querySelector('#cancelProjectionEdit').addEventListener('click', resetProjectionForm);

document.querySelector('#projectionList').addEventListener('click', async (event) => {
  const message = document.querySelector('#projectionFormMessage');
  if (blockPrivateAction(message) || !activeBoat || !auth.currentUser) return;
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
    fillProjectionForm(projection);
    editingProjectionId = projection.id;
    setProjectionIdentityFieldsLocked(Boolean(invite));
    if (invite) projectionForm.elements.preferredLocale.disabled = true;
    syncProjectionCabinGroupField();
    document.querySelector('#projectionSubmitButton').textContent = 'Salva la scheda';
    document.querySelector('#cancelProjectionEdit').hidden = false;
    setMessage(message, invite
      ? 'Puoi aggiornare ruolo, sistemazione, cabina e importi. Nome, WhatsApp, lingua e link personale restano invariati.'
      : 'Modifica posto, ruolo, sistemazione, cabina e importo previsto, poi salva.');
    projectionForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    // Le schede precedenti al flag V2 non possono aggiungere solo la cabina:
    // nella stessa scrittura fissiamo il valore equivalente al comportamento storico.
    await updateDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projection.id), {
      cabinGroupId,
      contributesToCosts: projection.contributesToCosts !== false,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
    });
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
  const briefingChanged = !activeBriefing || Object.entries(briefingData).some(([field, value]) => {
    const previous = field.endsWith('At') ? toDateTimeLocal(activeBriefing[field]) : String(activeBriefing[field] || '');
    return String(previous) !== String(value);
  });
  const currentRulesVersion = Number.isInteger(activeBriefing?.rulesVersion) ? activeBriefing.rulesVersion : 0;
  const rulesVersion = activeBriefing ? currentRulesVersion + (briefingChanged ? 1 : 0) : 1;
  submitButton.disabled = true;
  setMessage(document.querySelector('#briefingFormMessage'), 'Pubblico la bacheca…');
  try {
    await setDoc(doc(db, 'boats', activeBoat.id, 'briefing', 'board'), {
      ...briefingData, rulesVersion, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid,
    });
    form.dataset.editing = '';
    setMessage(document.querySelector('#briefingFormMessage'), briefingChanged && activeBriefing ? `Briefing aggiornato: l’equipaggio dovrà accettare la versione ${rulesVersion}.` : 'Briefing obbligatorio pubblicato.');
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
  renderCostPlanSummary();
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
  const fixedDinetteMessage = fixedDinetteConfigurationMessage(model);
  if (fixedDinetteMessage) {
    setMessage(message, fixedDinetteMessage, true);
    return;
  }
  const submitButton = costPlanForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(message, 'Salvo il preventivo barca…');
  try {
    await setDoc(doc(db, 'boats', activeBoat.id, 'costPlan', COST_PLAN_ID), {
      ...plan,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
    });
    activeCostPlan = normalizeCostPlan(plan);
    renderCostPlan(activeCostPlan);
    setMessage(message, 'Preventivo salvato: le quote vengono proposte solo per nuove proiezioni o campi ancora automatici. Le quote già salvate restano da verificare e possono essere personalizzate.');
  } catch (error) {
    setMessage(message, getFirestoreErrorMessage(error, 'Non riesco a salvare il preventivo barca.'), true);
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
  const plan = readContributionPlanForm();
  submitButton.disabled = true;
  setMessage(message, 'Salvo la composizione delle quote…');
  try {
    await setDoc(doc(db, 'boats', activeBoat.id, 'contributionPlan', 'default'), {
      ...plan,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
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

ensurePaymentAccountingCategoryField();
const paymentForm = document.querySelector('#paymentForm');
paymentForm.elements.berthType.addEventListener('change', applyPaymentBerthPreset);
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
  const payment = {
    recipientId,
    memberId: recipientId,
    payerInviteId: recipientId,
    contributionItemId: contributionItemIdForPaymentSelection(String(fields.get('berthType') || 'custom')),
    amountCents,
    currency: 'EUR',
    reason,
    isOptional: fields.get('isOptional') === 'on',
    accountingCategory: fields.get('accountingCategory') === 'cost_recovery' ? 'cost_recovery' : 'other',
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
    delete form.elements.amount.dataset.autoBerthRate;
    delete form.elements.reason.dataset.autoBerthReason;
    delete form.elements.accountingCategory.dataset.autoCostRecovery;
    renderPaymentBerthOptions();
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
    const isOrganizer = eventSnapshot.exists() && (eventSnapshot.data().organizerIds || []).includes(user.uid);
    document.querySelector('#accountStatus').textContent = isOrganizer ? 'Organizzatore configurato.' : 'Accesso skipper attivo. Per l’organizzatore: completa il documento iniziale nel README usando questo identificativo.';
  } catch (error) {
    document.querySelector('#accountStatus').textContent = 'Accesso skipper attivo.';
  }
  loadSkipperArea(user);
});

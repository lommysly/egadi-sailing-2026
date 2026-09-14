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
  { id: 'double_cabin', label: 'Posto in cabina doppia', rateKey: 'doubleCabinCents', defaultReason: 'Quota posto in cabina doppia', count: (totals) => totals.doubleCabins * 2 },
  { id: 'single_cabin', label: 'Posto in cabina singola', rateKey: 'singleCabinCents', defaultReason: 'Quota posto in cabina singola', count: (totals) => totals.singleCabins },
  { id: 'dinette', label: 'Posto in dinette', rateKey: 'dinetteCents', defaultReason: 'Quota posto in dinette', count: (totals) => totals.dinetteBerths },
  { id: 'other', label: 'Altra sistemazione', rateKey: 'otherBerthCents', defaultReason: 'Quota altra sistemazione', count: (totals) => totals.otherCrewBerths },
];
// Etichette tecniche chiuse: consentono di mostrare a ciascuno solo le
// proprie voci, senza dedurle dalla causale libera del messaggio WhatsApp.
const PAYMENT_CONTRIBUTION_ITEM_LABELS = Object.freeze({
  berth_base: 'Quota posto consigliata',
  berth_double_cabin: 'Posto in cabina doppia',
  berth_single_cabin: 'Posto in cabina singola',
  berth_dinette: 'Posto in dinette',
  berth_other: 'Altra sistemazione',
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
  double_cabin: 'Cabina doppia',
  single_cabin: 'Cabina singola',
  dinette: 'Dinette',
  other: 'Altra sistemazione',
});
const CONTRIBUTION_ITEM_STATES = new Map([
  ['to_define', 'Da definire'],
  ['included', 'Compreso nella quota'],
  ['extra', 'Da richiedere a parte'],
  ['local', 'Da regolare in loco / da dividere'],
  ['not_applicable', 'Non previsto'],
]);
const DEFAULT_CONTRIBUTION_ITEMS = [
  { id: 'berth', label: 'Quota posto in barca' },
  { id: 'starter_pack', label: 'Starter Pack · pulizie finali, fuoribordo e tender' },
  { id: 'linen_towels', label: 'Lenzuola e asciugamani' },
  { id: 'protection_insurance', label: 'Assicurazione cauzione' },
  { id: 'provisions', label: 'Cambusa' },
  { id: 'fuel', label: 'Gasolio per la navigazione' },
  { id: 'transfer', label: 'Transfer da/per il porto' },
  { id: 'refundable_deposit', label: 'Cauzione rimborsabile' },
];
const DEFAULT_RULES_SUMMARY = [
  '1. Seguo sempre le decisioni dello skipper su sicurezza, manovre, meteo, rotta, rada e porto.',
  '2. Partecipo al briefing pratico e uso le dotazioni di sicurezza quando richiesto.',
  '3. In navigazione mi muovo con prudenza: una mano per me e una per la barca.',
  '4. In emergenza avviso subito lo skipper e seguo le istruzioni senza improvvisare.',
  '5. Non uso gas, tender, VHF, verricello, motore o dotazioni senza autorizzazione.',
  '6. Uso con cura acqua, corrente, WC, cucina e rifiuti; rispetto cabine, spazi comuni, silenzio e orari.',
  '7. Niente droghe; alcol con responsabilità; fumo solo nelle zone comunicate dallo skipper.',
  '8. Avviso se mi allontano, tengo in ordine bagagli e oggetti e collaboro alla vita comune della barca.',
].join('\n');
const DEFAULT_FULL_RULES = [
  'REGOLAMENTO DI BORDO · EGADI SAILING EXPERIENCE 2026',
  '',
  'Premessa',
  'Questo regolamento si applica alla vita a bordo della barca indicata nell’invito. Meteo, rotta, rada, porto e programma possono cambiare: la sicurezza viene prima del programma. Le condizioni specifiche della barca, del charter e del porto vengono confermate dallo skipper.',
  '',
  '1. Skipper e decisioni di navigazione',
  'Le decisioni su sicurezza, manovre, navigazione, rada e porto spettano allo skipper. In caso di dubbio chiedi prima di agire; non prendere iniziative che possano mettere a rischio persone, barca o ambiente.',
  '',
  '2. Sicurezza e movimenti a bordo',
  'In navigazione una mano per te e una per la barca. Cammina piano, non correre a piedi nudi e usa scarpe idonee quando richiesto. Fai attenzione a boma, cime in tensione, winch, gallocce, oblò, scalette, ponti bagnati e oggetti in movimento. Bagagli e oggetti personali devono restare ordinati e assicurati.',
  '',
  '3. Briefing pratico ed emergenze',
  'Partecipa al briefing pratico svolto a bordo su giubbotti, life line, zattera, estintori, VHF, gas, uomo a mare e dotazioni reali della barca. Indossa il giubbotto quando richiesto. In caso di uomo a mare avvisa subito, indica la persona senza perderla di vista e segui le istruzioni dello skipper.',
  '',
  '4. Dotazioni, risorse e WC',
  'Non usare gas, tender, VHF, verricello, motore o altre dotazioni senza autorizzazione e istruzioni. Non lasciare ricariche incustodite o in carica durante la notte salvo indicazione dello skipper. Acqua ed elettricità sono risorse limitate: usa docce, rubinetti e dispositivi con attenzione. Nel WC va solo materiale biologico; niente carta, salviette, assorbenti o altri oggetti.',
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
  '10. Cambusa, costi e condizioni specifiche',
  'Cambusa, extra, eventuali quote, cauzioni e condizioni del charter non sono stabiliti da questo regolamento generale: vengono comunicati separatamente dallo skipper della singola barca prima di qualsiasi richiesta. La conferma online attesta la lettura integrale di questo testo; non sostituisce il briefing pratico obbligatorio a bordo.',
].join('\n');
const DEFAULT_RULES_SUMMARY_EN = [
  '1. I always follow the skipper’s decisions on safety, manoeuvres, weather, route, anchorage and harbour.',
  '2. I take part in the practical briefing and use safety equipment whenever requested.',
  '3. While under way, I move carefully: one hand for myself and one for the boat.',
  '4. In an emergency, I alert the skipper immediately and follow instructions without improvising.',
  '5. I do not use gas, the tender, VHF, windlass, engine or other equipment without permission.',
  '6. I use water, power, heads, galley and waste facilities with care; I respect cabins, shared spaces, quiet hours and timings.',
  '7. No drugs; alcohol responsibly; smoking only in areas specified by the skipper.',
  '8. I let the crew know if I leave the boat, keep my belongings secure and contribute to life on board.',
].join('\n');
const DEFAULT_FULL_RULES_EN = [
  'BOARD RULES · EGADI SAILING EXPERIENCE 2026',
  '',
  'Introduction',
  'These rules apply to life on board the boat named in the invitation. Weather, route, anchorage, harbour and programme may change: safety always takes priority over the programme. The skipper confirms the specific arrangements for the boat, charter and harbour.',
  '',
  '1. Skipper and navigation decisions',
  'The skipper is responsible for decisions about safety, manoeuvres, navigation, anchorage and harbour. If you are unsure, ask before acting. Do not take any initiative that could put people, the boat or the environment at risk.',
  '',
  '2. Safety and moving around on board',
  'While under way, keep one hand for yourself and one for the boat. Walk slowly, do not run barefoot, and wear suitable footwear when asked. Watch out for the boom, loaded lines, winches, cleats, hatches, ladders, wet decks and moving objects. Luggage and personal belongings must be kept tidy and secured.',
  '',
  '3. Practical briefing and emergencies',
  'Take part in the practical briefing on board covering lifejackets, lifelines, liferaft, extinguishers, VHF, gas, man overboard procedures and the boat’s actual equipment. Wear a lifejacket when asked. If someone goes overboard, raise the alarm immediately, keep pointing to the person without losing sight of them, and follow the skipper’s instructions.',
  '',
  '4. Equipment, resources and heads',
  'Do not use gas, the tender, VHF, windlass, engine or other equipment without permission and instruction. Do not leave chargers unattended or charging overnight unless the skipper says otherwise. Water and electricity are limited resources: use showers, taps and devices carefully. Only biological waste goes into the heads—never paper, wipes, sanitary products or other objects.',
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
  financeDashboard.setAttribute('aria-label', 'Quote e conti');

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
  overviewTitle.textContent = 'Quote e conti, senza confondere i passaggi.';
  const overviewLead = document.createElement('p');
  overviewLead.className = 'panel-lead';
  overviewLead.textContent = 'Prima imposti il quadro, poi prepari una richiesta personale e infine controlli quanto è stato verificato. Il sito non incassa denaro.';
  overviewHeading.append(overviewEyebrow, overviewTitle, overviewLead);

  const hub = document.createElement('div');
  hub.className = 'dashboard-hub finance-dashboard-hub';
  hub.setAttribute('aria-label', 'Azioni quote e conti');
  hub.append(
    financeDashboardCard({
      view: SKIPPER_FINANCE_VIEWS.setup,
      title: 'Imposta',
      detail: 'Metodi d’incasso, Cassa skipper e composizione delle quote.',
      icon: 'setup',
    }),
    financeDashboardCard({
      view: SKIPPER_FINANCE_VIEWS.request,
      title: 'Richiedi',
      detail: 'Prepara una richiesta personale e apri WhatsApp.',
      icon: 'request',
    }),
    financeDashboardCard({
      view: SKIPPER_FINANCE_VIEWS.review,
      title: 'Controlla',
      detail: 'Riepilogo, richieste emesse e accrediti verificati.',
      icon: 'review',
    }),
  );
  overviewPanel.append(overviewHeading, hub);

  const setupPanel = createFinanceDashboardPanel({
    view: SKIPPER_FINANCE_VIEWS.setup,
    eyebrow: '1 · Imposta',
    title: 'Prepara il quadro economico',
    lead: 'Queste informazioni restano nella tua area skipper: l’equipaggio non vede i metodi di incasso né la tua Cassa skipper.',
  });
  const requestPanel = createFinanceDashboardPanel({
    view: SKIPPER_FINANCE_VIEWS.request,
    eyebrow: '2 · Richiedi',
    title: 'Crea una richiesta personale',
    lead: 'Scegli persona, importo, causale e metodi; poi WhatsApp si apre con il messaggio già pronto. Il pagamento avviene sempre fuori dal sito.',
  });
  const reviewPanel = createFinanceDashboardPanel({
    view: SKIPPER_FINANCE_VIEWS.review,
    eyebrow: '3 · Controlla',
    title: 'Segui richieste e accrediti',
    lead: 'Riepiloga la Cassa skipper, ricontrolla le richieste inviate e conferma un accredito solo dopo averlo verificato davvero.',
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
        <p class="eyebrow">Centro di comando</p>
        <h3>Quattro aree, <em>una barca alla volta.</em></h3>
      </div>
      <p>Apri soltanto ciò che devi gestire: equipaggio, quote, barca oppure briefing. I dati restano separati e aggiornati.</p>
    </div>
    <div class="dashboard-hub" aria-label="Aree skipper">
      <button class="dashboard-hub-card dashboard-hub-card-crew" type="button" data-skipper-view="crew">
        <span class="dashboard-hub-icon">${skipperDashboardIcon('crew')}</span><span class="dashboard-hub-label">Equipaggio</span>
        <strong data-skipper-summary="crew">Carico i posti…</strong><small data-skipper-detail="crew">Inviti, Crew List e PDF charter.</small>
      </button>
      <button class="dashboard-hub-card dashboard-hub-card-money" type="button" data-skipper-view="money">
        <span class="dashboard-hub-icon">${skipperDashboardIcon('money')}</span><span class="dashboard-hub-label">Quote e conti</span>
        <strong data-skipper-summary="money">Carico i conti…</strong><small data-skipper-detail="money">Metodi, quote, cassa e richieste.</small>
      </button>
      <button class="dashboard-hub-card dashboard-hub-card-boat" type="button" data-skipper-view="boat">
        <span class="dashboard-hub-icon">${skipperDashboardIcon('boat')}</span><span class="dashboard-hub-label">Barca e flotta</span>
        <strong data-skipper-summary="boat">Carico la barca…</strong><small data-skipper-detail="boat">Sistemazioni e visibilità pubblica.</small>
      </button>
      <button class="dashboard-hub-card dashboard-hub-card-board" type="button" data-skipper-view="board">
        <span class="dashboard-hub-icon">${skipperDashboardIcon('board')}</span><span class="dashboard-hub-label">Briefing e bacheca</span>
        <strong data-skipper-summary="board">Carico il briefing…</strong><small data-skipper-detail="board">Regole, orari e comunicazioni.</small>
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
    nextActionText.textContent = 'La barca è pronta: invita la prima persona con un link WhatsApp personale.';
    nextActionButton.textContent = 'Invita una persona';
    nextActionButton.dataset.skipperView = 'crew';
  } else {
    nextActionText.textContent = 'Tutto sotto controllo: apri l’area che vuoi aggiornare.';
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
        ? 'Indica importo a persona e consegna in loco.'
        : 'Definisci se la voce è compresa, a parte o in loco.',
    };
  }
  const amount = item.amountCents > 0 ? `${formatCurrency(item.amountCents / 100)} a persona` : 'Importo da definire';
  if (item.state === 'included') return { value: 'Compreso nella quota', detail: 'Nessuna richiesta separata prevista.' };
  if (item.state === 'not_applicable') return { value: 'Non previsto', detail: 'Non entra nel riepilogo personale.' };
  if (item.state === 'extra') {
    return deposit
      ? { value: amount, detail: 'Configurazione da correggere: la cauzione va regolata in loco, non richiesta via WhatsApp.' }
      : { value: amount, detail: 'Voce separata, richiedibile con messaggio personale.' };
  }
  if (item.state === 'local') {
    return {
      value: amount,
      detail: deposit
        ? 'Da portare e regolare in loco; rimborsabile secondo charter e skipper.'
        : 'Da regolare in loco o da dividere a bordo.',
    };
  }
  return {
    value: 'Da definire',
    detail: deposit
      ? 'Non è inclusa nella quota né nella Cassa skipper.'
      : 'Non è ancora inclusa né richiesta a parte.',
  };
}

function renderSkipperFinanceOverview() {
  const overview = document.querySelector('#skipperFinanceOverview');
  if (!overview) return;
  const plan = normalizeCostPlan(activeCostPlan);
  const targetCents = activeCostPlan ? costPlanTotalCents(plan) : 0;
  const verifiedCents = activePayments
    .filter((payment) => payment.status === 'verified' && paymentCountsTowardCostPlan(payment))
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const pendingCents = activePayments
    .filter((payment) => isPendingPayment(payment) && paymentCountsTowardCostPlan(payment))
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const projectedBerthCents = activeProjections
    .reduce((total, projection) => total + normalizedProjectionAmount(projection.berthCents), 0);
  const projectedExtrasCents = activeProjections
    .reduce((total, projection) => total
      + normalizedProjectionAmount(projection.starterPackCents)
      + normalizedProjectionAmount(projection.protectionInsuranceCents), 0);
  const projectedPayableCents = projectedBerthCents + projectedExtrasCents;
  const baseContribution = costPlanBaseContribution();
  const starterPack = contributionConfigSummary('starter_pack');
  const protectionInsurance = contributionConfigSummary('protection_insurance');
  const refundableDeposit = contributionConfigSummary('refundable_deposit', { deposit: true });
  const recoveryValue = targetCents ? formatCurrency(targetCents / 100) : 'Da compilare';
  const recoveryDetail = !targetCents
    ? 'Solo charter e spese recuperabili dello skipper.'
    : verifiedCents > targetCents
      ? `${formatCurrency(verifiedCents / 100)} verificati · ${formatCurrency((verifiedCents - targetCents) / 100)} da riallocare.`
      : `${formatCurrency(verifiedCents / 100)} verificati · ${formatCurrency((targetCents - verifiedCents) / 100)} ancora da recuperare.${pendingCents ? ` ${formatCurrency(pendingCents / 100)} in attesa di verifica.` : ''}`;
  const baseValue = baseContribution ? `${formatCurrency(baseContribution.cents / 100)} a persona` : 'Da calcolare';
  const baseDetail = baseContribution
    ? `Cassa ÷ ${plan.payingParticipants} ${plan.payingParticipants === 1 ? 'partecipante pagante' : 'partecipanti paganti'}; skipper escluso.`
    : 'Inserisci i costi e chi li divide per proporre una quota posto.';
  const projectionValue = activeProjections.length
    ? `${formatCurrency(projectedPayableCents / 100)} previsti`
    : 'Nessuna previsione';
  const projectionDetail = activeProjections.length
    ? `${activeProjections.length} ${activeProjections.length === 1 ? 'posto riservato' : 'posti riservati'} · ${formatCurrency(projectedBerthCents / 100)} posti${projectedExtrasCents ? ` · ${formatCurrency(projectedExtrasCents / 100)} Starter Pack/assicurazione` : ''}. Non è un incasso.`
    : 'Aggiungi una persona nel Piano equipaggio per stimare gli scenari, senza inviare alcuna richiesta.';
  overview.innerHTML = `
    <div class="finance-overview-heading"><p class="eyebrow">Cabina di regia economica</p><p>La Cassa skipper recupera solo costi reali. Extra e cauzione restano distinti: nessun margine, nessun incasso nel sito.</p></div>
    <div class="finance-overview-grid">
      <article class="finance-overview-card"><span>Cassa skipper</span><strong>${escapeHtml(recoveryValue)}</strong><small>${escapeHtml(recoveryDetail)}</small></article>
      <article class="finance-overview-card"><span>Quota posto consigliata</span><strong>${escapeHtml(baseValue)}</strong><small>${escapeHtml(baseDetail)}</small></article>
      <article class="finance-overview-card finance-overview-card-projection"><span>Proiezione equipaggio</span><strong>${escapeHtml(projectionValue)}</strong><small>${escapeHtml(projectionDetail)}</small></article>
      <article class="finance-overview-card finance-overview-card-extras"><span>Extra per persona</span><strong>Starter Pack · ${escapeHtml(starterPack.value)}</strong><small>${escapeHtml(starterPack.detail)}</small><strong>Assicurazione cauzione · ${escapeHtml(protectionInsurance.value)}</strong><small>${escapeHtml(protectionInsurance.detail)}</small></article>
      <article class="finance-overview-card finance-overview-card-deposit"><span>Cauzione rimborsabile</span><strong>${escapeHtml(refundableDeposit.value)}</strong><small>${escapeHtml(refundableDeposit.detail)}</small></article>
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
  return {
    charterCents: 0,
    skipperFlightTrainCents: 0,
    skipperCarCents: 0,
    skipperLocalTransferCents: 0,
    otherRecoverableCents: 0,
    payingParticipants: Math.max(1, effectiveParticipantCapacity(activeBoat) || 1),
  };
}

function maximumPayingParticipants() {
  return Math.max(1, effectiveParticipantCapacity(activeBoat) || 30);
}

function normalizeCostPlan(plan = {}) {
  const defaults = defaultCostPlan();
  const payingParticipants = asNonNegativeInteger(plan?.payingParticipants, maximumPayingParticipants());
  return {
    charterCents: asNonNegativeInteger(plan?.charterCents, 1_000_000),
    skipperFlightTrainCents: asNonNegativeInteger(plan?.skipperFlightTrainCents, 1_000_000),
    skipperCarCents: asNonNegativeInteger(plan?.skipperCarCents, 1_000_000),
    skipperLocalTransferCents: asNonNegativeInteger(plan?.skipperLocalTransferCents, 1_000_000),
    otherRecoverableCents: asNonNegativeInteger(plan?.otherRecoverableCents, 1_000_000),
    payingParticipants: payingParticipants || defaults.payingParticipants,
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

function costPlanBaseContribution(plan = activeCostPlan) {
  if (!plan) return null;
  const normalized = normalizeCostPlan(plan);
  const totalCents = costPlanTotalCents(normalized);
  if (!totalCents || !normalized.payingParticipants) return null;
  return {
    id: 'cost:base',
    label: 'Quota base calcolata · recupero costi',
    cents: Math.round(totalCents / normalized.payingParticipants),
    defaultReason: 'Quota base · recupero costi barca e skipper',
  };
}

function normalizeContributionPlan(plan = {}) {
  const sourceItems = plan?.items && typeof plan.items === 'object' ? plan.items : {};
  const items = Object.fromEntries(DEFAULT_CONTRIBUTION_ITEMS.map((item) => {
    const source = sourceItems[item.id] || {};
    const state = CONTRIBUTION_ITEM_STATES.has(source.state) ? source.state : 'to_define';
    const amountCents = state === 'extra' || state === 'local'
      ? asNonNegativeInteger(source.amountCents, 1_000_000)
      : 0;
    return [item.id, { state, amountCents }];
  }));
  return { items };
}

function contributionCatalog(plan = activeContributionPlan) {
  const normalized = normalizeContributionPlan(plan);
  return DEFAULT_CONTRIBUTION_ITEMS.map((item) => ({ ...item, ...normalized.items[item.id] }));
}

function extraContributionTypes(plan = activeContributionPlan) {
  return contributionCatalog(plan)
    .filter((item) => item.state === 'extra' && item.id !== 'refundable_deposit')
    .map((item) => ({
      id: `extra:${item.id}`,
      label: item.label,
      cents: item.amountCents,
      defaultReason: item.id === 'refundable_deposit'
        ? 'Cauzione rimborsabile · restituzione esterna da concordare'
        : item.label,
    }));
}

function normalizeBerthLayout(layout = {}) {
  return {
    doubleCabins: asNonNegativeInteger(layout?.doubleCabins),
    singleCabins: asNonNegativeInteger(layout?.singleCabins),
    dinetteBerths: asNonNegativeInteger(layout?.dinetteBerths),
    // Le registrazioni precedenti distinguevano impropriamente l'uso della
    // cabina marinaio. Per la descrizione della barca conta solo se esiste.
    hasCrewCabin: layout?.hasCrewCabin === true
      || (LEGACY_CREW_CABIN_USES.has(layout?.crewCabinUse) && layout.crewCabinUse !== 'not_specified'),
    bathroomCount: asNonNegativeInteger(layout?.bathroomCount),
    otherCrewBerths: asNonNegativeInteger(layout?.otherCrewBerths),
  };
}

function berthLayoutTotals(layout) {
  const normalized = normalizeBerthLayout(layout);
  const standardBerths = (normalized.doubleCabins * 2)
    + normalized.singleCabins
    + normalized.dinetteBerths
    + normalized.otherCrewBerths;
  const physicalBerths = standardBerths + (normalized.hasCrewCabin ? 1 : 0);
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
  if (totals.doubleCabins) parts.push(`${totals.doubleCabins} ${totals.doubleCabins === 1 ? 'cabina doppia' : 'cabine doppie'}`);
  if (totals.singleCabins) parts.push(`${totals.singleCabins} ${totals.singleCabins === 1 ? 'cabina singola' : 'cabine singole'}`);
  if (totals.dinetteBerths) parts.push(`${totals.dinetteBerths} ${totals.dinetteBerths === 1 ? 'posto in dinette' : 'posti in dinette'}`);
  if (totals.hasCrewCabin) parts.push('cabina marinaio · posto skipper');
  if (totals.otherCrewBerths) parts.push(`${totals.otherCrewBerths} ${totals.otherCrewBerths === 1 ? 'posto letto extra' : 'posti letto extra'}`);
  if (totals.bathroomCount) parts.push(`${totals.bathroomCount} ${totals.bathroomCount === 1 ? 'bagno a bordo' : 'bagni a bordo'}`);
  return parts.join(' · ');
}

function readBerthLayout(form) {
  return normalizeBerthLayout({
    doubleCabins: form.elements.doubleCabins?.value,
    singleCabins: form.elements.singleCabins?.value,
    dinetteBerths: form.elements.dinetteBerths?.value,
    hasCrewCabin: form.elements.hasCrewCabin?.checked === true,
    bathroomCount: form.elements.bathroomCount?.value,
    otherCrewBerths: form.elements.otherCrewBerths?.value,
  });
}

function fillBerthLayoutForm(form, layout) {
  const normalized = normalizeBerthLayout(layout);
  form.elements.doubleCabins.value = String(normalized.doubleCabins);
  form.elements.singleCabins.value = String(normalized.singleCabins);
  form.elements.dinetteBerths.value = String(normalized.dinetteBerths);
  form.elements.hasCrewCabin.checked = normalized.hasCrewCabin;
  form.elements.bathroomCount.value = normalized.bathroomCount ? String(normalized.bathroomCount) : '';
  form.elements.otherCrewBerths.value = String(normalized.otherCrewBerths);
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
  const participantLabel = participantCapacity === 1 ? 'posto per partecipante' : 'posti per partecipanti';
  const skipperDetail = normalizedLayout.hasCrewCabin
    ? '1 è riservato allo skipper nella cabina marinaio'
    : '1 è riservato allo skipper';
  return `${totalBerths} ${totalLabel}: ${skipperDetail}; ${participantCapacity} ${participantLabel} invitabili e quotabili`;
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
    doubleCabinCents: 'cabina doppia',
    singleCabinCents: 'cabina singola',
    dinetteCents: 'dinette',
    otherBerthCents: 'altra sistemazione',
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
  label.append(input, ' Conta questo contributo nella Cassa skipper.');
  const hint = document.createElement('p');
  hint.className = 'field-hint';
  hint.textContent = 'Selezionalo solo per gli importi che recuperano charter e costi dello skipper. Cambusa, assicurazione, transfer o altri extra restano fuori dal bilancio della Cassa.';
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
  form.elements.payingParticipants.max = String(maximumPayingParticipants());
  form.elements.payingParticipants.value = String(normalized.payingParticipants);
}

function readCostPlanForm() {
  const form = document.querySelector('#costPlanForm');
  return {
    charterCents: toEuroCents(form?.elements.charterCost?.value),
    skipperFlightTrainCents: toEuroCents(form?.elements.skipperFlightTrainCost?.value),
    skipperCarCents: toEuroCents(form?.elements.skipperCarCost?.value),
    skipperLocalTransferCents: toEuroCents(form?.elements.skipperLocalTransferCost?.value),
    otherRecoverableCents: toEuroCents(form?.elements.otherRecoverableCost?.value),
    payingParticipants: asNonNegativeInteger(form?.elements.payingParticipants?.value, maximumPayingParticipants()),
  };
}

function renderCostPlanSummary() {
  const summary = document.querySelector('#costPlanSummary');
  if (!summary) return;
  const plan = normalizeCostPlan(readCostPlanForm());
  const totalCents = costPlanTotalCents(plan);
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
  if (!totalCents) {
    summary.textContent = `Inserisci i costi che vuoi recuperare. Lo skipper è escluso; al momento il divisore proposto è ${plan.payingParticipants} ${plan.payingParticipants === 1 ? 'partecipante' : 'partecipanti'}. Contributi Cassa skipper verificati: ${formatCurrency(verifiedCents / 100)}${pendingCents ? ` · ancora da verificare: ${formatCurrency(pendingCents / 100)}` : ''}.${legacyNote}`;
    return;
  }
  const baseCents = Math.round(totalCents / plan.payingParticipants);
  const balanceCents = verifiedCents - totalCents;
  const balance = balanceCents === 0
    ? 'Pareggio raggiunto con gli accrediti verificati.'
    : balanceCents > 0
      ? `Avanzo da riallocare: ${formatCurrency(balanceCents / 100)}. Non è un guadagno automatico.`
      : `Da recuperare: ${formatCurrency(Math.abs(balanceCents / 100))}.`;
  summary.textContent = `Totale costi recuperabili: ${formatCurrency(totalCents / 100)} ÷ ${plan.payingParticipants} ${plan.payingParticipants === 1 ? 'partecipante' : 'partecipanti'} = quota base indicativa ${formatCurrency(baseCents / 100)} a persona. Contributi Cassa skipper verificati: ${formatCurrency(verifiedCents / 100)}${pendingCents ? ` · ancora da verificare: ${formatCurrency(pendingCents / 100)}` : ''}. Bilancio: ${balance} Le richieste per cambusa, assicurazione o altri extra restano fuori; seleziona “Conta nella Cassa skipper” soltanto per i contributi che devono recuperare questi costi.${legacyNote}`;
}

function renderCostPlan(plan) {
  activeCostPlan = plan ? normalizeCostPlan(plan) : null;
  fillCostPlanForm(activeCostPlan);
  renderCostPlanSummary();
  renderPaymentBerthOptions();
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
  return [...CONTRIBUTION_ITEM_STATES.entries()]
    .filter(([value]) => item.id !== 'refundable_deposit' || ['to_define', 'local', 'not_applicable'].includes(value))
    .map(([value, label]) => `<option value="${value}"${value === item.state ? ' selected' : ''}>${label}</option>`)
    .join('');
}

function contributionCatalogRow(item) {
  const stateHint = item.id === 'refundable_deposit' ? '<small>È sempre rimborsabile e va portata/regolata in loco: non usa richieste WhatsApp.</small>' : '';
  return `<article class="contribution-catalog-row" data-contribution-id="${escapeHtml(item.id)}"><div class="contribution-catalog-label">${escapeHtml(item.label)}${stateHint}</div><label>Gestione<select data-contribution-state>${contributionStateOptions(item)}</select></label><label>€ a persona · solo a parte / in loco<input data-contribution-amount type="number" min="0" max="10000" step="0.01" inputmode="decimal" value="${euroInputValue(item.amountCents)}" placeholder="Es. 30,00" /></label></article>`;
}

function syncContributionCatalogRow(row) {
  const state = row?.querySelector('[data-contribution-state]')?.value;
  const amount = row?.querySelector('[data-contribution-amount]');
  if (!amount) return;
  const canSetAmount = state === 'extra' || state === 'local';
  amount.disabled = !canSetAmount;
  amount.title = canSetAmount
    ? 'Importo indicativo facoltativo per persona.'
    : 'L’importo è disponibile solo per voci a parte o da regolare in loco.';
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
  const baseContribution = costPlanBaseContribution();
  return baseContribution?.id === typeId ? baseContribution : null;
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
  if (typeof typeId === 'string' && typeId.startsWith('extra:')) {
    const itemId = typeId.slice('extra:'.length);
    return PAYMENT_CONTRIBUTION_ITEM_IDS.has(itemId) ? itemId : 'other';
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
  const costBase = costPlanBaseContribution();
  const costBaseOption = costBase
    ? `<optgroup label="Quota base dalla Cassa skipper"><option value="${costBase.id}">${escapeHtml(costBase.label)} · ${formatCurrency(costBase.cents / 100)} a persona</option></optgroup>`
    : '';
  select.innerHTML = '<option value="custom">Importo libero / altra voce</option>'
    + costBaseOption
    + (berthOptions ? `<optgroup label="Posti letto">${berthOptions}</optgroup>` : '')
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
    accountingCategory.checked = true;
    accountingCategory.dataset.autoCostRecovery = 'true';
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

function normalizedProjectionAmount(value) {
  return asNonNegativeInteger(value, 1_000_000);
}

function normalizeProjection(id, projection = {}) {
  const firstName = String(projection.firstName || '').trim();
  const lastName = String(projection.lastName || '').trim();
  const displayName = String(projection.displayName || `${firstName} ${lastName}`).trim();
  return {
    id,
    ...projection,
    firstName,
    lastName,
    displayName,
    plannedRole: String(projection.plannedRole || DEFAULT_CREW_ROLE).trim() || DEFAULT_CREW_ROLE,
    berthType: PROJECTION_BERTH_TYPES[projection.berthType] ? projection.berthType : 'to_define',
    berthCents: normalizedProjectionAmount(projection.berthCents),
    starterPackCents: normalizedProjectionAmount(projection.starterPackCents),
    protectionInsuranceCents: normalizedProjectionAmount(projection.protectionInsuranceCents),
    refundableDepositCents: normalizedProjectionAmount(projection.refundableDepositCents),
    status: projection.status === 'invited' ? 'invited' : 'projected',
  };
}

function projectionPayableCents(projection) {
  const normalized = normalizeProjection(projection.id, projection);
  return normalized.berthCents + normalized.starterPackCents + normalized.protectionInsuranceCents;
}

function projectionQuoteSummary(projection) {
  const normalized = normalizeProjection(projection.id, projection);
  const parts = [
    normalized.berthCents ? `Posto ${formatCurrency(normalized.berthCents / 100)}` : '',
    normalized.starterPackCents ? `Starter Pack ${formatCurrency(normalized.starterPackCents / 100)}` : '',
    normalized.protectionInsuranceCents ? `Assicurazione ${formatCurrency(normalized.protectionInsuranceCents / 100)}` : '',
  ].filter(Boolean);
  const payableCents = projectionPayableCents(normalized);
  if (!payableCents) return 'Quota prevista da definire';
  return `${parts.join(' · ')} · Totale previsto ${formatCurrency(payableCents / 100)}`;
}

function projectionInvite(projection) {
  return activeInvites.find((invite) => invite.id === projection.id) || null;
}

function projectionStatusLabel(projection) {
  const invite = projectionInvite(projection);
  if (!invite) return 'Posto riservato · invito da creare';
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
    + (projected ? ` · ${projected} nella proiezione equipaggio` : '') + '. '
    + (available ? available + ' ancora disponibili.' : 'Nessun posto ancora disponibile.');
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
  form.reset();
  editingProjectionId = null;
  document.querySelector('#projectionSubmitButton').textContent = 'Riserva posto nella proiezione';
  document.querySelector('#cancelProjectionEdit').hidden = true;
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

function renderProjections() {
  const list = document.querySelector('#projectionList');
  if (!list) return;
  if (!activeProjections.length) {
    list.innerHTML = '<p class="empty-state">Nessun posto ancora riservato nella proiezione.</p>';
    renderCapacityStatus();
    renderSkipperDashboardOverview();
    void syncPublicFleetAvailabilityFromCrew();
    return;
  }
  list.innerHTML = activeProjections.map((projection) => {
    const invite = projectionInvite(projection);
    const quote = projectionQuoteSummary(projection);
    const deposit = projection.refundableDepositCents > 0
      ? ` · cauzione rimborsabile ${formatCurrency(projection.refundableDepositCents / 100)} in loco`
      : ' · cauzione da definire/in loco';
    const inviteActions = !invite
      ? `<button class="text-button" type="button" data-send-projection="${escapeHtml(projection.id)}">Crea invito</button>`
      : invite.status === 'pending' && invite.accessKey
        ? `<button class="text-button" type="button" data-copy-invite="${escapeHtml(invite.id)}">Copia link</button><button class="text-button" type="button" data-whatsapp-invite="${escapeHtml(invite.id)}">Apri WhatsApp</button>`
        : '';
    const draftActions = !invite
      ? `<button class="text-button" type="button" data-edit-projection="${escapeHtml(projection.id)}">Modifica</button><button class="text-button" type="button" data-release-projection="${escapeHtml(projection.id)}">Libera posto</button>`
      : '';
    return `<article class="projection-row"><div><strong>${escapeHtml(projection.displayName)}</strong><span>${escapeHtml(projection.plannedRole)} · ${escapeHtml(projectionBerthLabel(projection.berthType))}</span><span>${escapeHtml(quote + deposit)}</span><small>${escapeHtml(projectionStatusLabel(projection))}</small></div><div class="member-actions">${inviteActions}${draftActions}</div></article>`;
  }).join('');
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
  if (!activeInvites.length) {
    list.innerHTML = '<p class="empty-state">Nessun link personale creato.</p>';
    renderPaymentRecipientOptions();
    renderCapacityStatus();
    renderSkipperDashboardOverview();
    void syncPublicFleetAvailabilityFromCrew();
    return;
  }
  list.innerHTML = activeInvites.map((invite) => {
    const profileCompleted = activeMembers.some((member) => member.id === invite.id);
    const expired = invite.expiresAt?.toDate && invite.expiresAt.toDate() < new Date();
    const status = invite.status === 'active'
      ? (profileCompleted ? 'Accesso attivo · anagrafica completata' : 'Accesso attivo · dati da completare')
      : (expired ? 'Invito scaduto' : 'Pronto da inviare · valido 14 giorni');
    const invitationLanguage = inviteLocale(invite) === 'en' ? 'English' : 'Italiano';
    const sendActions = invite.status === 'pending' && !expired && invite.accessKey
      ? `<button class="text-button" type="button" data-copy-invite="${escapeHtml(invite.id)}">Copia link</button><button class="text-button" type="button" data-whatsapp-invite="${escapeHtml(invite.id)}">Apri WhatsApp</button>`
      : '';
    return `<article class="invite-row"><div><strong>${escapeHtml(invite.displayName)}</strong><span>${escapeHtml(status)} · ${escapeHtml(invite.whatsappNumber)} · ${invitationLanguage}</span></div><div class="payment-action">${sendActions}<button class="text-button" type="button" data-reissue-invite="${escapeHtml(invite.id)}">Revoca e genera nuovo link</button></div></article>`;
  }).join('');
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
      ? '<span class="payment-accounting-tag">Cassa skipper</span>'
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
  status.textContent = `Briefing safety versione ${version} pubblicato. ${accepted} ${accepted === 1 ? 'persona ha' : 'persone hanno'} completato l’accettazione.${hasOfficialEnglish ? ' Versione inglese ufficiale disponibile.' : ' Versione inglese ufficiale non ancora pubblicata.'}`;
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
    setMessage(document.querySelector('#costPlanMessage'), 'Impossibile leggere la cassa skipper.', true);
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
  }, () => setMessage(document.querySelector('#projectionFormMessage'), 'Impossibile leggere la proiezione equipaggio.', true));
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
  return {
    id,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    whatsappNumber: `+${normalizeWhatsAppNumber(fields.get('whatsappNumber'))}`,
    plannedRole: roleFromFields(fields, 'projectionRole'),
    berthType: PROJECTION_BERTH_TYPES[fields.get('berthType')] ? fields.get('berthType') : 'to_define',
    berthCents: toEuroCents(fields.get('berthAmount')),
    starterPackCents: toEuroCents(fields.get('starterPackAmount')),
    protectionInsuranceCents: toEuroCents(fields.get('protectionInsuranceAmount')),
    refundableDepositCents: toEuroCents(fields.get('refundableDepositAmount')),
    preferredLocale: fields.get('preferredLocale') === 'en' ? 'en' : 'it',
    contactConsent: fields.get('contactConsent') === 'on',
  };
}

function fillProjectionForm(projection) {
  const form = document.querySelector('#projectionForm');
  if (!form) return;
  form.elements.firstName.value = projection.firstName;
  form.elements.lastName.value = projection.lastName;
  form.elements.whatsappNumber.value = projection.whatsappNumber;
  fillRoleFields(form, 'projectionRole', projection.plannedRole);
  form.elements.berthType.value = projection.berthType;
  form.elements.berthAmount.value = euroInputValue(projection.berthCents);
  form.elements.starterPackAmount.value = euroInputValue(projection.starterPackCents);
  form.elements.protectionInsuranceAmount.value = euroInputValue(projection.protectionInsuranceCents);
  form.elements.refundableDepositAmount.value = euroInputValue(projection.refundableDepositCents);
  form.elements.preferredLocale.value = projection.preferredLocale === 'en' ? 'en' : 'it';
  form.elements.contactConsent.checked = projection.contactConsent === true;
}

function applyProjectionBerthPreset() {
  const form = document.querySelector('#projectionForm');
  if (!form || !activeBoat) return;
  const type = berthRateType(form.elements.berthType?.value);
  if (!type) return;
  const cents = normalizeBerthRates(activeBoat.berthRates)[type.rateKey];
  const amount = form.elements.berthAmount;
  if (cents > 0 && (!amount.value || amount.dataset.autoProjectionRate === 'true')) {
    amount.value = euroInputValue(cents);
    amount.dataset.autoProjectionRate = 'true';
  }
}

document.querySelector('#projectionForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#projectionFormMessage');
  if (blockPrivateAction(message)) return;
  if (!activeBoat || !auth.currentUser) return;
  if (!editingProjectionId && needsCapacityAlignment(activeBoat)) {
    setMessage(message, capacityAlignmentMessage(activeBoat), true);
    return;
  }
  if (!editingProjectionId && isCrewCapacityReached()) {
    setMessage(message, 'Hai già riservato tutti i posti per partecipanti indicati per questa barca.', true);
    return;
  }
  const form = event.currentTarget;
  const fields = new FormData(form);
  const normalizedNumber = normalizeWhatsAppNumber(fields.get('whatsappNumber'));
  if (!normalizedNumber) {
    setMessage(message, 'Inserisci il numero WhatsApp in formato internazionale, ad esempio +39 333 1234567.', true);
    return;
  }
  if (fields.get('contactConsent') !== 'on') {
    setMessage(message, 'Conferma di avere il consenso della persona prima di salvarne il contatto.', true);
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const projectionId = editingProjectionId || createInviteId();
    const projection = projectionDraftFromFields(fields, projectionId);
    if (editingProjectionId) {
      await updateDoc(doc(db, 'boats', activeBoat.id, 'crewProjections', projectionId), {
        ...projection,
        status: 'projected',
        inviteId: null,
        invitedAt: null,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });
      setMessage(message, 'Proiezione aggiornata: il posto resta riservato.');
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
      setMessage(message, 'Posto riservato nella proiezione. Quando vuoi, crea l’invito dalla riga della persona.');
    }
    resetProjectionForm();
  } catch (error) {
    setMessage(message, getFirestoreErrorMessage(error, 'Non riesco a salvare la proiezione equipaggio.'), true);
  } finally {
    submitButton.disabled = false;
  }
});

const projectionForm = document.querySelector('#projectionForm');
projectionForm.elements.berthType.addEventListener('change', applyProjectionBerthPreset);
projectionForm.elements.berthAmount.addEventListener('input', () => {
  delete projectionForm.elements.berthAmount.dataset.autoProjectionRate;
});
document.querySelector('#cancelProjectionEdit').addEventListener('click', resetProjectionForm);

document.querySelector('#projectionList').addEventListener('click', async (event) => {
  const message = document.querySelector('#projectionFormMessage');
  if (blockPrivateAction(message) || !activeBoat || !auth.currentUser) return;
  const editButton = event.target.closest('[data-edit-projection]');
  if (editButton) {
    const projection = activeProjections.find((candidate) => candidate.id === editButton.dataset.editProjection);
    if (!projection || projectionInvite(projection)) return;
    fillProjectionForm(projection);
    editingProjectionId = projection.id;
    document.querySelector('#projectionSubmitButton').textContent = 'Salva proiezione';
    document.querySelector('#cancelProjectionEdit').hidden = false;
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
      setMessage(message, 'Posto liberato: torna disponibile per una nuova proiezione.');
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
        setMessage(message, `Invito pronto per ${projection.displayName}: WhatsApp è aperto con il messaggio già preparato.`);
      } else {
        whatsappWindow?.close();
        setMessage(message, `Invito pronto per ${projection.displayName}: copia il link dalla lista inviti.`);
      }
    } catch (error) {
      whatsappWindow?.close();
      sendButton.disabled = false;
      const fallback = error.code === 'phone-already-assigned'
        ? 'Questo numero è già associato a una barca dell’evento. Verifica prima con l’organizzatore.'
        : error.code === 'english-briefing-required'
          ? 'Prima di creare un invito in inglese, pubblica il briefing safety ufficiale in inglese dalla bacheca di bordo.'
          : 'Non riesco a creare l’invito personale.';
      setMessage(message, getFirestoreErrorMessage(error, fallback), true);
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
costPlanForm.addEventListener('input', renderCostPlanSummary);
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
  const submitButton = costPlanForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(message, 'Salvo la cassa skipper…');
  try {
    await setDoc(doc(db, 'boats', activeBoat.id, 'costPlan', COST_PLAN_ID), {
      ...plan,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
    });
    activeCostPlan = normalizeCostPlan(plan);
    renderCostPlanSummary();
    renderPaymentBerthOptions();
    setMessage(message, 'Cassa skipper salvata. La quota base è solo una proposta: puoi sempre differenziare le richieste per persona o cabina.');
  } catch (error) {
    setMessage(message, getFirestoreErrorMessage(error, 'Non riesco a salvare la cassa skipper.'), true);
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

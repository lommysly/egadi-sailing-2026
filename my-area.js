import { collection, doc, getDoc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { auth, crewAccessErrorMessage, crewSaveErrorMessage, crewAccessUrl, db, isScriptStale, profileUrl, signOutCrew, startCrewAreaSession, watchForStaleScript, withSaveRetry } from './crew-session.js?v=20261004-messaggi-sinceri-v1';
import { canConfirmCrewBriefing, crewTravelNeedsAttention } from './crew-flow-state.js?v=20261002-transfer-su-richiesta-v1';
import { roleConfirmationText } from './crew-roles.js?v=20260914-en2';
import { bindRulesDialog } from './rules-dialog.js?v=20260925-rules-dialog-v1';

watchForStaleScript(import.meta.url);

const i18n = window.EgadiI18n;
const translate = (key, fallback, params) => {
  const translated = i18n?.t?.(key, params);
  return translated && translated !== key ? translated : fallback;
};
const activeLocale = () => i18n?.getLocale?.() === 'en' ? 'en' : 'it';
const localized = (italian, english) => activeLocale() === 'en' ? english : italian;
let activeInvite = null;
let activeBriefing = null;
let activeRuleAcceptance = null;
let activeContributionPlan = null;
let activeMember = null;
let activeProjection = null;
let activeCrewPayments = [];
let activeCrewAnnouncements = [];
let activePaymentInstructions = null;
let activeCrewTravelStatus = null;
let activeTransferPricing = null;
let crewTravelStatusLoaded = false;
let crewTravelStatusReadError = false;
let stopPaymentSubscription = null;
let stopAnnouncementSubscription = null;
let stopContributionPlanSubscription = null;
let stopProjectionSubscription = null;
let stopPaymentInstructionsSubscription = null;
let stopCrewTravelStatusSubscription = null;
const CREW_DASHBOARD_HASHES = Object.freeze({
  overview: 'crew-panorama',
  profile: 'crew-profilo',
  money: 'crew-quote',
  board: 'crew-bacheca',
});
const CREW_DASHBOARD_LABELS = Object.freeze({
  overview: 'Panoramica',
  profile: 'I miei dati',
  money: 'Quote e richieste',
  board: 'Barca e bacheca',
});
let crewDashboardView = 'overview';
let crewDashboardInitialized = false;
const PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal' },
  { id: 'satispay', label: 'Satispay' },
  { id: 'revolut', label: 'Revolut' },
  { id: 'bankTransfer', label: localized('Bonifico', 'Bank transfer') },
];
const CONTRIBUTION_ITEM_STATES = new Map([
  ['to_define', localized('Da confermare con lo skipper', 'To be confirmed with the skipper')],
  ['included', localized('Compreso nella quota', 'Included in the contribution')],
  ['extra', localized('Da richiedere a parte', 'To be requested separately')],
  ['local', localized('Da regolare separatamente / da dividere', 'To be settled separately / shared')],
  ['not_applicable', localized('Non previsto', 'Not included')],
]);
const CONTRIBUTION_ITEMS = [
  { id: 'berth', label: localized('Quota posto in barca', 'Berth contribution') },
  { id: 'starter_pack', label: localized('Starter Pack · servizi per la barca', 'Starter Pack · boat services') },
  { id: 'linen_towels', label: localized('Lenzuola e asciugamani · inclusi nello Starter Pack', 'Bed linen and towels · included in the Starter Pack') },
  { id: 'protection_insurance', label: localized('Assicurazione cauzione', 'Deposit insurance') },
  { id: 'provisions', label: localized('Cambusa', 'Provisions') },
  { id: 'fuel', label: localized('Gasolio per la navigazione', 'Fuel for navigation') },
  { id: 'transfer', label: localized('Transfer da/per il porto', 'Transfer to/from the port') },
  { id: 'shore_dinner', label: localized('Cena a terra programmata', 'Planned dinner ashore') },
  { id: 'mooring_fee', label: localized('Porto / ormeggio programmato', 'Planned port / mooring') },
  { id: 'refundable_deposit', label: localized('Cauzione rimborsabile', 'Refundable deposit') },
];
const STARTER_PACK_ITEMS = [
  { id: 'bed_linen', label: localized('Lenzuola', 'Bed linen') },
  { id: 'bath_towels', label: localized('Asciugamani', 'Bath towels') },
  { id: 'bath_kit', label: localized('Kit bagno / consumabili', 'Bathroom kit / essentials') },
  { id: 'beach_towel', label: localized('Telo mare', 'Beach towel') },
  { id: 'outboard', label: localized('Fuoribordo', 'Outboard engine') },
  { id: 'final_cleaning', label: localized('Pulizie finali', 'Final cleaning') },
  { id: 'sup', label: 'SUP' },
  { id: 'egadi_navigation_permit', label: localized('Permesso di navigazione Egadi', 'Egadi navigation permit') },
  { id: 'tender', label: localized('Tender, se previsto dal charter', 'Tender, if included by the charter') },
];
const STARTER_PACK_ITEM_IDS = new Set(STARTER_PACK_ITEMS.map((item) => item.id));
const DEFAULT_STARTER_PACK_ITEM_IDS = Object.freeze(['bed_linen', 'bath_towels', 'outboard', 'sup']);
const PERSONAL_PAYMENT_GROUPS = Object.freeze({
  berth: new Set(['berth_base', 'berth_double_cabin', 'berth_single_cabin', 'berth_dinette', 'berth_other']),
  protection_insurance: new Set(['protection_insurance']),
});

function normalizeStarterPackItems(value, { fallbackToDefault = false } = {}) {
  const selected = Array.isArray(value)
    ? value.filter((itemId) => typeof itemId === 'string' && STARTER_PACK_ITEM_IDS.has(itemId))
    : [];
  const unique = [...new Set(selected)];
  if (unique.length || Array.isArray(value) || !fallbackToDefault) return unique;
  return [...DEFAULT_STARTER_PACK_ITEM_IDS];
}

function starterPackItemsDescription(value) {
  const labels = normalizeStarterPackItems(value)
    .map((itemId) => STARTER_PACK_ITEMS.find((item) => item.id === itemId)?.label)
    .filter(Boolean);
  if (!labels.length) return localized('Servizi da definire con lo skipper.', 'Services to be confirmed with the skipper.');
  return localized(`Comprende: ${labels.join(', ')}.`, `Includes: ${labels.join(', ')}.`);
}

// Per un invito recente la lista è congelata nella sua proiezione. Gli inviti
// storici non possono ricostruire ciò che ricevettero allora: per loro resta
// visibile il piano attuale della barca.
function starterPackItemsForActiveProjection() {
  const hasSnapshot = Array.isArray(activeProjection?.starterPackItemsSnapshot);
  const source = hasSnapshot
    ? activeProjection.starterPackItemsSnapshot
    : activeContributionPlan?.starterPackItems;
  return normalizeStarterPackItems(source, {
    fallbackToDefault: hasSnapshot ? false : !Array.isArray(activeContributionPlan?.starterPackItems),
  });
}

function staticContributionDescription(itemId, starterPackItems = []) {
  const descriptions = {
    berth: localized('Il valore dipende dalla sistemazione assegnata dallo skipper.', 'The amount depends on the berth assigned by the skipper.'),
    starter_pack: `${starterPackItemsDescription(starterPackItems)} ${localized('Si regola solo in contanti a bordo.', 'It is settled in cash on board only.')}`,
    linen_towels: localized('Già raccontati nello Starter Pack: non sono una seconda spesa.', 'Already included in the Starter Pack: this is not a second charge.'),
    protection_insurance: localized('Separata dalla quota del posto.', 'Separate from the berth contribution.'),
    provisions: localized('Cambusa da dividere tra chi partecipa.', 'Provisions are shared among participants.'),
    fuel: localized('Si calcola sul gasolio effettivamente consumato.', 'It is calculated on fuel actually used.'),
    transfer: localized('Servizio a pagamento. Il transfer aeroporto ↔ porto, andata e ritorno, è sempre fuori dallo Starter Pack.', 'Paid service. Airport ↔ port transfers, both ways, are always outside the Starter Pack.'),
    shore_dinner: localized('Solo se viene organizzata una cena a terra.', 'Only if a dinner ashore is organised.'),
    mooring_fee: localized('Solo se porto, ormeggio o boa non sono già inclusi.', 'Only if port, mooring or buoy costs are not already included.'),
    refundable_deposit: localized('Contanti all’imbarco; restituzione dopo il check-out del charter, salvo danni da definire.', 'Cash at boarding; returned after the charter check-out, unless damage needs to be assessed.'),
  };
  return descriptions[itemId] || '';
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function crewDashboardViewFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  return Object.entries(CREW_DASHBOARD_HASHES)
    .find(([, value]) => value === hash)?.[0] || 'overview';
}

function crewDashboardIcon(kind) {
  const paths = {
    profile: '<circle cx="12" cy="8.25" r="3.25"/><path d="M5.25 19.25a6.75 6.75 0 0 1 13.5 0"/>',
    money: '<rect x="3.5" y="5.25" width="17" height="13.5" rx="2"/><path d="M3.5 9.5h17M15.5 14.25h2.25"/>',
    board: '<path d="M3 14.5h18l-2.25 4.25H5.25L3 14.5Z"/><path d="M12 3.5v11M12 4l5.25 7H12M11.75 6.25 7 11h4.75"/>',
    activity: '<path d="M4 12h3l2-5 3 10 2-5h6"/>',
    travel: '<path d="m3 13 18-8-8 18-2.4-7.6L3 13Z"/><path d="m10.6 15.4 4.1-4.1"/>',
    cabin: '<path d="M4 20V9.5L12 4l8 5.5V20"/><path d="M4 20h16M9 20v-6h6v6"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[kind] || paths.activity}</svg>`;
}

function crewDashboardCopy() {
  if (activeLocale() === 'en') {
    return {
      eyebrow: 'Your crew area',
      title: 'Before departure,<br /><em>here is what to check.</em>',
      description: 'Your charter details, safety briefing, skipper updates and your own contribution summary — only information for you.',
      activity: 'Your progress',
      activityDetail: 'What you have already completed.',
      activityTimelineEyebrow: 'Your trip status',
      activityTimelineTitle: 'What you have already done',
      board: 'Rules and updates',
      boardDetail: 'Safety briefing, timings and skipper messages.',
      money: 'Your contribution',
      moneyDetail: 'The invitation summary, cash on board and later confirmations.',
      profile: 'Charter details',
      profileDetail: 'Personal details requested before boarding.',
      cabin: 'My cabin',
      cabinLoading: 'Checking…',
      cabinDetail: 'The skipper assigns cabins; ask them if you have not seen it yet.',
      cabinUnassigned: 'Not assigned yet',
      travel: 'Arrivals and departures',
      travelStatus: 'Plan your journey',
      travelDetail: 'Flight, transfer or car ride: save it here.',
      nextStep: 'Next step',
      nextButton: 'Open',
      noPayments: 'Contribution to be confirmed',
      paymentsPending: '{count} request{suffix} to settle',
      paymentsVerified: '{count} confirmed contribution{suffix}',
      briefingReady: 'Safety briefing accepted',
      briefingWaiting: 'Safety briefing to be accepted',
      profileReady: 'Details saved',
      profileWaiting: 'Details to complete',
      announcements: '{count} skipper update{suffix}',
      activityProgress: '{count} completed step{suffix}',
      allReady: 'You have completed everything for now. Come back when the skipper posts an update or a new request.',
      pendingAction: 'A payment request is waiting. The amount and the skipper’s instructions are here.',
      boardAction: 'Before departure, take a look at the skipper’s latest updates.',
      profileAction: 'Complete the details needed for the charter.',
      openBoard: 'Open rules and updates',
      openPayments: 'Open requests',
      openProfile: 'Open my details',
    };
  }
  return {
    eyebrow: 'La tua area equipaggio',
    title: 'Prima di partire,<br /><em>ecco cosa controllare.</em>',
    description: 'Dati per il charter, briefing di sicurezza, messaggi dello skipper e riepilogo della tua quota: qui trovi solo ciò che riguarda te.',
    activity: 'Il tuo percorso',
    activityDetail: 'Quello che hai già completato.',
    activityTimelineEyebrow: 'Stato del viaggio',
    activityTimelineTitle: 'Quello che hai già fatto',
    board: 'Regole e avvisi',
    boardDetail: 'Briefing di sicurezza, orari e messaggi dello skipper.',
    money: 'La tua quota',
    moneyDetail: 'Il riepilogo dell’invito, i contanti a bordo e le conferme successive.',
    profile: 'Dati per il charter',
    profileDetail: 'Dati personali richiesti prima dell’imbarco.',
    cabin: 'La mia cabina',
    cabinLoading: 'Controllo…',
    cabinDetail: 'L’assegnazione la fa lo skipper; chiedi a lui se non la vedi ancora.',
    cabinUnassigned: 'Non ancora assegnata',
    travel: 'Arrivi e partenze',
    travelStatus: 'Organizza il viaggio',
    travelDetail: 'Volo, transfer o passaggio auto: salvalo qui.',
    nextStep: 'Prossimo passo',
    nextButton: 'Apri',
    noPayments: 'Quota da definire',
    paymentsPending: '{count} richiest{suffix} da regolare',
    paymentsVerified: '{count} contribut{suffix} confermat{suffixVerified}',
    briefingReady: 'Briefing di sicurezza accettato',
    briefingWaiting: 'Briefing di sicurezza da accettare',
    profileReady: 'Dati salvati',
    profileWaiting: 'Dati da completare',
    announcements: '{count} comunicazion{suffix} dello skipper',
    activityProgress: '{count} passagg{suffix} completat{suffixCompleted}',
    allReady: 'Per ora hai completato tutto. Torna qui quando lo skipper pubblica un avviso o una nuova richiesta.',
    pendingAction: 'C’è una richiesta da pagare. Qui trovi importo e indicazioni dello skipper.',
    boardAction: 'Prima di partire, dai un’occhiata agli ultimi messaggi dello skipper.',
    profileAction: 'Completa i dati richiesti per il charter.',
    openBoard: 'Apri regole e avvisi',
    openPayments: 'Apri richieste',
    openProfile: 'Apri i miei dati',
  };
}

function crewPluralSuffix(count, italianSingular, italianPlural, englishSingular = '', englishPlural = 's') {
  if (activeLocale() === 'en') return count === 1 ? englishSingular : englishPlural;
  return count === 1 ? italianSingular : italianPlural;
}

function renderCrewDashboardShell() {
  if (!crewDashboardInitialized) return;
  const overview = document.querySelector('#crewDashboardOverview');
  const navigation = document.querySelector('#crewDashboardNavigation');
  if (!overview || !navigation) return;
  const copy = crewDashboardCopy();
  overview.setAttribute('aria-label', copy.eyebrow);
  navigation.setAttribute('aria-label', activeLocale() === 'en' ? 'Crew area sections' : 'Sezioni area equipaggio');
  overview.innerHTML = `
    <div class="dashboard-overview-heading">
      <div><p class="eyebrow">${escapeHtml(copy.eyebrow)}</p><h3>${copy.title}</h3></div>
      <p>${escapeHtml(copy.description)}</p>
    </div>
    <div class="dashboard-hub" aria-label="${escapeHtml(copy.eyebrow)}">
      <button class="dashboard-hub-card dashboard-hub-card-crew" type="button" data-crew-view="profile">
        <span class="dashboard-hub-status" data-crew-status="profile" aria-label="Da completare" hidden>!</span>
        <span class="dashboard-hub-icon">${crewDashboardIcon('profile')}</span><span class="dashboard-hub-label">${escapeHtml(copy.profile)}</span>
        <strong data-crew-summary="profile">${escapeHtml(copy.profileReady)}</strong><small data-crew-detail="profile">${escapeHtml(copy.profileDetail)}</small>
      </button>
      <a class="dashboard-hub-card dashboard-hub-card-travel" href="${escapeHtml(i18n?.preserveLocaleUrl?.('travel.html') || 'travel.html')}">
        <span class="dashboard-hub-status" data-crew-status="travel" aria-label="Da completare" hidden>!</span>
        <span class="dashboard-hub-icon">${crewDashboardIcon('travel')}</span><span class="dashboard-hub-label">${escapeHtml(copy.travel)}</span>
        <strong data-crew-summary="travel">${escapeHtml(copy.travelStatus)}</strong><small data-crew-detail="travel">${escapeHtml(copy.travelDetail)}</small>
      </a>
      <article class="dashboard-hub-card dashboard-hub-card-cabin dashboard-hub-card--static">
        <span class="dashboard-hub-status" data-crew-status="cabin" aria-label="Da assegnare" hidden>!</span>
        <span class="dashboard-hub-icon">${crewDashboardIcon('cabin')}</span><span class="dashboard-hub-label">${escapeHtml(copy.cabin)}</span>
        <strong data-crew-summary="cabin">${escapeHtml(copy.cabinLoading)}</strong><small data-crew-detail="cabin">${escapeHtml(copy.cabinDetail)}</small>
      </article>
      <button class="dashboard-hub-card dashboard-hub-card-money" type="button" data-crew-view="money">
        <span class="dashboard-hub-status" data-crew-status="money" aria-label="Da completare" hidden>!</span>
        <span class="dashboard-hub-icon">${crewDashboardIcon('money')}</span><span class="dashboard-hub-label">${escapeHtml(copy.money)}</span>
        <strong data-crew-summary="money">${escapeHtml(copy.noPayments)}</strong><small data-crew-detail="money">${escapeHtml(copy.moneyDetail)}</small>
      </button>
      <button class="dashboard-hub-card dashboard-hub-card-board" type="button" data-crew-view="board">
        <span class="dashboard-hub-status" data-crew-status="board" aria-label="Da completare" hidden>!</span>
        <span class="dashboard-hub-icon">${crewDashboardIcon('board')}</span><span class="dashboard-hub-label">${escapeHtml(copy.board)}</span>
        <strong data-crew-summary="board">${escapeHtml(copy.briefingReady)}</strong><small data-crew-detail="board">${escapeHtml(copy.boardDetail)}</small>
      </button>
      <article class="dashboard-hub-card dashboard-hub-card-activity dashboard-hub-card--static">
        <span class="dashboard-hub-icon">${crewDashboardIcon('activity')}</span><span class="dashboard-hub-label">${escapeHtml(copy.activity)}</span>
        <strong data-crew-summary="activity">${escapeHtml(copy.briefingReady)}</strong><small data-crew-detail="activity">${escapeHtml(copy.activityDetail)}</small>
      </article>
    </div>
    <section id="crewActivityTimeline" class="crew-activity-timeline" aria-live="polite" aria-labelledby="crewActivityTimelineTitle">
      <div class="crew-activity-timeline-heading"><p class="eyebrow">${escapeHtml(copy.activityTimelineEyebrow)}</p><h4 id="crewActivityTimelineTitle">${escapeHtml(copy.activityTimelineTitle)}</h4></div>
      <ol class="crew-activity-timeline-list"></ol>
    </section>
    <div class="dashboard-next-step"><div><span>${escapeHtml(copy.nextStep)}</span><strong id="crewNextActionText">${escapeHtml(copy.boardAction)}</strong></div><button id="crewNextActionButton" class="button button-primary" type="button" data-crew-view="board">${escapeHtml(copy.nextButton)}</button></div>
  `;
  // "Viaggio" apre una pagina separata (travel.html), non una vista della
  // stessa dashboard come le altre tre: prima esisteva solo come riquadro
  // nella Panoramica, quindi appena ci si allontanava (Bacheca, Quote...)
  // l'unico modo per tornarci era passare di nuovo da "← Panoramica" — un
  // utente di fretta non lo ritrovava (caso reale Pauline Eloff, segnalato
  // il 25/09/2026). Ora resta raggiungibile da qui in ogni momento, come le
  // altre sezioni.
  const travelHref = escapeHtml(i18n?.preserveLocaleUrl?.('travel.html') || 'travel.html');
  navigation.innerHTML = Object.entries(CREW_DASHBOARD_LABELS)
    .map(([view, label]) => `<button type="button" data-crew-view="${view}">${view === 'overview' ? '← ' : ''}${escapeHtml(activeLocale() === 'en' ? ({ overview: 'Overview', profile: 'My details', money: 'Contributions', board: 'Boat and updates' }[view]) : label)}</button>`)
    .join('') + `<a href="${travelHref}">${escapeHtml(copy.travel)}</a>`;
}

function setupCrewDashboard() {
  if (crewDashboardInitialized) return;
  const dashboard = document.querySelector('#participantDashboard');
  const grid = dashboard?.querySelector('.dashboard-grid');
  const profilePanel = document.querySelector('#participantProfileSummary')?.closest('.dashboard-panel');
  const boardPanel = document.querySelector('#participantAnnouncementList')?.closest('.dashboard-panel');
  const contributionPanel = document.querySelector('#participantContributionPlan')?.closest('.dashboard-panel');
  const paymentPanel = document.querySelector('#participantPaymentList')?.closest('.dashboard-panel');
  if (!dashboard || !grid || !profilePanel || !boardPanel || !contributionPanel || !paymentPanel) return;

  profilePanel.dataset.crewPanel = 'profile';
  boardPanel.dataset.crewPanel = 'board';
  contributionPanel.dataset.crewPanel = 'money';
  paymentPanel.dataset.crewPanel = 'money';
  const overview = document.createElement('section');
  overview.id = 'crewDashboardOverview';
  overview.className = 'dashboard-overview crew-dashboard-overview';
  overview.setAttribute('aria-label', 'Panoramica area equipaggio');
  const navigation = document.createElement('nav');
  navigation.id = 'crewDashboardNavigation';
  navigation.className = 'dashboard-view-navigation';
  navigation.setAttribute('aria-label', 'Sezioni area equipaggio');
  grid.before(overview, navigation);
  dashboard.addEventListener('click', (event) => {
    const copyPaymentButton = event.target.closest('[data-copy-payment-instruction]');
    if (copyPaymentButton && dashboard.contains(copyPaymentButton)) {
      copyPaymentInstruction(copyPaymentButton.dataset.copyPaymentInstruction);
      return;
    }
    const declareButton = event.target.closest('[data-declare-payment]');
    if (declareButton && dashboard.contains(declareButton)) {
      declareCrewPayment(declareButton.dataset.declarePayment, declareButton.closest('[data-payment-declare-id]'));
      return;
    }
    const reportButton = event.target.closest('[data-report-payment]');
    if (reportButton && dashboard.contains(reportButton)) {
      reportCrewPayment(reportButton.closest('[data-payment-self-report]'));
      return;
    }
    const rulesReference = event.target.closest('[data-rules-reference="deposit"]');
    if (rulesReference && dashboard.contains(rulesReference)) {
      window.setTimeout(() => {
        const recap = document.querySelector('#participantBriefing .briefing-recap');
        if (recap) recap.open = true;
        const heading = [...document.querySelectorAll('#participantRulesText .rules-section-heading')]
          .find((node) => /cauzione|deposit/i.test(node.textContent));
        heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
      return;
    }
    const button = event.target.closest('[data-crew-view]');
    if (!button || !dashboard.contains(button)) return;
    const view = button.dataset.crewView;
    if (!CREW_DASHBOARD_HASHES[view]) return;
    const nextHash = `#${CREW_DASHBOARD_HASHES[view]}`;
    if (window.location.hash === nextHash) {
      setCrewDashboardView(view);
    } else {
      window.location.hash = nextHash;
    }
  });
  window.addEventListener('hashchange', () => setCrewDashboardView(crewDashboardViewFromHash()));
  document.addEventListener('egadi:localechange', () => {
    renderCrewDashboardShell();
    renderParticipantFinanceSummary();
    renderCrewDashboardOverview();
    setCrewDashboardView(crewDashboardView);
  });
  crewDashboardInitialized = true;
  renderCrewDashboardShell();
  setCrewDashboardView(crewDashboardViewFromHash());
  renderCrewDashboardOverview();
}

function setCrewDashboardView(nextView) {
  if (!crewDashboardInitialized || !hasAcceptedCurrentBriefing()) return;
  const view = CREW_DASHBOARD_HASHES[nextView] ? nextView : 'overview';
  crewDashboardView = view;
  const dashboard = document.querySelector('#participantDashboard');
  const overview = document.querySelector('#crewDashboardOverview');
  const navigation = document.querySelector('#crewDashboardNavigation');
  const grid = dashboard?.querySelector('.dashboard-grid');
  if (!overview || !navigation || !grid) return;
  overview.hidden = view !== 'overview';
  // Resta visibile SEMPRE, anche sulla Panoramica: vedi lo stesso commento
  // in area.js (setSkipperDashboardView) — stesso bug, stessa correzione,
  // stesso caso reale segnalato il 25/09/2026.
  navigation.hidden = false;
  grid.hidden = view === 'overview';
  grid.classList.toggle('dashboard-grid-single-view', view !== 'overview');
  grid.querySelectorAll('[data-crew-panel]').forEach((panel) => {
    panel.hidden = view === 'overview' || panel.dataset.crewPanel !== view;
  });
  navigation.querySelectorAll('[data-crew-view]').forEach((button) => {
    button.toggleAttribute('aria-current', button.dataset.crewView === view);
  });
}

function setCrewDashboardMetric(name, value, detail, needsAttention = false) {
  const card = document.querySelector(`.dashboard-hub-card[data-crew-view="${name}"], .dashboard-hub-card-${name}`);
  const valueTarget = document.querySelector(`[data-crew-summary="${name}"]`);
  const detailTarget = document.querySelector(`[data-crew-detail="${name}"]`);
  const statusTarget = document.querySelector(`[data-crew-status="${name}"]`);
  if (valueTarget) valueTarget.textContent = value;
  if (detailTarget) detailTarget.textContent = detail;
  // Stesso linguaggio visivo introdotto in area.js per lo skipper (bordo
  // ambra + pallino "!"): anche l'equipaggio deve capire a colpo d'occhio
  // cosa manca, non solo leggendo il testo di ogni card (richiesta di
  // Silvio, 27/09/2026 — "una visione cognitiva di quello che hanno scritto").
  card?.classList.toggle('dashboard-hub-card--attention', needsAttention);
  if (statusTarget) statusTarget.hidden = !needsAttention;
}

function paymentActivitySummary(pendingPayments, verifiedPayments, pendingPaymentCents, verifiedPaymentCents) {
  if (pendingPayments) {
    const countLabel = localized(
      pendingPayments === 1 ? '1 richiesta da regolare' : `${pendingPayments} richieste da regolare`,
      pendingPayments === 1 ? '1 request to settle' : `${pendingPayments} requests to settle`,
    );
    const amount = pendingPaymentCents ? ` · ${formatCurrency(pendingPaymentCents / 100)}` : '';
    const confirmed = verifiedPayments
      ? localized(
        verifiedPayments === 1 ? '1 accredito già confermato' : `${verifiedPayments} accrediti già confermati`,
        verifiedPayments === 1 ? '1 payment already confirmed' : `${verifiedPayments} payments already confirmed`,
      )
      : '';
    const confirmedAmount = verifiedPaymentCents ? ` · ${formatCurrency(verifiedPaymentCents / 100)}` : '';
    return { tone: 'attention', label: localized('Richieste personali', 'Personal requests'), detail: `${countLabel}${amount}${confirmed ? ` · ${confirmed}${confirmedAmount}` : ''}` };
  }
  if (verifiedPayments) {
    const countLabel = localized(
      verifiedPayments === 1 ? '1 accredito confermato' : `${verifiedPayments} accrediti confermati`,
      verifiedPayments === 1 ? '1 payment confirmed' : `${verifiedPayments} payments confirmed`,
    );
    const amount = verifiedPaymentCents ? ` · ${formatCurrency(verifiedPaymentCents / 100)}` : '';
    return { tone: 'complete', label: localized('Richieste personali', 'Personal requests'), detail: `${countLabel}${amount}` };
  }
  const contribution = onlineContributionBalance();
  if (contribution.hasTarget && !contribution.isExempt) {
    return {
      tone: 'waiting',
      label: localized('Quota del tuo invito', 'Your invitation contribution'),
      detail: paymentInstructionsAreReady()
        ? localized(
          `${formatCurrency(contribution.remainingCents / 100)} da versare: apri la tua quota per scegliere il metodo e copiare la causale.`,
          `${formatCurrency(contribution.remainingCents / 100)} to pay: open your contribution to choose a method and copy the payment reference.`,
        )
        : localized(
          `${formatCurrency(contribution.remainingCents / 100)} da versare: lo skipper pubblicherà qui i metodi di versamento.`,
          `${formatCurrency(contribution.remainingCents / 100)} to pay: the skipper will publish payment methods here.`,
        ),
    };
  }
  return {
    tone: 'waiting',
    label: localized('Aggiornamenti sulla quota', 'Contribution updates'),
    detail: localized('Non ci sono promemoria o richieste aggiuntive.', 'There are no reminders or additional requests.'),
  };
}

function renderCrewActivityTimeline({ profileReady, briefingReady, pendingPayments, verifiedPayments, pendingPaymentCents, verifiedPaymentCents }) {
  const list = document.querySelector('#crewActivityTimeline .crew-activity-timeline-list');
  if (!list) return;
  const profileUpdatedAt = formatDateTime(activeMember?.updatedAt || activeMember?.createdAt);
  const briefingAcceptedAt = formatDateTime(activeRuleAcceptance?.acceptedAt);
  const paymentActivity = paymentActivitySummary(pendingPayments, verifiedPayments, pendingPaymentCents, verifiedPaymentCents);
  const latestAnnouncement = activeCrewAnnouncements[0];
  const activity = [
    {
      tone: profileReady ? 'complete' : 'waiting',
      label: localized('Dati personali', 'Personal details'),
      detail: profileReady
        ? profileUpdatedAt
          ? localized(`Dati aggiornati il ${profileUpdatedAt}.`, `Details updated on ${profileUpdatedAt}.`)
          : localized('Dati salvati nell’elenco dello skipper per il charter.', 'Details saved in the skipper’s list for the charter.')
        : localized('Dati ancora da completare.', 'Details still need to be completed.'),
    },
    {
      tone: briefingReady ? 'complete' : 'waiting',
      label: localized('Briefing di sicurezza', 'Safety briefing'),
      detail: briefingReady
        ? briefingAcceptedAt
          ? localized(`Accettato il ${briefingAcceptedAt}.`, `Accepted on ${briefingAcceptedAt}.`)
          : localized('Regole di bordo accettate.', 'Board rules accepted.')
        : localized('Da leggere e accettare prima di salpare.', 'Read and accept it before departure.'),
    },
    paymentActivity,
  ];
  for (const direction of ['outbound', 'return']) {
    const progress = crewTravelProgress(direction);
    activity.push({ tone: progress.tone, label: progress.label, detail: progress.detail });
  }
  if (latestAnnouncement) {
    const title = latestAnnouncement.title || localized('Comunicazione dello skipper', 'Skipper update');
    const publishedAt = formatDateTime(latestAnnouncement.createdAt);
    activity.push({
      tone: 'update',
      label: localized('Ultimo aggiornamento dello skipper', 'Latest skipper update'),
      detail: `${title}${publishedAt ? ` · ${publishedAt}` : ''}`,
    });
  }
  list.innerHTML = activity.map((item) => `
    <li class="crew-activity-row crew-activity-row-${item.tone}">
      <span class="crew-activity-marker" aria-hidden="true">${item.tone === 'complete' ? '✓' : item.tone === 'attention' ? '!' : '•'}</span>
      <div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></div>
    </li>
  `).join('');
}

// Stesso dato di travel.js (crewTravelStatus.{direction}MeetingPoint/Time,
// scritto da writeCrewTransferOperationStatus): qui prima si diceva solo
// "chiedigli i dettagli del ritrovo", rimandando a un messaggio a parte che
// l'operatore doveva scrivere a mano (richiesta di Silvio, 30/09/2026).
function meetingDetailText(direction, operation) {
  const meetingPoint = String(activeCrewTravelStatus?.[`${direction}MeetingPoint`] || '').trim();
  const meetingTime = String(activeCrewTravelStatus?.[`${direction}MeetingTime`] || '').trim();
  if (meetingPoint || meetingTime) {
    const timeLabel = meetingTime ? localized(`ore ${meetingTime}`, `time ${meetingTime}`) : '';
    const bits = [meetingPoint, timeLabel].filter(Boolean).join(' · ');
    return ` ${localized('Punto di ritrovo:', 'Meeting point:')} ${bits}.`;
  }
  if (operation === 'planned' || operation === 'confirmed') {
    return ` ${localized('Il punto di ritrovo comparirà qui appena il gestore lo imposta.', 'The meeting point will appear here as soon as the organiser sets it.')}`;
  }
  return '';
}

function crewTravelProgress(direction) {
  const name = direction === 'outbound' ? localized('Andata', 'Outbound') : localized('Rientro', 'Return');
  if (crewTravelStatusReadError) return { tone: 'attention', label: `${name} · ${localized('stato non disponibile', 'status unavailable')}`, detail: localized('Non riesco a leggere l’ultimo aggiornamento. Riprova tra poco.', 'I cannot read the latest update. Try again shortly.') };
  if (!crewTravelStatusLoaded) return { tone: 'waiting', label: `${name} · ${localized('stato in aggiornamento', 'updating status')}`, detail: localized('Controllo l’ultimo stato salvato dal server.', 'Checking the latest state saved on the server.') };
  const travelState = activeCrewTravelStatus?.[direction];
  const transferState = activeCrewTravelStatus?.[`${direction}Transfer`];
  const operation = activeCrewTravelStatus?.[`${direction}OperationStatus`];
  const item = (tone, label, detail) => ({ tone, label: `${name} · ${label}`, detail });
  // Il transfer si chiede, non è previsto d'ufficio: non aver chiesto niente
  // non è una pratica aperta, è una scelta legittima. Lo diciamo come fatto,
  // con il promemoria che nessuno passa a prendere chi non ha chiesto
  // (richiesta di Silvio, 2/10/2026).
  if (transferState === 'requested' && travelState === 'draft') return item(
    'waiting',
    localized('transfer richiesto · viaggio in bozza', 'transfer requested · trip in draft'),
    `${localized('La richiesta è partita. Completa gli orari quando li conosci.', 'The request went through. Fill in the times when you know them.')} ${crewTransferPaidNote()}`,
  );
  if (transferState === 'undecided') return item(
    'attention',
    localized('transfer da completare', 'transfer to complete'),
    localized('Hai scelto il transfer ma manca il consenso: la richiesta non è partita e nessuno passerà a prenderti. Aprila e metti la spunta.', 'You chose the transfer but the consent is missing: the request never went through and nobody will pick you up. Open it and tick the box.'),
  );
  if (transferState !== 'requested') return item(
    'complete',
    direction === 'outbound'
      ? localized('a Marsala ci arrivi tu', 'you get to Marsala on your own')
      : localized('all’aeroporto ci arrivi tu', 'you get to the airport on your own'),
    localized('Nessun transfer organizzato per questa tratta: se ti va bene così non devi fare niente. Se lo vuoi, aprilo da Arrivi e partenze.', 'No organised transfer for this leg: if that works for you there is nothing to do. If you want one, open Arrivals and departures.'),
  );
  if (operation === 'planned') return item('update', localized('transfer in organizzazione', 'transfer being arranged'), `${localized('Il gestore sta preparando il collegamento.', 'The organiser is preparing the connection.')}${meetingDetailText(direction, operation)} ${crewTransferPaidNote()}`);
  if (operation === 'confirmed') return item('complete', localized('transfer confermato', 'transfer confirmed'), `${localized('Il gestore ha confermato il collegamento.', 'The organiser confirmed the connection.')}${meetingDetailText(direction, operation)} ${crewTransferPaidNote()}`);
  if (operation === 'completed') return item('complete', localized('transfer concluso', 'transfer completed'), `${localized('Il gestore ha segnato il collegamento come concluso.', 'The organiser marked the connection as completed.')} ${crewTransferPaidNote()}`);
  if (operation === 'cancelled') return item('attention', localized('transfer annullato', 'transfer cancelled'), localized('Contatta lo skipper prima di partire.', 'Contact your skipper before travelling.'));
  return item('waiting', localized('transfer richiesto', 'transfer requested'), `${localized('Richiesta salvata; il gestore non l’ha ancora confermata.', 'Request saved; the organiser has not confirmed it yet.')} ${crewTransferPaidNote()}`);
}

function crewTransferPaidNote() {
  const fallback = localized(
    'Il transfer organizzato è a pagamento; il gestore confermerà il costo esatto.',
    'The organised transfer is a paid service; the organiser will confirm the exact fare.',
  );
  const tpsCents = activeTransferPricing?.tpsPricePerPersonCents;
  const pmoCents = activeTransferPricing?.pmoPricePerPersonCents;
  if (!Number.isFinite(tpsCents) || tpsCents <= 0 || !Number.isFinite(pmoCents) || pmoCents <= 0) return fallback;
  if (!Number.isInteger(activeTransferPricing?.minimumBillablePersons) || activeTransferPricing.minimumBillablePersons <= 0) return fallback;
  const minimum = activeTransferPricing.minimumBillablePersons;
  return localized(
    `Servizio a pagamento: Trapani ${formatCurrency(tpsCents / 100)} a persona, Palermo ${formatCurrency(pmoCents / 100)} a persona; minimo ${minimum} persone fatturate. Il gestore confermerà il tuo importo esatto.`,
    `Paid service: Trapani ${formatCurrency(tpsCents / 100)} per person, Palermo ${formatCurrency(pmoCents / 100)} per person; minimum ${minimum} people billed. The organiser will confirm your exact fare.`,
  );
}

function crewHasPaidTransferRequest() {
  return ['outbound', 'return'].some((direction) => activeCrewTravelStatus?.[`${direction}Transfer`] === 'requested');
}

function renderCrewDashboardOverview() {
  if (!crewDashboardInitialized) return;
  const copy = crewDashboardCopy();
  const pendingPayments = activeCrewPayments.filter((payment) => payment.status !== 'verified' && payment.status !== 'cancelled').length;
  const verifiedPayments = activeCrewPayments.filter((payment) => payment.status === 'verified').length;
  const pendingPaymentCents = activeCrewPayments
    .filter(isPendingCrewPayment)
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const verifiedPaymentCents = activeCrewPayments
    .filter((payment) => payment.status === 'verified')
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const onlineContribution = onlineContributionBalance();
  const projectedPaymentSummary = onlineContribution.hasTarget && !onlineContribution.isExempt
    ? `${formatCurrency(onlineContribution.targetCents / 100)} ${localized('concordati', 'agreed')}`
    : copy.noPayments;
  const announcements = activeCrewAnnouncements.length;
  const profileReady = Boolean(activeMember);
  const briefingReady = hasAcceptedCurrentBriefing();
  const pendingPaymentSummary = copy.paymentsPending
    .replace('{count}', String(pendingPayments))
    .replace('{suffix}', crewPluralSuffix(pendingPayments, 'a', 'e'));
  const verifiedPaymentSummary = copy.paymentsVerified
    .replace('{count}', String(verifiedPayments))
    .replace('{suffix}', crewPluralSuffix(verifiedPayments, 'o', 'i'))
    .replace('{suffixVerified}', crewPluralSuffix(verifiedPayments, 'o', 'i'));
  const moneyValue = onlineContribution.isExempt
    ? localized('Esente dalle quote', 'Exempt from contributions')
    : onlineContribution.hasTarget && onlineContribution.overpaidCents > 0
      ? `${formatCurrency(onlineContribution.overpaidCents / 100)} ${localized('oltre quota', 'over the agreed amount')}`
      : onlineContribution.hasTarget && onlineContribution.remainingCents > 0
        ? `${formatCurrency(onlineContribution.remainingCents / 100)} ${localized('saldo da versare', 'balance to pay')}`
        : onlineContribution.hasTarget
          ? localized('Quota coperta', 'Contribution covered')
          : pendingPayments
            ? `${formatCurrency(pendingPaymentCents / 100)} ${localized('da regolare', 'to settle')}`
            : verifiedPayments
              ? `${formatCurrency(verifiedPaymentCents / 100)} ${localized('confermati', 'confirmed')}`
              : projectedPaymentSummary;
  const verifiedDetail = verifiedContributionDetail(onlineContribution);
  const pendingDetail = onlineContribution.pendingCents > 0
    ? localized(
      `Richieste già inviate: ${formatCurrency(onlineContribution.pendingCents / 100)}. Non riducono il saldo finché lo skipper non verifica l’accredito.`,
      `Requests already sent: ${formatCurrency(onlineContribution.pendingCents / 100)}. They do not reduce the balance until the skipper verifies the payment.`,
    )
    : '';
  const moneyDetail = onlineContribution.isExempt
    ? localized('Starter Pack e cauzione rimborsabile, se previsti, restano separati.', 'Starter Pack and refundable deposit, if applicable, remain separate.')
    : onlineContribution.hasTarget
      ? [
        verifiedDetail || localized('Nessun accredito è ancora stato verificato.', 'No payment has been verified yet.'),
        pendingDetail,
        onlineContribution.overpaidCents > 0
          ? localized('Non inviare altri versamenti: verifica prima l’eccedenza con lo skipper.', 'Do not make further payments: check the excess with the skipper first.')
          : '',
        onlineContribution.remainingCents > 0 && paymentInstructionsAreReady()
          ? localized('Apri questa card per scegliere il metodo di versamento e copiare la causale.', 'Open this card to choose a payment method and copy the payment reference.')
          : '',
        localized('Starter Pack e cauzione rimborsabile restano separati.', 'Starter Pack and refundable deposit remain separate.'),
      ].filter(Boolean).join(' ')
      : `${copy.moneyDetail} · ${localized('La cauzione rimborsabile è sempre separata.', 'The refundable deposit is always separate.')}`;
  setCrewDashboardMetric(
    'board',
    briefingReady ? copy.briefingReady : copy.briefingWaiting,
    copy.announcements
      .replace('{count}', String(announcements))
      .replace('{suffix}', crewPluralSuffix(announcements, 'e', 'i')),
    !briefingReady,
  );
  const moneyNeedsAttention = onlineContribution.hasTarget && !onlineContribution.isExempt && onlineContribution.remainingCents > 0;
  setCrewDashboardMetric(
    'money',
    moneyValue,
    moneyDetail,
    moneyNeedsAttention,
  );
  setCrewDashboardMetric('profile', profileReady ? copy.profileReady : copy.profileWaiting, copy.profileDetail, !profileReady);
  const outboundProgress = crewTravelProgress('outbound');
  const returnProgress = crewTravelProgress('return');
  // Una richiesta transfer già salvata è in attesa del gestore, non di una
  // nuova azione della persona: il bordo ambra resta soltanto per ciò che
  // l'equipaggio deve ancora completare o correggere.
  const travelNeedsAttention = crewTravelNeedsAttention(outboundProgress, returnProgress);
  const travelDetail = [
    `${outboundProgress.label} · ${returnProgress.label}`,
    crewHasPaidTransferRequest() ? crewTransferPaidNote() : '',
  ].filter(Boolean).join(' · ');
  setCrewDashboardMetric('travel', copy.travel, travelDetail, travelNeedsAttention);
  const cabinAssigned = Boolean(activeProjection?.berthType);
  setCrewDashboardMetric(
    'cabin',
    cabinAssigned ? projectionBerthLabel() : copy.cabinUnassigned,
    copy.cabinDetail,
    !cabinAssigned,
  );
  const readyItems = [profileReady, briefingReady].filter(Boolean).length;
  setCrewDashboardMetric(
    'activity',
    copy.activityProgress
      .replace('{count}', String(readyItems))
      .replace('{suffix}', crewPluralSuffix(readyItems, 'o', 'i'))
      .replace('{suffixCompleted}', crewPluralSuffix(readyItems, 'o', 'i')),
    copy.activityDetail,
  );
  renderCrewActivityTimeline({ profileReady, briefingReady, pendingPayments, verifiedPayments, pendingPaymentCents, verifiedPaymentCents });
  const participantStatus = document.querySelector('#participantStatus');
  if (participantStatus) {
    participantStatus.textContent = [
      profileReady ? copy.profileReady : copy.profileWaiting,
      briefingReady ? copy.briefingReady : copy.briefingWaiting,
      onlineContribution.hasTarget || onlineContribution.isExempt
        ? moneyValue
        : (pendingPayments ? pendingPaymentSummary : (verifiedPayments ? verifiedPaymentSummary : projectedPaymentSummary)),
    ].join(' · ');
  }

  const nextActionText = document.querySelector('#crewNextActionText');
  const nextActionButton = document.querySelector('#crewNextActionButton');
  if (!nextActionText || !nextActionButton) return;
  if (!profileReady) {
    nextActionText.textContent = copy.profileAction;
    nextActionButton.textContent = copy.openProfile;
    nextActionButton.dataset.crewView = 'profile';
  } else if (!briefingReady) {
    nextActionText.textContent = copy.boardAction;
    nextActionButton.textContent = copy.openBoard;
    nextActionButton.dataset.crewView = 'board';
  } else if (pendingPayments) {
    nextActionText.textContent = copy.pendingAction;
    nextActionButton.textContent = copy.openPayments;
    nextActionButton.dataset.crewView = 'money';
  } else if (onlineContribution.hasTarget && !onlineContribution.isExempt && onlineContribution.remainingCents > 0) {
    nextActionText.textContent = paymentInstructionsAreReady()
      ? localized(
        'Apri la tua quota: trovi i metodi disponibili, la causale da copiare e la distinzione dai contanti di bordo.',
        'Open your contribution: you will find available methods, the payment reference to copy and the separate cash-on-board amounts.',
      )
      : localized(
        'La quota è pronta; lo skipper deve ancora pubblicare qui i metodi di versamento.',
        'Your contribution is ready; the skipper still needs to publish payment methods here.',
      );
    nextActionButton.textContent = paymentInstructionsAreReady()
      ? localized('Scegli come versare', 'Choose how to pay')
      : localized('Apri la mia quota', 'Open my contribution');
    nextActionButton.dataset.crewView = 'money';
  } else {
    nextActionText.textContent = copy.allReady;
    nextActionButton.textContent = copy.openBoard;
    nextActionButton.dataset.crewView = 'board';
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(activeLocale() === 'en' ? 'en-GB' : 'it-IT').format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(activeLocale() === 'en' ? 'en-GB' : 'it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat(activeLocale() === 'en' ? 'en-GB' : 'it-IT', { style: 'currency', currency: 'EUR' }).format(amount || 0);
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

function paymentMethodLabel(methodId) {
  const labels = {
    paypal: 'PayPal',
    satispay: 'Satispay',
    revolut: 'Revolut',
    bankTransfer: localized('Bonifico', 'Bank transfer'),
  };
  return labels[methodId] || methodId;
}

function safeHttpsPaymentUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch (error) {
    return '';
  }
}

function safeRevolutRevtag(value) {
  const tag = String(value || '').trim();
  return /^@[a-zA-Z0-9._-]{3,50}$/.test(tag) ? tag : '';
}

function paymentInstructionsAreReady(instructions = activePaymentInstructions) {
  if (!instructions || typeof instructions !== 'object') return false;
  const methods = instructions.paymentMethods || {};
  const details = instructions.paymentDetails || {};
  const bankTransfer = details.bankTransfer || {};
  return (methods.paypal === true && Boolean(safeHttpsPaymentUrl(details.paypal)))
    || (methods.satispay === true && Boolean(safeHttpsPaymentUrl(details.satispay)))
    || (methods.revolut === true && Boolean(safeHttpsPaymentUrl(details.revolut) || safeRevolutRevtag(details.revolut)))
    || (methods.bankTransfer === true
      && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(String(bankTransfer.iban || '').trim())
      && String(bankTransfer.accountHolder || '').trim().length >= 2);
}

function copyTextFallback(value) {
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  return copied;
}

async function copyPaymentInstruction(value) {
  const text = String(value || '').trim();
  if (!text) return;
  const status = document.querySelector('[data-payment-instruction-status]');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (!copyTextFallback(text)) {
      throw new Error('copy-not-supported');
    }
    if (status) status.textContent = localized('Copiato. Incollalo nell’app che preferisci.', 'Copied. Paste it in the app you prefer.');
  } catch (error) {
    if (status) status.textContent = localized('Non riesco a copiare automaticamente: seleziona e copia il testo.', 'I could not copy it automatically: select and copy the text.');
  }
}

function paymentStatusLabel(payment) {
  if (payment?.entryType === 'manual_receipt') return localized('Registrato e verificato', 'Recorded and verified');
  if (payment.status === 'verified') return localized('Accredito confermato', 'Payment confirmed');
  if (payment.status === 'cancelled') return localized('Richiesta annullata', 'Request cancelled');
  if (payment.declaredAt) return localized('Dichiarato, in attesa di conferma', 'Reported as paid, awaiting confirmation');
  return localized('Da regolare', 'To be settled');
}

function canDeclareCrewPayment(payment) {
  return isPendingCrewPayment(payment)
    && !isManualCrewReceipt(payment)
    && !payment.declaredAt
    && Object.keys(payment.paymentMethods || {}).some((methodId) => payment.paymentMethods[methodId] === true);
}

// Un solo controllo alla volta: la persona sceglie il metodo appena prima di
// dichiarare, non lo prepara in anticipo. Evita di dover salvare uno stato
// intermedio "metodo scelto" solo per la UI.
function paymentDeclareMarkup(payment, paymentId) {
  if (!canDeclareCrewPayment(payment)) return '';
  const methods = PAYMENT_METHODS.filter((method) => payment.paymentMethods?.[method.id] === true);
  const options = methods.map((method) => `<option value="${escapeHtml(method.id)}">${escapeHtml(method.label)}</option>`).join('');
  return `<div class="payment-declare-controls" data-payment-declare-id="${escapeHtml(paymentId)}">
    <label>
      <span>${escapeHtml(localized('Con quale metodo hai pagato?', 'Which method did you pay with?'))}</span>
      <select data-declare-method-select>
        <option value="" selected>${escapeHtml(localized('Scegli il metodo', 'Choose the method'))}</option>
        ${options}
      </select>
    </label>
    <button class="button button-ghost" type="button" data-declare-payment="${escapeHtml(paymentId)}">${escapeHtml(localized('Ho pagato', 'I paid'))}</button>
    <p class="payment-declare-message" data-declare-payment-message role="status" aria-live="polite"></p>
  </div>`;
}

async function declareCrewPayment(paymentId, controls) {
  const select = controls.querySelector('[data-declare-method-select]');
  const message = controls.querySelector('[data-declare-payment-message]');
  const method = select?.value || '';
  if (!method) {
    setMessage(message, localized('Scegli un metodo prima di continuare.', 'Choose a method before continuing.'), true);
    return;
  }
  const button = controls.querySelector('[data-declare-payment]');
  button.disabled = true;
  select.disabled = true;
  try {
    await withSaveRetry(
      () => updateDoc(doc(db, 'boats', activeInvite.boatId, 'paymentRequests', paymentId), {
        declaredAt: serverTimestamp(),
        declaredBy: auth.currentUser.uid,
        declaredMethod: method,
      }),
      () => setMessage(message, localized('Connessione lenta — verifico se è stato comunque salvato…', 'Slow connection — checking whether it actually saved…')),
    );
    // Nessun messaggio di conferma locale: la sottoscrizione paymentRequests
    // ridisegna subito la card con lo stato "Dichiarato".
  } catch (error) {
    console.error('Egadi dichiarazione pagamento:', error);
    setMessage(message, localized('Non riesco a registrare la dichiarazione. Riprova tra poco.', 'I could not save this. Please try again shortly.'), true);
    button.disabled = false;
    select.disabled = false;
  }
}

function paymentAmountCents(payment) {
  return Math.round(paymentAmount(payment) * 100);
}

function isPendingCrewPayment(payment) {
  return payment.status !== 'verified' && payment.status !== 'cancelled';
}

function isManualCrewReceipt(payment) {
  return payment?.entryType === 'manual_receipt';
}

function isSelfReportedCrewPayment(payment) {
  return payment?.entryType === 'self_reported';
}

function paymentInstallmentKind(payment) {
  const value = String(payment?.installmentType || '').trim().toLowerCase();
  if (value === 'advance') return 'advance';
  if (value === 'balance') return 'balance';
  if (value === 'full') return 'full';
  if (value === 'extra') return 'extra';
  return 'history';
}

function paymentInstallmentLabel(payment) {
  if (isSelfReportedCrewPayment(payment)) return localized('Segnalato da te', 'Reported by you');
  const labels = {
    advance: localized('Acconto', 'Advance'),
    balance: localized('Saldo', 'Balance'),
    full: localized('Quota', 'Contribution'),
    extra: localized('Voce separata', 'Separate item'),
    history: localized('Storico', 'History'),
  };
  const label = labels[paymentInstallmentKind(payment)] || labels.history;
  if (!isManualCrewReceipt(payment) || paymentInstallmentKind(payment) === 'history') return label;
  return localized(`${label} · registrato`, `${label} · recorded`);
}

function validPaymentAllocationCents(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function paymentAllocation(payment) {
  const amountCents = paymentAmountCents(payment);
  const allocation = payment?.allocation;
  const berthCents = allocation?.berthCents;
  const protectionInsuranceCents = allocation?.protectionInsuranceCents;
  const hasValidExplicitAllocation = allocation
    && typeof allocation === 'object'
    && validPaymentAllocationCents(berthCents)
    && validPaymentAllocationCents(protectionInsuranceCents)
    && berthCents + protectionInsuranceCents === amountCents;
  if (hasValidExplicitAllocation) {
    return {
      berthCents,
      protectionInsuranceCents,
      source: 'allocation',
    };
  }

  const contributionItemId = String(payment?.contributionItemId || '');
  if (PERSONAL_PAYMENT_GROUPS.berth.has(contributionItemId)) {
    return { berthCents: amountCents, protectionInsuranceCents: 0, source: 'legacy' };
  }
  if (PERSONAL_PAYMENT_GROUPS.protection_insurance.has(contributionItemId)) {
    return { berthCents: 0, protectionInsuranceCents: amountCents, source: 'legacy' };
  }
  return { berthCents: 0, protectionInsuranceCents: 0, source: 'unclassified' };
}

function paymentAllocationCentsForGroup(payment, groupId) {
  const allocation = paymentAllocation(payment);
  if (groupId === 'berth') return allocation.berthCents;
  if (groupId === 'protection_insurance') return allocation.protectionInsuranceCents;
  return 0;
}

function onlineContributionPaymentTotals() {
  const rows = activeCrewPayments
    .filter((payment) => payment.status !== 'cancelled')
    .map((payment) => ({
      payment,
      allocation: paymentAllocation(payment),
    }))
    .filter(({ allocation }) => allocation.berthCents + allocation.protectionInsuranceCents > 0);
  const totalFor = (predicate) => rows
    .filter(predicate)
    .reduce((total, { allocation }) => total + allocation.berthCents + allocation.protectionInsuranceCents, 0);
  const verifiedRows = rows.filter(({ payment }) => payment.status === 'verified');
  const totalVerifiedForInstallment = (kind) => verifiedRows
    .filter(({ payment }) => paymentInstallmentKind(payment) === kind)
    .reduce((total, { allocation }) => total + allocation.berthCents + allocation.protectionInsuranceCents, 0);
  return {
    rows,
    requestedCents: totalFor(() => true),
    verifiedCents: totalFor(({ payment }) => payment.status === 'verified'),
    pendingCents: totalFor(({ payment }) => isPendingCrewPayment(payment)),
    verifiedAdvanceCents: totalVerifiedForInstallment('advance'),
    verifiedBalanceCents: totalVerifiedForInstallment('balance'),
    verifiedFullCents: totalVerifiedForInstallment('full'),
    verifiedHistoryCents: totalVerifiedForInstallment('history'),
  };
}

function projectionAmountCents(fieldName) {
  if (activeProjection?.contributesToCosts === false && fieldName !== 'refundableDepositCents') return 0;
  const amountCents = Number(activeProjection?.[fieldName]);
  return Number.isInteger(amountCents) && amountCents > 0 ? amountCents : 0;
}

function projectionHasFrozenPricing() {
  return activeProjection?.status === 'invited'
    && (Boolean(activeProjection?.pricingSnapshotAt)
      || activeProjection?.pricingMode === 'dashboard'
      || activeProjection?.pricingMode === 'custom');
}

function projectionPayableCents() {
  return ['berthCents', 'protectionInsuranceCents']
    .reduce((total, fieldName) => total + projectionAmountCents(fieldName), 0);
}

function projectionBerthLabel() {
  const labels = {
    double_cabin: localized('Cabina doppia', 'Double cabin'),
    single_cabin: localized('Cabina singola', 'Single cabin'),
    dinette: 'Dinette',
    other: localized('Altra sistemazione', 'Other accommodation'),
  };
  return labels[activeProjection?.berthType] || localized('Da definire', 'To be confirmed');
}

function projectedRefundableDepositSummary() {
  const amountCents = projectionAmountCents('refundableDepositCents');
  if (!amountCents && !projectionHasFrozenPricing()) return contributionPlanFallback('refundable_deposit', { deposit: true });
  if (!amountCents) {
    return {
      value: localized('Non prevista per il tuo posto', 'Not included for your berth'),
      detail: localized('Nella quota fissata dal tuo skipper non è prevista una cauzione rimborsabile per te.', 'Your skipper’s agreed contribution does not include a refundable deposit for you.'),
    };
  }
  return {
    value: `${formatCurrency(amountCents / 100)} ${localized('all’imbarco', 'at boarding')}`,
    detail: localized(
      'Contanti all’imbarco; resta separata dalle richieste di pagamento.',
      'Cash at boarding; it stays separate from payment requests.',
    ),
  };
}

function starterPackCashAmountCents() {
  if (activeProjection?.contributesToCosts === false) {
    return 0;
  }
  const projectedCents = projectionAmountCents('starterPackCents');
  const plannedItem = contributionPlanItems().find((item) => item.id === 'starter_pack');
  return projectionHasFrozenPricing()
    ? projectedCents
    : projectedCents || contributionAmountCents(plannedItem);
}

function starterPackCashSummary() {
  if (activeProjection?.contributesToCosts === false) {
    return {
      value: localized('Non previsto', 'Not applicable'),
      detail: localized('Lo Starter Pack non è previsto per il tuo ruolo gratuito.', 'The Starter Pack is not planned for your complimentary role.'),
    };
  }
  const projectedCents = projectionAmountCents('starterPackCents');
  const plannedItem = contributionPlanItems().find((item) => item.id === 'starter_pack');
  // Le card storiche potevano usare "included" per il Pack senza salvarne
  // la quota individuale. Non facciamolo sembrare già pagato: il modello
  // attuale lo regola comunque cash a bordo.
  const legacyIncludedInCharter = plannedItem?.state === 'included' && !projectedCents;
  const amountCents = starterPackCashAmountCents();
  const value = amountCents
    ? `${formatCurrency(amountCents / 100)} ${localized('in contanti a bordo', 'cash on board')}`
    : legacyIncludedInCharter
      ? localized('Quota da definire · contanti a bordo', 'Amount to be confirmed · cash on board')
    : projectionHasFrozenPricing()
      ? localized('Non previsto nella quota fissata', 'Not included in the agreed contribution')
      : localized('Da definire · contanti a bordo', 'To be confirmed · cash on board');
  const hasSnapshot = Array.isArray(activeProjection?.starterPackItemsSnapshot);
  const description = hasSnapshot
    ? starterPackItemsDescription(starterPackItemsForActiveProjection())
    : String(plannedItem?.description || '').trim();
  return {
    value,
    detail: legacyIncludedInCharter
      ? localized(
        `${description || 'Lo Starter Pack riunisce i servizi scelti per la barca.'} È già parte del costo charter, ma la quota individuale non è ancora stata indicata: chiedi allo skipper. Quando sarà definita, si regola in contanti a bordo e non con una richiesta online.`,
        `${description || 'The Starter Pack brings together the services selected for the boat.'} It is already part of the charter cost, but the individual amount has not yet been set: ask your skipper. Once confirmed, it is settled in cash on board, not through an online request.`,
      )
      : localized(
        `${description || 'Lo Starter Pack riunisce i servizi scelti per la barca.'} Per questa barca si paga solo in contanti a bordo: non entra nelle richieste online e non usa link di pagamento.`,
        `${description || 'The Starter Pack brings together the services selected for the boat.'} For this boat it is settled in cash on board only: it is not included in online requests and does not use payment links.`,
      ),
  };
}

function paymentTotalsForGroup(groupId) {
  const payments = activeCrewPayments.filter((payment) => payment.status !== 'cancelled'
    && paymentAllocationCentsForGroup(payment, groupId) > 0);
  const amountFor = (payment) => paymentAllocationCentsForGroup(payment, groupId);
  return {
    payments,
    requestedCents: payments.reduce((total, payment) => total + amountFor(payment), 0),
    verifiedCents: payments
      .filter((payment) => payment.status === 'verified')
      .reduce((total, payment) => total + amountFor(payment), 0),
    pendingCents: payments
      .filter(isPendingCrewPayment)
      .reduce((total, payment) => total + amountFor(payment), 0),
  };
}

function personalAmountCents(groupId, planItemId, projectionField) {
  const projectedCents = projectionAmountCents(projectionField);
  if (projectedCents || projectionHasFrozenPricing()) return projectedCents;
  const requestedCents = paymentTotalsForGroup(groupId).requestedCents;
  if (requestedCents > 0) return requestedCents;
  return contributionAmountCents(contributionPlanItems().find((item) => item.id === planItemId));
}

function onlineContributionBalance() {
  const berthCents = personalAmountCents('berth', 'berth', 'berthCents');
  const protectionInsuranceCents = personalAmountCents('protection_insurance', 'protection_insurance', 'protectionInsuranceCents');
  const targetCents = berthCents + protectionInsuranceCents;
  const isExempt = activeProjection?.contributesToCosts === false;
  const hasTarget = isExempt || targetCents > 0 || projectionHasFrozenPricing();
  const payments = onlineContributionPaymentTotals();
  const remainingCents = hasTarget ? Math.max(0, targetCents - payments.verifiedCents) : 0;
  const overpaidCents = hasTarget ? Math.max(0, payments.verifiedCents - targetCents) : 0;
  return {
    berthCents,
    protectionInsuranceCents,
    targetCents,
    hasTarget,
    isExempt,
    remainingCents,
    overpaidCents,
    ...payments,
  };
}

function participantPaymentCausale() {
  const recipient = String(activeMember?.displayName || activeInvite?.displayName || '').trim();
  return ['Egadi Sailing Experience', localized('quota equipaggio', 'crew contribution'), recipient]
    .filter(Boolean)
    .join(' · ');
}

function paymentInstructionCopyControl(value, label) {
  return `<button class="participant-payment-copy" type="button" data-copy-payment-instruction="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function participantPaymentInstructionsMarkup(onlineContribution) {
  if (onlineContribution.isExempt || !onlineContribution.hasTarget || onlineContribution.remainingCents <= 0) return '';
  if (!paymentInstructionsAreReady()) {
    return `<section class="participant-payment-instructions participant-payment-instructions-waiting">
      <p class="eyebrow">${escapeHtml(localized('Come versare', 'How to pay'))}</p>
      <h5>${escapeHtml(localized('Coordinate in aggiornamento', 'Payment details being updated'))}</h5>
      <p>${escapeHtml(localized('Lo skipper non ha ancora pubblicato qui i metodi di versamento. Non serve un nuovo invito: torna in questa sezione tra poco oppure chiedi allo skipper di completare il profilo di incasso.', 'The skipper has not published payment details here yet. You do not need a new invitation: return to this section shortly or ask the skipper to complete the payment profile.'))}</p>
    </section>`;
  }
  const instructions = activePaymentInstructions;
  const methods = instructions.paymentMethods || {};
  const details = instructions.paymentDetails || {};
  const bankTransfer = details.bankTransfer || {};
  const collectorName = String(instructions.collectorName || '').trim() || localized('lo skipper', 'the skipper');
  const remaining = formatCurrency(onlineContribution.remainingCents / 100);
  const causale = participantPaymentCausale();
  const methodCards = [];
  const paypalUrl = methods.paypal === true ? safeHttpsPaymentUrl(details.paypal) : '';
  const satispayUrl = methods.satispay === true ? safeHttpsPaymentUrl(details.satispay) : '';
  const revolutUrl = methods.revolut === true ? safeHttpsPaymentUrl(details.revolut) : '';
  const revolutTag = methods.revolut === true ? safeRevolutRevtag(details.revolut) : '';
  const iban = methods.bankTransfer === true ? String(bankTransfer.iban || '').trim() : '';
  const accountHolder = methods.bankTransfer === true ? String(bankTransfer.accountHolder || '').trim() : '';
  if (paypalUrl) {
    methodCards.push(`<article class="participant-payment-method"><span>${escapeHtml(paymentMethodLabel('paypal'))}</span><a class="button button-ghost" href="${escapeHtml(paypalUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized('Apri PayPal', 'Open PayPal'))}</a></article>`);
  }
  if (satispayUrl) {
    methodCards.push(`<article class="participant-payment-method"><span>${escapeHtml(paymentMethodLabel('satispay'))}</span><a class="button button-ghost" href="${escapeHtml(satispayUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized('Apri Satispay', 'Open Satispay'))}</a></article>`);
  }
  if (revolutUrl) {
    methodCards.push(`<article class="participant-payment-method"><span>${escapeHtml(paymentMethodLabel('revolut'))}</span><a class="button button-ghost" href="${escapeHtml(revolutUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized('Apri Revolut', 'Open Revolut'))}</a></article>`);
  } else if (revolutTag) {
    methodCards.push(`<article class="participant-payment-method"><span>${escapeHtml(paymentMethodLabel('revolut'))}</span><strong>${escapeHtml(revolutTag)}</strong>${paymentInstructionCopyControl(revolutTag, localized('Copia Revtag', 'Copy Revtag'))}</article>`);
  }
  if (iban && accountHolder) {
    methodCards.push(`<article class="participant-payment-method participant-payment-method-bank"><span>${escapeHtml(paymentMethodLabel('bankTransfer'))}</span><strong>${escapeHtml(accountHolder)}</strong><code>${escapeHtml(iban)}</code>${paymentInstructionCopyControl(iban, localized('Copia IBAN', 'Copy IBAN'))}</article>`);
  }
  return `<section class="participant-payment-instructions">
    <div><p class="eyebrow">${escapeHtml(localized('Come versare', 'How to pay'))}</p><h5>${escapeHtml(localized(`Da versare ora: ${remaining}`, `Amount to pay now: ${remaining}`))}</h5></div>
    <p>${escapeHtml(localized(`Il sito non riceve denaro. Scegli uno dei metodi indicati da ${collectorName}; dopo il versamento avvisalo così potrà verificare manualmente l’accredito.`, `The site does not receive money. Choose one of the methods provided by ${collectorName}; after paying, let them know so they can manually verify the payment.`))}</p>
    <div class="participant-payment-methods">${methodCards.join('')}</div>
    <div class="participant-payment-causale"><span>${escapeHtml(localized('Causale consigliata', 'Suggested payment reference'))}</span><code>${escapeHtml(causale)}</code>${paymentInstructionCopyControl(causale, localized('Copia causale', 'Copy reference'))}</div>
    <p class="participant-payment-note">${escapeHtml(localized('Starter Pack e cauzione rimborsabile restano separati: controlla le rispettive card qui sotto per sapere cosa portare in contanti a bordo.', 'The Starter Pack and refundable deposit remain separate: check their cards below to see what to bring in cash on board.'))}</p>
    <p class="participant-payment-status" data-payment-instruction-status role="status" aria-live="polite"></p>
    ${selfReportPaymentMarkup(methods, onlineContribution.remainingCents)}
  </section>`;
}

// Non tutti pagano dopo una richiesta formale dello skipper: chi versa di
// propria iniziativa (es. bonifico spontaneo dopo aver letto questi
// metodi) deve poter segnalarlo subito, senza restare bloccato ad
// aspettare che lo skipper prepari prima una richiesta nominale — caso
// reale del 24/09/2026 con Carla Olivieri, che aveva già pagato ma non
// aveva nessun pulsante per dirlo. La segnalazione crea una richiesta a
// tutti gli effetti già "dichiarata": lo skipper la vede e la verifica
// esattamente come le altre, non serve nessuna azione tecnica in più.
function selfReportPaymentMarkup(methods, remainingCents) {
  const availableMethods = PAYMENT_METHODS.filter((method) => methods[method.id] === true);
  if (!availableMethods.length) return '';
  const options = availableMethods.map((method) => `<option value="${escapeHtml(method.id)}">${escapeHtml(method.label)}</option>`).join('');
  const defaultAmount = remainingCents > 0 ? (remainingCents / 100).toFixed(2) : '';
  return `<div class="payment-self-report" data-payment-self-report>
    <p class="payment-self-report-intro">${escapeHtml(localized('Hai già versato? Segnalalo qui: lo skipper lo vede subito e verifica l’accredito.', 'Already paid? Report it here: the skipper sees it right away and verifies the payment.'))}</p>
    <label>
      <span>${escapeHtml(localized('Importo versato', 'Amount paid'))}</span>
      <input type="number" step="0.01" min="0.01" max="10000" inputmode="decimal" data-report-amount value="${escapeHtml(defaultAmount)}" />
    </label>
    <label>
      <span>${escapeHtml(localized('Con quale metodo hai pagato?', 'Which method did you pay with?'))}</span>
      <select data-report-method-select>
        <option value="" selected>${escapeHtml(localized('Scegli il metodo', 'Choose the method'))}</option>
        ${options}
      </select>
    </label>
    <button class="button button-ghost" type="button" data-report-payment>${escapeHtml(localized('Ho pagato', 'I paid'))}</button>
    <p class="payment-self-report-message" data-report-payment-message role="status" aria-live="polite"></p>
  </div>`;
}

async function reportCrewPayment(controls) {
  const amountInput = controls.querySelector('[data-report-amount]');
  const select = controls.querySelector('[data-report-method-select]');
  const message = controls.querySelector('[data-report-payment-message]');
  const method = select?.value || '';
  const amount = Number(amountInput?.value);
  const amountCents = Math.round(amount * 100);
  if (!method) {
    setMessage(message, localized('Scegli un metodo prima di continuare.', 'Choose a method before continuing.'), true);
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amountCents) || amountCents > 1000000) {
    setMessage(message, localized('Inserisci un importo valido.', 'Enter a valid amount.'), true);
    return;
  }
  const button = controls.querySelector('[data-report-payment]');
  button.disabled = true;
  select.disabled = true;
  amountInput.disabled = true;
  setMessage(message, localized('Invio…', 'Sending…'));
  try {
    if (await isScriptStale(import.meta.url)) {
      setMessage(message, localized(
        'Questa pagina non era aggiornata. La ricarico — riprova a segnalare il pagamento dopo il ricaricamento.',
        'This page was not up to date. Reloading it now — please report the payment again after it reloads.',
      ), true);
      window.location.reload();
      return;
    }
    // L'identificativo si decide QUI, una volta sola, prima di qualunque
    // tentativo. Fino al 3/10/2026 questa scrittura usava addDoc dentro
    // withSaveRetry: addDoc genera un documento nuovo a ogni chiamata, e
    // withSaveRetry ritenta dopo 800, 1600 e 3200 ms. Su una rete lenta una
    // prima scrittura arrivata al server ma con la risposta persa produceva
    // una SECONDA segnalazione di pagamento. È successo davvero il 2/10/2026:
    // Fabio Marcomin risultava con due bonifici da 300 € a otto secondi
    // l'uno dall'altro, e lo skipper ha dovuto annullarne uno a mano.
    //
    // withSaveRetry è sicuro solo con scritture ripetibili (setDoc, updateDoc,
    // transazioni), che ricadono sempre sullo stesso documento. Questo era
    // l'unico punto del sito dove veniva usato con una scrittura che non lo è.
    const paymentRef = doc(collection(db, 'boats', activeInvite.boatId, 'paymentRequests'));
    await withSaveRetry(
      async () => {
        // Se il tentativo precedente era in realtà arrivato, non si riscrive:
        // una seconda setDoc sullo stesso documento verrebbe letta come una
        // modifica e le regole la rifiuterebbero, facendo sembrare fallito un
        // pagamento già registrato.
        const esistente = await getDoc(paymentRef);
        if (esistente.exists()) return;
        await setDoc(paymentRef, {
          recipientId: activeInvite.id,
          memberId: activeInvite.id,
          payerInviteId: activeInvite.id,
          entryType: 'self_reported',
          amountCents,
          currency: 'EUR',
          reason: 'Pagamento segnalato dalla persona',
          accountingCategory: 'cost_recovery',
          // Senza questo campo lo skipper può confermare la segnalazione ma il
          // saldo non si aggiorna mai: paymentAllocation() (area.js) non trova
          // un importo da contare (bug reale scoperto il 30/09/2026 — vedi
          // isValidSelfReportedPaymentCreate in firestore.rules).
          contributionItemId: 'berth_base',
          isOptional: false,
          dueDate: '',
          paymentMethods: {},
          status: 'prepared',
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser.uid,
          verifiedAt: null,
          verifiedBy: null,
          cancelledAt: null,
          cancelledBy: null,
          declaredAt: serverTimestamp(),
          declaredBy: auth.currentUser.uid,
          declaredMethod: method,
        });
      },
      () => setMessage(message, localized('Connessione lenta — verifico se è stato comunque salvato…', 'Slow connection — checking whether it actually saved…')),
    );
    // Nessun messaggio locale aggiuntivo: la sottoscrizione paymentRequests
    // ridisegna subito questa sezione con la segnalazione in elenco.
  } catch (error) {
    console.error('Egadi segnalazione pagamento:', error);
    setMessage(message, crewSaveErrorMessage(error, localized('Non riesco a registrare la segnalazione. Riprova tra poco, oppure avvisa lo skipper su WhatsApp.', 'I could not save this. Please try again shortly, or let the skipper know on WhatsApp.')), true);
    button.disabled = false;
    select.disabled = false;
    amountInput.disabled = false;
  }
}

function verifiedContributionDetail(totals) {
  const parts = [];
  if (totals.verifiedAdvanceCents > 0) {
    parts.push(localized(
      `Acconti verificati: ${formatCurrency(totals.verifiedAdvanceCents / 100)}.`,
      `Verified advances: ${formatCurrency(totals.verifiedAdvanceCents / 100)}.`,
    ));
  }
  if (totals.verifiedBalanceCents > 0) {
    parts.push(localized(
      `Saldi verificati: ${formatCurrency(totals.verifiedBalanceCents / 100)}.`,
      `Verified balances: ${formatCurrency(totals.verifiedBalanceCents / 100)}.`,
    ));
  }
  if (totals.verifiedFullCents > 0) {
    parts.push(localized(
      `Quote verificate: ${formatCurrency(totals.verifiedFullCents / 100)}.`,
      `Verified contributions: ${formatCurrency(totals.verifiedFullCents / 100)}.`,
    ));
  }
  if (totals.verifiedHistoryCents > 0) {
    parts.push(localized(
      `Versamenti storici verificati: ${formatCurrency(totals.verifiedHistoryCents / 100)}.`,
      `Verified historical payments: ${formatCurrency(totals.verifiedHistoryCents / 100)}.`,
    ));
  }
  return parts.join(' ');
}

function refundableDepositCashAmountCents() {
  const projectedCents = projectionAmountCents('refundableDepositCents');
  if (projectedCents || projectionHasFrozenPricing()) return projectedCents;
  return contributionAmountCents(contributionPlanItems().find((item) => item.id === 'refundable_deposit'));
}

function contributionPlanFallback(itemId, { deposit = false } = {}) {
  const item = contributionPlanItems().find((candidate) => candidate.id === itemId);
  if (!activeContributionPlan || !item) {
    return {
      value: localized('Da definire', 'To be confirmed'),
      detail: deposit
        ? localized('Lo skipper indicherà importo e modalità di consegna all’imbarco.', 'The skipper will confirm the amount and how it is settled at boarding.')
        : localized('Lo skipper non ha ancora preparato una richiesta personale.', 'The skipper has not prepared a personal request yet.'),
    };
  }
  const amount = item.amountCents > 0 ? `${formatCurrency(item.amountCents / 100)} ${localized('a persona', 'per person')}` : localized('Importo da definire', 'Amount to be confirmed');
  const description = String(item.description || '').trim();
  const descriptionPrefix = description ? `${description} ` : '';
  if (item.state === 'included') {
    return { value: localized('Compreso nella quota', 'Included in the contribution'), detail: `${descriptionPrefix}${localized('Nessuna richiesta separata prevista.', 'No separate request is expected.')}` };
  }
  if (item.state === 'not_applicable') {
    return { value: localized('Non previsto', 'Not included'), detail: localized('Non è previsto per questa barca.', 'This is not planned for this boat.') };
  }
  if (item.state === 'extra') {
    return deposit
      ? { value: amount, detail: localized('Da correggere: una cauzione rimborsabile si regola all’imbarco.', 'To be corrected: a refundable deposit is settled at boarding.') }
      : { value: amount, detail: `${descriptionPrefix}${localized('Richiesta personale non ancora preparata.', 'A personal request has not been prepared yet.')}` };
  }
  if (item.state === 'local') {
    return {
      value: amount,
      detail: deposit
        ? localized('Da portare e regolare all’imbarco; non è sommata alle richieste online.', 'Bring and settle it at boarding; it is not added to online requests.')
        : `${descriptionPrefix}${localized('Da regolare separatamente o da dividere a bordo.', 'To be settled separately or shared on board.')}`,
    };
  }
  return {
    value: localized('Da definire', 'To be confirmed'),
    detail: deposit
      ? localized('Non è inclusa nella quota né nelle richieste personali.', 'It is not included in the contribution or personal requests.')
      : localized('Non è ancora inclusa né richiesta a parte.', 'It is not included or requested separately yet.'),
  };
}

function participantFinanceRow(label, summary, extraClass = '', detailMarkup = '') {
  const detail = detailMarkup || escapeHtml(summary.detail);
  return `<article class="participant-finance-row${extraClass ? ` ${extraClass}` : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(summary.value)}</strong><small>${detail}</small></article>`;
}

function participantProjectionRows() {
  if (!activeProjection) return '';
  const role = String(activeProjection.plannedRole || '').trim() || localized('Da definire', 'To be confirmed');
  return [
    participantFinanceRow(localized('Ruolo previsto', 'Planned role'), {
      value: role,
      detail: localized('Proposta dello skipper: il ruolo finale resta quello confermato nella tua anagrafica.', 'Skipper proposal: the final role remains the one confirmed in your personal details.'),
    }),
    participantFinanceRow(localized('Sistemazione prevista', 'Planned accommodation'), {
      value: projectionBerthLabel(),
      detail: localized('Posto riservato per te nell’elenco provvisorio dell’equipaggio.', 'A place reserved for you in the provisional crew list.'),
    }),
  ].join('');
}

// Icone semplici, un solo tratto, colore ereditato (currentColor): niente
// immagini esterne da caricare, restano nitide a qualunque dimensione.
// "Le immagini raccontano più delle scritte" (Silvio, 30/09/2026): l'icona
// di stato (spunta/euro/pallino) va letta da sola, prima ancora del testo.
const FINANCE_ICONS = {
  berth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17v-5.5a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2V17"/><path d="M2.5 17v2.5M21.5 17v2.5"/><path d="M4.5 9.5V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3.5"/></svg>',
  starterPack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="11.5" rx="1.5"/><path d="M3 13.5h18"/><path d="M12 9v11.5"/><path d="M12 9C10 9 8.3 7.7 8.3 5.8 8.3 4 10 3.3 12 5c2-1.7 3.7-1 3.7.8C15.7 7.7 14 9 12 9Z"/></svg>',
  deposit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.8 7.5 9.2 4.4-1.4 7.5-4.6 7.5-9.2V6L12 3Z"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5 5.5-6"/></svg>',
  pending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.8 8.7c-.8-.7-1.8-1.1-3-1.1-2.4 0-4.3 2-4.3 4.4s1.9 4.4 4.3 4.4c1.2 0 2.2-.4 3-1.1"/><path d="M6.8 10.5h5.6M6.8 13.2h4.6"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12h7"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9.5 12 4.5l8.5 5"/><path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8"/><path d="M3.5 20.5h17"/></svg>',
  cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="19" height="11.5" rx="1.6"/><circle cx="12" cy="12.25" r="2.6"/><path d="M5.5 9v0M18.5 15.5v0"/></svg>',
  extra: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11.8V4.6a1 1 0 0 1 1-1h7.2l8.8 8.8-8.2 8.2-8.8-8.8Z"/><circle cx="7.8" cy="7.8" r="1.3"/></svg>',
};

// Un'icona per le voci richieste a parte più comuni, con un ripiego generico:
// una voce nuova nel piano contributi compare comunque, senza codice nuovo.
const EXTRA_FINANCE_ICONS = {
  shore_dinner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="14.5" cy="12" r="6"/><circle cx="14.5" cy="12" r="2.5"/><path d="M4.5 3.5v6.5M7.5 3.5v6.5M6 10v10.5"/></svg>',
  mooring_fee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.6" r="2.1"/><path d="M12 6.7v13.8M7.6 10h8.8"/><path d="M4 14.4c0 3.5 3.6 6.1 8 6.1s8-2.6 8-6.1"/></svg>',
  provisions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.4 8h13.2l-1.3 11a1.6 1.6 0 0 1-1.6 1.4H8.3A1.6 1.6 0 0 1 6.7 19Z"/><path d="M9 8V6.2a3 3 0 0 1 6 0V8"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.4c3.2 4.1 5.4 7.3 5.4 10.2a5.4 5.4 0 0 1-10.8 0c0-2.9 2.2-6.1 5.4-10.2Z"/></svg>',
  transfer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="12.5" height="8" rx="1.5"/><path d="M15 10h3.3l3.2 3.2V15H15z"/><circle cx="7" cy="17.4" r="1.7"/><circle cx="17.2" cy="17.4" r="1.7"/></svg>',
};

// Le voci che hanno già una card dedicata sopra: tutto il resto del piano
// contributi diventa automaticamente una card "richiesta a parte".
const DEDICATED_FINANCE_CARD_ITEM_IDS = new Set(['berth', 'starter_pack', 'linen_towels', 'protection_insurance', 'refundable_deposit']);

// Una card con un'icona di stato grande, non una tabella da leggere riga per
// riga: "saldato"/"da versare" deve capirsi dal colore e dall'icona prima
// ancora del numero. Il "quanto hai già versato" diventa una nota piccola
// solo quando serve, non una colonna sempre visibile — meno testo, più
// riconoscimento immediato (richiesta di Silvio, 30/09/2026: "un'alternativa
// più cognitiva", dopo aver trovato la prima versione ancora troppo fitta).
function financeStatusCard({ icon, label, totalLabel, statusTone, statusText, methodIcon = '', methodText = '', note = '' }) {
  const statusIcon = FINANCE_ICONS[statusTone] || FINANCE_ICONS.muted;
  return `<article class="finance-card finance-card--${statusTone}">
    <div class="finance-card-icon" aria-hidden="true">${icon}</div>
    <div class="finance-card-body">
      <div class="finance-card-title"><strong>${escapeHtml(label)}</strong>${totalLabel ? `<span>${escapeHtml(totalLabel)}</span>` : ''}</div>
      <div class="finance-card-status"><span class="finance-card-status-icon" aria-hidden="true">${statusIcon}</span><span>${escapeHtml(statusText)}</span></div>
      ${methodText ? `<div class="finance-card-method"><span class="finance-card-method-icon" aria-hidden="true">${FINANCE_ICONS[methodIcon] || ''}</span><span>${escapeHtml(methodText)}</span></div>` : ''}
      ${note ? `<p class="finance-card-note">${note}</p>` : ''}
    </div>
  </article>`;
}

// Quanto è già stato chiesto e confermato per una singola voce (cena a terra,
// ormeggio, cambusa...): le richieste di quella voce non entrano nel saldo del
// posto barca, quindi si contano a parte sul loro importo pieno.
function extraItemPaymentTotals(itemId) {
  const rows = activeCrewPayments.filter((payment) => payment.status !== 'cancelled' && payment.contributionItemId === itemId);
  const sumFor = (predicate) => rows
    .filter(predicate)
    .reduce((total, payment) => total + (Number.isInteger(payment.amountCents) ? payment.amountCents : 0), 0);
  return {
    verifiedCents: sumFor((payment) => payment.status === 'verified'),
    pendingCents: sumFor(isPendingCrewPayment),
  };
}

// Una card per ogni voce che lo skipper ha segnato "da richiedere a parte" o
// "da regolare a parte" nel piano contributi: nasce dal piano, non da un
// elenco scritto a mano, così la cena di Egadi e qualunque voce futura
// (ormeggio, cambusa, gasolio) compaiono senza toccare il codice — richiesta
// di Silvio, 2/10/2026: "semplice da gestire, la complessità dietro le quinte".
function extraContributionCards() {
  const cashMethod = localized('Contanti all’imbarco', 'Cash at boarding');
  const bankTransferMethod = localized('Bonifico allo skipper', 'Bank transfer to the skipper');
  return contributionPlanItems()
    .filter((item) => !DEDICATED_FINANCE_CARD_ITEM_IDS.has(item.id) && !item.hideFromCrew)
    .filter((item) => item.state === 'extra' || item.state === 'local')
    .map((item) => {
      const icon = EXTRA_FINANCE_ICONS[item.id] || FINANCE_ICONS.extra;
      // Una voce può esistere senza prezzo: la cambusa si divide a bordo e
      // l'importo si sa solo dopo la spesa. Meglio dirlo che inventare una
      // cifra (richiesta di Silvio, 2/10/2026: "prevedi anche la cambusa").
      const hasAmount = item.amountCents > 0;
      const amountLabel = hasAmount ? formatCurrency(item.amountCents / 100) : '';
      const toBeConfirmed = localized('Importo da definire', 'Amount to be confirmed');
      const note = item.description ? escapeHtml(item.description) : '';
      if (item.state === 'local') {
        return financeStatusCard({
          icon,
          label: item.label,
          totalLabel: amountLabel,
          statusTone: 'pending',
          statusText: hasAmount
            ? localized(`Da versare ${amountLabel}`, `${amountLabel} still to pay`)
            : toBeConfirmed,
          methodIcon: 'cash',
          methodText: hasAmount ? cashMethod : localized('Si regola a bordo', 'Settled on board'),
          note,
        });
      }
      const totals = extraItemPaymentTotals(item.id);
      if (totals.verifiedCents > 0 && (!hasAmount || totals.verifiedCents >= item.amountCents)) {
        return financeStatusCard({
          icon,
          label: item.label,
          totalLabel: amountLabel,
          statusTone: 'ok',
          statusText: localized('Saldato', 'Fully paid'),
          methodText: localized(`Hai versato ${formatCurrency(totals.verifiedCents / 100)}`, `You paid ${formatCurrency(totals.verifiedCents / 100)}`),
          note,
        });
      }
      if (totals.pendingCents > 0) {
        return financeStatusCard({
          icon,
          label: item.label,
          totalLabel: amountLabel,
          statusTone: 'pending',
          statusText: localized(`Da versare ${formatCurrency(totals.pendingCents / 100)}`, `${formatCurrency(totals.pendingCents / 100)} still to pay`),
          methodIcon: 'bank',
          methodText: bankTransferMethod,
          note: escapeHtml(localized(
            'Richiesta inviata dallo skipper: resta "in attesa" finché non conferma l’accredito.',
            'Request sent by the skipper: it stays "pending" until they confirm the payment.',
          )),
        });
      }
      return financeStatusCard({
        icon,
        label: item.label,
        totalLabel: amountLabel,
        statusTone: 'muted',
        statusText: hasAmount
          ? localized('Lo skipper non ha ancora inviato la richiesta', 'The skipper has not sent the request yet')
          : toBeConfirmed,
        note,
      });
    })
    .join('');
}

function renderParticipantFinanceSummary() {
  const summary = document.querySelector('#participantFinanceSummary');
  if (!summary) return;
  if (!hasAcceptedCurrentBriefing()) {
    summary.hidden = true;
    summary.replaceChildren();
    return;
  }
  const onlineContribution = onlineContributionBalance();
  const starterPackCents = starterPackCashAmountCents();
  const depositCents = refundableDepositCashAmountCents();
  const starterPack = starterPackCashSummary();
  const refundableDeposit = projectedRefundableDepositSummary();
  const bankTransferMethod = localized('Bonifico allo skipper', 'Bank transfer to the skipper');
  const cashMethod = localized('Contanti all’imbarco', 'Cash at boarding');

  const berthRow = onlineContribution.isExempt
    ? financeStatusCard({
      icon: FINANCE_ICONS.berth,
      label: localized('Posto barca e assicurazione', 'Berth and deposit insurance'),
      totalLabel: localized('Esente', 'Exempt'),
      statusTone: 'muted',
      statusText: localized('Non previsto per il tuo ruolo', 'Not applicable for your role'),
    })
    : !onlineContribution.hasTarget
      ? financeStatusCard({
        icon: FINANCE_ICONS.berth,
        label: localized('Posto barca e assicurazione', 'Berth and deposit insurance'),
        totalLabel: localized('Da definire', 'To be confirmed'),
        statusTone: 'muted',
        statusText: localized('Lo skipper deve ancora fissare la quota', 'The skipper still needs to set the amount'),
      })
      : financeStatusCard({
        icon: FINANCE_ICONS.berth,
        label: localized('Posto barca e assicurazione', 'Berth and deposit insurance'),
        totalLabel: formatCurrency(onlineContribution.targetCents / 100),
        statusTone: onlineContribution.overpaidCents > 0 ? 'pending' : onlineContribution.remainingCents > 0 ? 'pending' : 'ok',
        statusText: onlineContribution.overpaidCents > 0
          ? localized('Da verificare col skipper', 'Check with the skipper')
          : onlineContribution.remainingCents > 0
            ? localized(`Da versare ${formatCurrency(onlineContribution.remainingCents / 100)}`, `${formatCurrency(onlineContribution.remainingCents / 100)} still to pay`)
            : localized('Saldato', 'Fully paid'),
        methodIcon: onlineContribution.remainingCents > 0 && onlineContribution.overpaidCents === 0 ? 'bank' : '',
        methodText: onlineContribution.overpaidCents > 0
          ? localized(`${formatCurrency(onlineContribution.overpaidCents / 100)} oltre quota`, `${formatCurrency(onlineContribution.overpaidCents / 100)} over the agreed amount`)
          : onlineContribution.remainingCents > 0
            ? bankTransferMethod
            : onlineContribution.verifiedCents > 0
              ? localized(`Hai versato ${formatCurrency(onlineContribution.verifiedCents / 100)}`, `You paid ${formatCurrency(onlineContribution.verifiedCents / 100)}`)
              : '',
        note: onlineContribution.pendingCents > 0
          ? escapeHtml(localized(
            `${formatCurrency(onlineContribution.pendingCents / 100)} già segnalati o richiesti: restano "in attesa" finché lo skipper non conferma l’accredito.`,
            `${formatCurrency(onlineContribution.pendingCents / 100)} already reported or requested: they stay "pending" until the skipper confirms the payment.`,
          ))
          : '',
      });

  const starterPackRow = activeProjection?.contributesToCosts === false
    ? financeStatusCard({
      icon: FINANCE_ICONS.starterPack,
      label: 'Starter Pack',
      totalLabel: localized('Non previsto', 'Not applicable'),
      statusTone: 'muted',
      statusText: localized('Non previsto per il tuo ruolo', 'Not applicable for your role'),
    })
    : financeStatusCard({
      icon: FINANCE_ICONS.starterPack,
      label: 'Starter Pack',
      totalLabel: starterPackCents > 0 ? formatCurrency(starterPackCents / 100) : localized('Da definire', 'To be confirmed'),
      statusTone: 'pending',
      statusText: starterPackCents > 0
        ? localized(`Da versare ${formatCurrency(starterPackCents / 100)}`, `${formatCurrency(starterPackCents / 100)} still to pay`)
        : localized('Importo da definire', 'Amount to be confirmed'),
      methodIcon: 'cash',
      methodText: cashMethod,
      note: starterPack.detail ? escapeHtml(starterPack.detail) : '',
    });

  const depositRow = depositCents > 0
    ? financeStatusCard({
      icon: FINANCE_ICONS.deposit,
      label: localized('Cauzione rimborsabile', 'Refundable deposit'),
      totalLabel: formatCurrency(depositCents / 100),
      statusTone: 'pending',
      statusText: localized(`Da versare ${formatCurrency(depositCents / 100)}`, `${formatCurrency(depositCents / 100)} still to pay`),
      methodIcon: 'cash',
      methodText: localized('Contanti all’imbarco · restituita a fine charter', 'Cash at boarding · returned at the end of the charter'),
      note: `<a class="rules-reference-link" href="#crew-bacheca" data-rules-reference="deposit">${escapeHtml(localized('Leggi la regola sulla cauzione', 'Read the deposit rule'))}</a>`,
    })
    : financeStatusCard({
      icon: FINANCE_ICONS.deposit,
      label: localized('Cauzione rimborsabile', 'Refundable deposit'),
      totalLabel: localized('Non prevista', 'Not applicable'),
      statusTone: 'muted',
      statusText: localized('Non prevista per il tuo posto', 'Not applicable for your berth'),
    });

  const acceptedAt = formatDateTime(activeRuleAcceptance?.acceptedAt);
  summary.hidden = false;
  summary.innerHTML = `
    <p class="eyebrow">${escapeHtml(localized('Il tuo riepilogo dei costi', 'Your cost summary'))}</p>
    <h4>${escapeHtml(localized('Cosa hai già dato e cosa manca', 'What you’ve already given and what’s left'))}</h4>
    ${participantProjectionRows() ? `<div class="participant-finance-grid participant-finance-grid-compact">${participantProjectionRows()}</div>` : ''}
    ${participantPaymentInstructionsMarkup(onlineContribution)}
    <div class="finance-cards">${berthRow}${starterPackRow}${extraContributionCards()}${depositRow}</div>
    <div class="participant-finance-acceptance"><strong>${escapeHtml(localized('Regole di bordo accettate', 'Board rules accepted'))}</strong>${acceptedAt ? ` · ${escapeHtml(acceptedAt)}` : ''}. <a href="#crew-bacheca">${escapeHtml(localized('Rileggi il regolamento e la bacheca', 'Read the rules and updates again'))}</a></div>
  `;
}

function showOpening(message = '', isError = false) {
  clearPersonalDashboard();
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#boardingRulesGate').hidden = true;
  document.querySelector('#participantDashboard').hidden = true;
  document.querySelector('#signInSection').hidden = false;
  setMessage(document.querySelector('#participantAuthMessage'), message, isError);
}

function showInvalid(error) {
  clearPersonalDashboard();
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#boardingRulesGate').hidden = true;
  document.querySelector('#participantDashboard').hidden = true;
  document.querySelector('#invalidLink').hidden = false;
  const message = document.querySelector('#invalidAccessMessage');
  if (message) setMessage(message, crewAccessErrorMessage(error));
  const loginLink = document.querySelector('#crewLoginLink');
  if (loginLink) loginLink.href = crewAccessUrl();
}

function clearPersonalDashboard() {
  stopPaymentSubscription?.();
  stopAnnouncementSubscription?.();
  stopContributionPlanSubscription?.();
  stopProjectionSubscription?.();
  stopPaymentInstructionsSubscription?.();
  stopCrewTravelStatusSubscription?.();
  stopPaymentSubscription = null;
  stopAnnouncementSubscription = null;
  stopContributionPlanSubscription = null;
  stopProjectionSubscription = null;
  stopPaymentInstructionsSubscription = null;
  stopCrewTravelStatusSubscription = null;
  activeInvite = null;
  activeBriefing = null;
  activeRuleAcceptance = null;
  activeContributionPlan = null;
  activeMember = null;
  activeProjection = null;
  activeCrewPayments = [];
  activeCrewAnnouncements = [];
  activePaymentInstructions = null;
  activeCrewTravelStatus = null;
  activeTransferPricing = null;
  crewTravelStatusLoaded = false;
  crewTravelStatusReadError = false;
  ['#participantProfileSummary', '#participantPaymentList', '#participantFinanceSummary', '#boardingSchedule', '#participantSchedule', '#boardingRulesSummary', '#boardingRulesText', '#participantRulesSummary', '#participantRulesText', '#participantAnnouncementList', '#participantContributionIncluded', '#participantContributionSeparate'].forEach((selector) => {
    document.querySelector(selector).replaceChildren();
  });
  document.querySelector('#boardingRulesGate').hidden = true;
  document.querySelector('#boardingBriefing').hidden = true;
  document.querySelector('#boardingGateWaiting').hidden = true;
  document.querySelector('#participantBriefing').hidden = true;
  document.querySelector('#participantContributionPlan').hidden = true;
  document.querySelector('#participantContributionPlanEmpty').hidden = false;
  document.querySelector('#participantFinanceSummary').hidden = true;
  document.querySelector('#participantContributionNotApplicable')?.replaceChildren();
  clearBoardingRulesGateState();
  renderCrewDashboardOverview();
}

function handlePrivateReadError(error, messageElement, fallbackMessage, { invalidatesSession = false } = {}) {
  // Una card secondaria non deve mai simulare la revoca dell'accesso: la
  // sessione è già stata verificata da startCrewAreaSession. Solo i due dati
  // che compongono il gate del briefing possono invalidare la vista corrente.
  if (invalidatesSession && error?.code === 'permission-denied') {
    clearPersonalDashboard();
    showOpening(translate('crew.flow.accessNoLongerActive', 'Questo accesso non è più attivo. Accedi di nuovo con numero e codice personale oppure chiedi allo skipper un nuovo invito.'), true);
    return;
  }
  setMessage(messageElement, fallbackMessage, true);
}

function renderProfile(member) {
  activeMember = member || null;
  const documentTail = member.documentNumber ? `•••• ${escapeHtml(member.documentNumber.slice(-4))}` : translate('crew.flow.notProvided', 'Non indicato');
  document.querySelector('#participantProfileSummary').innerHTML = `<dl><div><dt>${escapeHtml(translate('crew.flow.profileName', 'Nome'))}</dt><dd>${escapeHtml(member.displayName || `${member.firstName || ''} ${member.lastName || ''}`)}</dd></div><div><dt>${escapeHtml(translate('crew.flow.profileBirth', 'Nascita'))}</dt><dd>${escapeHtml([formatDate(member.birthDate), member.birthPlace].filter(Boolean).join(' · '))}</dd></div><div><dt>${escapeHtml(translate('crew.flow.profileDocument', 'Documento'))}</dt><dd>${escapeHtml(member.documentType || translate('crew.flow.profileDocument', 'Documento'))} · ${documentTail}</dd></div><div><dt>${escapeHtml(translate('crew.flow.profileRole', 'Ruolo a bordo'))}</dt><dd>${escapeHtml(roleConfirmationText(member))}</dd></div></dl>`;
  renderCrewDashboardOverview();
}

function renderPayments(snapshot) {
  const list = document.querySelector('#participantPaymentList');
  activeCrewPayments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  if (snapshot.empty) {
    list.innerHTML = `<p class="empty-state">${escapeHtml(translate('crew.flow.noPayments', 'Il riepilogo ricevuto con l’invito è qui sopra. Qui compariranno solo eventuali promemoria, extra o conferme dello skipper.'))}</p>`;
    renderParticipantFinanceSummary();
    renderCrewDashboardOverview();
    return;
  }
  list.innerHTML = snapshot.docs.map((item) => {
    const payment = item.data();
    const isManualReceipt = isManualCrewReceipt(payment);
    const isSelfReported = isSelfReportedCrewPayment(payment);
    const dueDate = isManualReceipt && payment.receivedOn
      ? ` · ${localized('ricevuto il', 'received on')} ${formatDate(payment.receivedOn)}`
      : !isManualReceipt && !isSelfReported && payment.dueDate ? ` · ${translate('crew.flow.dueBy', 'Entro')} ${formatDate(payment.dueDate)}` : '';
    const reason = `${payment.reason || translate('crew.flow.weekendContribution', 'Contributo weekend')}${payment.isOptional ? ` · ${translate('crew.flow.optional', 'Facoltativo')}` : ''}`;
    const status = paymentStatusLabel(payment);
    const installment = `<span class="payment-contribution-tag">${escapeHtml(paymentInstallmentLabel(payment))}</span>`;
    const declaredMethodLabel = isSelfReported
      ? PAYMENT_METHODS.find((method) => method.id === payment.declaredMethod)?.label || payment.declaredMethod
      : '';
    const methods = isManualReceipt
      ? ''
      : isSelfReported
        ? `<span>${escapeHtml(localized(`Segnalato con ${declaredMethodLabel}.`, `Reported with ${declaredMethodLabel}.`))}</span>`
        : paymentMethodTags(payment) || `<span>${escapeHtml(translate('crew.flow.paymentMethodToAgree', 'Metodo da concordare con lo skipper.'))}</span>`;
    const legacyInstructions = !isManualReceipt && !isSelfReported && payment.instructions ? `<span>${escapeHtml(payment.instructions)}</span>` : '';
    const detail = isManualReceipt
      ? localized(
        'Registrato dallo skipper come accredito già ricevuto: non è una nuova richiesta e non richiede WhatsApp.',
        'Recorded by the skipper as a payment already received: this is not a new request and does not require WhatsApp.',
      )
      : isSelfReported
        ? localized('Segnalato da te nella tua area: lo skipper deve ancora verificare l’accredito reale.', 'Reported by you in your area: the skipper still has to verify the actual payment.')
        : paymentInstructionsAreReady()
          ? localized('Apri il riquadro “Come versare” nel riepilogo della tua quota.', 'Open the “How to pay” panel in your contribution summary.')
          : localized('Lo skipper pubblicherà qui i metodi di versamento: non serve un nuovo invito.', 'The skipper will publish payment methods here: you do not need a new invitation.');
    const declare = paymentDeclareMarkup(payment, item.id);
    return `<article class="payment-row"><div><strong>${formatCurrency(paymentAmount(payment))} · ${escapeHtml(reason)}</strong><span>${escapeHtml(dueDate)}</span>${installment}${methods}${legacyInstructions}<span class="payment-detail-note">${escapeHtml(detail)}</span>${declare}</div><div class="payment-action"><span class="payment-status">${escapeHtml(status)}</span></div></article>`;
  }).join('');
  renderParticipantFinanceSummary();
  renderCrewDashboardOverview();
}

function contributionAmountCents(item) {
  const amountCents = Number(item?.amountCents);
  return Number.isInteger(amountCents) && amountCents >= 0 ? amountCents : 0;
}

function contributionPlanItems(plan = activeContributionPlan, starterPackItemsOverride = null) {
  const sourceItems = plan?.items && typeof plan.items === 'object' ? plan.items : {};
  const isV4 = Array.isArray(plan?.starterPackItems);
  const hasStarterPackOverride = Array.isArray(starterPackItemsOverride);
  const starterPackItems = hasStarterPackOverride
    ? normalizeStarterPackItems(starterPackItemsOverride)
    : normalizeStarterPackItems(plan?.starterPackItems, {
      fallbackToDefault: !isV4,
    });
  return CONTRIBUTION_ITEMS.map((item) => {
    const source = sourceItems[item.id] || {};
    const state = item.id === 'starter_pack'
      ? (CONTRIBUTION_ITEM_STATES.has(source.state) ? source.state : 'local')
      : item.id === 'linen_towels'
        ? 'included'
      : CONTRIBUTION_ITEM_STATES.has(source.state) ? source.state : 'to_define';
    return {
      ...item,
      state,
      amountCents: item.id === 'linen_towels' ? 0 : contributionAmountCents(source),
      description: isV4 || hasStarterPackOverride
        ? staticContributionDescription(item.id, starterPackItems)
        : String(source.description || '').trim().slice(0, 320) || staticContributionDescription(item.id, starterPackItems),
      hideFromCrew: (isV4 || hasStarterPackOverride) && item.id === 'linen_towels',
    };
  });
}

function contributionItemMarkup(item) {
  const amount = item.amountCents > 0 ? ` · ${formatCurrency(item.amountCents / 100)} ${translate('crew.flow.perPerson', 'a persona')}` : '';
  const stateLabel = item.id === 'starter_pack' && item.state === 'local'
    ? localized('Solo contanti a bordo', 'Cash on board only')
    : CONTRIBUTION_ITEM_STATES.get(item.state);
  const depositLink = item.id === 'refundable_deposit'
    ? ` <a class="rules-reference-link" href="#crew-bacheca" data-rules-reference="deposit">${escapeHtml(localized('Leggi la regola sulla cauzione', 'Read the deposit rule'))}</a>`
    : '';
  const description = item.description ? `<small>${escapeHtml(item.description)}${depositLink}</small>` : depositLink;
  return `<div><span>${escapeHtml(stateLabel)}</span><strong>${escapeHtml(item.label)}${escapeHtml(amount)}</strong>${description}</div>`;
}

function contributionNotApplicableContainer(plan) {
  let container = document.querySelector('#participantContributionNotApplicable');
  if (container) return container;
  const heading = document.createElement('h4');
  heading.textContent = translate('crew.flow.notForThisBoat', 'Non previsto per questa barca');
  container = document.createElement('div');
  container.id = 'participantContributionNotApplicable';
  container.className = 'schedule-list';
  plan.querySelector('.panel-lead')?.before(heading, container);
  return container;
}

function renderContributionPlan() {
  const empty = document.querySelector('#participantContributionPlanEmpty');
  const plan = document.querySelector('#participantContributionPlan');
  const included = document.querySelector('#participantContributionIncluded');
  const separate = document.querySelector('#participantContributionSeparate');
  if (!activeContributionPlan) {
    empty.hidden = false;
    plan.hidden = true;
    included.replaceChildren();
    separate.replaceChildren();
    document.querySelector('#participantContributionNotApplicable')?.replaceChildren();
    renderParticipantFinanceSummary();
    renderCrewDashboardOverview();
    return;
  }

  const notApplicable = contributionNotApplicableContainer(plan);
  const starterPackItemsSnapshot = Array.isArray(activeProjection?.starterPackItemsSnapshot)
    ? activeProjection.starterPackItemsSnapshot
    : null;
  const items = contributionPlanItems(activeContributionPlan, starterPackItemsSnapshot)
    .filter((item) => !item.hideFromCrew);
  const includedItems = items.filter((item) => item.state === 'included');
  const separateItems = items.filter((item) => ['extra', 'local', 'to_define'].includes(item.state));
  const notApplicableItems = items.filter((item) => item.state === 'not_applicable');
  empty.hidden = true;
  plan.hidden = false;
  included.innerHTML = includedItems.length
    ? includedItems.map(contributionItemMarkup).join('')
    : `<p class="empty-state">${escapeHtml(translate('crew.flow.noIncludedItems', 'Nessuna voce è stata ancora indicata come compresa nella quota.'))}</p>`;
  separate.innerHTML = separateItems.length
    ? separateItems.map(contributionItemMarkup).join('')
    : `<p class="empty-state">${escapeHtml(translate('crew.flow.noSeparateItems', 'Nessuna spesa separata o da confermare al momento.'))}</p>`;
  notApplicable.innerHTML = notApplicableItems.length
    ? notApplicableItems.map(contributionItemMarkup).join('')
    : `<p class="empty-state">${escapeHtml(translate('crew.flow.noExcludedItems', 'Nessuna voce è stata esclusa.'))}</p>`;
  renderParticipantFinanceSummary();
  renderCrewDashboardOverview();
}

function hasItalianBriefing() {
  return typeof activeBriefing?.rulesText === 'string' && activeBriefing.rulesText.trim().length > 0;
}

function hasOfficialEnglishBriefing() {
  return typeof activeBriefing?.rulesTitleEn === 'string' && activeBriefing.rulesTitleEn.trim().length > 0
    && typeof activeBriefing?.rulesSummaryEn === 'string' && activeBriefing.rulesSummaryEn.trim().length > 0
    && typeof activeBriefing?.rulesTextEn === 'string' && activeBriefing.rulesTextEn.trim().length > 0
    && typeof activeBriefing?.scheduleNoteEn === 'string';
}

function canAcceptCurrentLocaleBriefing() {
  return hasItalianBriefing() && (activeLocale() !== 'en' || hasOfficialEnglishBriefing());
}

function hasPublishedBriefing() {
  return hasItalianBriefing();
}

function briefingTitle() {
  return translate('crew.briefing.fullRules', 'Regolamento di bordo');
}

function briefingRequiresFullRulesRead() {
  return activeBriefing?.fullRulesRequired === true;
}

function briefingSummary() {
  const summary = activeLocale() === 'en' && hasOfficialEnglishBriefing()
    ? activeBriefing.rulesSummaryEn
    : activeBriefing?.rulesSummary;
  return typeof summary === 'string' && summary.trim()
    ? summary.trim()
    : translate('crew.briefing.summaryFallback', 'La sintesi ti orienta: leggi tutto il regolamento di bordo prima di confermare.');
}

function briefingRulesText() {
  if (activeLocale() === 'en' && hasOfficialEnglishBriefing()) return activeBriefing.rulesTextEn;
  return activeBriefing?.rulesText || '';
}

function compactRulesLine(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isRulesSectionHeading(line, index, lines) {
  const compact = compactRulesLine(line);
  if (!compact || compact.length > 140 || /^[•\-–—*]\s+/.test(compact)) return false;
  if (/^(?:#{1,6}\s+|\d{1,2}[.)]\s+|[ivxlcdm]{1,7}[.)]\s+)/i.test(compact)) return true;
  if (/[A-ZÀ-ÖØ-Þ]/.test(compact) && compact.length <= 110 && compact === compact.toUpperCase()) return true;
  if (/^(?:premessa|introduzione|introduction|overview|notice|avvertenza|avvertenze)$/i.test(compact)) return true;
  const previousBlank = index === 0 || !compactRulesLine(lines[index - 1]);
  const nextLine = lines.slice(index + 1).map(compactRulesLine).find(Boolean);
  return previousBlank
    && Boolean(nextLine)
    && compact.length <= 96
    && !/[.!?;:]$/.test(compact)
    && nextLine.length >= compact.length;
}

function splitRulesIntoSections(value) {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  let current = null;
  let paragraphLines = [];
  const flushParagraph = () => {
    const paragraph = paragraphLines.map((line) => line.trim()).filter(Boolean).join('\n');
    paragraphLines = [];
    if (!paragraph) return;
    if (!current) current = { heading: '', paragraphs: [] };
    current.paragraphs.push(paragraph);
  };
  const flushSection = () => {
    flushParagraph();
    if (current?.heading || current?.paragraphs.length) sections.push(current);
    current = null;
  };

  lines.forEach((line, index) => {
    if (!compactRulesLine(line)) {
      flushParagraph();
      return;
    }
    if (isRulesSectionHeading(line, index, lines)) {
      flushSection();
      current = { heading: compactRulesLine(line), paragraphs: [] };
      return;
    }
    paragraphLines.push(line);
  });
  flushSection();
  return sections;
}

function rulesSectionCategory(section) {
  const heading = String(section.heading || '').toLowerCase();
  const fullText = `${heading} ${section.paragraphs.join(' ')}`.toLowerCase();
  const environment = /ambient|rifiut|fumo|mozzicon|mare|marin[oa]|environment|waste|smok/;
  const route = /skipper|naviga|rotta|rada|porto|tender|uscit|orari|route|navigation|anchorage|harbou?r|timings|schedule/;
  const life = /vita comune|rispetto|cabine|cambusa|cucina|salute|comportamento|preparazione|personale|spesa|costi|life on board|respect|cabins|galley|health|behavio[u]?r|preparation|cost/;
  const safety = /sicurezz|emergen|giubbot|life ?line|zattera|estintor|cadut|boma|dotazion|gas|safety|emergen|lifejacket|liferaft|extinguisher|overboard|equipment/;
  if (environment.test(heading)) return 'environment';
  if (route.test(heading)) return 'route';
  if (life.test(heading)) return 'life';
  if (safety.test(heading)) return 'safety';
  if (environment.test(fullText)) return 'environment';
  if (route.test(fullText)) return 'route';
  if (safety.test(fullText)) return 'safety';
  return 'life';
}

function rulesSectionLabel(category) {
  const labels = activeLocale() === 'en'
    ? { route: 'Route & navigation', safety: 'Safety', life: 'Life on board', environment: 'Sea & environment' }
    : { route: 'Rotta e navigazione', safety: 'Sicurezza', life: 'Vita a bordo', environment: 'Mare e ambiente' };
  return labels[category] || labels.life;
}

function renderRulesSections(selector, value) {
  const target = document.querySelector(selector);
  if (!target) return;
  const sections = splitRulesIntoSections(value);
  const fragment = document.createDocumentFragment();
  sections.forEach((section, index) => {
    const isDocumentTitle = index === 0
      && section.paragraphs.length === 0
      && /regolamento|board rules/i.test(section.heading);
    const category = isDocumentTitle ? 'route' : rulesSectionCategory(section);
    const card = document.createElement('section');
    card.className = `rules-section-card rules-section-card--${category}${isDocumentTitle ? ' rules-section-card--document' : ''}`;
    const icon = document.createElement('span');
    icon.className = 'rules-section-icon';
    icon.setAttribute('aria-hidden', 'true');
    const content = document.createElement('div');
    content.className = 'rules-section-content';
    const label = document.createElement('p');
    label.className = 'rules-section-kicker';
    label.textContent = rulesSectionLabel(category);
    if (!isDocumentTitle) content.append(label);
    if (section.heading) {
      const heading = document.createElement('h4');
      heading.className = 'rules-section-heading';
      heading.id = `${target.id}-section-${index}`;
      heading.textContent = section.heading;
      card.setAttribute('aria-labelledby', heading.id);
      content.append(heading);
    } else {
      card.setAttribute('aria-label', rulesSectionLabel(category));
    }
    const copy = document.createElement('div');
    copy.className = 'rules-section-copy';
    section.paragraphs.forEach((paragraph) => {
      const item = document.createElement('p');
      item.textContent = paragraph;
      copy.append(item);
    });
    content.append(copy);
    card.append(icon, content);
    fragment.append(card);
  });
  target.replaceChildren(fragment);
}

function currentBriefingVersion() {
  return Number.isInteger(activeBriefing?.rulesVersion) ? activeBriefing.rulesVersion : 1;
}

function hasAcceptedCurrentBriefing() {
  return activeRuleAcceptance?.rulesVersion === currentBriefingVersion()
    && activeRuleAcceptance?.acceptedBy === auth.currentUser?.uid
    && (!briefingRequiresFullRulesRead() || activeRuleAcceptance?.fullRulesRead === true);
}

function clearBoardingRulesGateState() {
  const gate = document.querySelector('#boardingRulesGate');
  const scrollRegion = document.querySelector('#boardingRulesScroll');
  gate.dataset.rulesContext = '';
  gate.dataset.rulesVersion = '';
  gate.dataset.fullRulesRead = '';
  scrollRegion.scrollTop = 0;
  scrollRegion.classList.remove('is-complete');
  boardingRulesDialogController.close();
  document.querySelector('#rulesAcknowledgement').checked = false;
  document.querySelector('#rulesAcknowledgement').disabled = true;
  document.querySelector('#acceptRulesButton').disabled = true;
  document.querySelector('#boardingFullRulesHint').textContent = translate('crew.flow.scrollToEnd', 'Apri il regolamento e leggilo fino alla fine. Quando hai finito, seleziona qui sotto la dichiarazione di lettura.');
}

function updateBoardingAcceptState() {
  const acknowledgement = document.querySelector('#rulesAcknowledgement');
  const acceptButton = document.querySelector('#acceptRulesButton');
  const fullRulesRead = document.querySelector('#boardingRulesGate').dataset.fullRulesRead === 'true';
  const canConfirm = canAcceptCurrentLocaleBriefing()
    && canConfirmCrewBriefing({ requiresFullRulesRead: briefingRequiresFullRulesRead(), fullRulesRead })
    && !hasAcceptedCurrentBriefing();
  acknowledgement.disabled = !canConfirm;
  if (!canConfirm) acknowledgement.checked = false;
  acceptButton.disabled = !(canConfirm && acknowledgement.checked);
}

function markBoardingRulesRead() {
  const gate = document.querySelector('#boardingRulesGate');
  const scrollRegion = document.querySelector('#boardingRulesScroll');
  const acknowledgement = document.querySelector('#rulesAcknowledgement');
  if (gate.dataset.fullRulesRead === 'true') return;
  gate.dataset.fullRulesRead = 'true';
  scrollRegion.classList.add('is-complete');
  document.querySelector('#boardingFullRulesHint').textContent = translate('crew.flow.fullRulesSeen', 'Regolamento di bordo visualizzato. Se lo hai letto, puoi confermare la dichiarazione.');
  updateBoardingAcceptState();
  if (document.activeElement === scrollRegion) acknowledgement.focus();
}

function resetBoardingRulesRead() {
  const gate = document.querySelector('#boardingRulesGate');
  const scrollRegion = document.querySelector('#boardingRulesScroll');
  gate.dataset.fullRulesRead = '';
  scrollRegion.scrollTop = 0;
  scrollRegion.classList.remove('is-complete');
  boardingRulesDialogController.close();
  document.querySelector('#boardingFullRulesHint').textContent = translate('crew.flow.scrollToEnd', 'Apri il regolamento e leggilo fino alla fine. Quando hai finito, seleziona qui sotto la dichiarazione di lettura.');
  updateBoardingAcceptState();
  requestAnimationFrame(() => boardingRulesDialogController.checkComplete());
}

function briefingSchedule() {
  const scheduleNote = activeLocale() === 'en' && hasOfficialEnglishBriefing()
    ? activeBriefing?.scheduleNoteEn
    : activeBriefing?.scheduleNote;
  return [
    [translate('crew.schedule.meeting', 'Ritrovo'), activeBriefing?.meetingPoint],
    [translate('crew.schedule.boarding', 'Imbarco'), formatDateTime(activeBriefing?.boardingAt)],
    [translate('crew.schedule.departure', 'Partenza'), formatDateTime(activeBriefing?.departureAt)],
    [translate('crew.schedule.return', 'Rientro'), formatDateTime(activeBriefing?.returnAt)],
    [translate('crew.schedule.note', 'Nota operativa'), scheduleNote],
  ].filter(([, value]) => value);
}

function renderSchedule(selector) {
  const target = document.querySelector(selector);
  target.innerHTML = briefingSchedule().map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function stopDashboardSubscriptions() {
  stopPaymentSubscription?.();
  stopAnnouncementSubscription?.();
  stopContributionPlanSubscription?.();
  stopProjectionSubscription?.();
  stopPaymentInstructionsSubscription?.();
  stopCrewTravelStatusSubscription?.();
  stopPaymentSubscription = null;
  stopAnnouncementSubscription = null;
  stopContributionPlanSubscription = null;
  stopProjectionSubscription = null;
  stopPaymentInstructionsSubscription = null;
  stopCrewTravelStatusSubscription = null;
  activePaymentInstructions = null;
  activeCrewTravelStatus = null;
  crewTravelStatusLoaded = false;
  crewTravelStatusReadError = false;
}

function startDashboardSubscriptions() {
  if (!activeInvite) return;
  if (!stopCrewTravelStatusSubscription) {
    stopCrewTravelStatusSubscription = onSnapshot(
      doc(db, 'boats', activeInvite.boatId, 'crewTravelStatus', activeInvite.id),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        crewTravelStatusLoaded = true;
        crewTravelStatusReadError = false;
        activeCrewTravelStatus = snapshot.exists() ? snapshot.data() : null;
        renderCrewDashboardOverview();
      },
      (error) => {
        console.error('Impossibile leggere lo stato personale del transfer.', error);
        crewTravelStatusReadError = true;
        activeCrewTravelStatus = null;
        renderCrewDashboardOverview();
      },
    );
  }
  if (!stopPaymentSubscription) {
    stopPaymentSubscription = onSnapshot(
      query(collection(db, 'boats', activeInvite.boatId, 'paymentRequests'), where('recipientId', '==', activeInvite.id)),
      renderPayments,
      (error) => handlePrivateReadError(error, document.querySelector('#accessLinkMessage'), translate('crew.flow.cannotReadPayments', 'Non riesco a leggere le richieste personali. Riprova tra poco.')),
    );
  }
  if (!stopAnnouncementSubscription) {
    stopAnnouncementSubscription = onSnapshot(
      query(collection(db, 'boats', activeInvite.boatId, 'announcements'), orderBy('createdAt', 'desc')),
      renderAnnouncements,
      (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), translate('crew.flow.cannotReadAnnouncements', 'Non riesco a leggere le comunicazioni dello skipper. Riprova tra poco.')),
    );
  }
  if (!stopContributionPlanSubscription) {
    stopContributionPlanSubscription = onSnapshot(
      doc(db, 'boats', activeInvite.boatId, 'contributionPlan', 'default'),
      (snapshot) => {
        activeContributionPlan = snapshot.exists() ? snapshot.data() : null;
        renderContributionPlan();
      },
      (error) => handlePrivateReadError(error, document.querySelector('#accessLinkMessage'), translate('crew.flow.cannotReadContributionPlan', 'Non riesco a leggere la composizione delle quote. Riprova tra poco.')),
    );
  }
  if (!stopProjectionSubscription) {
    stopProjectionSubscription = onSnapshot(
      doc(db, 'boats', activeInvite.boatId, 'crewProjections', activeInvite.id),
      (snapshot) => {
        activeProjection = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
        renderParticipantFinanceSummary();
        renderCrewDashboardOverview();
      },
      () => {
        // Gli inviti legacy non hanno una proiezione; non devono perdere l'accesso alla dashboard.
        activeProjection = null;
        renderParticipantFinanceSummary();
        renderCrewDashboardOverview();
      },
    );
  }
  if (!stopPaymentInstructionsSubscription) {
    stopPaymentInstructionsSubscription = onSnapshot(
      doc(db, 'boats', activeInvite.boatId, 'paymentInstructions', 'default'),
      (snapshot) => {
        activePaymentInstructions = snapshot.exists() ? snapshot.data() : null;
        renderParticipantFinanceSummary();
        renderCrewDashboardOverview();
      },
      () => {
        // Una card di pagamento non deve mai disconnettere la persona: se lo
        // skipper non ha ancora pubblicato le coordinate, il riepilogo resta.
        activePaymentInstructions = null;
        renderParticipantFinanceSummary();
        renderCrewDashboardOverview();
      },
    );
  }
}

async function loadCrewTransferPricing() {
  try {
    const snapshot = await getDoc(doc(db, 'events', 'egadi-2026', 'transferPricing', 'default'));
    activeTransferPricing = snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    console.info('Tariffe transfer non disponibili nella panoramica equipaggio.', error?.code || error);
    activeTransferPricing = null;
  }
  renderCrewDashboardOverview();
}

function renderDashboardBriefing() {
  const empty = document.querySelector('#participantBriefingEmpty');
  const briefing = document.querySelector('#participantBriefing');
  if (!hasPublishedBriefing()) {
    empty.hidden = false;
    briefing.hidden = true;
    renderCrewDashboardOverview();
    return;
  }
  empty.hidden = true;
  briefing.hidden = false;
  renderSchedule('#participantSchedule');
  document.querySelector('#participantRulesTitle').textContent = translate('crew.briefing.fullText', 'Testo completo');
  document.querySelector('#participantRulesSummary').textContent = briefingSummary();
  renderRulesSections('#participantRulesText', briefingRulesText());
  const acceptedAt = formatDateTime(activeRuleAcceptance?.acceptedAt);
  const acceptedAtSuffix = acceptedAt
    ? translate('crew.flow.briefingAcceptedAtSuffix', ' il {date}', { date: acceptedAt })
    : '';
  const originalNotice = activeLocale() === 'en' && !hasOfficialEnglishBriefing()
    ? translate('crew.flow.italianOriginalNotice', ' Italian original supplied by the skipper; an official English version has not yet been published.')
    : '';
  document.querySelector('#participantRulesStatus').textContent = `${translate('crew.flow.briefingAcceptedStatus', 'Regolamento di bordo accettato{acceptedAt}.', {
    acceptedAt: acceptedAtSuffix,
  })}${originalNotice}`;
  renderParticipantFinanceSummary();
  renderCrewDashboardOverview();
}

function renderBoardingGate() {
  if (!activeInvite || !auth.currentUser) return;
  const gate = document.querySelector('#boardingRulesGate');
  const dashboard = document.querySelector('#participantDashboard');
  const briefing = document.querySelector('#boardingBriefing');
  const waiting = document.querySelector('#boardingGateWaiting');
  const status = document.querySelector('#boardingGateStatus');
  const acknowledgement = document.querySelector('#rulesAcknowledgement');
  const acceptButton = document.querySelector('#acceptRulesButton');

  if (!hasPublishedBriefing()) {
    stopDashboardSubscriptions();
    dashboard.hidden = true;
    gate.hidden = false;
    briefing.hidden = true;
    waiting.hidden = false;
    acknowledgement.checked = false;
    acknowledgement.disabled = true;
    acceptButton.disabled = true;
    gate.dataset.rulesContext = '';
    gate.dataset.rulesVersion = '';
    gate.dataset.fullRulesRead = '';
    if (hasItalianBriefing() && activeLocale() === 'en') {
      waiting.textContent = translate('crew.flow.officialEnglishWaiting', 'The skipper has not yet published the official English version of the safety briefing. Please ask for it before accepting the rules in English.');
      status.textContent = translate('crew.flow.officialEnglishRequired', 'An official English safety briefing is required before you can continue in English.');
    } else {
      waiting.textContent = translate('crew.flow.briefingWaiting', 'Lo skipper deve ancora pubblicare il briefing di sicurezza e le regole di bordo…');
      status.textContent = translate('crew.flow.briefingRequiredForArea', 'Il briefing di sicurezza è obbligatorio prima di accedere alla tua area di bordo.');
    }
    return;
  }

  renderSchedule('#boardingSchedule');
  const version = String(currentBriefingVersion());
  const rulesContext = `${activeInvite.boatId}:${activeInvite.id}:${version}:${activeLocale()}`;
  if (gate.dataset.rulesContext !== rulesContext) {
    document.querySelector('#boardingRulesTitle').textContent = briefingTitle();
    document.querySelector('#boardingRulesSummary').textContent = briefingSummary();
    renderRulesSections('#boardingRulesText', briefingRulesText());
    gate.dataset.rulesContext = rulesContext;
    gate.dataset.rulesVersion = version;
    resetBoardingRulesRead();
  }

  if (hasAcceptedCurrentBriefing()) {
    gate.hidden = true;
    dashboard.hidden = false;
    setupCrewDashboard();
    setCrewDashboardView(crewDashboardViewFromHash());
    renderDashboardBriefing();
    startDashboardSubscriptions();
    renderCrewDashboardOverview();
    return;
  }

  stopDashboardSubscriptions();
  dashboard.hidden = true;
  gate.hidden = false;
  waiting.hidden = true;
  briefing.hidden = false;
  status.textContent = translate('crew.flow.readThenEnter', 'Leggi la sintesi e il regolamento di bordo completo. Poi potrai entrare nella tua area.');
  updateBoardingAcceptState();
}

function renderAnnouncements(snapshot) {
  const list = document.querySelector('#participantAnnouncementList');
  activeCrewAnnouncements = snapshot.docs.map((item) => item.data());
  if (snapshot.empty) {
    list.innerHTML = `<p class="empty-state">${escapeHtml(translate('crew.flow.noAnnouncements', 'Nessuna comunicazione al momento.'))}</p>`;
    renderCrewDashboardOverview();
    return;
  }
  list.innerHTML = snapshot.docs.map((item) => {
    const announcement = item.data();
    const important = announcement.isImportant ? `<span class="announcement-important">${escapeHtml(translate('crew.flow.important', 'Importante'))}</span>` : '';
    return `<article class="announcement-row"><strong>${escapeHtml(announcement.title || translate('crew.flow.announcement', 'Comunicazione dello skipper'))}</strong><span>${escapeHtml(announcement.message || '')}</span><span class="announcement-meta">${important}${escapeHtml(formatDateTime(announcement.createdAt) || translate('crew.flow.justPublished', 'Appena pubblicato'))}</span></article>`;
  }).join('');
  renderCrewDashboardOverview();
}

document.querySelector('#participantSignOutButton').addEventListener('click', async () => {
  try {
    await signOutCrew();
  } finally {
    window.location.assign('index.html');
  }
});

document.querySelector('#rulesAcknowledgement').addEventListener('change', (event) => {
  if (!event.currentTarget.disabled) updateBoardingAcceptState();
});

const boardingRulesDialogController = bindRulesDialog({
  dialog: document.querySelector('#boardingRulesDialog'),
  openButton: document.querySelector('#boardingRulesOpenButton'),
  scrollRegion: document.querySelector('#boardingRulesScroll'),
});
boardingRulesDialogController.setOnFullyRead(() => {
  if (canAcceptCurrentLocaleBriefing()) markBoardingRulesRead();
});
document.querySelector('#boardingRulesCloseButton').addEventListener('click', () => boardingRulesDialogController.close());

document.querySelector('#boardingGateStatus').setAttribute('role', 'status');
document.querySelector('#boardingGateStatus').setAttribute('aria-live', 'polite');

document.querySelector('#acceptRulesButton').addEventListener('click', async () => {
  if (!canAcceptCurrentLocaleBriefing() || !activeInvite || !auth.currentUser) return;
  const fullRulesRead = document.querySelector('#boardingRulesGate').dataset.fullRulesRead === 'true';
  if (!canConfirmCrewBriefing({ requiresFullRulesRead: briefingRequiresFullRulesRead(), fullRulesRead })) {
    setMessage(document.querySelector('#participantRulesMessage'), translate('crew.flow.scrollToEnd', 'Passo 1 di 2: apri il regolamento e scorri fino alla fine. Poi si attiva la dichiarazione qui sotto.'), true);
    return;
  }
  if (!document.querySelector('#rulesAcknowledgement').checked) {
    setMessage(document.querySelector('#participantRulesMessage'), translate('crew.flow.confirmReadFirst', 'Conferma di aver letto il regolamento di bordo prima di proseguire.'), true);
    return;
  }
  const button = document.querySelector('#acceptRulesButton');
  button.disabled = true;
  try {
    const rulesVersion = currentBriefingVersion();
    const acceptance = {
      inviteId: activeInvite.id,
      acceptedBy: auth.currentUser.uid,
      rulesVersion,
      ...(briefingRequiresFullRulesRead() ? { fullRulesRead: true } : {}),
      acceptedLocale: activeLocale(),
      acceptedAt: serverTimestamp(),
    };
    const acceptanceRef = doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id);
    const historyId = `${rulesVersion}-${auth.currentUser.uid}`;
    const historyRef = doc(acceptanceRef, 'history', historyId);
    await withSaveRetry(
      () => runTransaction(db, async (transaction) => {
        const historySnapshot = await transaction.get(historyRef);
        transaction.set(acceptanceRef, acceptance);
        if (!historySnapshot.exists()) transaction.set(historyRef, acceptance);
      }),
      () => setMessage(document.querySelector('#participantRulesMessage'), translate('crew.flow.verifying', 'Connessione lenta — verifico se è stato comunque salvato…')),
    );
    setMessage(document.querySelector('#participantRulesMessage'), translate('crew.flow.briefingConfirmedOpenArea', 'Briefing confermato. Apro la tua area di bordo…'));
  } catch (error) {
    console.error('Impossibile salvare la conferma del briefing.', error);
    setMessage(document.querySelector('#participantRulesMessage'), translate('crew.flow.cannotConfirmRules', 'Non riesco a confermare le regole. Riprova tra poco.'), true);
    button.disabled = false;
  }
});

startCrewAreaSession({
  onOpening: showOpening,
  onInvalid: showInvalid,
  onReady: async ({ invite }) => {
    activeInvite = invite;
    void loadCrewTransferPricing();
    const member = await getDoc(doc(db, 'boats', invite.boatId, 'members', invite.id));
    if (!member.exists()) {
      window.location.replace(profileUrl({ edit: true }));
      return;
    }
    document.querySelector('#signInSection').hidden = true;
    document.querySelector('#participantDashboard').hidden = true;
    document.querySelector('#participantTitle').textContent = member.data().displayName || invite.displayName || translate('crew.flow.myAreaTitle', 'La mia area');
    document.querySelector('#editProfileButton').href = profileUrl({ edit: true });
    renderProfile(member.data());
    onSnapshot(doc(db, 'boats', invite.boatId, 'briefing', 'board'), (snapshot) => {
      activeBriefing = snapshot.exists() ? snapshot.data() : null;
      renderBoardingGate();
    }, (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), translate('crew.flow.cannotReadBriefing', 'Non riesco a leggere il briefing di sicurezza. Riprova tra poco.'), { invalidatesSession: true }));
    onSnapshot(doc(db, 'boats', invite.boatId, 'ruleAcceptances', invite.id), (snapshot) => {
      activeRuleAcceptance = snapshot.exists() ? snapshot.data() : null;
      renderBoardingGate();
    }, (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), translate('crew.flow.cannotReadAcceptance', 'Non riesco a leggere la conferma del briefing. Riprova tra poco.'), { invalidatesSession: true }));
  },
});

import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { auth, crewAccessErrorMessage, crewAccessUrl, db, profileUrl, signOutCrew, startCrewAreaSession } from './crew-session.js?v=20260914-en2';
import { roleConfirmationText } from './crew-roles.js?v=20260914-en2';

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
let stopPaymentSubscription = null;
let stopAnnouncementSubscription = null;
let stopContributionPlanSubscription = null;
let stopProjectionSubscription = null;
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
  ['local', localized('Da regolare in loco / da dividere', 'To be settled locally / shared')],
  ['not_applicable', localized('Non previsto', 'Not included')],
]);
const CONTRIBUTION_ITEMS = [
  { id: 'berth', label: localized('Quota posto in barca', 'Berth contribution') },
  { id: 'starter_pack', label: localized('Starter Pack · lenzuola/asciugamani, SUP e fuoribordo · solo contanti in loco', 'Starter Pack · bed linen/towels, SUP and outboard · cash on board only') },
  { id: 'linen_towels', label: localized('Lenzuola e asciugamani · inclusi nello Starter Pack', 'Bed linen and towels · included in the Starter Pack') },
  { id: 'protection_insurance', label: localized('Assicurazione cauzione', 'Deposit insurance') },
  { id: 'provisions', label: localized('Cambusa', 'Provisions') },
  { id: 'fuel', label: localized('Gasolio per la navigazione', 'Fuel for navigation') },
  { id: 'transfer', label: localized('Transfer da/per il porto', 'Transfer to/from the port') },
  { id: 'refundable_deposit', label: localized('Cauzione rimborsabile', 'Refundable deposit') },
];
const PERSONAL_PAYMENT_GROUPS = Object.freeze({
  berth: new Set(['berth_base', 'berth_double_cabin', 'berth_single_cabin', 'berth_dinette', 'berth_other']),
  protection_insurance: new Set(['protection_insurance']),
});

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
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[kind] || paths.activity}</svg>`;
}

function crewDashboardCopy() {
  if (activeLocale() === 'en') {
    return {
      eyebrow: 'Your onboard hub',
      title: 'Your trip, <em>clear and personal.</em>',
      description: 'Open only what you need. Your personal details, payments and skipper updates remain visible only to you.',
      activity: 'My activity',
      activityDetail: 'Your completed personal steps.',
      activityTimelineEyebrow: 'Your trip status',
      activityTimelineTitle: 'What you have already done',
      board: 'My boat',
      boardDetail: 'Safety briefing and skipper updates.',
      money: 'My contributions',
      moneyDetail: 'Only requests addressed to you.',
      profile: 'My details',
      profileDetail: 'Your submitted charter details.',
      nextStep: 'Next step',
      nextButton: 'Open',
      noPayments: 'No requests at the moment',
      paymentsPending: '{count} request{suffix} to settle',
      paymentsVerified: '{count} confirmed contribution{suffix}',
      briefingReady: 'Safety briefing accepted',
      briefingWaiting: 'Safety briefing to be accepted',
      profileReady: 'Details submitted',
      profileWaiting: 'Details to complete',
      announcements: '{count} skipper update{suffix}',
      activityProgress: '{count} completed step{suffix}',
      allReady: 'Everything is ready. Keep this area handy for new updates or requests.',
      pendingAction: 'You have a payment request to settle. Check the details shared by the skipper.',
      boardAction: 'The boat is ready. Check the latest skipper updates before departure.',
      profileAction: 'Complete your details to enter your personal onboard area.',
      openBoard: 'Open boat area',
      openPayments: 'Open requests',
      openProfile: 'Open my details',
    };
  }
  return {
    eyebrow: 'Il tuo centro di bordo',
    title: 'Tutto il tuo viaggio, <em>chiaro e personale.</em>',
    description: 'Apri solo ciò che ti serve. I tuoi dati, le richieste e le comunicazioni dello skipper restano visibili soltanto a te.',
    activity: 'La mia attività',
    activityDetail: 'I passaggi personali già completati.',
    activityTimelineEyebrow: 'Stato del viaggio',
    activityTimelineTitle: 'Quello che hai già fatto',
    board: 'La mia barca',
    boardDetail: 'Briefing safety e aggiornamenti dello skipper.',
    money: 'Le mie quote',
    moneyDetail: 'Solo le richieste indirizzate a te.',
    profile: 'I miei dati',
    profileDetail: 'Anagrafica inviata per il charter.',
    nextStep: 'Prossimo passo',
    nextButton: 'Apri',
    noPayments: 'Nessuna richiesta al momento',
    paymentsPending: '{count} richiest{suffix} da regolare',
    paymentsVerified: '{count} contribut{suffix} confermat{suffixVerified}',
    briefingReady: 'Briefing safety accettato',
    briefingWaiting: 'Briefing safety da accettare',
    profileReady: 'Dati inviati',
    profileWaiting: 'Dati da completare',
    announcements: '{count} comunicazion{suffix} dello skipper',
    activityProgress: '{count} passagg{suffix} completat{suffixCompleted}',
    allReady: 'Tutto pronto. Tieni questa area a portata di mano per nuovi avvisi o richieste.',
    pendingAction: 'Hai una richiesta da regolare. Controlla i dettagli condivisi dallo skipper.',
    boardAction: 'La barca è pronta: controlla gli ultimi aggiornamenti dello skipper prima della partenza.',
    profileAction: 'Completa i tuoi dati per entrare nella tua area personale di bordo.',
    openBoard: 'Apri la barca',
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
      <button class="dashboard-hub-card dashboard-hub-card-board" type="button" data-crew-view="board">
        <span class="dashboard-hub-icon">${crewDashboardIcon('board')}</span><span class="dashboard-hub-label">${escapeHtml(copy.board)}</span>
        <strong data-crew-summary="board">${escapeHtml(copy.briefingReady)}</strong><small data-crew-detail="board">${escapeHtml(copy.boardDetail)}</small>
      </button>
      <button class="dashboard-hub-card dashboard-hub-card-money" type="button" data-crew-view="money">
        <span class="dashboard-hub-icon">${crewDashboardIcon('money')}</span><span class="dashboard-hub-label">${escapeHtml(copy.money)}</span>
        <strong data-crew-summary="money">${escapeHtml(copy.noPayments)}</strong><small data-crew-detail="money">${escapeHtml(copy.moneyDetail)}</small>
      </button>
      <button class="dashboard-hub-card dashboard-hub-card-crew" type="button" data-crew-view="profile">
        <span class="dashboard-hub-icon">${crewDashboardIcon('profile')}</span><span class="dashboard-hub-label">${escapeHtml(copy.profile)}</span>
        <strong data-crew-summary="profile">${escapeHtml(copy.profileReady)}</strong><small data-crew-detail="profile">${escapeHtml(copy.profileDetail)}</small>
      </button>
      <article class="dashboard-hub-card dashboard-hub-card-activity crew-dashboard-activity-card">
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
  navigation.innerHTML = Object.entries(CREW_DASHBOARD_LABELS)
    .map(([view, label]) => `<button type="button" data-crew-view="${view}">${view === 'overview' ? '← ' : ''}${escapeHtml(activeLocale() === 'en' ? ({ overview: 'Overview', profile: 'My details', money: 'Contributions', board: 'Boat and updates' }[view]) : label)}</button>`)
    .join('');
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
  navigation.hidden = view === 'overview';
  grid.hidden = view === 'overview';
  grid.classList.toggle('dashboard-grid-single-view', view !== 'overview');
  grid.querySelectorAll('[data-crew-panel]').forEach((panel) => {
    panel.hidden = view === 'overview' || panel.dataset.crewPanel !== view;
  });
  navigation.querySelectorAll('[data-crew-view]').forEach((button) => {
    button.toggleAttribute('aria-current', button.dataset.crewView === view);
  });
}

function setCrewDashboardMetric(name, value, detail) {
  const valueTarget = document.querySelector(`[data-crew-summary="${name}"]`);
  const detailTarget = document.querySelector(`[data-crew-detail="${name}"]`);
  if (valueTarget) valueTarget.textContent = value;
  if (detailTarget) detailTarget.textContent = detail;
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
  return { tone: 'waiting', label: localized('Richieste personali', 'Personal requests'), detail: localized('Nessuna richiesta personale al momento.', 'No personal requests at the moment.') };
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
          : localized('Dati inviati per il charter.', 'Details submitted for the charter.')
        : localized('Dati ancora da completare.', 'Details still need to be completed.'),
    },
    {
      tone: briefingReady ? 'complete' : 'waiting',
      label: localized('Briefing safety', 'Safety briefing'),
      detail: briefingReady
        ? briefingAcceptedAt
          ? localized(`Accettato il ${briefingAcceptedAt}.`, `Accepted on ${briefingAcceptedAt}.`)
          : localized('Regole di bordo accettate.', 'Board rules accepted.')
        : localized('Da leggere e accettare prima di salpare.', 'Read and accept it before departure.'),
    },
    paymentActivity,
  ];
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
  const projectedPayableCents = projectionPayableCents();
  const projectedPaymentSummary = projectedPayableCents
    ? `${formatCurrency(projectedPayableCents / 100)} ${localized('previsti', 'planned')}`
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
  setCrewDashboardMetric(
    'board',
    briefingReady ? copy.briefingReady : copy.briefingWaiting,
    copy.announcements
      .replace('{count}', String(announcements))
      .replace('{suffix}', crewPluralSuffix(announcements, 'e', 'i')),
  );
  setCrewDashboardMetric(
    'money',
    pendingPayments
      ? `${formatCurrency(pendingPaymentCents / 100)} ${localized('da regolare', 'to settle')}`
      : verifiedPayments
        ? `${formatCurrency(verifiedPaymentCents / 100)} ${localized('confermati', 'confirmed')}`
        : projectedPaymentSummary,
    verifiedPayments
      ? `${verifiedPaymentSummary} · ${localized('Cauzione rimborsabile separata.', 'Refundable deposit kept separate.')}`
      : projectedPayableCents
        ? `${localized('Quota prevista dallo skipper; non è ancora una richiesta di pagamento.', 'Planned by the skipper; this is not a payment request yet.')} ${localized('La cauzione rimborsabile è sempre separata.', 'The refundable deposit is always separate.')}`
        : `${copy.moneyDetail} · ${localized('La cauzione rimborsabile è sempre separata.', 'The refundable deposit is always separate.')}`,
  );
  setCrewDashboardMetric('profile', profileReady ? copy.profileReady : copy.profileWaiting, copy.profileDetail);
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
      pendingPayments ? pendingPaymentSummary : (verifiedPayments ? verifiedPaymentSummary : projectedPaymentSummary),
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

function paymentStatusLabel(payment) {
  if (payment.status === 'verified') return localized('Accredito confermato', 'Payment confirmed');
  if (payment.status === 'cancelled') return localized('Richiesta annullata', 'Request cancelled');
  return localized('Da regolare', 'To be settled');
}

function paymentAmountCents(payment) {
  return Math.round(paymentAmount(payment) * 100);
}

function isPendingCrewPayment(payment) {
  return payment.status !== 'verified' && payment.status !== 'cancelled';
}

function projectionAmountCents(fieldName) {
  if (activeProjection?.contributesToCosts === false && fieldName !== 'refundableDepositCents') return 0;
  const amountCents = Number(activeProjection?.[fieldName]);
  return Number.isInteger(amountCents) && amountCents > 0 ? amountCents : 0;
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

function projectedContributionSummary(fieldName) {
  if (activeProjection?.contributesToCosts === false) {
    return {
      value: localized('Esente dalle quote', 'Exempt from contributions'),
      detail: localized('Lo skipper ti ha escluso dalle quote automatiche della barca.', 'The skipper has excluded you from the boat’s automatic contributions.'),
    };
  }
  const amountCents = projectionAmountCents(fieldName);
  if (!amountCents) return null;
  return {
    value: `${formatCurrency(amountCents / 100)} ${localized('previsti', 'planned')}`,
    detail: localized('Quota prevista dallo skipper; non è ancora una richiesta di pagamento.', 'Planned by the skipper; this is not a payment request yet.'),
  };
}

function projectedRefundableDepositSummary() {
  const amountCents = projectionAmountCents('refundableDepositCents');
  if (!amountCents) return contributionPlanFallback('refundable_deposit', { deposit: true });
  return {
    value: `${formatCurrency(amountCents / 100)} ${localized('in loco', 'locally')}`,
    detail: localized('Cauzione rimborsabile: da portare e regolare in loco, separata dalle richieste di pagamento.', 'Refundable deposit: bring and settle it locally, separate from payment requests.'),
  };
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
  const amountCents = projectedCents || contributionAmountCents(plannedItem);
  const value = amountCents
    ? `${formatCurrency(amountCents / 100)} ${localized('in contanti, in loco', 'cash on board')}`
    : localized('Da definire · contanti in loco', 'To be confirmed · cash on board');
  return {
    value,
    detail: localized(
      'Starter Pack da regolare esclusivamente in contanti a bordo: non entra nella quota richiesta online e non usa link di pagamento.',
      'The Starter Pack is settled in cash on board only: it is not included in the online contribution and does not use payment links.',
    ),
  };
}

function paymentTotalsForGroup(groupId) {
  const itemIds = PERSONAL_PAYMENT_GROUPS[groupId] || new Set();
  const payments = activeCrewPayments.filter((payment) => itemIds.has(payment.contributionItemId) && payment.status !== 'cancelled');
  return {
    payments,
    verifiedCents: payments
      .filter((payment) => payment.status === 'verified')
      .reduce((total, payment) => total + paymentAmountCents(payment), 0),
    pendingCents: payments
      .filter(isPendingCrewPayment)
      .reduce((total, payment) => total + paymentAmountCents(payment), 0),
  };
}

function contributionPlanFallback(itemId, { deposit = false } = {}) {
  const item = contributionPlanItems().find((candidate) => candidate.id === itemId);
  if (!activeContributionPlan || !item) {
    return {
      value: localized('Da definire', 'To be confirmed'),
      detail: deposit
        ? localized('Lo skipper indicherà importo e modalità di consegna in loco.', 'The skipper will confirm the amount and how it is settled locally.')
        : localized('Lo skipper non ha ancora preparato una richiesta personale.', 'The skipper has not prepared a personal request yet.'),
    };
  }
  const amount = item.amountCents > 0 ? `${formatCurrency(item.amountCents / 100)} ${localized('a persona', 'per person')}` : localized('Importo da definire', 'Amount to be confirmed');
  if (item.state === 'included') {
    return { value: localized('Compreso nella quota', 'Included in the contribution'), detail: localized('Nessuna richiesta separata prevista.', 'No separate request is expected.') };
  }
  if (item.state === 'not_applicable') {
    return { value: localized('Non previsto', 'Not included'), detail: localized('Non è previsto per questa barca.', 'This is not planned for this boat.') };
  }
  if (item.state === 'extra') {
    return deposit
      ? { value: amount, detail: localized('Da correggere: una cauzione rimborsabile si regola in loco.', 'To be corrected: a refundable deposit is settled locally.') }
      : { value: amount, detail: localized('Richiesta personale non ancora preparata.', 'A personal request has not been prepared yet.') };
  }
  if (item.state === 'local') {
    return {
      value: amount,
      detail: deposit
        ? localized('Da portare e regolare in loco; non è sommata alle richieste online.', 'Bring and settle locally; it is not added to online requests.')
        : localized('Da regolare in loco o da dividere a bordo.', 'To be settled locally or shared on board.'),
    };
  }
  return {
    value: localized('Da definire', 'To be confirmed'),
    detail: deposit
      ? localized('Non è inclusa nella quota né nelle richieste personali.', 'It is not included in the contribution or personal requests.')
      : localized('Non è ancora inclusa né richiesta a parte.', 'It is not included or requested separately yet.'),
  };
}

function personalContributionSummary(groupId, planItemId, projectionField) {
  const totals = paymentTotalsForGroup(groupId);
  if (!totals.payments.length && activeProjection?.contributesToCosts === false) {
    return {
      value: localized('Esente dalle quote', 'Exempt from contributions'),
      detail: localized('Lo skipper ti ha escluso dalle quote automatiche della barca.', 'The skipper has excluded you from the boat’s automatic contributions.'),
    };
  }
  if (!totals.payments.length) return projectedContributionSummary(projectionField) || contributionPlanFallback(planItemId);
  if (totals.pendingCents && totals.verifiedCents) {
    return {
      value: `${formatCurrency(totals.pendingCents / 100)} ${localized('da regolare', 'to settle')}`,
      detail: `${formatCurrency(totals.verifiedCents / 100)} ${localized('già confermati dallo skipper.', 'already confirmed by the skipper.')}`,
    };
  }
  if (totals.pendingCents) {
    return {
      value: `${formatCurrency(totals.pendingCents / 100)} ${localized('da regolare', 'to settle')}`,
      detail: localized('I dettagli del metodo scelto sono nel messaggio WhatsApp dello skipper.', 'The chosen payment method details are in the skipper’s WhatsApp message.'),
    };
  }
  return {
    value: `${formatCurrency(totals.verifiedCents / 100)} ${localized('confermati', 'confirmed')}`,
    detail: localized('Accredito confermato manualmente dallo skipper.', 'The contribution was manually confirmed by the skipper.'),
  };
}

function participantFinanceRow(label, summary, extraClass = '') {
  return `<article class="participant-finance-row${extraClass ? ` ${extraClass}` : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(summary.value)}</strong><small>${escapeHtml(summary.detail)}</small></article>`;
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
      detail: localized('Posto riservato per te nella proiezione equipaggio.', 'A place reserved for you in the crew plan.'),
    }),
  ].join('');
}

function renderParticipantFinanceSummary() {
  const summary = document.querySelector('#participantFinanceSummary');
  if (!summary) return;
  if (!hasAcceptedCurrentBriefing()) {
    summary.hidden = true;
    summary.replaceChildren();
    return;
  }
  const berth = personalContributionSummary('berth', 'berth', 'berthCents');
  const starterPack = starterPackCashSummary();
  const protectionInsurance = personalContributionSummary('protection_insurance', 'protection_insurance', 'protectionInsuranceCents');
  const refundableDeposit = projectedRefundableDepositSummary();
  const pendingCents = activeCrewPayments
    .filter(isPendingCrewPayment)
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const verifiedCents = activeCrewPayments
    .filter((payment) => payment.status === 'verified')
    .reduce((total, payment) => total + paymentAmountCents(payment), 0);
  const unclassifiedPayments = activeCrewPayments.filter((payment) => payment.status !== 'cancelled' && !payment.contributionItemId).length;
  const acceptedAt = formatDateTime(activeRuleAcceptance?.acceptedAt);
  const rulesTitle = briefingTitle();
  const paymentStatus = pendingCents
    ? `${formatCurrency(pendingCents / 100)} ${localized('da regolare', 'to settle')}`
    : verifiedCents
      ? `${formatCurrency(verifiedCents / 100)} ${localized('accrediti confermati', 'payments confirmed')}`
      : localized('Nessuna richiesta personale attiva', 'No personal requests at the moment');
  const paymentDetailBase = verifiedCents && pendingCents
    ? `${formatCurrency(verifiedCents / 100)} ${localized('già confermati. La cauzione rimborsabile resta separata.', 'already confirmed. The refundable deposit remains separate.')}`
    : localized('Il sito non incassa denaro; le richieste vengono confermate manualmente dallo skipper.', 'The site does not collect money; requests are confirmed manually by the skipper.');
  const paymentDetail = unclassifiedPayments
    ? `${paymentDetailBase} ${unclassifiedPayments} ${localized(unclassifiedPayments === 1 ? 'richiesta precedente resta nell’elenco sotto, ma non può essere assegnata automaticamente a una voce.' : 'richieste precedenti restano nell’elenco sotto, ma non possono essere assegnate automaticamente a una voce.', unclassifiedPayments === 1 ? 'earlier request remains in the list below, but cannot be assigned to an item automatically.' : 'earlier requests remain in the list below, but cannot be assigned to an item automatically.')}`
    : paymentDetailBase;
  summary.hidden = false;
  summary.innerHTML = `
    <p class="eyebrow">${escapeHtml(localized('Il mio riepilogo', 'My personal summary'))}</p>
    <h4>${escapeHtml(localized('Le tue voci, senza conti degli altri', 'Your items, with no one else’s finances'))}</h4>
    <p>${escapeHtml(localized('Qui vedi soltanto la tua previsione, le tue richieste, lo Starter Pack e la cauzione da regolare in contanti/in loco, oltre al briefing che hai accettato.', 'Here you only see your plan, your requests, the Starter Pack and refundable deposit settled in cash/on board, plus the briefing you accepted.'))}</p>
    <div class="participant-finance-grid">
      ${participantProjectionRows()}
      ${participantFinanceRow(localized('Posto / cabina', 'Berth / cabin'), berth)}
      ${participantFinanceRow('Starter Pack', starterPack)}
      ${participantFinanceRow(localized('Assicurazione cauzione', 'Deposit insurance'), protectionInsurance)}
      ${participantFinanceRow(localized('Cauzione rimborsabile', 'Refundable deposit'), refundableDeposit, 'participant-finance-row-deposit')}
      ${participantFinanceRow(localized('Richieste personali', 'My personal requests'), { value: paymentStatus, detail: paymentDetail })}
    </div>
    <div class="participant-finance-acceptance"><strong>${escapeHtml(localized('Regole di bordo accettate', 'Board rules accepted'))}</strong>${escapeHtml(rulesTitle)} · ${escapeHtml(localized('versione', 'version'))} ${currentBriefingVersion()}${acceptedAt ? ` · ${escapeHtml(acceptedAt)}` : ''}. <a href="#crew-bacheca">${escapeHtml(localized('Rileggi briefing e bacheca', 'Read the briefing and updates again'))}</a></div>
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
  stopPaymentSubscription = null;
  stopAnnouncementSubscription = null;
  stopContributionPlanSubscription = null;
  stopProjectionSubscription = null;
  activeInvite = null;
  activeBriefing = null;
  activeRuleAcceptance = null;
  activeContributionPlan = null;
  activeMember = null;
  activeProjection = null;
  activeCrewPayments = [];
  activeCrewAnnouncements = [];
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

function handlePrivateReadError(error, messageElement, fallbackMessage) {
  if (error?.code === 'permission-denied') {
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
  activeCrewPayments = snapshot.docs.map((item) => item.data());
  if (snapshot.empty) {
    list.innerHTML = `<p class="empty-state">${escapeHtml(translate('crew.flow.noPayments', 'Nessuna richiesta al momento. Lo skipper può aggiungerne altre anche in seguito.'))}</p>`;
    renderParticipantFinanceSummary();
    renderCrewDashboardOverview();
    return;
  }
  list.innerHTML = snapshot.docs.map((item) => {
    const payment = item.data();
    const dueDate = payment.dueDate ? ` · ${translate('crew.flow.dueBy', 'Entro')} ${formatDate(payment.dueDate)}` : '';
    const reason = `${payment.reason || translate('crew.flow.weekendContribution', 'Contributo weekend')}${payment.isOptional ? ` · ${translate('crew.flow.optional', 'Facoltativo')}` : ''}`;
    const status = paymentStatusLabel(payment);
    const methods = paymentMethodTags(payment) || `<span>${escapeHtml(translate('crew.flow.paymentMethodToAgree', 'Metodo da concordare con lo skipper.'))}</span>`;
    const legacyInstructions = payment.instructions ? `<span>${escapeHtml(payment.instructions)}</span>` : '';
    return `<article class="payment-row"><div><strong>${formatCurrency(paymentAmount(payment))} · ${escapeHtml(reason)}</strong><span>${escapeHtml(dueDate)}</span>${methods}${legacyInstructions}<span class="payment-detail-note">${escapeHtml(translate('crew.flow.paymentDetailsInWhatsApp', 'I dettagli del pagamento sono nel messaggio WhatsApp dello skipper.'))}</span></div><div class="payment-action"><span class="payment-status">${escapeHtml(status)}</span></div></article>`;
  }).join('');
  renderParticipantFinanceSummary();
  renderCrewDashboardOverview();
}

function contributionAmountCents(item) {
  const amountCents = Number(item?.amountCents);
  return Number.isInteger(amountCents) && amountCents >= 0 ? amountCents : 0;
}

function contributionPlanItems(plan = activeContributionPlan) {
  const sourceItems = plan?.items && typeof plan.items === 'object' ? plan.items : {};
  return CONTRIBUTION_ITEMS.map((item) => {
    const source = sourceItems[item.id] || {};
    const state = item.id === 'starter_pack'
      ? 'local'
      : item.id === 'linen_towels'
        ? 'included'
      : CONTRIBUTION_ITEM_STATES.has(source.state) ? source.state : 'to_define';
    return {
      ...item,
      state,
      amountCents: item.id === 'linen_towels' ? 0 : contributionAmountCents(source),
    };
  });
}

function contributionItemMarkup(item) {
  const amount = item.amountCents > 0 ? ` · ${formatCurrency(item.amountCents / 100)} ${translate('crew.flow.perPerson', 'a persona')}` : '';
  const stateLabel = item.id === 'starter_pack'
    ? localized('Solo contanti, in loco', 'Cash on board only')
    : CONTRIBUTION_ITEM_STATES.get(item.state);
  return `<div><span>${escapeHtml(stateLabel)}</span><strong>${escapeHtml(item.label)}${escapeHtml(amount)}</strong></div>`;
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
  const items = contributionPlanItems();
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
  if (activeLocale() === 'en' && hasOfficialEnglishBriefing()) return activeBriefing.rulesTitleEn.trim();
  return activeBriefing?.rulesTitle || translate('crew.briefing.fullRules', 'Regolamento completo');
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
    : translate('crew.briefing.summaryFallback', 'Leggi integralmente il regolamento completo: questa sintesi non sostituisce il testo.');
}

function briefingRulesText() {
  if (activeLocale() === 'en' && hasOfficialEnglishBriefing()) return activeBriefing.rulesTextEn;
  return activeBriefing?.rulesText || '';
}

function currentBriefingVersion() {
  return Number.isInteger(activeBriefing?.rulesVersion) ? activeBriefing.rulesVersion : 1;
}

function hasAcceptedCurrentBriefing() {
  return activeRuleAcceptance?.rulesVersion === currentBriefingVersion()
    && activeRuleAcceptance?.acceptedBy === auth.currentUser?.uid
    && (!briefingRequiresFullRulesRead() || activeRuleAcceptance?.fullRulesRead === true);
}

function hasReachedEnd(element) {
  return element.clientHeight > 0 && element.scrollHeight - element.scrollTop - element.clientHeight <= 8;
}

function isEntireRulesTextVisible(element) {
  return element.clientHeight > 0 && element.scrollHeight <= element.clientHeight + 8;
}

function clearBoardingRulesGateState() {
  const gate = document.querySelector('#boardingRulesGate');
  const scrollRegion = document.querySelector('#boardingRulesScroll');
  gate.dataset.rulesContext = '';
  gate.dataset.rulesVersion = '';
  gate.dataset.fullRulesRead = '';
  scrollRegion.scrollTop = 0;
  scrollRegion.classList.remove('is-complete');
  document.querySelector('#rulesAcknowledgement').checked = false;
  document.querySelector('#rulesAcknowledgement').disabled = true;
  document.querySelector('#acceptRulesButton').disabled = true;
  document.querySelector('#boardingFullRulesHint').textContent = translate('crew.flow.scrollToEnd', 'Scorri fino alla fine del regolamento per sbloccare la conferma.');
}

function updateBoardingAcceptState() {
  const gate = document.querySelector('#boardingRulesGate');
  const acknowledgement = document.querySelector('#rulesAcknowledgement');
  const acceptButton = document.querySelector('#acceptRulesButton');
  const fullRulesRead = gate.dataset.fullRulesRead === 'true';
  acknowledgement.disabled = !fullRulesRead;
  if (!fullRulesRead) acknowledgement.checked = false;
  acceptButton.disabled = !(canAcceptCurrentLocaleBriefing() && !hasAcceptedCurrentBriefing() && fullRulesRead && acknowledgement.checked);
}

function markBoardingRulesRead() {
  const gate = document.querySelector('#boardingRulesGate');
  const scrollRegion = document.querySelector('#boardingRulesScroll');
  const acknowledgement = document.querySelector('#rulesAcknowledgement');
  if (gate.dataset.fullRulesRead === 'true') return;
  gate.dataset.fullRulesRead = 'true';
  scrollRegion.classList.add('is-complete');
  document.querySelector('#boardingFullRulesHint').textContent = translate('crew.flow.fullRulesSeen', 'Regolamento completo visualizzato. Ora puoi confermare la lettura.');
  updateBoardingAcceptState();
  if (document.activeElement === scrollRegion) acknowledgement.focus();
}

function resetBoardingRulesRead() {
  const gate = document.querySelector('#boardingRulesGate');
  const scrollRegion = document.querySelector('#boardingRulesScroll');
  gate.dataset.fullRulesRead = '';
  scrollRegion.scrollTop = 0;
  scrollRegion.classList.remove('is-complete');
  document.querySelector('#boardingFullRulesHint').textContent = translate('crew.flow.scrollToEnd', 'Scorri fino alla fine del regolamento per sbloccare la conferma.');
  updateBoardingAcceptState();
  requestAnimationFrame(() => {
    if (isEntireRulesTextVisible(scrollRegion)) markBoardingRulesRead();
  });
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
  stopPaymentSubscription = null;
  stopAnnouncementSubscription = null;
  stopContributionPlanSubscription = null;
  stopProjectionSubscription = null;
}

function startDashboardSubscriptions() {
  if (!activeInvite) return;
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
  document.querySelector('#participantRulesTitle').textContent = briefingTitle();
  document.querySelector('#participantRulesSummary').textContent = briefingSummary();
  document.querySelector('#participantRulesText').textContent = briefingRulesText();
  const acceptedAt = formatDateTime(activeRuleAcceptance?.acceptedAt);
  const acceptedAtSuffix = acceptedAt
    ? translate('crew.flow.briefingAcceptedAtSuffix', ' il {date}', { date: acceptedAt })
    : '';
  const originalNotice = activeLocale() === 'en' && !hasOfficialEnglishBriefing()
    ? translate('crew.flow.italianOriginalNotice', ' Italian original supplied by the skipper; an official English version has not yet been published.')
    : '';
  document.querySelector('#participantRulesStatus').textContent = `${translate('crew.flow.briefingAcceptedStatus', 'Briefing di sicurezza versione {version} accettato{acceptedAt}.', {
    version: currentBriefingVersion(),
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
    status.textContent = translate('crew.flow.briefingRequiredForArea', 'Il briefing di sicurezza è obbligatorio prima di accedere alla tua area di bordo.');
    return;
  }

  if (activeLocale() === 'en' && !hasOfficialEnglishBriefing() && !hasAcceptedCurrentBriefing()) {
    stopDashboardSubscriptions();
    dashboard.hidden = true;
    gate.hidden = false;
    briefing.hidden = true;
    waiting.hidden = false;
    waiting.textContent = translate('crew.flow.officialEnglishWaiting', 'The skipper has not yet published the official English version of the safety briefing. Please ask for it before accepting the rules in English.');
    acknowledgement.checked = false;
    acknowledgement.disabled = true;
    acceptButton.disabled = true;
    gate.dataset.rulesContext = '';
    gate.dataset.rulesVersion = '';
    gate.dataset.fullRulesRead = '';
    status.textContent = translate('crew.flow.officialEnglishRequired', 'An official English safety briefing is required before you can continue in English.');
    return;
  }

  renderSchedule('#boardingSchedule');
  const version = String(currentBriefingVersion());
  const rulesContext = `${activeInvite.boatId}:${activeInvite.id}:${version}:${activeLocale()}`;
  if (gate.dataset.rulesContext !== rulesContext) {
    document.querySelector('#boardingRulesTitle').textContent = briefingTitle();
    document.querySelector('#boardingRulesSummary').textContent = briefingSummary();
    document.querySelector('#boardingRulesText').textContent = briefingRulesText();
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
  status.textContent = translate('crew.flow.readThenEnter', `Leggi la sintesi e l’intero regolamento, poi accetta la versione ${version} per entrare nella tua area di bordo.`, { version });
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

document.querySelector('#boardingRulesScroll').addEventListener('scroll', (event) => {
  if (canAcceptCurrentLocaleBriefing() && hasReachedEnd(event.currentTarget)) markBoardingRulesRead();
});

if ('ResizeObserver' in window) {
  new ResizeObserver(() => {
    const scrollRegion = document.querySelector('#boardingRulesScroll');
    if (canAcceptCurrentLocaleBriefing() && scrollRegion && isEntireRulesTextVisible(scrollRegion)) markBoardingRulesRead();
  }).observe(document.querySelector('#boardingRulesScroll'));
}

document.querySelector('#boardingGateStatus').setAttribute('role', 'status');
document.querySelector('#boardingGateStatus').setAttribute('aria-live', 'polite');

document.querySelector('#acceptRulesButton').addEventListener('click', async () => {
  if (!canAcceptCurrentLocaleBriefing() || !activeInvite || !auth.currentUser) return;
  if (!document.querySelector('#rulesAcknowledgement').checked) {
    setMessage(document.querySelector('#participantRulesMessage'), translate('crew.flow.confirmReadFirst', 'Scorri il regolamento completo e conferma di averlo letto prima di proseguire.'), true);
    return;
  }
  if (document.querySelector('#boardingRulesGate').dataset.fullRulesRead !== 'true') return;
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
    const batch = writeBatch(db);
    batch.set(doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id), acceptance, { merge: true });
    const historyId = `${rulesVersion}-${auth.currentUser.uid}`;
    batch.create(doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id, 'history', historyId), acceptance);
    await batch.commit();
    setMessage(document.querySelector('#participantRulesMessage'), translate('crew.flow.briefingConfirmedOpenArea', 'Briefing confermato. Apro la tua area di bordo…'));
  } catch (error) {
    setMessage(document.querySelector('#participantRulesMessage'), translate('crew.flow.cannotConfirmRules', 'Non riesco a confermare le regole. Riprova tra poco.'), true);
    button.disabled = false;
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
    document.querySelector('#participantDashboard').hidden = true;
    document.querySelector('#participantTitle').textContent = member.data().displayName || invite.displayName || translate('crew.flow.myAreaTitle', 'La mia area');
    document.querySelector('#editProfileButton').href = profileUrl({ edit: true });
    renderProfile(member.data());
    onSnapshot(doc(db, 'boats', invite.boatId, 'briefing', 'board'), (snapshot) => {
      activeBriefing = snapshot.exists() ? snapshot.data() : null;
      renderBoardingGate();
    }, (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), translate('crew.flow.cannotReadBriefing', 'Non riesco a leggere il briefing di sicurezza. Riprova tra poco.')));
    onSnapshot(doc(db, 'boats', invite.boatId, 'ruleAcceptances', invite.id), (snapshot) => {
      activeRuleAcceptance = snapshot.exists() ? snapshot.data() : null;
      renderBoardingGate();
    }, (error) => handlePrivateReadError(error, document.querySelector('#participantRulesMessage'), translate('crew.flow.cannotReadAcceptance', 'Non riesco a leggere la conferma del briefing. Riprova tra poco.')));
  },
});

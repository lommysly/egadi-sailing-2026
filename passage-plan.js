(() => {
  const locale = window.EgadiI18n?.getLocale?.() === 'en' ? 'en' : 'it';
  const data = locale === 'en'
    ? (window.PASSAGE_PLAN_DATA_EN || window.PASSAGE_PLAN_DATA)
    : window.PASSAGE_PLAN_DATA;
  const COPY = {
    it: {
      visualLabels: [
        ['Levanzo · acqua e rocce', 'Acqua cristallina e rocce di Levanzo'],
        ['Levanzo · luce del mattino', 'Acqua e fondale di Levanzo'],
        ['Marettimo · costa dal largo', 'Costa e acqua trasparente di Marettimo'],
        ['Favignana · acqua e luce', 'Acqua cristallina di Favignana'],
      ],
      scenarioImage: 'immagine di scenario',
      photo: 'Foto',
      updateUnavailable: 'Aggiornamento non disponibile',
      unavailableSummary: 'Il Passage Plan non è stato caricato. Riprova più tardi oppure chiedi allo skipper il briefing più recente.',
      unavailableSources: 'Nessun dato meteo o di navigazione deve essere dedotto da questa pagina finché il briefing non è disponibile.',
      updating: 'Aggiornamento in corso',
      nextUpdateUnknown: 'Da comunicare dallo skipper',
      departureLabel: 'Partenza tra',
      travelLabel: 'Viaggio',
      daySingular: 'giorno',
      dayPlural: 'giorni',
      hourSingular: 'ora',
      hourPlural: 'ore',
      sailingNow: 'Siamo in navigazione',
      tripFinished: 'Viaggio concluso',
      openSource: 'Apri la fonte',
      updated: 'Dati meteo aggiornati al',
      noOperationalBulletin: 'Nessun bollettino meteo operativo ancora pubblicato.',
      published: 'Pubblicato',
      operationalWeatherLabel: 'Meteo operativo non ancora pubblicato',
      operationalWeather: 'Meteo operativo',
      awaitingWindow: 'In attesa della finestra utile.',
      awaitingWindowText: 'Vento, mare, temperature e correnti arriveranno con fonte, ora di emissione e validità.',
      navigation: 'Come si naviga oggi',
      sun: 'Sole',
      moon: 'Luna',
      wind: 'Vento',
      sea: 'Mare / onda',
      visibility: 'Visibilità',
      phenomena: 'Fenomeni e precipitazioni',
      sky: 'Cielo',
      air: 'Aria',
      water: 'Acqua',
      currents: 'Correnti',
      skipperDecision: 'Decisione skipper',
      stopsLabel: 'Scenari di luce e soste',
      stopsHeading: 'Scenari da valutare con lo skipper',
      checks: 'Verifiche prima della sosta',
      overnightUndefined: 'Da definire',
      overnightStatus: 'Da verificare',
      indicativeOvernight: 'Piano notte indicativo:',
      alternative: 'Alternativa:',
      climateOutlookEyebrow: 'Aria, acqua e luce',
      weatherDetailsToggle: 'Dettagli meteo e fonti',
      decisionBoardEyebrow: 'Briefing operativo',
      decisionBoardTitle: 'Le decisioni che contano adesso',
      decisiveFactorsTitle: 'Tre elementi decisivi',
      missingChecksTitle: 'Verifiche ancora necessarie',
      routeMapTitle: 'Schema orientativo della rotta nelle Isole Egadi',
      routeMapDescription: 'Traccia verde: gruppo del giovedì via Levanzo. Traccia blu: gruppo del venerdì da Marsala verso Marettimo, a Sud e Ovest di Favignana. Programma comune successivo solo se consentito.',
      routeMapCaption: 'Schema non utilizzabile per navigare. Verde: giovedì via Levanzo; blu: scenario venerdì diretto a Marettimo. Non mostra imboccature, distanze in scala o rifugi garantiti. Verificare rotte, fondali e accessi su carta aggiornata.',
      orientationNotesTitle: 'Punti esposti e alternative',
      summaryEyebrow: 'Sintesi giorno per giorno',
      summaryTitle: 'Uscita, navigazione e arrivo a colpo d’occhio',
      summaryLegend: '🟢 relativamente favorevole · 🟡 criticità o incertezza · 🔴 condizioni avverse · ⚪ dati insufficienti. Il colore non sostituisce la decisione dello skipper. Da telefono, scorri la tabella verso destra.',
      summaryHeaders: ['Giorno', 'Tratta', 'Uscita', 'Navigazione', 'Arrivo', 'Finestra favorevole', 'Criticità principale', 'Incertezza'],
      departureAssessment: 'Uscita dal porto',
      passageAssessment: 'Navigazione',
      arrivalAssessment: 'Arrivo o sosta',
      insufficientData: 'Dati insufficienti per una valutazione',
      routeDetails: 'Dati indicativi della tratta',
      distance: 'Distanza',
      course: 'Direzione',
      duration: 'Durata indicativa',
      favourableWindow: 'Finestra favorevole',
      criticality: 'Fase più critica',
      uncertainty: 'Incertezza',
      operationalChecksTitle: 'Da ricontrollare prima di salpare',
      modelComparisonEyebrow: 'Fonti e confronto',
      modelComparisonTitle: 'Dove i modelli concordano e dove divergono',
      modelComparisonIntro: 'Gli scenari restano separati: non facciamo una media che nasconda quello più impegnativo.',
      modelHeaders: ['Parametro', 'Scenari consultati', 'Divergenza', 'Decisione interessata'],
      nextUpdateEyebrow: 'Prossimo aggiornamento',
      nextUpdateTitle: 'Quando ricontrollare il briefing',
      scheduledUpdate: 'Prossimo controllo:',
      departureSchedule: 'Partenze · giovedì e venerdì',
      callDecisionsTitle: 'Da decidere insieme nella call',
      harbourExposure: 'Esposizione e limiti',
      harbourForecast: 'Arrivo e notte · dato al largo',
      harbourChecks: 'Conferma locale necessaria',
      harbourDetails: 'Leggi esposizione, verifiche e alternativa',
    },
    en: {
      visualLabels: [
        ['Levanzo · water and rock', 'Crystal-clear water and rock at Levanzo'],
        ['Levanzo · morning light', 'Water and seabed at Levanzo'],
        ['Marettimo · coast from offshore', 'Marettimo’s coast and clear water'],
        ['Favignana · water and light', 'Crystal-clear water at Favignana'],
      ],
      scenarioImage: 'illustrative image',
      photo: 'Photo',
      updateUnavailable: 'Update unavailable',
      unavailableSummary: 'The Passage Plan could not be loaded. Please try again later or ask the skipper for the latest briefing.',
      unavailableSources: 'Do not infer weather or navigation information from this page while the briefing is unavailable.',
      updating: 'Update in progress',
      nextUpdateUnknown: 'To be confirmed by the skipper',
      departureLabel: 'Departure in',
      travelLabel: 'Trip',
      daySingular: 'day',
      dayPlural: 'days',
      hourSingular: 'hour',
      hourPlural: 'hours',
      sailingNow: 'We are sailing',
      tripFinished: 'Trip completed',
      openSource: 'Open source',
      updated: 'Weather data checked on',
      noOperationalBulletin: 'No operational weather bulletin has been published yet.',
      published: 'Published',
      operationalWeatherLabel: 'Operational weather not yet published',
      operationalWeather: 'Operational weather',
      awaitingWindow: 'Waiting for the useful weather window.',
      awaitingWindowText: 'Wind, sea state, temperatures and currents will be published with source, issue time and validity.',
      navigation: 'How we sail today',
      sun: 'Sun',
      moon: 'Moon',
      wind: 'Wind',
      sea: 'Sea state / waves',
      visibility: 'Visibility',
      phenomena: 'Weather and precipitation',
      sky: 'Sky',
      air: 'Air',
      water: 'Water',
      currents: 'Currents',
      skipperDecision: 'Skipper’s decision',
      stopsLabel: 'Light and stop scenarios',
      stopsHeading: 'Scenarios to assess with the skipper',
      checks: 'Checks before stopping',
      overnightUndefined: 'To be decided',
      overnightStatus: 'To be checked',
      indicativeOvernight: 'Indicative overnight plan:',
      alternative: 'Alternative:',
      climateOutlookEyebrow: 'Air, water and daylight',
      weatherDetailsToggle: 'Weather details and sources',
      decisionBoardEyebrow: 'Operational briefing',
      decisionBoardTitle: 'The decisions that matter now',
      decisiveFactorsTitle: 'Three decisive factors',
      missingChecksTitle: 'Checks still required',
      routeMapTitle: 'Orientation diagram of the route through the Egadi Islands',
      routeMapDescription: 'Green: Thursday group via Levanzo. Blue: Friday group from Marsala towards Marettimo, south and west of Favignana. Shared later programme only if conditions allow.',
      routeMapCaption: 'Not for navigation. Green: Thursday via Levanzo; blue: Friday’s direct Marettimo scenario. No entrance detail, scaled distances or guaranteed shelters. Check routes, depths and access on current charts.',
      orientationNotesTitle: 'Exposed points and alternatives',
      summaryEyebrow: 'Day-by-day summary',
      summaryTitle: 'Departure, passage and arrival at a glance',
      summaryLegend: '🟢 relatively favourable · 🟡 concern or uncertainty · 🔴 adverse conditions · ⚪ insufficient data. The colour does not replace the skipper’s decision. On a phone, swipe the table to the right.',
      summaryHeaders: ['Day', 'Route', 'Departure', 'Passage', 'Arrival', 'Favourable window', 'Main concern', 'Uncertainty'],
      departureAssessment: 'Harbour departure',
      passageAssessment: 'Passage',
      arrivalAssessment: 'Arrival or stop',
      insufficientData: 'Insufficient data for an assessment',
      routeDetails: 'Indicative passage details',
      distance: 'Distance',
      course: 'Direction',
      duration: 'Indicative duration',
      favourableWindow: 'Favourable window',
      criticality: 'Most critical phase',
      uncertainty: 'Uncertainty',
      operationalChecksTitle: 'Recheck before departure',
      modelComparisonEyebrow: 'Sources and comparison',
      modelComparisonTitle: 'Where the models agree and where they differ',
      modelComparisonIntro: 'Scenarios remain separate: we do not average away the more demanding outcome.',
      modelHeaders: ['Parameter', 'Scenarios reviewed', 'Divergence', 'Decision affected'],
      nextUpdateEyebrow: 'Next update',
      nextUpdateTitle: 'When to review the briefing',
      scheduledUpdate: 'Next check:',
      departureSchedule: 'Departures · Thursday and Friday',
      callDecisionsTitle: 'Decisions for the skippers’ call',
      harbourExposure: 'Exposure and limitations',
      harbourForecast: 'Arrival and night · offshore data',
      harbourChecks: 'Local confirmation required',
      harbourDetails: 'Read exposure, checks and fallback',
    },
  };
  const copy = COPY[locale];
  const $ = (selector) => document.querySelector(selector);
  const departureAt = new Date('2026-10-08T15:00:00+02:00').getTime();
  const returnAt = new Date('2026-10-11T18:00:00+02:00').getTime();
  const escapeHtml = (value) => String(value === null || value === undefined || value === '' ? '—' : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const RATING_TONES = {
    good: { className: 'good', symbol: '🟢' },
    favorable: { className: 'good', symbol: '🟢' },
    favourable: { className: 'good', symbol: '🟢' },
    caution: { className: 'caution', symbol: '🟡' },
    warning: { className: 'caution', symbol: '🟡' },
    danger: { className: 'danger', symbol: '🔴' },
    adverse: { className: 'danger', symbol: '🔴' },
    unknown: { className: 'unknown', symbol: '⚪' },
    insufficient: { className: 'unknown', symbol: '⚪' },
    muted: { className: 'unknown', symbol: '⚪' },
  };
  const normaliseRating = (rating) => {
    const value = typeof rating === 'string' ? { text: rating } : (rating || {});
    const tone = RATING_TONES[String(value.tone || 'unknown').toLowerCase()] || RATING_TONES.unknown;
    return {
      className: tone.className,
      symbol: value.label || tone.symbol,
      text: value.text || copy.insufficientData,
    };
  };
  const renderRating = (rating, compact = false) => {
    const normalised = normaliseRating(rating);
    return `
      <span class="passage-rating passage-rating-${normalised.className}${compact ? ' is-compact' : ''}">
        <span class="passage-rating-symbol" aria-hidden="true">${escapeHtml(normalised.symbol)}</span>
        <span>${escapeHtml(normalised.text)}</span>
      </span>
    `;
  };
  const ratingFor = (day, phase) => {
    if (phase === 'departure') return day?.ratings?.departure || day?.ratings?.exit;
    if (phase === 'passage') return day?.ratings?.passage || day?.ratings?.navigation;
    return day?.ratings?.arrival;
  };
  const listValues = (values) => Array.isArray(values) ? values.filter(Boolean) : [];
  const displayValue = (value) => Array.isArray(value) ? value.filter(Boolean).join(' · ') : value;

  // Icone minime per il clima tipico del periodo: stesso stile a tratto
  // usato altrove nel sito, un colpo d'occhio invece di solo testo.
  const CLIMATE_ICONS = {
    air: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 4.5a1.8 1.8 0 1 1 1.8 1.8H5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="8.4" y="7.5" width="2.6" height="8" rx="1.3" stroke="currentColor" stroke-width="1.4"/></svg>',
    water: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3c2.4 3 4.3 5.7 4.3 8.2A4.3 4.3 0 0 1 10 15.5a4.3 4.3 0 0 1-4.3-4.3C5.7 8.7 7.6 6 10 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    wind: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.5 7h9a2 2 0 1 0-1.9-2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M2.5 13h11a2 2 0 1 1-1.9 2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M2.5 10h14.5a1.8 1.8 0 1 0-1.7-2.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    rain: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5.5 9.5a3 3 0 0 1 .4-5.9 4 4 0 0 1 7.6.9 3 3 0 0 1-.5 6H6Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6.5 13v2.4M10 13v2.4M13.5 13v2.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    sun: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="3.3" stroke="currentColor" stroke-width="1.4"/><path d="M10 2.6v2M10 15.4v2M17.4 10h-2M4.6 10h-2M15.2 4.8l-1.4 1.4M6.2 13.8l-1.4 1.4M15.2 15.2l-1.4-1.4M6.2 6.2 4.8 4.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    wave: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M1.5 8.5c1.3-1.6 2.6-1.6 3.9 0s2.6 1.6 3.9 0 2.6-1.6 3.9 0 2.6 1.6 3.9 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M1.5 13c1.3-1.6 2.6-1.6 3.9 0s2.6 1.6 3.9 0 2.6-1.6 3.9 0 2.6 1.6 3.9 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  };

  // Pillole "a semaforo" invece di numeri nudi: stessa logica della scala
  // Beaufort/Douglas a colori pieni trovata nella ricerca del 1° ottobre
  // (community Windy) — verde/ambra leggibili a colpo d'occhio, grigio
  // quando il dato non è ancora affidabile (mai un colore "tranquillo" per
  // qualcosa che in realtà non sappiamo ancora).
  const renderDayPills = (glance) => {
    if (!glance) return '';
    const items = [
      glance.wind ? { icon: 'wind', tone: glance.windTone || 'muted', value: glance.wind } : null,
      glance.sea ? { icon: 'wave', tone: glance.seaTone || 'muted', value: glance.sea } : null,
      glance.sky ? { icon: glance.skyIcon || 'sun', tone: glance.skyTone || 'muted', value: glance.sky } : null,
    ].filter(Boolean);
    if (!items.length) return '';
    return `
      <div class="passage-day-pills">
        ${items.map((item) => `
          <span class="passage-day-pill tone-${escapeHtml(item.tone)}">
            <span aria-hidden="true">${CLIMATE_ICONS[item.icon] || ''}</span>${escapeHtml(item.value)}
          </span>
        `).join("")}
      </div>
    `;
  };

  // Sono immagini di scenario, non indicazioni nautiche né conferme di sosta.
  // Le fonti e le licenze sono riportate accanto a ogni fotografia.
  const DAY_VISUALS = [
    {
      label: copy.visualLabels[0][0],
      imageUrl: 'media/levanzo-sea.jpg',
      alt: copy.visualLabels[0][1],
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Levanzo_Italy_12.jpg',
      author: 'Norbert Nagel',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.it',
      className: 'is-levanzo-port',
    },
    {
      label: copy.visualLabels[1][0],
      imageUrl: 'media/levanzo-sea.jpg',
      alt: copy.visualLabels[1][1],
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Levanzo_Italy_12.jpg',
      author: 'Norbert Nagel',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.it',
      className: 'is-levanzo-light',
    },
    {
      label: copy.visualLabels[2][0],
      imageUrl: 'media/marettimo-sea.jpg',
      alt: copy.visualLabels[2][1],
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Marettimo_coast.jpg',
      author: 'The Cosmonaut',
      license: 'CC BY-SA 2.5 CA',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5/ca/deed.it',
      className: 'is-marettimo-coast',
    },
    {
      label: copy.visualLabels[3][0],
      imageUrl: 'media/favignana-crystal-water.jpg',
      alt: copy.visualLabels[3][1],
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Crystal_clear_water_at_Favignana_-_panoramio.jpg',
      author: 'René Bongard',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.it',
      className: 'is-favignana-water',
    },
  ];

  // La foto reale della tappa, con il trattamento scuro già pronto in
  // passage-visual.css (ritaglio per foto, sfumatura, hover) — qui aggiungo
  // solo le pillole meteo nella didascalia, sopra l'etichetta di scenario
  // già esistente (richiesta di Silvio, 1° ottobre: pubblicare subito con i
  // dati di oggi, aggiornare di nuovo lunedì).
  const renderDayVisual = (visual, day) => {
    if (!visual) return '';
    return `
      <figure class="passage-day-visual ${escapeHtml(visual.className)}">
        <img src="${visual.imageUrl}" alt="${escapeHtml(visual.alt)}" loading="lazy" decoding="async" />
        <figcaption>
          ${renderDayPills(day.glance)}
          <span>${escapeHtml(visual.label)} · ${escapeHtml(copy.scenarioImage)}</span>
          <small>${escapeHtml(copy.photo)}: <a href="${visual.sourceUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(visual.author)}</a> · <a href="${visual.licenseUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(visual.license)}</a></small>
        </figcaption>
      </figure>
    `;
  };

  const updateDeparturePhase = () => {
    const now = Date.now();
    const phaseLabel = $("[data-passage-phase-label]");
    if (now >= returnAt) {
      phaseLabel.textContent = copy.travelLabel;
      $("#planPhase").textContent = copy.tripFinished;
      return;
    }
    if (now >= departureAt) {
      phaseLabel.textContent = copy.travelLabel;
      $("#planPhase").textContent = copy.sailingNow;
      return;
    }
    const remaining = departureAt - now;
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    phaseLabel.textContent = copy.departureLabel;
    $("#planPhase").textContent = `${days} ${days === 1 ? copy.daySingular : copy.dayPlural} · ${hours} ${hours === 1 ? copy.hourSingular : copy.hourPlural}`;
  };

  updateDeparturePhase();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateDeparturePhase();
  });
  window.setInterval(updateDeparturePhase, 60000);

  $("#routeMapTitle").textContent = copy.routeMapTitle;
  $("#routeMapDescription").textContent = copy.routeMapDescription;
  $("#routeMapCaption").textContent = copy.routeMapCaption;

  if (!data) {
    $("#planStatus").textContent = copy.updateUnavailable;
    $("#planSummary").textContent = copy.unavailableSummary;
    $("#planSources").textContent = copy.unavailableSources;
    return;
  }

  $("#planStatus").textContent = data.status || copy.updating;
  $("#planConfidence").textContent = data.confidence || "—";
  $("#planNextUpdate").textContent = data.nextUpdateAt || copy.nextUpdateUnknown;
  $("#planSummary").textContent = data.summary || "—";
  $("#planSources").textContent = data.sourceNote || "—";

  const decisiveFactors = listValues(data.decisiveFactors);
  const missingChecks = listValues(data.missingChecks);
  const decisionBoard = $("#planDecisionBoard");
  if (decisiveFactors.length || missingChecks.length) {
    $("#planDecisionBoardEyebrow").textContent = copy.decisionBoardEyebrow;
    $("#planDecisionBoardTitle").textContent = copy.decisionBoardTitle;
    $("#planDecisiveFactorsTitle").textContent = copy.decisiveFactorsTitle;
    $("#planMissingChecksTitle").textContent = copy.missingChecksTitle;
    $("#planDecisiveFactors").innerHTML = (decisiveFactors.length ? decisiveFactors : [copy.insufficientData])
      .map((item) => `<li>${escapeHtml(displayValue(item))}</li>`).join('');
    $("#planMissingChecks").innerHTML = (missingChecks.length ? missingChecks : [copy.insufficientData])
      .map((item) => `<li>${escapeHtml(displayValue(item))}</li>`).join('');
    decisionBoard.hidden = false;
  }

  const orientationNotes = listValues(data.orientationNotes);
  const departureBriefing = data.callBriefing;
  if (departureBriefing?.options?.length) {
    $('#planDepartureTitle').textContent = departureBriefing.title;
    $('#planDepartureIntroduction').textContent = departureBriefing.introduction;
    $('#planDepartureOptions').innerHTML = departureBriefing.options.map((option) => `
      <article class="passage-departure-option">
        <h3>${escapeHtml(option.title)}</h3>
        <p class="passage-option-route">${escapeHtml(option.route)}</p>
        <dl class="passage-option-facts">
          <div><dt>${escapeHtml(copy.course)}</dt><dd>${escapeHtml(option.course)}</dd></div>
          <div><dt>${escapeHtml(copy.duration)}</dt><dd>${escapeHtml(option.duration)}</dd></div>
        </dl>
        <div class="passage-option-ratings">
          ${['departure', 'passage', 'arrival'].map((phase) => `<div><h4>${escapeHtml(copy[`${phase}Assessment`])}</h4>${renderRating(ratingFor(option, phase))}</div>`).join('')}
        </div>
        <p><strong>${escapeHtml(copy.favourableWindow)}</strong><br>${escapeHtml(option.window)}</p>
        <p class="passage-option-decision">${escapeHtml(option.decision)}</p>
        <details class="passage-option-details"><summary>${escapeHtml(copy.weatherDetailsToggle)}</summary>
          <p><strong>${escapeHtml(copy.wind)}</strong><br>${escapeHtml(option.wind)}</p>
          <p><strong>${escapeHtml(copy.sea)}</strong><br>${escapeHtml(option.sea)}</p>
          <p><strong>${escapeHtml(copy.alternative)}</strong><br>${escapeHtml(option.alternative)}</p>
        </details>
      </article>`).join('');
    $('#planCallDecisionsTitle').textContent = copy.callDecisionsTitle;
    $('#planCallDecisions').innerHTML = departureBriefing.decisions.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    $('#planDepartureBriefing').hidden = false;
    const departureStop = $('.passage-route-line li:first-child small');
    departureStop.removeAttribute('data-i18n');
    departureStop.textContent = copy.departureSchedule;
  }
  const harbourChecks = data.harbourChecks;
  if (harbourChecks?.items?.length) {
    $('#planHarbourTitle').textContent = harbourChecks.title;
    $('#planHarbourIntroduction').textContent = harbourChecks.introduction;
    $('#planHarbourItems').innerHTML = harbourChecks.items.map((item) => `
      <article class="passage-harbour-item">
        <h3>${escapeHtml(item.title)}</h3>
        ${renderRating(item.rating)}
        <p><strong>${escapeHtml(copy.harbourForecast)}</strong><br>${escapeHtml(item.forecast)}</p>
        <details class="passage-option-details"><summary>${escapeHtml(copy.harbourDetails)}</summary>
          <p><strong>${escapeHtml(copy.harbourExposure)}</strong><br>${escapeHtml(item.exposure)}</p>
          <p><strong>${escapeHtml(copy.harbourChecks)}</strong><br>${escapeHtml(item.check)}</p>
          <p><strong>${escapeHtml(copy.alternative)}</strong><br>${escapeHtml(item.alternative)}</p>
          <a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.sourceLabel)}</a>
        </details>
      </article>`).join('');
    $('#planHarbourChecks').hidden = false;
  }
  const orientationNotesElement = $("#planOrientationNotes");
  if (orientationNotes.length) {
    $("#planOrientationNotesTitle").textContent = copy.orientationNotesTitle;
    $("#planOrientationNotesList").innerHTML = orientationNotes.map((note) => {
      if (typeof note === 'string') return `<li>${escapeHtml(note)}</li>`;
      return `<li>${note?.title ? `<strong>${escapeHtml(note.title)}</strong>` : ''}${escapeHtml(note?.text)}</li>`;
    }).join('');
    orientationNotesElement.hidden = false;
  }

  const sources = Array.isArray(data.sources)
    ? data.sources
    : data.sourceUrl ? [{ url: data.sourceUrl, label: data.sourceLabel }] : [];
  const sourcesListElement = $("#planSourcesList");
  sourcesListElement.replaceChildren(...sources.filter((source) => source?.url).map((source) => {
    const item = document.createElement('li');
    const icon = document.createElement('span');
    icon.className = 'passage-source-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 20 20" fill="none"><path d="M8 12 16 4M16 4h-5M16 4v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const sourceLink = document.createElement('a');
    sourceLink.href = source.url;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.textContent = source.label || copy.openSource;
    const sourceDetails = document.createElement('small');
    sourceDetails.textContent = [source.product, source.model, source.availability, source.scope, source.checkedAt].filter(Boolean).join(' · ');
    item.append(icon, sourceLink, sourceDetails);
    return item;
  }));
  $("#planStopsNote").textContent = data.stopsNote || "";

  const climateOutlook = data.climateOutlook;
  const climateOutlookElement = $("#planClimateOutlook");
  if (climateOutlook?.title && Array.isArray(climateOutlook.items) && climateOutlook.items.length) {
    $("#planClimateOutlookEyebrow").textContent = copy.climateOutlookEyebrow;
    $("#planClimateOutlookTitle").textContent = climateOutlook.title;
    $("#planClimateOutlookDisclaimer").textContent = climateOutlook.disclaimer || "";
    $("#planClimateOutlookGrid").innerHTML = climateOutlook.items.map((item) => `
      <div class="passage-climate-item">
        <span class="passage-climate-icon" aria-hidden="true">${CLIMATE_ICONS[item.icon] || ""}</span>
        <dt>${escapeHtml(item.label)}<b>${escapeHtml(item.value)}</b></dt>
        <dd>${escapeHtml(item.detail)}</dd>
      </div>
    `).join("");
    climateOutlookElement.hidden = false;
  }
  $("#planUpdatedAt").textContent = data.updatedAt
    ? `${copy.updated} ${data.updatedAt}`
    : copy.noOperationalBulletin;
  const validity = [data.validFrom, data.validUntil].filter(Boolean).join(' · ');
  $("#planValidity").textContent = [data.publishedAt ? `${copy.published} ${data.publishedAt}` : '', validity].filter(Boolean).join(' · ');

  const mooringGuide = data.mooringGuide;
  const mooringGuideElement = $("#planMooringGuide");
  if (mooringGuide?.title && Array.isArray(mooringGuide.checks) && mooringGuide.checks.length) {
    $("#planMooringTitle").textContent = mooringGuide.title;
    $("#planMooringIntroduction").textContent = mooringGuide.introduction || '';
    $("#planMooringChecks").innerHTML = mooringGuide.checks.map((check) => `
      <li>
        <strong>${escapeHtml(check.title)}</strong>
        <span>${escapeHtml(check.text)}</span>
      </li>
    `).join("");
    mooringGuideElement.hidden = false;
  }

  const days = Array.isArray(data.days) ? data.days : [];
  const summarySection = $("#planSummarySection");
  if (days.length) {
    $("#planSummaryEyebrow").textContent = copy.summaryEyebrow;
    $("#planSummaryTitle").textContent = copy.summaryTitle;
    $("#planSummaryLegend").textContent = copy.summaryLegend;
    $("#planSummaryHead").innerHTML = `<tr>${copy.summaryHeaders.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr>`;
    // Il venerdì ha due origini: non nascondere il gruppo ancora a Marsala
    // dietro alla sola riga Levanzo–Marettimo del programma giornaliero.
    const fridayDeparture = data.callBriefing?.options?.[1];
    const summaryDays = days.flatMap((day, index) => index === 1 && fridayDeparture ? [
      { ...day, ...fridayDeparture, criticality: fridayDeparture.ratings.passage.text, uncertainty: data.confidence },
      day,
    ] : [day]);
    $("#planSummaryBody").innerHTML = summaryDays.map((day) => `
      <tr>
        <th scope="row">${escapeHtml(day.date)}</th>
        <td>${escapeHtml(day.route)}</td>
        <td>${renderRating(ratingFor(day, 'departure'), true)}</td>
        <td>${renderRating(ratingFor(day, 'passage'), true)}</td>
        <td>${renderRating(ratingFor(day, 'arrival'), true)}</td>
        <td>${escapeHtml(day.window)}</td>
        <td>${escapeHtml(day.criticality)}</td>
        <td>${escapeHtml(day.uncertainty)}</td>
      </tr>
    `).join('');
    summarySection.hidden = false;
  }

  const planningMode = data.dataMode === 'planning';
  const weatherNoticeTitle = data.weatherNoticeTitle || copy.awaitingWindow;
  const weatherNoticeText = data.weatherNoticeText || copy.awaitingWindowText;
  const operationalData = (day) => planningMode ? `
    <section class="passage-weather-pending" aria-label="${escapeHtml(copy.operationalWeatherLabel)}">
      <span>${escapeHtml(copy.operationalWeather)}</span>
      <strong>${escapeHtml(weatherNoticeTitle)}</strong>
      <p>${escapeHtml(weatherNoticeText)}</p>
    </section>
    <dl class="passage-data-grid passage-astronomy-grid">
      <div><dt>${escapeHtml(copy.sun)}</dt><dd>${escapeHtml(day.sun)}</dd></div>
      <div><dt>${escapeHtml(copy.moon)}</dt><dd>${escapeHtml(day.moon)}</dd></div>
    </dl>
  ` : `
    ${day.decision ? `<p class="passage-decision"><strong>${escapeHtml(copy.skipperDecision)}</strong> ${escapeHtml(day.decision)}</p>` : ''}
    <details class="passage-weather-details">
      <summary>${escapeHtml(copy.weatherDetailsToggle)}</summary>
      <dl class="passage-data-grid">
        <div><dt>${escapeHtml(copy.wind)}</dt><dd>${escapeHtml(day.wind)}</dd></div>
        <div><dt>${escapeHtml(copy.sea)}</dt><dd>${escapeHtml(day.sea)}</dd></div>
        <div><dt>${escapeHtml(copy.visibility)}</dt><dd>${escapeHtml(day.visibility)}</dd></div>
        <div><dt>${escapeHtml(copy.phenomena)}</dt><dd>${escapeHtml(day.phenomena)}</dd></div>
        <div><dt>${escapeHtml(copy.air)}</dt><dd>${escapeHtml(day.air)}</dd></div>
        <div><dt>${escapeHtml(copy.water)}</dt><dd>${escapeHtml(day.water)}</dd></div>
        <div><dt>${escapeHtml(copy.currents)}</dt><dd>${escapeHtml(day.currents)}</dd></div>
        <div><dt>${escapeHtml(copy.sun)}</dt><dd>${escapeHtml(day.sun)}</dd></div>
        <div><dt>${escapeHtml(copy.moon)}</dt><dd>${escapeHtml(day.moon)}</dd></div>
      </dl>
    </details>
  `;

  const renderRouteDetails = (day) => {
    const details = [
      [copy.distance, day.distance],
      [copy.course, day.course],
      [copy.duration, day.duration],
      [copy.favourableWindow, day.window],
      [copy.criticality, day.criticality],
      [copy.uncertainty, day.uncertainty],
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');
    if (!details.length) return '';
    return `
      <section class="passage-route-details" aria-label="${escapeHtml(copy.routeDetails)}">
        ${details.map(([label, value]) => `
          <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(displayValue(value))}</strong></div>
        `).join('')}
      </section>
    `;
  };

  const renderPhaseAssessments = (day) => `
    <section class="passage-phase-assessments" aria-label="${escapeHtml(copy.summaryTitle)}">
      <article>
        <h3>${escapeHtml(copy.departureAssessment)}</h3>
        ${renderRating(ratingFor(day, 'departure'))}
      </article>
      <article>
        <h3>${escapeHtml(copy.passageAssessment)}</h3>
        ${renderRating(ratingFor(day, 'passage'))}
      </article>
      <article>
        <h3>${escapeHtml(copy.arrivalAssessment)}</h3>
        ${renderRating(ratingFor(day, 'arrival'))}
      </article>
    </section>
  `;

  const renderOperationalChecks = (day) => {
    const checks = listValues(day.operationalChecks);
    if (!checks.length) return '';
    return `
      <section class="passage-operational-checks">
        <h3>${escapeHtml(copy.operationalChecksTitle)}</h3>
        <ul>${checks.map((check) => `<li>${escapeHtml(displayValue(check))}</li>`).join('')}</ul>
      </section>
    `;
  };

  $("#dailyPlan").innerHTML = days.map((day, index) => {
    const stops = Array.isArray(day.stops) && day.stops.length ? `
      <section class="passage-stop-section" aria-label="${escapeHtml(copy.stopsLabel)}">
        <p class="passage-stop-heading">${escapeHtml(copy.stopsHeading)}</p>
        <div class="passage-stop-grid">
          ${day.stops.map((stop) => `
            <article class="passage-stop-card">
              <p class="passage-stop-moment">${escapeHtml(stop.moment)}</p>
              <h3>${escapeHtml(stop.title)}</h3>
              <p>${escapeHtml(stop.description)}</p>
              <details class="passage-stop-check">
                <summary>${escapeHtml(copy.checks)}</summary>
                <p>${escapeHtml(stop.check)}</p>
              </details>
            </article>
          `).join("")}
        </div>
      </section>
    ` : '';

    return `
      <article class="passage-day-card">
        <div class="passage-day-layout">
          <div class="passage-day-story">
            <div class="passage-day-heading">
              <p class="eyebrow">${escapeHtml(day.date)}</p>
              <h2>${escapeHtml(day.route)}</h2>
            </div>
            ${renderRouteDetails(day)}
            <p class="passage-day-plan">${escapeHtml(day.plan)}</p>
            ${day.navigation ? `<p class="passage-navigation"><strong>${escapeHtml(copy.navigation)}</strong>${escapeHtml(day.navigation)}</p>` : ''}
            <p class="passage-overnight"><span class="passage-overnight-meta">${escapeHtml(day.overnightType || copy.overnightUndefined)} · ${escapeHtml(day.overnightStatus || copy.overnightStatus)}</span><strong>${escapeHtml(copy.indicativeOvernight)}</strong> ${escapeHtml(day.overnight)}</p>
            <p class="passage-alternative"><strong>${escapeHtml(copy.alternative)}</strong> ${escapeHtml(day.alternative)}</p>
          </div>
          ${renderDayVisual(DAY_VISUALS[index], day)}
        </div>
        ${renderPhaseAssessments(day)}
        ${stops}
        ${renderOperationalChecks(day)}
        ${operationalData(day)}
      </article>
    `;
  }).join("");

  const modelComparison = listValues(data.modelComparison);
  const modelComparisonSection = $("#planModelComparison");
  if (modelComparison.length) {
    $("#planModelComparisonEyebrow").textContent = copy.modelComparisonEyebrow;
    $("#planModelComparisonTitle").textContent = copy.modelComparisonTitle;
    $("#planModelComparisonIntro").textContent = copy.modelComparisonIntro;
    $("#planModelComparisonHead").innerHTML = `<tr>${copy.modelHeaders.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr>`;
    $("#planModelComparisonBody").innerHTML = modelComparison.map((comparison) => `
      <tr>
        <th scope="row">${escapeHtml(comparison?.parameter)}</th>
        <td>${escapeHtml(displayValue(comparison?.scenarios))}</td>
        <td>${escapeHtml(comparison?.divergence)}</td>
        <td>${escapeHtml(comparison?.decisionImpact)}</td>
      </tr>
    `).join('');
    modelComparisonSection.hidden = false;
  }

  const nextUpdateSection = $("#planNextUpdateSection");
  if (data.nextUpdateAt || data.nextUpdateReason) {
    $("#planNextUpdateEyebrow").textContent = copy.nextUpdateEyebrow;
    $("#planNextUpdateTitle").textContent = copy.nextUpdateTitle;
    $("#planNextUpdateText").textContent = data.nextUpdateAt
      ? `${copy.scheduledUpdate} ${data.nextUpdateAt}`
      : copy.nextUpdateUnknown;
    $("#planNextUpdateReason").textContent = data.nextUpdateReason || '';
    $("#planNextUpdateReason").hidden = !data.nextUpdateReason;
    nextUpdateSection.hidden = false;
  }

})();

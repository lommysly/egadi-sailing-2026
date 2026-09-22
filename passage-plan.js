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
      updated: 'Aggiornato il',
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
      climateOutlookEyebrow: 'Clima tipico del periodo',
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
      updated: 'Updated',
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
      climateOutlookEyebrow: 'Typical climate for the period',
    },
  };
  const copy = COPY[locale];
  const $ = (selector) => document.querySelector(selector);
  const departureAt = new Date('2026-10-08T15:00:00+02:00').getTime();
  const returnAt = new Date('2026-10-11T18:00:00+02:00').getTime();
  const escapeHtml = (value) => String(value || "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // Icone minime per il clima tipico del periodo: stesso stile a tratto
  // usato altrove nel sito, un colpo d'occhio invece di solo testo.
  const CLIMATE_ICONS = {
    air: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 4.5a1.8 1.8 0 1 1 1.8 1.8H5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="8.4" y="7.5" width="2.6" height="8" rx="1.3" stroke="currentColor" stroke-width="1.4"/></svg>',
    water: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3c2.4 3 4.3 5.7 4.3 8.2A4.3 4.3 0 0 1 10 15.5a4.3 4.3 0 0 1-4.3-4.3C5.7 8.7 7.6 6 10 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    wind: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.5 7h9a2 2 0 1 0-1.9-2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M2.5 13h11a2 2 0 1 1-1.9 2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M2.5 10h14.5a1.8 1.8 0 1 0-1.7-2.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    rain: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5.5 9.5a3 3 0 0 1 .4-5.9 4 4 0 0 1 7.6.9 3 3 0 0 1-.5 6H6Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6.5 13v2.4M10 13v2.4M13.5 13v2.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    sun: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="3.3" stroke="currentColor" stroke-width="1.4"/><path d="M10 2.6v2M10 15.4v2M17.4 10h-2M4.6 10h-2M15.2 4.8l-1.4 1.4M6.2 13.8l-1.4 1.4M15.2 15.2l-1.4-1.4M6.2 6.2 4.8 4.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
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

  const renderDayVisual = (visual) => {
    if (!visual) return '';
    return `
      <figure class="passage-day-visual ${escapeHtml(visual.className)}">
        <img src="${visual.imageUrl}" alt="${escapeHtml(visual.alt)}" loading="lazy" decoding="async" />
        <figcaption>
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
  const sourceElement = $("#planSources");
  sourceElement.replaceChildren(document.createTextNode(data.sourceNote || "—"));
  const sources = Array.isArray(data.sources)
    ? data.sources
    : data.sourceUrl ? [{ url: data.sourceUrl, label: data.sourceLabel }] : [];
  sources.forEach((source, index) => {
    if (!source?.url) return;
    const sourceLink = document.createElement('a');
    sourceLink.href = source.url;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.textContent = source.label || copy.openSource;
    sourceElement.append(index === 0 ? ' ' : ' · ', sourceLink);
    const sourceDetails = [source.scope, source.checkedAt].filter(Boolean).join(' · ');
    if (sourceDetails) sourceElement.append(` (${sourceDetails})`);
  });
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
    <dl class="passage-data-grid">
      <div><dt>${escapeHtml(copy.wind)}</dt><dd>${escapeHtml(day.wind)}</dd></div>
      <div><dt>${escapeHtml(copy.sea)}</dt><dd>${escapeHtml(day.sea)}</dd></div>
      <div><dt>${escapeHtml(copy.air)}</dt><dd>${escapeHtml(day.air)}</dd></div>
      <div><dt>${escapeHtml(copy.water)}</dt><dd>${escapeHtml(day.water)}</dd></div>
      <div><dt>${escapeHtml(copy.currents)}</dt><dd>${escapeHtml(day.currents)}</dd></div>
      <div><dt>${escapeHtml(copy.skipperDecision)}</dt><dd>${escapeHtml(day.decision)}</dd></div>
      <div><dt>${escapeHtml(copy.sun)}</dt><dd>${escapeHtml(day.sun)}</dd></div>
      <div><dt>${escapeHtml(copy.moon)}</dt><dd>${escapeHtml(day.moon)}</dd></div>
    </dl>
  `;

  $("#dailyPlan").innerHTML = (data.days || []).map((day, index) => {
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
            <p class="passage-day-plan">${escapeHtml(day.plan)}</p>
            ${day.navigation ? `<p class="passage-navigation"><strong>${escapeHtml(copy.navigation)}</strong>${escapeHtml(day.navigation)}</p>` : ''}
            <p class="passage-overnight"><span class="passage-overnight-meta">${escapeHtml(day.overnightType || copy.overnightUndefined)} · ${escapeHtml(day.overnightStatus || copy.overnightStatus)}</span><strong>${escapeHtml(copy.indicativeOvernight)}</strong> ${escapeHtml(day.overnight)}</p>
            <p class="passage-alternative"><strong>${escapeHtml(copy.alternative)}</strong> ${escapeHtml(day.alternative)}</p>
          </div>
          ${renderDayVisual(DAY_VISUALS[index])}
        </div>
        ${stops}
        ${operationalData(day)}
      </article>
    `;
  }).join("");

})();

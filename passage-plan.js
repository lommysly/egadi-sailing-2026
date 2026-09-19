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
    },
  };
  const copy = COPY[locale];
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value || "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

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

  if (!data) {
    $("#planStatus").textContent = copy.updateUnavailable;
    $("#planSummary").textContent = copy.unavailableSummary;
    $("#planSources").textContent = copy.unavailableSources;
    return;
  }

  $("#planStatus").textContent = data.status || copy.updating;
  $("#planPhase").textContent = data.phase || "—";
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

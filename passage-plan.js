(() => {
  const data = window.PASSAGE_PLAN_DATA;
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value || "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  if (!data) {
    $("#planStatus").textContent = "Aggiornamento non disponibile";
    $("#planSummary").textContent = "Il Passage Plan non è stato caricato. Riprova più tardi oppure chiedi allo skipper il briefing più recente.";
    $("#planSources").textContent = "Nessun dato meteo o di navigazione deve essere dedotto da questa pagina finché il briefing non è disponibile.";
    return;
  }

  $("#planStatus").textContent = data.status || "Aggiornamento in corso";
  $("#planPhase").textContent = data.phase || "—";
  $("#planConfidence").textContent = data.confidence || "—";
  $("#planNextUpdate").textContent = data.nextUpdateAt || "Da comunicare dallo skipper";
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
    sourceLink.textContent = source.label || 'Apri la fonte';
    sourceElement.append(index === 0 ? ' ' : ' · ', sourceLink);
    const sourceDetails = [source.scope, source.checkedAt].filter(Boolean).join(' · ');
    if (sourceDetails) sourceElement.append(` (${sourceDetails})`);
  });
  $("#planStopsNote").textContent = data.stopsNote || "";
  $("#planUpdatedAt").textContent = data.updatedAt
    ? `Aggiornato il ${data.updatedAt}`
    : "Nessun bollettino meteo operativo ancora pubblicato.";
  const validity = [data.validFrom, data.validUntil].filter(Boolean).join(' · ');
  $("#planValidity").textContent = [data.publishedAt ? `Pubblicato ${data.publishedAt}` : '', validity].filter(Boolean).join(' · ');

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
  const operationalData = (day) => planningMode ? `
    <section class="passage-weather-pending" aria-label="Meteo operativo non ancora pubblicato">
      <strong>Meteo operativo non ancora pubblicato.</strong>
      <p>Vento, mare, aria, acqua e correnti verranno aggiunti nella finestra utile con fonti, ora di emissione e validità. Fino ad allora questa scheda resta un quadro di pianificazione.</p>
    </section>
    <dl class="passage-data-grid passage-astronomy-grid">
      <div><dt>Sole</dt><dd>${escapeHtml(day.sun)}</dd></div>
      <div><dt>Luna</dt><dd>${escapeHtml(day.moon)}</dd></div>
    </dl>
  ` : `
    <dl class="passage-data-grid">
      <div><dt>Vento</dt><dd>${escapeHtml(day.wind)}</dd></div>
      <div><dt>Mare / onda</dt><dd>${escapeHtml(day.sea)}</dd></div>
      <div><dt>Aria</dt><dd>${escapeHtml(day.air)}</dd></div>
      <div><dt>Acqua</dt><dd>${escapeHtml(day.water)}</dd></div>
      <div><dt>Correnti</dt><dd>${escapeHtml(day.currents)}</dd></div>
      <div><dt>Decisione skipper</dt><dd>${escapeHtml(day.decision)}</dd></div>
      <div><dt>Sole</dt><dd>${escapeHtml(day.sun)}</dd></div>
      <div><dt>Luna</dt><dd>${escapeHtml(day.moon)}</dd></div>
    </dl>
  `;

  $("#dailyPlan").innerHTML = (data.days || []).map((day) => `
    <article class="passage-day-card">
      <div class="passage-day-heading">
        <p class="eyebrow">${escapeHtml(day.date)}</p>
        <h2>${escapeHtml(day.route)}</h2>
      </div>
      <p>${escapeHtml(day.plan)}</p>
      <p class="passage-overnight"><span class="passage-overnight-meta">${escapeHtml(day.overnightType || 'Da definire')} · ${escapeHtml(day.overnightStatus || 'Da verificare')}</span><strong>Piano notte indicativo:</strong> ${escapeHtml(day.overnight)}</p>
      <p class="passage-alternative"><strong>Alternativa:</strong> ${escapeHtml(day.alternative)}</p>
      ${Array.isArray(day.stops) && day.stops.length ? `
        <section class="passage-stop-section" aria-label="Scenari di luce e soste">
          <p class="passage-stop-heading">Scenari di luce e soste</p>
          <div class="passage-stop-grid">
            ${day.stops.map((stop) => `
              <article class="passage-stop-card">
                <p class="passage-stop-moment">${escapeHtml(stop.moment)}</p>
                <h3>${escapeHtml(stop.title)}</h3>
                <p>${escapeHtml(stop.description)}</p>
                <p class="passage-stop-check">${escapeHtml(stop.check)}</p>
              </article>
            `).join("")}
          </div>
        </section>
      ` : ""}
      ${operationalData(day)}
    </article>
  `).join("");
})();

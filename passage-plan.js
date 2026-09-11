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
  });
  $("#planStopsNote").textContent = data.stopsNote || "";
  $("#planUpdatedAt").textContent = data.updatedAt
    ? `Aggiornato il ${data.updatedAt}`
    : "Nessun bollettino meteo operativo ancora pubblicato.";

  $("#dailyPlan").innerHTML = (data.days || []).map((day) => `
    <article class="passage-day-card">
      <div class="passage-day-heading">
        <p class="eyebrow">${escapeHtml(day.date)}</p>
        <h2>${escapeHtml(day.route)}</h2>
      </div>
      <p>${escapeHtml(day.plan)}</p>
      <p class="passage-overnight"><strong>Notte prevista:</strong> ${escapeHtml(day.overnight)}</p>
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
    </article>
  `).join("");
})();

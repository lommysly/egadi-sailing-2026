(() => {
  const data = window.PASSAGE_PLAN_DATA;
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value || "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  if (!data) return;

  $("#planStatus").textContent = data.status || "Aggiornamento in corso";
  $("#planPhase").textContent = data.phase || "—";
  $("#planConfidence").textContent = data.confidence || "—";
  $("#planSummary").textContent = data.summary || "—";
  $("#planSources").textContent = data.sourceNote || "—";
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
      <p class="passage-alternative"><strong>Alternativa:</strong> ${escapeHtml(day.alternative)}</p>
      <dl class="passage-data-grid">
        <div><dt>Vento</dt><dd>${escapeHtml(day.wind)}</dd></div>
        <div><dt>Mare / onda</dt><dd>${escapeHtml(day.sea)}</dd></div>
        <div><dt>Aria</dt><dd>${escapeHtml(day.air)}</dd></div>
        <div><dt>Acqua</dt><dd>${escapeHtml(day.water)}</dd></div>
        <div><dt>Correnti</dt><dd>${escapeHtml(day.currents)}</dd></div>
        <div><dt>Sole</dt><dd>${escapeHtml(day.sun)}</dd></div>
        <div><dt>Luna</dt><dd>${escapeHtml(day.moon)}</dd></div>
      </dl>
    </article>
  `).join("");
})();

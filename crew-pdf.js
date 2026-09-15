const requiredCharterFields = [
  'firstName',
  'lastName',
  'gender',
  'birthDate',
  'birthPlace',
  'nationality',
  'documentType',
  'documentNumber',
  'documentExpiry',
];
const eventEndDate = '2026-10-11';
const skipperProfileFields = [
  'firstName',
  'lastName',
  'gender',
  'birthDate',
  'birthPlace',
  'nationality',
  'documentType',
  'documentNumber',
  'documentExpiry',
  'email',
  'phone',
  'sailingLicenseNumber',
  'radioCertificateType',
  'radioCertificateNumber',
];
const skipperDocumentStatusFields = [
  'identityDocumentStatus',
  'sailingLicenseStatus',
  'radioCertificateStatus',
];
const skipperDocumentStatusLabels = {
  to_prepare: 'Da preparare',
  ready: 'Pronto da inviare',
  sent: 'Inviato al charter',
  confirmed: 'Conferma di ricezione registrata',
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatDate(value) {
  if (!isIsoDate(value)) return '—';
  const [year, month, day] = String(value).split('-');
  return `${day}/${month}/${year}`;
}

function isIsoDate(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isDateOnOrAfter(value, minimum) {
  return isIsoDate(value) && value >= minimum;
}

export function getMissingCharterFields(member) {
  const missing = requiredCharterFields.filter((field) => !String(member[field] || '').trim());
  if (member.documentExpiry && String(member.documentExpiry) < eventEndDate) missing.push('documentExpiry');
  if (!member.charterConsent) missing.push('charterConsent');
  return missing;
}

export function isCharterReady(member) {
  return getMissingCharterFields(member).length === 0;
}

export function isBoatReadyForPdf(boat) {
  return Boolean(boat?.name && boat?.flag && boat?.skipperName);
}

export function getMissingSkipperProfileFields(profile) {
  if (!profile) return ['skipperProfile'];
  const missing = skipperProfileFields.filter((field) => !String(profile[field] || '').trim());
  if (!isIsoDate(profile.birthDate)) missing.push('birthDate');
  if (!isDateOnOrAfter(profile.documentExpiry, eventEndDate)) missing.push('documentExpiry');
  if (profile.sailingLicenseExpiry && !isDateOnOrAfter(profile.sailingLicenseExpiry, eventEndDate)) missing.push('sailingLicenseExpiry');
  if (profile.radioCertificateExpiry && !isDateOnOrAfter(profile.radioCertificateExpiry, eventEndDate)) missing.push('radioCertificateExpiry');
  if (!profile.charterConsent) missing.push('charterConsent');
  skipperDocumentStatusFields.forEach((field) => {
    if (!skipperDocumentStatusLabels[profile[field]] || profile[field] === 'to_prepare') missing.push(field);
  });
  return [...new Set(missing)];
}

export function isSkipperProfileCharterReady(profile) {
  return getMissingSkipperProfileFields(profile).length === 0;
}

function skipperDocumentStatus(profile, field) {
  return skipperDocumentStatusLabels[profile?.[field]] || 'Da preparare';
}

export function buildCapitaneriaPrintHtml({ boat, members, skipperProfile }) {
  const skipper = {
    ...skipperProfile,
    role: 'Skipper / comandante',
  };
  const people = [skipper, ...members];
  const rows = people.map((member, index) => `<tr>
    <td class="num">${index + 1}</td>
    <td class="name">${escapeHtml(`${member.lastName || ''} ${member.firstName || ''}`.trim())}</td>
    <td>${escapeHtml(member.gender)}</td>
    <td>${escapeHtml(formatDate(member.birthDate))}</td>
    <td>${escapeHtml(member.birthPlace)}</td>
    <td>${escapeHtml(member.nationality)}</td>
    <td>${escapeHtml(member.documentType)}</td>
    <td>${escapeHtml(member.documentNumber)}</td>
    <td>${escapeHtml(formatDate(member.documentExpiry))}</td>
    <td>${escapeHtml(member.role || 'Crew')}</td>
  </tr>`).join('');
  const skipperName = `${skipper.firstName || ''} ${skipper.lastName || ''}`.trim() || boat.skipperName;
  const skipperDossier = `<section class="section dossier-section">Dossier skipper per il charter</section>
  <div class="dossier-grid">
    <div><p class="label">Documento identità</p><p class="value">${escapeHtml(`${skipper.documentType || ''} · ${skipper.documentNumber || ''}`.trim())}</p><p class="detail">${escapeHtml(`Scadenza: ${formatDate(skipper.documentExpiry)} · ${skipperDocumentStatus(skipper, 'identityDocumentStatus')}`)}</p></div>
    <div><p class="label">Patente nautica</p><p class="value">${escapeHtml(skipper.sailingLicenseNumber || '—')}</p><p class="detail">${escapeHtml(`Scadenza: ${skipper.sailingLicenseExpiry ? formatDate(skipper.sailingLicenseExpiry) : 'non indicata'} · ${skipperDocumentStatus(skipper, 'sailingLicenseStatus')}`)}</p></div>
    <div><p class="label">Certificato radio</p><p class="value">${escapeHtml(`${skipper.radioCertificateType || ''} · ${skipper.radioCertificateNumber || ''}`.trim())}</p><p class="detail">${escapeHtml(`Scadenza: ${skipper.radioCertificateExpiry ? formatDate(skipper.radioCertificateExpiry) : 'non indicata'} · ${skipperDocumentStatus(skipper, 'radioCertificateStatus')}`)}</p></div>
  </div>
  <p class="dossier-note">Le copie dei documenti seguono il canale richiesto dal charter; questo foglio registra solo riferimenti e stato operativo dichiarato dallo skipper.</p>`;

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>Elenco equipaggio - ${escapeHtml(boat.name)}</title>
<style>
  @page { size:A4 landscape; margin:10mm; }
  * { box-sizing:border-box; } body { margin:0; color:#102d3a; font-family:Arial,sans-serif; font-size:8.5px; }
  .page { max-width:277mm; margin:0 auto; } .header { display:flex; justify-content:space-between; gap:18px; align-items:start; padding-bottom:10px; border-bottom:2px solid #0c5260; }
  h1 { margin:0 0 3px; font-size:17px; letter-spacing:.04em; } .subtitle { margin:0; color:#526b73; font-size:9px; } .mark { color:#0c5260; font-weight:700; text-align:right; font-size:10px; }
  .meta { display:grid; grid-template-columns:repeat(4,1fr); margin:14px 0 16px; border:1px solid #b7c9ce; } .meta-route { grid-template-columns:repeat(5,1fr); } .meta div { min-height:44px; padding:7px 8px; border-right:1px solid #b7c9ce; } .meta div:last-child { border-right:0; }
  .label { margin-bottom:4px; color:#5c808b; font-size:7px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; } .value { color:#123b46; font-size:9px; font-weight:700; }
  .section { padding:6px 8px; color:white; background:#0c5260; font-size:8px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
  table { width:100%; border-collapse:collapse; } thead { display:table-header-group; background:#e4f0f1; } tr { break-inside:avoid; page-break-inside:avoid; } th { padding:6px 5px; color:#164955; border:1px solid #b7c9ce; font-size:6.8px; letter-spacing:.04em; text-align:left; text-transform:uppercase; } td { padding:6px 5px; border:1px solid #d1dde0; vertical-align:top; } tbody tr:nth-child(even) { background:#f5f9f9; } .num { width:6mm; text-align:center; } .name { min-width:28mm; font-weight:700; }
  .signatures { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:24px; } .signature { min-height:42px; padding-top:5px; border-top:1px solid #0c5260; } .signature .label { margin-bottom:20px; }
  .dossier-section { margin-top:14px; } .dossier-grid { display:grid; grid-template-columns:repeat(3,1fr); border:1px solid #b7c9ce; } .dossier-grid > div { min-height:46px; padding:7px 8px; border-right:1px solid #b7c9ce; } .dossier-grid > div:last-child { border-right:0; } .detail { margin:4px 0 0; color:#526b73; font-size:7.4px; } .dossier-note { margin:7px 0 0; color:#607b83; font-size:7px; }
  .footer { display:flex; justify-content:space-between; gap:12px; margin-top:16px; padding-top:7px; border-top:1px solid #b7c9ce; color:#607b83; font-size:7px; }
</style></head><body><main class="page">
  <header class="header"><div><h1>ELENCO EQUIPAGGIO - CREW LIST</h1><p class="subtitle">Documento operativo per il charter e per eventuali controlli dell'autorita marittima.</p></div><div class="mark">EGADI SAILING EXPERIENCE<br>8 - 11 OTTOBRE 2026</div></header>
  <section class="meta">
    <div><p class="label">Imbarcazione</p><p class="value">${escapeHtml(boat.name)}</p></div>
    <div><p class="label">Modello</p><p class="value">${escapeHtml(boat.model)}</p></div>
    <div><p class="label">Bandiera</p><p class="value">${escapeHtml(boat.flag)}</p></div>
    <div><p class="label">Comandante / Skipper</p><p class="value">${escapeHtml(skipperName)}</p></div>
  </section>
  <section class="meta meta-route">
    <div><p class="label">Porto di partenza</p><p class="value">${escapeHtml(boat.homePort || 'Marsala')}</p></div>
    <div><p class="label">Partenza</p><p class="value">8 ottobre 2026 - ore 15:00</p></div>
    <div><p class="label">Porto di rientro</p><p class="value">Marsala</p></div>
    <div><p class="label">Rientro previsto</p><p class="value">11 ottobre 2026 - entro le 18:00</p></div>
    <div><p class="label">Persone a bordo</p><p class="value">${people.length} · skipper incluso</p></div>
  </section>
  <div class="section">Composizione equipaggio</div>
  <table><thead><tr><th>#</th><th>Cognome e nome</th><th>Sesso</th><th>Data nascita</th><th>Luogo nascita</th><th>Nazionalita</th><th>Tipo documento</th><th>N. documento</th><th>Scadenza</th><th>Ruolo a bordo</th></tr></thead><tbody>${rows}</tbody></table>
  ${skipperDossier}
  <section class="signatures"><div class="signature"><p class="label">Firma comandante</p><strong>${escapeHtml(skipperName)}</strong></div><div class="signature"><p class="label">Timbro / visto charter o autorita</p></div><div class="signature"><p class="label">Luogo e data</p><strong>Marsala, 8 ottobre 2026</strong></div></section>
  <footer class="footer"><span>Egadi Sailing Experience - Marsala</span><span>Foglio operativo creato localmente: verificare con il charter campi, modello e consegna richiesti.</span></footer>
</main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`;
}

export function openCapitaneriaPdf(data) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('La finestra di stampa è stata bloccata dal browser.');
  printWindow.opener = null;
  printWindow.document.write(buildCapitaneriaPrintHtml(data));
  printWindow.document.close();
}

const requiredCharterFields = [
  'firstName',
  'lastName',
  'birthDate',
  'birthPlace',
  'nationality',
  'documentType',
  'documentNumber',
  'documentExpiry',
];

const charterHeaders = [
  'Evento',
  'Imbarco',
  'Sbarco',
  'Barca',
  'Skipper',
  'Ruolo/Cabina',
  'Nome',
  'Cognome',
  'Data di nascita',
  'Luogo di nascita',
  'Nazionalità',
  'Sesso',
  'Tipo documento',
  'Numero documento',
  'Scadenza documento',
  'Email',
  'Telefono',
];

function csvCell(value = '') {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function getMissingCharterFields(member) {
  const missing = requiredCharterFields.filter((field) => !String(member[field] || '').trim());
  if (!member.charterConsent) missing.push('charterConsent');
  return missing;
}

export function isCharterReady(member) {
  return getMissingCharterFields(member).length === 0;
}

export function buildCharterCsv({ boat, skipperName, members }) {
  const rows = members.map((member) => [
    'Egadi Sailing Experience · 8–11 ottobre 2026',
    'Marsala · 8 ottobre 2026, ore 15:00',
    'Marsala · 11 ottobre 2026, entro le ore 18:00',
    boat.name,
    skipperName,
    member.role || '',
    member.firstName || '',
    member.lastName || '',
    member.birthDate || '',
    member.birthPlace || '',
    member.nationality || '',
    member.gender || '',
    member.documentType || '',
    member.documentNumber || '',
    member.documentExpiry || '',
    member.email || '',
    member.phone || '',
  ].map(csvCell).join(';'));
  return `\uFEFF${charterHeaders.map(csvCell).join(';')}\r\n${rows.join('\r\n')}\r\n`;
}

export function charterFileName(boatName) {
  const safeBoatName = String(boatName || 'barca')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'barca';
  return `crew-list-egadi-2026-${safeBoatName}.csv`;
}

export function downloadCharterCsv(data) {
  const blob = new Blob([buildCharterCsv(data)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = charterFileName(data.boat.name);
  anchor.click();
  URL.revokeObjectURL(url);
}

const TRANSFER_STATUS_LABELS = {
  new: 'Da pianificare',
  planned: 'Pianificato',
  confirmed: 'Confermato',
  completed: 'Completato',
  cancelled: 'Annullato',
};

function sheetTransferRequestLabel(record) {
  if (record.airportMarsalaChoice === 'transfer') {
    return record.contactConsent === true ? 'Sì' : 'Consenso mancante';
  }
  if (record.airportMarsalaChoice === 'independent' || record.airportMarsalaChoice === 'ride_offer') return 'No';
  return 'Da scegliere';
}

function sheetTravelStatusLabel(record) {
  const choice = sheetTransferRequestLabel(record);
  if (choice === 'Da scegliere') return 'Transfer da scegliere';
  if (choice === 'Consenso mancante') return 'Consenso transfer da confermare';
  if (choice === 'No') return 'Transfer non richiesto';
  if (record.legState === 'draft') return 'Bozza, non confermata';
  return TRANSFER_STATUS_LABELS[record.status] || 'Da pianificare';
}

// Il foglio lo legge una persona, e siamo in Italia: il giorno va prima del
// mese, come in ogni altra data del sito. I record conservano AAAA-MM-GG
// perché ordina bene; scritto così nel foglio "2026-10-08" si leggeva come 10
// agosto (segnalato da Silvio il 7/10/2026, alla vigilia degli arrivi). Le
// celle sono scritte come testo puro, quindi Google non le reinterpreta.
function sheetDate(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}

// Data e ora con l'orologio di Marsala: chi apre il foglio non ragiona in UTC.
const SHEET_TIMESTAMP_FORMAT = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function sheetTimestamp(value) {
  const date = typeof value?.toDate === 'function' ? value.toDate() : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return SHEET_TIMESTAMP_FORMAT.format(date).replace(',', '');
}

module.exports = { sheetDate, sheetTimestamp, sheetTransferRequestLabel, sheetTravelStatusLabel };

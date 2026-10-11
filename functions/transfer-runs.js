// Chi sale davvero sullo stesso mezzo.
//
// Il conteggio "compagni di tratta" (stesso aeroporto, stesso giorno) dice se
// il costo si può dividere in teoria; poi però il gestore distribuisce le
// persone in corse a orari diversi, e chi resta da solo su una corsa il mezzo
// lo paga da solo. L'11/10/2026 Silvio ha ricevuto lamentele da chi lo ha
// scoperto al momento di salire. Qui si contano le persone che hanno lo
// stesso orario di ritrovo: è la stessa definizione di "corsa" del portale
// del gestore (transfer-ordering.js, groupTransferRuns).
const { transferSeatCount } = require('./transfer-party');

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

// L'orario che identifica la corsa; vuoto se la scheda non occupa posti
// (annullata, revocata) o il gestore non ha ancora fissato il ritrovo.
function transferRunTime(record) {
  if (!transferSeatCount(record)) return '';
  const time = typeof record.meetingTime === 'string' ? record.meetingTime.trim() : '';
  return TIME.test(time) ? time : '';
}

// Per ogni scheda, nello stesso ordine: quante ALTRE persone hanno lo stesso
// orario di ritrovo, oppure null se la scheda non è in nessuna corsa. Gli
// accompagnatori contano come persone: chi viaggia con due accompagnatori non
// è da solo. Le schede passate condividono già tratta, aeroporto e giorno.
function transferRunCompanions(records) {
  const seats = new Map();
  records.forEach((record) => {
    const run = transferRunTime(record);
    if (run) seats.set(run, (seats.get(run) || 0) + transferSeatCount(record));
  });
  return records.map((record) => {
    const run = transferRunTime(record);
    return run ? Math.max(0, seats.get(run) - 1) : null;
  });
}

// Cambia quando cambia chi sale su quale mezzo: serve a non ricalcolare
// quando il gestore ritocca solo una nota o il nome del veicolo.
function transferRunSignature(record) {
  const seats = transferSeatCount(record);
  if (!seats) return '';
  return [record.direction, record.airport, record.date, transferRunTime(record), seats].join('|');
}

module.exports = { transferRunCompanions, transferRunSignature, transferRunTime };

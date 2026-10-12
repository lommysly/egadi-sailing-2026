// La nota del gestore, per chi viaggia.
//
// Fino all'11/10/2026 le note restavano al gestore. Il 12/10 Silvio ha deciso
// che il partecipante le deve leggere: è lì che il gestore scrive il prezzo, e
// chi lo ha scoperto al momento di salire si è lamentato. Le note scritte
// prima di quella decisione erano appunti interni («non è venuta», «manca
// cell»): per questo arriva solo la nota di una tratta ancora da fare e non
// annullata, mai quella di un giorno già trascorso. Mezzo assegnato e nome
// del gruppo restano del gestore.
const VISIBLE_STATUSES = new Set(['new', 'planned', 'confirmed']);
const ROME_DAY = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });

// Il giorno con l'orologio di Marsala: a mezzanotte e mezza del 12 il server,
// che ragiona in UTC, è ancora all'11.
function romeToday(now = new Date()) {
  const parts = Object.fromEntries(ROME_DAY.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function passengerTransferNote(record, today = romeToday()) {
  if (!record || record.recordState !== 'active') return '';
  if (!VISIBLE_STATUSES.has(record.status || 'new')) return '';
  if (typeof record.date !== 'string' || record.date < today) return '';
  return typeof record.operatorNotes === 'string' ? record.operatorNotes.trim().slice(0, 500) : '';
}

module.exports = { passengerTransferNote, romeToday };

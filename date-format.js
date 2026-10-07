// Come si scrive un giorno a schermo.
//
// Nel database i giorni viaggiano come AAAA-MM-GG: è il formato che ordina
// bene e che i campi data del browser restituiscono. Ma scritto così com'è
// davanti a una persona si legge "mese, poi giorno": "2026-10-08" sembra il
// 10 agosto. È successo nel portale transfer il 7/10/2026, il giorno prima
// degli arrivi (segnalato da Silvio): siamo in Italia, il giorno va prima del
// mese, sempre.
//
// Da qui passa ogni giorno che il sito scrive a parole. Il mese è scritto per
// esteso apposta: "gio 8 ottobre" non si può leggere al contrario, nemmeno da
// chi è abituato alle date americane. Anche in inglese il giorno resta prima
// del mese ("Thu 8 October").
const GIORNO_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatIsoDay(value, { english = false, weekday = 'short' } = {}) {
  const testo = String(value ?? '').trim();
  const parti = GIORNO_ISO.exec(testo);
  // Un testo che non è una data ISO (un vecchio record scritto a mano) resta
  // com'è: meglio mostrarlo intero che inventarne una lettura.
  if (!parti) return testo;
  const [anno, mese, giorno] = parti.slice(1).map(Number);
  const data = new Date(Date.UTC(anno, mese - 1, giorno, 12));
  // Il 31 febbraio per Date diventa il 3 marzo: un giorno che nessuno ha
  // scritto. Se la data non esiste, si mostra il testo originale.
  if (data.getUTCFullYear() !== anno || data.getUTCMonth() !== mese - 1 || data.getUTCDate() !== giorno) return testo;
  return new Intl.DateTimeFormat(english ? 'en-GB' : 'it-IT', {
    weekday,
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(data);
}

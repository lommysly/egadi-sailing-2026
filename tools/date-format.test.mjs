import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { formatIsoDay } from '../date-format.js';

// Il 7/10/2026, il giorno prima degli arrivi, il portale transfer mostrava
// "2026-10-08 · 14:30": anno, mese, giorno. Letta da un italiano è il 10
// agosto. Questi test esistono perché un giorno scritto a schermo abbia
// sempre il giorno prima del mese, in ogni pagina.

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `manca la funzione ${name}`);
  return source.slice(start, source.indexOf('\nfunction ', start + 1));
}

test('il giorno si scrive prima del mese, e il mese a parole', () => {
  assert.equal(formatIsoDay('2026-10-08'), 'gio 8 ottobre');
  assert.equal(formatIsoDay('2026-10-11'), 'dom 11 ottobre');
  assert.equal(formatIsoDay('2026-10-08', { weekday: 'long' }), 'giovedì 8 ottobre');
});

test('anche in inglese il giorno resta prima del mese', () => {
  const label = formatIsoDay('2026-10-08', { english: true });
  assert.match(label, /8 October/);
  assert.doesNotMatch(label, /October 8/);
});

test('il fuso di chi guarda non sposta il giorno', () => {
  // Mezzanotte UTC in un fuso a ovest è ancora il giorno prima: la data è
  // costruita a mezzogiorno UTC e letta in UTC proprio per questo.
  const previous = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    assert.equal(formatIsoDay('2026-10-08'), 'gio 8 ottobre');
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test('quello che non è una data vera resta com’è, non viene inventato', () => {
  assert.equal(formatIsoDay(''), '');
  assert.equal(formatIsoDay(undefined), '');
  assert.equal(formatIsoDay('da definire'), 'da definire');
  // Il 31 febbraio non esiste: niente "3 marzo" comparso dal nulla.
  assert.equal(formatIsoDay('2026-02-31'), '2026-02-31');
});

test('la scheda del portale transfer non mostra più anno-mese-giorno', () => {
  const transfer = read('transfer.js');
  for (const language of ['it', 'en']) {
    const context = vm.createContext({
      formatIsoDay,
      locale: () => language,
      text: (value, limit) => String(value || '').slice(0, limit),
      optionalTime: (value) => value || '',
      t: (key) => key,
    });
    vm.runInContext(functionSource(transfer, 'formatSchedule'), context);
    const schedule = context.formatSchedule({ date: '2026-10-08', time: '14:30' });
    assert.doesNotMatch(schedule, /2026-10-08/, language);
    assert.match(schedule, language === 'en' ? /8 October · 14:30$/ : /^gio 8 ottobre · 14:30$/);
    // Senza giorno né ora resta il testo previsto, non una riga vuota.
    assert.equal(context.formatSchedule({}), 'unknownDateTime');
  }
  // Scheda e messaggio WhatsApp leggono la stessa funzione: corretta una,
  // corrette entrambe.
  assert.match(functionSource(transfer, 'whatsappMessage'), /formatSchedule\(record\)/);
});

test('il messaggio "offro un passaggio" dello skipper dice il giorno a parole', () => {
  const area = read('area.js');
  const context = vm.createContext({ formatIsoDay });
  vm.runInContext(functionSource(area, 'travelRideOfferMessage'), context);
  const form = (values) => ({
    dataset: { skipperTravelLeg: 'outbound' },
    elements: { namedItem: (name) => (name in values ? { value: values[name] } : null) },
    querySelector: () => ({ value: 'Trapani (TPS)' }),
  });
  const full = context.travelRideOfferMessage(form({ arrivalDate: '2026-10-08', arrivalTime: '14:30', rideOfferSeats: '2' }));
  assert.match(full, /^Ciao! Giovedì 8 ottobre alle 14:30 faccio la tratta Trapani \(TPS\) → porto di Marsala\. /);
  assert.doesNotMatch(full, /2026-10-08/);
  // Con un dato solo la frase deve reggere lo stesso.
  assert.match(context.travelRideOfferMessage(form({ arrivalTime: '14:30', rideOfferSeats: '1' })), /^Ciao! Alle 14:30 faccio la tratta /);
  assert.match(context.travelRideOfferMessage(form({ arrivalDate: '2026-10-08', rideOfferSeats: '1' })), /^Ciao! Giovedì 8 ottobre faccio la tratta /);
  assert.match(context.travelRideOfferMessage(form({ rideOfferSeats: '1' })), /^Ciao! faccio la tratta /);
});

test('nessuna pagina lascia decidere al dispositivo come scrivere una data', () => {
  // Una chiamata senza lingua esplicita usa quella del telefono: su un
  // dispositivo impostato in inglese americano scrive il mese per primo.
  const scripts = readdirSync(root).filter((name) => name.endsWith('.js'));
  const calls = /Intl\.DateTimeFormat\(|\.toLocaleDateString\(|\.toLocaleTimeString\(|\.toLocaleString\(/g;
  let checked = 0;
  for (const name of scripts) {
    const source = read(name);
    assert.doesNotMatch(source, /en-US/, `${name}: en-US mette il mese prima del giorno`);
    for (const match of source.matchAll(calls)) {
      const call = source.slice(match.index, match.index + match[0].length + 70);
      assert.match(call, /'it-IT'/, `${name}: ${call.split('\n')[0]}`);
      checked += 1;
    }
  }
  assert.equal(checked >= 9, true, 'il controllo deve trovare le chiamate esistenti');
});

// Trovato nella console dell'area skipper il 6/10/2026 e corretto il 7/10:
// la dichiarazione di pagamento passava una data vera a una funzione che si
// aspettava il testo AAAA-MM-GG. Il formattatore lanciava "Invalid time
// value" e con lui si fermava l'intero elenco dei versamenti della barca.
test('la data di una dichiarazione di pagamento non ferma più l’elenco dei versamenti', () => {
  const area = read('area.js');
  const context = vm.createContext({
    Intl,
    Date,
    escapeHtml: (value) => String(value),
    PAYMENT_METHODS: [{ id: 'bank', label: 'bonifico' }],
    isManualPaymentReceipt: () => false,
  });
  vm.runInContext(`${functionSource(area, 'formatDate')}\n${functionSource(area, 'paymentDeclaredHint')}`, context);
  const declaredAt = { toDate: () => new Date(2026, 9, 4, 10, 30) };
  const hint = context.paymentDeclaredHint({ declaredAt, declaredMethod: 'bank' });
  // Lo zero davanti al giorno dipende dal motore: conta l'ordine giorno/mese.
  assert.match(hint, /dichiara di aver pagato con bonifico il 0?4\/10\/2026\./);
  // I giorni dei campi data continuano a uscire come prima, giorno/mese/anno.
  assert.match(context.formatDate('2026-10-08'), /^0?8\/10\/2026$/);
  // E un valore che non è una data non lancia più niente: resta vuoto.
  assert.equal(context.formatDate('non una data'), '');
  assert.equal(context.formatDate(undefined), '');
});

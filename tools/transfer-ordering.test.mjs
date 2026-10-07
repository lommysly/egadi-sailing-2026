import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupTransferRecords,
  groupByTimeBand,
  additionalPassengerCount,
  transferPassengerCount,
  transferSeatCount,
  totalTransferSeats,
  sortTransferRecords,
  suggestedMarsalaDeparture,
  transferOperationalDate,
  transferTimingCheck,
} from '../transfer-ordering.js';
import serverParty from '../functions/transfer-party.js';

test('posti: legacy, +1/+2, annullamenti e validazione coincidono tra browser e server', () => {
  for (const value of [undefined, 0, 1, 2, 8, -1, 9, 1.5, '2', null]) {
    for (const status of ['new', 'planned', 'confirmed', 'completed', 'cancelled', 'revoked']) {
      const item = { additionalPassengers: value, status, recordState: 'active' };
      assert.equal(additionalPassengerCount(item), serverParty.additionalPassengerCount(item));
      assert.equal(transferPassengerCount(item), serverParty.transferPassengerCount(item));
      assert.equal(transferSeatCount(item), serverParty.transferSeatCount(item));
    }
  }
  assert.equal(transferSeatCount(null), 0);
  assert.equal(transferPassengerCount({}), 1);
  assert.equal(totalTransferSeats([{ additionalPassengers: 2 }, {}, { additionalPassengers: 1 }]), 6);
  assert.equal(totalTransferSeats([{ additionalPassengers: 2, status: 'cancelled' }, { recordState: 'revoked' }]), 0);
});

test('fasce: anche due sole schede contano quattro posti; nessuna catena oltre due ore', () => {
  const bands = groupByTimeBand([
    record('oltre', { time: '13:01' }),
    record('carlo', { time: '11:00', additionalPassengers: 2 }),
    record('vicino', { time: '12:30' }),
    record('senza-orario', { time: '' }),
  ], 'outbound');
  assert.deepEqual(bands.map(({ records }) => records.map(({ id }) => id)), [['carlo', 'vicino'], ['oltre'], ['senza-orario']]);
  assert.equal(totalTransferSeats(bands[0].records), 4);
  assert.equal(bands[2].minMinutes, null);
});

test('posti distinti per direzione, data e aeroporto; ritorno con partenza stimata', () => {
  const out = groupTransferRecords([
    record('carlo', { airport: 'TPS', additionalPassengers: 2 }),
    record('palermo', { airport: 'PMO', additionalPassengers: 1 }),
    record('domani', { airport: 'TPS', date: '2026-10-09' }),
  ], 'outbound');
  assert.deepEqual(out.map(({ count }) => count), [5, 1]);
  assert.equal(totalTransferSeats(out[0].airportGroups.find(({ airport }) => airport === 'TPS').records), 3);
  const ret = groupByTimeBand([record('ritorno', { airport: 'TPS', direction: 'return', time: '20:35', additionalPassengers: 2 })], 'return');
  assert.equal(ret[0].minMinutes, 18 * 60 + 50);
  assert.equal(totalTransferSeats(ret[0].records), 3);
});

function record(id, overrides = {}) {
  return {
    id,
    direction: 'outbound',
    participantName: id,
    airport: 'PMO',
    date: '2026-10-08',
    time: '10:00',
    luggageCount: 0,
    ...overrides,
  };
}

test('andata: ordina per data e orario del ritiro, non per ultimo aggiornamento', () => {
  const records = [
    record('tardi', { date: '2026-10-08', time: '11:00' }),
    record('giorno-prima', { airport: 'TPS', date: '2026-10-07', time: '20:05' }),
    record('prima', { date: '2026-10-08', time: '09:15' }),
  ];
  assert.deepEqual(sortTransferRecords(records, 'outbound').map(({ id }) => id), [
    'giorno-prima',
    'prima',
    'tardi',
  ]);
});

test('raggruppa per data operativa e aeroporto mantenendo l ordine cronologico', () => {
  const groups = groupTransferRecords([
    record('tps-sera', { airport: 'TPS', time: '20:05' }),
    record('pmo-tardi', { airport: 'PMO', time: '11:00' }),
    record('pmo-prima', { airport: 'PMO', time: '09:15' }),
    record('tps-prima', { airport: 'TPS', date: '2026-10-07', time: '20:05' }),
  ], 'outbound');

  assert.deepEqual(groups.map(({ date }) => date), ['2026-10-07', '2026-10-08']);
  assert.deepEqual(groups[1].airportGroups.map(({ airport }) => airport), ['PMO', 'TPS']);
  assert.deepEqual(groups[1].airportGroups[0].records.map(({ id }) => id), ['pmo-prima', 'pmo-tardi']);
});

test('ritorno: ordina per partenza stimata da Marsala e considera il bagaglio', () => {
  const records = [
    record('trapani', { direction: 'return', airport: 'TPS', time: '21:30' }),
    record('palermo', { direction: 'return', airport: 'PMO', time: '22:00' }),
    record('palermo-stiva', { direction: 'return', airport: 'PMO', time: '22:10', luggageCount: 1 }),
  ];

  assert.equal(suggestedMarsalaDeparture(records[0]), '19:45');
  assert.equal(suggestedMarsalaDeparture(records[1]), '19:15');
  assert.equal(suggestedMarsalaDeparture(records[2]), '18:55');
  assert.deepEqual(sortTransferRecords(records, 'return').map(({ id }) => id), [
    'palermo-stiva',
    'palermo',
    'trapani',
  ]);
});

test('un orario di ritrovo già assegnato dal gestore diventa la priorità operativa', () => {
  const records = [
    record('volo-prima-ma-ritrovo-dopo', { time: '09:00', meetingTime: '10:30' }),
    record('ritrovo-prima', { time: '10:00', meetingTime: '09:45' }),
  ];
  assert.deepEqual(sortTransferRecords(records, 'outbound').map(({ id }) => id), [
    'ritrovo-prima',
    'volo-prima-ma-ritrovo-dopo',
  ]);
});

test('un ritrovo manuale usa la propria data quando attraversa la mezzanotte', () => {
  const recordWithMeeting = record('notturno-manuale', {
    direction: 'return',
    airport: 'PMO',
    date: '2026-10-12',
    time: '04:00',
    meetingDate: '2026-10-11',
    meetingTime: '23:30',
  });

  assert.equal(transferOperationalDate(recordWithMeeting, 'return'), '2026-10-11');
});

test('ritorno notturno: usa come gruppo la data reale di partenza da Marsala', () => {
  const overnight = record('notturno', {
    direction: 'return',
    airport: 'PMO',
    date: '2026-10-12',
    time: '00:30',
  });
  assert.equal(suggestedMarsalaDeparture(overnight), '21:45');
  assert.equal(transferOperationalDate(overnight, 'return'), '2026-10-11');
});

test('dati incompleti: la data nota resta ordinata e i record senza data vanno in fondo', () => {
  const groups = groupTransferRecords([
    record('senza-data', { date: '', time: '' }),
    record('senza-orario', { date: '2026-10-08', time: '' }),
    record('completo', { date: '2026-10-08', time: '09:15' }),
  ], 'outbound');

  assert.deepEqual(groups.map(({ date }) => date), ['2026-10-08', '']);
  assert.deepEqual(groups[0].airportGroups[0].records.map(({ id }) => id), ['completo', 'senza-orario']);
});

test('a parità di orario l ordine resta deterministico per nome e id', () => {
  const records = [
    record('z-2', { participantName: 'Zeno' }),
    record('anna-2', { participantName: 'Anna' }),
    record('anna-1', { participantName: 'Anna' }),
  ];
  assert.deepEqual(sortTransferRecords(records, 'outbound').map(({ id }) => id), [
    'anna-1',
    'anna-2',
    'z-2',
  ]);
});

// I casi veri della vigilia degli arrivi (7/10/2026): il portale accettava in
// silenzio un ritrovo prima dell'atterraggio, conferme senza orario e attese
// di ore. Questi test fissano che cosa deve segnalare e, altrettanto
// importante, che cosa deve lasciar passare senza disturbare il gestore.
const arrival = (time, meetingTime, extra = {}) => ({ airport: 'PMO', date: '2026-10-08', time, meetingTime, status: 'confirmed', ...extra });
const departure = (airport, time, meetingTime, extra = {}) => ({ airport, date: '2026-10-11', time, meetingTime, status: 'confirmed', direction: 'return', ...extra });

test('andata: ritrovo prima dell’atterraggio è un errore, con i minuti di scarto', () => {
  assert.deepEqual(transferTimingCheck(arrival('21:10', '18:00'), 'outbound'), { level: 'error', code: 'pickup_before_landing', minutes: 190 });
});

test('andata: oltre due ore di attesa è un avviso, entro due ore non si segnala niente', () => {
  assert.deepEqual(transferTimingCheck(arrival('07:45', '11:30'), 'outbound'), { level: 'warning', code: 'long_wait', minutes: 225 });
  assert.deepEqual(transferTimingCheck(arrival('12:55', '14:30'), 'outbound'), { level: 'ok', code: '', minutes: 95 });
  assert.deepEqual(transferTimingCheck(arrival('12:30', '14:30'), 'outbound'), { level: 'ok', code: '', minutes: 120 });
  assert.equal(transferTimingCheck(arrival('18:00', '18:00'), 'outbound').level, 'ok');
});

test('conferma senza orario di ritrovo: avviso; da organizzare senza orario: niente', () => {
  assert.equal(transferTimingCheck(arrival('23:55', ''), 'outbound').code, 'confirmed_without_time');
  assert.equal(transferTimingCheck(arrival('23:55', '', { status: 'completed' }), 'outbound').code, 'confirmed_without_time');
  assert.equal(transferTimingCheck(arrival('23:55', '', { status: 'new' }), 'outbound').level, 'none');
  assert.equal(transferTimingCheck(arrival('23:55', '', { status: 'planned' }), 'outbound').level, 'none');
});

test('una scheda annullata non genera avvisi, qualunque orario abbia', () => {
  assert.equal(transferTimingCheck(arrival('21:10', '18:00', { status: 'cancelled' }), 'outbound').level, 'none');
  assert.equal(transferTimingCheck(null, 'outbound').level, 'none');
});

test('volo a ridosso di mezzanotte: il ritrovo dopo le 24 non è "prima dell’atterraggio"', () => {
  assert.deepEqual(transferTimingCheck(arrival('23:55', '00:20'), 'outbound'), { level: 'ok', code: '', minutes: 25 });
  // Con la data di ritrovo scritta esplicitamente vale quella, senza correzioni.
  assert.deepEqual(transferTimingCheck(arrival('23:55', '00:20', { meetingDate: '2026-10-09' }), 'outbound'), { level: 'ok', code: '', minutes: 25 });
  assert.equal(transferTimingCheck(arrival('23:55', '00:20', { meetingDate: '2026-10-08' }), 'outbound').code, 'pickup_before_landing');
});

test('ritorno: conta il tempo che resta in aeroporto dopo il viaggio da Marsala', () => {
  // Palermo: 105 minuti di strada. Partenza 18:45 per il volo delle 21:30.
  assert.deepEqual(transferTimingCheck(departure('PMO', '21:30', '18:45'), 'return'), { level: 'ok', code: '', minutes: 60 });
  assert.deepEqual(transferTimingCheck(departure('PMO', '21:30', '19:30'), 'return'), { level: 'warning', code: 'tight_margin', minutes: 15 });
  assert.deepEqual(transferTimingCheck(departure('PMO', '21:30', '20:00'), 'return'), { level: 'error', code: 'late_for_flight', minutes: 15 });
  // Trapani: 45 minuti di strada.
  assert.deepEqual(transferTimingCheck(departure('TPS', '20:35', '18:50'), 'return'), { level: 'ok', code: '', minutes: 60 });
});

test('ritorno con volo dopo mezzanotte: la partenza della sera prima non sballa il conto', () => {
  assert.deepEqual(transferTimingCheck(departure('TPS', '00:30', '23:00', { date: '2026-10-12' }), 'return'), { level: 'ok', code: '', minutes: 45 });
  assert.deepEqual(transferTimingCheck(departure('TPS', '05:55', '04:10', { date: '2026-10-12' }), 'return'), { level: 'ok', code: '', minutes: 60 });
});

test('senza volo leggibile o con aeroporto sconosciuto non si inventa un avviso', () => {
  assert.equal(transferTimingCheck(arrival('', '14:30'), 'outbound').level, 'none');
  assert.equal(transferTimingCheck(departure('XXX', '21:30', '18:45'), 'return').level, 'none');
});

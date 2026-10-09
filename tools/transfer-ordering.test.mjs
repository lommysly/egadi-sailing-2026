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
  groupTransferRuns,
  groupReturnFlights,
  returnRunFlights,
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

// Il gestore ragiona per corse ("Palermo 14:30, tredici persone"): le persone
// con lo stesso orario di ritrovo stanno insieme, chi non ce l'ha resta da
// organizzare, gli annullati vanno a parte (richiesta di Silvio, 7/10/2026).
test('corse: stesso orario di ritrovo insieme, in ordine di orario', () => {
  const records = [
    { id: 'c', airport: 'PMO', date: '2026-10-08', time: '15:20', meetingTime: '18:00', status: 'confirmed' },
    { id: 'a', airport: 'PMO', date: '2026-10-08', time: '12:55', meetingTime: '14:30', status: 'confirmed', meetingPoint: 'Hall Arrivi' },
    { id: 'b', airport: 'PMO', date: '2026-10-08', time: '14:00', meetingTime: '14:30', status: 'new', meetingPoint: 'HALL ARRIVI' },
    { id: 'd', airport: 'PMO', date: '2026-10-08', time: '13:15', status: 'new' },
    { id: 'e', airport: 'PMO', date: '2026-10-08', time: '09:15', meetingTime: '11:30', status: 'cancelled' },
  ];
  const { runs, unscheduled, cancelled } = groupTransferRuns(records, 'outbound');
  assert.deepEqual(runs.map((run) => [run.meetingTime, run.records.map((record) => record.id)]), [['14:30', ['a', 'b']], ['18:00', ['c']]]);
  assert.deepEqual(unscheduled.map((record) => record.id), ['d']);
  assert.deepEqual(cancelled.map((record) => record.id), ['e']);
});

test('corse: il punto di ritrovo scritto in modo diverso non spezza la navetta', () => {
  const { runs } = groupTransferRuns([
    { id: 'a', airport: 'PMO', date: '2026-10-08', time: '12:55', meetingTime: '14:30', meetingPoint: 'Hall Arrivi' },
    { id: 'b', airport: 'PMO', date: '2026-10-08', time: '13:25', meetingTime: '14:30', meetingPoint: 'HALL ARRIVI APT PALERMO' },
  ], 'outbound');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].records.length, 2);
});

test('corse: senza nessun orario di ritrovo non ne nasce nessuna', () => {
  const result = groupTransferRuns([{ id: 'a', airport: 'TPS', date: '2026-10-11', time: '20:35' }, { id: 'b', airport: 'TPS', date: '2026-10-11', time: '21:15', meetingTime: 'presto' }], 'return');
  assert.equal(result.runs.length, 0);
  assert.equal(result.unscheduled.length, 2);
  assert.deepEqual(groupTransferRuns([], 'outbound'), { runs: [], unscheduled: [], cancelled: [] });
});

test('corse: dentro la navetta l’ordine è quello dei voli, non l’alfabeto', () => {
  const r = (id, name, time) => ({ id, participantName: name, airport: 'PMO', date: '2026-10-08', time, meetingTime: '14:30', status: 'confirmed' });
  const { runs } = groupTransferRuns([r('a', 'Anna', '13:25'), r('c', 'Carlo', '14:00'), r('m', 'Marco', '12:55'), r('b', 'Bruno', '12:55')], 'outbound');
  assert.deepEqual(runs[0].records.map((record) => record.id), ['b', 'm', 'a', 'c']);
});

// Al ritorno si organizza a partire dal volo (richiesta di Silvio, 9/10/2026).
const back = (id, airport, time, extra = {}) => ({ id, participantName: id, airport, date: '2026-10-11', time, direction: 'return', status: 'new', ...extra });

test('ritorni per volo: fasce di due ore dal primo volo, un gruppo per orario di decollo', () => {
  const { bands, untimed } = groupReturnFlights([
    back('d', 'PMO', '22:00'), back('a', 'PMO', '18:00'), back('c', 'PMO', '21:45', { luggageCount: 1 }), back('b', 'PMO', '21:45'), back('e', 'PMO', ''),
  ]);
  assert.deepEqual(bands.map((band) => [band.firstFlight, band.lastFlight, band.records.map((record) => record.id)]), [['18:00', '18:00', ['a']], ['21:45', '22:00', ['b', 'c', 'd']]]);
  assert.deepEqual(bands[1].flights.map((group) => [group.flightTime, group.records.map((record) => record.id)]), [['21:45', ['b', 'c']], ['22:00', ['d']]]);
  assert.deepEqual(untimed.map((record) => record.id), ['e']);
});

test('ritorni per volo: "partire entro" è l’orario più stretto del gruppo', () => {
  const { bands } = groupReturnFlights([back('b', 'PMO', '21:45'), back('c', 'PMO', '21:45', { luggageCount: 1 }), back('d', 'PMO', '22:00')]);
  // Palermo: 105 minuti di strada, 60 di margine col solo bagaglio a mano, 90 con la stiva.
  assert.equal(bands[0].flights[0].departBy, '18:30');
  assert.equal(bands[0].flights[1].departBy, '19:15');
  assert.equal(bands[0].departBy, '18:30');
  // Trapani: 45 minuti di strada.
  assert.equal(groupReturnFlights([back('t', 'TPS', '20:35')]).bands[0].departBy, '18:50');
  // Aeroporto sconosciuto: nessun orario inventato.
  assert.equal(groupReturnFlights([back('x', 'XXX', '20:35')]).bands[0].departBy, '');
});

test('ritorni per volo: un decollo dopo mezzanotte resta in ordine e non sballa il "partire entro"', () => {
  const { bands } = groupReturnFlights([back('n', 'TPS', '00:30', { date: '2026-10-12' }), back('s', 'TPS', '23:10')]);
  assert.deepEqual(bands[0].records.map((record) => record.id), ['s', 'n']);
  assert.equal(bands[0].firstFlight, '23:10');
  assert.equal(bands[0].lastFlight, '00:30');
  assert.equal(bands[0].departBy, '21:25');
});

test('corsa di ritorno: primo e ultimo volo e margine della persona messa peggio', () => {
  const run = (meetingTime, ...times) => times.map((time, index) => back(`p${index}`, 'PMO', time, { meetingTime, status: 'confirmed' }));
  assert.deepEqual(returnRunFlights(run('18:30', '21:15', '22:00', '21:45')), { first: '21:15', last: '22:00', marginMinutes: 60 });
  // Partenza troppo tardi per il primo volo: margine negativo.
  assert.equal(returnRunFlights(run('19:45', '21:15', '22:00')).marginMinutes, -15);
  assert.deepEqual(returnRunFlights([]), { first: '', last: '', marginMinutes: null });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupTransferRecords,
  sortTransferRecords,
  suggestedMarsalaDeparture,
  transferOperationalDate,
} from '../transfer-ordering.js';

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

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { renderFixture } from './transfer-passengers-fixture.mjs';
import party from '../functions/transfer-party.js';
import sheetStatus from '../functions/sheet-status.js';
import { totalTransferSeats } from '../transfer-ordering.js';

const server = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
function section(start, end) {
  return server.slice(server.indexOf(start), server.indexOf(end, server.indexOf(start)));
}
function context(extra = {}) {
  const ctx = vm.createContext({
    ...party, ...sheetStatus, ...extra,
    asText: (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '',
    safeStatus: (value) => ['new', 'planned', 'confirmed', 'completed', 'cancelled'].includes(value) ? value : 'new',
  });
  vm.runInContext(section('function safeOperationalFields(', '// Nome e cognome separati:')
    + section('function humanSheetRow(', 'function technicalSheetRow('), ctx);
  return ctx;
}

test('backup: +2 sopravvive alla ricostruzione; le colonne A:M restano invariate', () => {
  const ctx = context();
  const original = { recordState: 'active', firstName: 'Mario', lastName: 'Fittizio', airportMarsalaChoice: 'transfer', contactConsent: true, additionalPassengers: 2, groupName: 'Navetta A', status: 'planned' };
  const preserved = ctx.safeOperationalFields(original);
  assert.equal(preserved.additionalPassengers, 2);
  assert.equal(preserved.groupName, 'Navetta A');
  const row = Array.from(ctx.humanSheetRow({ ...original, ...preserved }));
  const legacy = Array.from(ctx.humanSheetRow({ ...original, additionalPassengers: undefined }));
  assert.equal(row.length, 15);
  assert.deepEqual(row.slice(0, 13), legacy.slice(0, 13));
  assert.deepEqual(row.slice(13), [2, 3]);
  assert.deepEqual(legacy.slice(13), [0, 1]);
  assert.equal(ctx.humanSheetRow({ recordState: 'revoked' }).length, 15);
});

test('trigger reale: copia +2 nel backup e ricalcola i posti; non tocca inviti o voli', async () => {
  let handler;
  let changes;
  const refreshed = [];
  const ctx = context({
    exports: {}, EVENT_ID: 'egadi-2026', REGION: 'test', RUNTIME_SERVICE_ACCOUNT: 'test',
    onDocumentWritten: (_, callback) => { handler = callback; },
    sourceRevision: () => 2,
    FieldValue: { serverTimestamp: () => 'server' },
    writeCrewTransferOperationStatus: async () => {},
    refreshTransferCompanionCounts: async (...args) => refreshed.push(args),
    db: {
      doc: (path) => { assert.match(path, /travelBackupRecords\/test$/); return path; },
      runTransaction: async (callback) => callback({
        get: async () => ({ exists: true, data: () => ({ operatorRevision: 1, recordState: 'active' }) }),
        set: (_, payload) => { changes = payload; },
      }),
    },
  });
  vm.runInContext(section('exports.copyTransferOperationsToBackup =', '// Tre fogli separati'), ctx);
  const before = { recordState: 'active', status: 'new', direction: 'outbound', airport: 'TPS', date: '2026-10-08' };
  const after = { ...before, additionalPassengers: 2 };
  await handler({ params: { recordId: 'test' }, data: { before: { data: () => before }, after: { exists: true, data: () => after } } });
  assert.equal(changes.additionalPassengers, 2);
  assert.deepEqual(refreshed, [['outbound', 'TPS', '2026-10-08']]);
  refreshed.length = 0;
  const cancelled = { ...after, status: 'cancelled' };
  await handler({ params: { recordId: 'test' }, data: { before: { data: () => after }, after: { exists: true, data: () => cancelled } } });
  assert.equal(changes.status, 'cancelled');
  assert.equal(changes.additionalPassengers, 2);
  assert.deepEqual(refreshed, [['outbound', 'TPS', '2026-10-08']]);
});

test('stato equipaggio: l’annullamento si propaga solo alla tratta scelta, senza perdere il rientro', async () => {
  let changes;
  const ctx = context({
    asUid: (value) => value,
    FieldValue: { serverTimestamp: () => 'server' },
    db: {
      doc: (path) => { assert.equal(path, 'boats/boat/crewTravelStatus/person'); return path; },
      runTransaction: async (callback) => callback({
        get: async () => ({ data: () => ({ outboundOperationRevision: 1, returnOperationStatus: 'confirmed' }) }),
        set: (_, payload, options) => { changes = payload; assert.equal(options.merge, true); },
      }),
    },
  });
  vm.runInContext(section('async function writeCrewTransferOperationStatus(', 'exports.materializeCrewTravel ='), ctx);
  await ctx.writeCrewTransferOperationStatus({ boatId: 'boat', inviteId: 'person', direction: 'outbound', recordState: 'active', status: 'cancelled' }, 2);
  assert.equal(changes.outboundOperationStatus, 'cancelled');
  assert.equal(changes.outboundOperationRevision, 2);
  assert.equal(Object.hasOwn(changes, 'returnOperationStatus'), false);
});

test('conteggio anonimo: considera anche gli accompagnatori propri e ignora gli annullati', async () => {
  const writes = [];
  const records = [
    { boatId: 'boat', inviteId: 'a', additionalPassengers: 2, status: 'new' },
    { boatId: 'boat', inviteId: 'b', status: 'confirmed' },
    { boatId: 'boat', inviteId: 'c', additionalPassengers: 4, status: 'cancelled' },
  ];
  const query = { where: () => query, get: async () => ({ docs: records.map((record) => ({ data: () => record })) }) };
  const ctx = context({
    EVENT_ID: 'egadi-2026', asUid: (value) => value,
    FieldValue: { serverTimestamp: () => 'server' },
    db: { collection: () => query, doc: (path) => ({ set: async (payload) => writes.push([path, payload]) }) },
  });
  vm.runInContext(section('async function refreshTransferCompanionCounts(', '// Chi lascia la tratta'), ctx);
  await ctx.refreshTransferCompanionCounts('outbound', 'TPS', '2026-10-08');
  assert.deepEqual(writes.map(([, payload]) => payload.outboundTransferCompanions), [3, 3, 0]);
});

test('interfaccia reale IT/EN: totali per fascia e accompagnatori nel riepilogo e nel form', () => {
  const it = renderFixture('it');
  assert.match(it, /3 persone \(\+2\)/);
  assert.match(it, /13:15–14:10<\/h4>|13:15–14:10<span>4 persone<\/span>/);
  assert.match(it, /name="additionalPassengers"/);
  assert.match(it, /value="2" selected>\+2 · 3 persone/);
  const en = renderFixture('en');
  assert.match(en, /3 people \(\+2\)/);
  assert.match(en, /Additional passengers with this contact/);
  assert.match(en, /Departure from Marsala 18:50/);
});

test('riepilogo per barca: tre posti con un referente, annullati e altre barche esclusi', () => {
  const source = readFileSync(new URL('../transfer.js', import.meta.url), 'utf8');
  const start = source.indexOf('function boatTransferSeatsMarkup(');
  const end = source.indexOf('\nfunction renderBoatStats()', start);
  const ctx = vm.createContext({
    state: { records: [
      { boatId: 'boat', direction: 'outbound', additionalPassengers: 2, status: 'new' },
      { boatId: 'boat', direction: 'return', status: 'confirmed' },
      { boatId: 'boat', direction: 'outbound', additionalPassengers: 8, status: 'cancelled' },
      { boatId: 'other', direction: 'outbound', status: 'new' },
    ] },
    totalTransferSeats, normalizeDirection: (direction) => direction,
    locale: () => 'it', escapeHtml: (value) => value, t: (key) => key === 'inbound' ? 'Andata' : 'Rientro',
  });
  vm.runInContext(source.slice(start, end), ctx);
  assert.match(ctx.boatTransferSeatsMarkup('boat'), /Andata <strong>3<\/strong> · Rientro <strong>1<\/strong>/);
  assert.match(ctx.boatTransferSeatsMarkup(), /Andata <strong>4<\/strong>/);
  assert.match(source.slice(end), /\$\{boatTransferSeatsMarkup\(boat.id\)\}/);
});

// Richiesta di Silvio, 7/10/2026: a prenotazioni fatte la scheda deve mostrare
// l'orario deciso dal gestore e lo stato senza doverla aprire, e segnalare da
// sola gli orari che non tornano. I record sono fittizi; i renderer sono
// quelli veri della pagina.
test('scheda chiusa: ritrovo in testa, volo con la sua etichetta, avvisi sugli orari', () => {
  const records = [
    { id: 'ok', participantName: 'Persona puntuale', phone: '+39000', airport: 'PMO', date: '2026-10-08', time: '12:55', meetingTime: '14:30', direction: 'outbound', status: 'confirmed' },
    { id: 'tardi', participantName: 'Atterra dopo', phone: '+39000', airport: 'PMO', date: '2026-10-08', time: '21:10', meetingTime: '18:00', direction: 'outbound', status: 'confirmed' },
    { id: 'attesa', participantName: 'Aspetta a lungo', phone: '+39000', airport: 'PMO', date: '2026-10-08', time: '07:45', meetingTime: '11:30', direction: 'outbound', status: 'confirmed' },
    { id: 'senza', participantName: 'Senza orario', airport: 'TPS', date: '2026-10-08', time: '23:55', direction: 'outbound', status: 'confirmed' },
    { id: 'nuova', participantName: 'Da organizzare', phone: '+39000', airport: 'TPS', date: '2026-10-08', time: '13:15', direction: 'outbound', status: 'new' },
  ];
  const html = renderFixture('it', records);
  const card = (id) => html.slice(html.indexOf(`data-record-id="${id}"`), html.indexOf('</summary>', html.indexOf(`data-record-id="${id}"`)));

  const ok = card('ok');
  assert.match(ok, /class="transfer-record-pickup"><small>Ritrovo<\/small><b>14:30<\/b>/);
  // Il numero del volo si legge senza aprire la scheda (richiesta di Silvio).
  assert.match(ok, /<span>Volo Volo fittizio · arrivo gio 8 ottobre · 12:55<\/span>/);
  assert.match(ok, /transfer-badge--confirmed/);
  assert.doesNotMatch(ok, /transfer-badge--alert-/);

  const late = card('tardi');
  assert.match(late, /transfer-badge--alert-error">Atterra dopo il ritrovo/);
  assert.match(html, /data-record-id="tardi" data-timing="error"/);
  assert.doesNotMatch(html, /data-record-id="ok" data-timing/);

  assert.match(card('attesa'), /transfer-badge--alert-warning">Attesa 3h45/);

  const missing = card('senza');
  assert.match(missing, /transfer-record-pickup is-missing"><small>Ritrovo<\/small><b>da fissare<\/b>/);
  assert.match(missing, /transfer-badge--alert-warning">Manca orario di ritrovo/);
  assert.match(missing, /transfer-badge--alert-note">Senza telefono/);

  // Chi è ancora da organizzare non ha colpe: nessun avviso sugli orari.
  const fresh = card('nuova');
  assert.match(fresh, /is-missing/);
  assert.doesNotMatch(fresh, /transfer-badge--alert-(error|warning)/);

  // L'intestazione della fascia dice quante schede vanno guardate.
  assert.match(html, /transfer-time-band-alert">1 da controllare/);

  const en = renderFixture('en', records);
  assert.match(en, /<small>Pick-up<\/small><b>14:30<\/b>/);
  assert.match(en, /Lands after pick-up/);
  assert.match(en, /Flight Volo fittizio · lands /);
});

test('vista per corse: intestazione con ritrovo, persone, punto e stato; il resto da organizzare', () => {
  const r = (id, name, time, extra = {}) => ({ id, participantName: name, phone: '+39000', airport: 'PMO', date: '2026-10-08', time, direction: 'outbound', status: 'confirmed', ...extra });
  const records = [
    r('a', 'Prima Persona', '12:55', { meetingTime: '14:30', meetingPoint: 'Hall Arrivi' }),
    r('b', 'Seconda Persona', '13:25', { meetingTime: '14:30', meetingPoint: 'HALL ARRIVI', additionalPassengers: 2 }),
    r('c', 'Terza Persona', '14:00', { meetingTime: '14:30', meetingPoint: 'Hall Arrivi', status: 'new' }),
    r('d', 'Atterra Tardi', '21:10', { meetingTime: '18:00', meetingPoint: 'Hall Arrivi' }),
    r('e', 'Da Organizzare', '13:15', { status: 'new' }),
    r('f', 'Annullata', '09:15', { status: 'cancelled' }),
  ];
  const html = renderFixture('it', records);
  const firstRun = html.slice(html.indexOf('class="transfer-run"'), html.indexOf('class="transfer-run"', html.indexOf('class="transfer-run"') + 10));
  // Una corsa per orario: 14:30 con cinque persone (1 + 3 + 1), punto unico
  // anche se scritto con maiuscole diverse, stati misti contati.
  assert.equal((html.match(/class="transfer-run"/g) || []).length, 2);
  assert.match(firstRun, /transfer-run-head"><span class="transfer-record-pickup"><small>Ritrovo<\/small><b>14:30<\/b>/);
  assert.match(firstRun, /<strong>5 persone<\/strong><span>Hall Arrivi<\/span>/);
  assert.match(firstRun, /transfer-badge--confirmed">[^<]* ×2<\/span>/);
  assert.match(firstRun, /transfer-badge--new">[^<]* ×1<\/span>/);
  assert.match(firstRun, /data-action="edit-run">Modifica corsa/);
  assert.match(firstRun, /data-cluster/);
  for (const id of ['a', 'b', 'c']) assert.match(firstRun, new RegExp(`data-record-id="${id}"`));
  assert.doesNotMatch(firstRun, /data-record-id="d"/);
  // La seconda corsa segnala chi atterra dopo il ritrovo.
  const secondRun = html.slice(html.lastIndexOf('class="transfer-run"'));
  assert.match(secondRun.slice(0, secondRun.indexOf('transfer-operator-list')), /<b>18:00<\/b>[\s\S]*transfer-time-band-alert">1 da controllare/);
  // Chi non ha orario resta sotto "Da organizzare", gli annullati a parte.
  assert.match(html, /transfer-run-section">Da organizzare · 1 persona<\/h5>/);
  assert.match(html, /transfer-run-section">Annullati · 1<\/h5>/);
  assert.equal(html.indexOf('data-record-id="e"') > html.lastIndexOf('class="transfer-run"'), true);
  assert.equal(html.indexOf('data-record-id="f"') > html.indexOf('Annullati · 1'), true);
  // Ogni persona compare una volta sola.
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) assert.equal((html.match(new RegExp(`data-record-id="${id}"`, 'g')) || []).length, 1, id);
});

test('vista per corse: punti di ritrovo davvero diversi vengono segnalati', () => {
  const r = (id, point) => ({ id, participantName: id, phone: '+39000', airport: 'TPS', date: '2026-10-08', time: '13:15', meetingTime: '14:00', meetingPoint: point, direction: 'outbound', status: 'confirmed' });
  const html = renderFixture('it', [r('a', 'Hall Arrivi'), r('b', 'Parcheggio P2'), r('c', '')]);
  assert.match(html, /<span class="is-caution">Punti di ritrovo diversi: Hall Arrivi \/ Parcheggio P2<\/span>/);
  const none = renderFixture('it', [r('a', ''), r('b', '')]);
  assert.match(none, /<span class="is-caution">Punto di ritrovo da indicare<\/span>/);
});

test('senza orari di ritrovo la schermata resta quella di prima, in fasce per volo', () => {
  const html = renderFixture('it');
  assert.doesNotMatch(html, /class="transfer-run"/);
  assert.doesNotMatch(html, /class="transfer-run-section"/);
  assert.match(html, /Voli in arrivo 13:15–14:10/);
});

test('"Modifica corsa" seleziona tutta la navetta e apre il modulo di gruppo esistente', () => {
  const source = readFileSync(new URL('../transfer.js', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf("if (action === 'edit-run')"), source.indexOf("if (action === 'edit-run')") + 700);
  assert.match(handler, /state\.selectedRecordIds\.clear\(\)/);
  assert.match(handler, /cluster\?\.querySelectorAll\('\[data-record-select\]'\)/);
  assert.match(handler, /state\.bulkFormExpanded = true/);
  assert.match(handler, /renderBulkToolbar\(\)/);
});

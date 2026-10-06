import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { renderFixture } from './transfer-passengers-fixture.mjs';
import party from '../functions/transfer-party.js';
import sheetStatus from '../functions/sheet-status.js';

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

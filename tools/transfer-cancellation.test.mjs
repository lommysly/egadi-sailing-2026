import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import cancellation from '../functions/transfer-cancellation.js';

class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function fixture({ uid = 'skipper', event = {}, boat = {}, record = {} } = {}) {
  const documents = new Map([
    ['events/egadi-2026', { privateAreaEnabled: true, organizerIds: ['owner'], ...event }],
    ['boats/boat', { eventId: 'egadi-2026', skipperId: 'skipper', ...boat }],
    ['events/egadi-2026/transferOpsRecords/boat_person_outbound', {
      boatId: 'boat', inviteId: 'person', direction: 'outbound', recordState: 'active',
      status: 'confirmed', additionalPassengers: 2, date: '2026-10-08', time: '13:15',
      contactConsent: true, flightNumber: 'FR0000', ...record,
    }],
  ]);
  const writes = [];
  const db = {
    doc: (path) => path,
    runTransaction: (callback) => callback({
      get: async (path) => ({ exists: documents.has(path), data: () => documents.get(path) }),
      update: (path, changes) => { writes.push({ path, changes }); documents.set(path, { ...documents.get(path), ...changes }); },
    }),
  };
  const handler = cancellation.createTransferCancellationHandler({ db, FieldValue: { serverTimestamp: () => 'server' }, HttpsError });
  const request = { auth: uid ? { uid } : null, data: { boatId: 'boat', inviteId: 'person', direction: 'outbound' } };
  return { handler, request, writes, documents };
}

test('skipper della propria barca: annulla 3 posti, conserva volo/consenso e non duplica il comando', async () => {
  const f = fixture();
  const result = await f.handler(f.request);
  assert.deepEqual(result, { status: 'cancelled', alreadyCancelled: false, releasedSeats: 3 });
  assert.deepEqual(Object.keys(f.writes[0].changes).sort(), ['status', 'updatedAt', 'updatedBy']);
  const saved = f.documents.get(f.writes[0].path);
  assert.equal(saved.flightNumber, 'FR0000');
  assert.equal(saved.contactConsent, true);
  assert.equal(saved.additionalPassengers, 2);
  assert.equal(saved.time, '13:15');
  assert.equal(saved.updatedBy, 'skipper');
  assert.deepEqual(await f.handler(f.request), { status: 'cancelled', alreadyCancelled: true, releasedSeats: 0 });
  assert.equal(f.writes.length, 1);
});

test('organizzatore autorizzato: annulla una singola tratta senza letture globali', async () => {
  const f = fixture({ uid: 'owner', record: { status: 'new', additionalPassengers: 0 } });
  assert.equal((await f.handler(f.request)).releasedSeats, 1);
  assert.equal(f.writes.length, 1);
});

test('accesso negato a equipaggio, altro skipper, estraneo e sessione assente', async () => {
  for (const uid of ['crew', 'other-skipper', 'stranger', null]) {
    const f = fixture({ uid });
    await assert.rejects(f.handler(f.request), { code: uid ? 'permission-denied' : 'unauthenticated' });
    assert.equal(f.writes.length, 0);
  }
});

test('input chiuso: nega percorsi, campi estranei e direzioni non previste', async () => {
  for (const data of [
    { boatId: '../boat', inviteId: 'person', direction: 'outbound' },
    { boatId: 'boat', inviteId: 'person', direction: 'both' },
    { boatId: 'boat', inviteId: 'person', direction: 'outbound', status: 'completed' },
    { boatId: 'boat', direction: 'outbound' },
  ]) {
    const f = fixture();
    await assert.rejects(f.handler({ ...f.request, data }), { code: 'invalid-argument' });
    assert.equal(f.writes.length, 0);
  }
});

test('nega area chiusa, record concluso/revocato, metadati incoerenti e barca di altro evento', async () => {
  for (const changes of [
    { event: { privateAreaEnabled: false } },
    { record: { status: 'completed' } },
    { record: { recordState: 'revoked' } },
    { record: { boatId: 'other' } },
    { record: { inviteId: 'other' } },
    { record: { direction: 'return' } },
    { boat: { eventId: 'other' } },
    { uid: 'stranger', event: { organizerIds: 'stranger' } },
  ]) {
    const f = fixture(changes);
    await assert.rejects(f.handler(f.request), (error) => ['failed-precondition', 'permission-denied'].includes(error.code));
    assert.equal(f.writes.length, 0);
  }
});

const uiSource = readFileSync(new URL('../area-transfer-cancel.js', import.meta.url), 'utf8');
function uiContext(confirm = true, rejects = false) {
  let click;
  const calls = [];
  const alerts = [];
  const button = { dataset: { direction: 'return', cancelCrewTransfer: 'person' }, addEventListener: (_, callback) => { click = callback; } };
  const section = { querySelectorAll: () => [button] };
  const ctx = vm.createContext({
    window: { confirm: () => confirm, alert: (message) => alerts.push(message) },
    console: { error: () => {} },
    getFunctions: (_, region) => { assert.equal(region, 'europe-west8'); return {}; },
    httpsCallable: (_, name) => async (payload) => { calls.push({ name, payload: JSON.parse(JSON.stringify(payload)) }); if (rejects) throw new Error('rete'); return { data: { status: 'cancelled' } }; },
  });
  vm.runInContext(uiSource.replace(/^import .*;\n/m, '').replaceAll('export function ', 'function '), ctx);
  ctx.bindTransferCancellation(section, { app: {}, boatId: 'boat' });
  return { ctx, click: () => click(), calls, button, alerts };
}

test('UI: azioni chiare IT/EN, solo richieste attive, mai su trasferimento concluso', () => {
  const { ctx } = uiContext();
  const status = { outboundOperationStatus: 'new', returnOperationStatus: 'confirmed' };
  const it = ctx.cancellationActions(status, 'person', (value) => value);
  assert.match(it, /Annulla transfer andata/);
  assert.match(it, /Annulla transfer ritorno/);
  assert.match(ctx.cancellationActions(status, 'person', (value) => value, true), /Cancel return transfer/);
  assert.equal(ctx.cancellationActions({ outboundOperationStatus: 'cancelled', returnOperationStatus: 'completed' }, 'person', (value) => value), '');
});

test('UI: conferma obbligatoria, payload preciso, esito e errore senza falso successo', async () => {
  const denied = uiContext(false);
  await denied.click();
  assert.equal(denied.calls.length, 0);
  const accepted = uiContext();
  await accepted.click();
  assert.deepEqual(accepted.calls, [{ name: 'cancelBoatTransfer', payload: { boatId: 'boat', inviteId: 'person', direction: 'return' } }]);
  assert.equal(accepted.button.disabled, true);
  assert.equal(accepted.button.textContent, 'Transfer annullato ✓');
  const failed = uiContext(true, true);
  await failed.click();
  assert.equal(failed.button.disabled, false);
  assert.equal(failed.alerts.length, 1);
  assert.notEqual(failed.button.textContent, 'Transfer annullato ✓');
});

test('renderer skipper reale: usa la barca attiva anche per la scheda skipper e non interrompe la pagina', () => {
  const source = readFileSync(new URL('../area.js', import.meta.url), 'utf8');
  const start = source.indexOf('function renderCrewTravelOverview()');
  const end = source.indexOf('\nfunction renderMembers()', start);
  const bindings = [];
  const section = {};
  const ctx = vm.createContext({
    activeBoat: { id: 'boat' }, app: {}, activeInvites: [], activeCrewTravelStatus: [{ isSkipper: true, outboundOperationStatus: 'new' }],
    document: { querySelectorAll: () => [section] }, window: {},
    crewTravelOverviewCards: () => [{ member: { id: 'person' }, group: 'done', presentation: { tone: 'ready' }, legStates: {} }],
    crewTravelMembers: () => [{ id: 'person' }], crewTravelStatusFor: () => ({ outboundOperationStatus: 'confirmed' }),
    memberName: () => 'Persona fittizia', inviteLocale: () => 'it',
    crewTravelContactUrl: () => 'https://wa.me/000', whatsappActionIconMarkup: () => '', escapeHtml: (value) => value,
    rosterHeading: () => ({ title: 'Viaggi', eyebrow: 'Equipaggio' }),
    rosterMarkup: (rows, options) => rows.map((row) => options.azione(row)).join(''),
    cancellationActions: uiContext().ctx.cancellationActions,
    bindTransferCancellation: (_, options) => bindings.push(options),
  });
  vm.runInContext(source.slice(start, end), ctx);
  ctx.renderCrewTravelOverview();
  assert.equal(bindings[0].boatId, 'boat');
  assert.match(section.innerHTML, /data-cancel-crew-transfer="person"/);
  assert.match(section.innerHTML, /data-cancel-crew-transfer="skipper"/);
  ctx.activeBoat = null;
  assert.doesNotThrow(() => ctx.renderCrewTravelOverview());
});

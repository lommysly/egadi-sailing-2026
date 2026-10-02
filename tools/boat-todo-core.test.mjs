import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boatFromData,
  boatSetupReadiness,
  economySignals,
  normalizeTransferDirection,
  openTodoKeys,
  setupSignals,
  skipperTransferStatus,
  travelBreakdown,
} from '../boat-todo-core.js';

// Questa regola è letta da due pagine diverse: la console organizzatore
// (elenco "Cose da fare" + messaggi di sollecito) e il numero sulla card
// dell'area skipper. I test servono a tenerle d'accordo nel tempo.

const BOAT_READY = boatFromData('karibu', { name: 'Karibu', totalBerths: 6, berthLayout: { bathroomCount: 2 } });

const readinessOf = ({ boat = BOAT_READY, briefing = { rulesText: 'regole' }, contact = {}, economy } = {}) => boatSetupReadiness({
  boat,
  setup: setupSignals({ briefing, contact }),
  economy,
});

test('il numero di bagni si legge dentro berthLayout, non in cima al documento', () => {
  assert.equal(BOAT_READY.bathroomCount, 2);
  assert.equal(boatFromData('x', { totalBerths: 6, bathroomCount: 2 }).bathroomCount, 0);
  assert.equal(boatFromData('senza-nome', {}).name, 'senza-nome');
});

test('le tratte sono nominate in più modi dalle diverse fonti', () => {
  assert.equal(normalizeTransferDirection('ARRIVO'), 'outbound');
  assert.equal(normalizeTransferDirection('airport_to_marsala'), 'outbound');
  assert.equal(normalizeTransferDirection('marsala_to_airport'), 'return');
  assert.equal(normalizeTransferDirection(undefined), '');
});

test('un dato non ancora letto non è "non fatto": niente sollecito a vuoto', () => {
  const readiness = readinessOf({ economy: undefined });
  assert.equal(readiness.quotesSet, null);
  assert.equal(readiness.extrasSet, null);
  assert.deepEqual(openTodoKeys({ readiness, transferPending: 0 }), []);
});

test('barca completa ed equipaggio tutto deciso: nessuna cosa aperta', () => {
  const readiness = readinessOf({ economy: economySignals({ planExists: true, items: { cena: { state: 'extra' } }, projectionBerthCents: [45000, 45000] }) });
  assert.deepEqual(readiness, { boatConfigured: true, rulesActive: true, dossierConfirmed: true, quotesSet: true, extrasSet: true });
  assert.deepEqual(openTodoKeys({ readiness, transferPending: 0 }), []);
});

test('chi non ha mai aperto la parte economica compare con quote ed extra', () => {
  const readiness = readinessOf({ economy: economySignals({ planExists: false, items: undefined, projectionBerthCents: [] }) });
  assert.deepEqual(openTodoKeys({ readiness, transferPending: 0 }), ['quotes', 'extras']);
});

test('una voce lasciata "da definire" non vale come decisa', () => {
  const signals = economySignals({ planExists: true, items: { cena: { state: 'to_define' }, cambusa: {} }, projectionBerthCents: [0, 45000] });
  assert.equal(signals.decidedItems, 0);
  assert.equal(signals.pricedProjections, 1);
  assert.equal(signals.projectionsTotal, 2);
});

test('regole e dossier mancanti vengono elencati prima della parte economica', () => {
  const readiness = readinessOf({
    boat: boatFromData('x', { totalBerths: 1 }),
    briefing: null,
    contact: null,
    economy: economySignals({ planExists: false, projectionBerthCents: [] }),
  });
  assert.deepEqual(openTodoKeys({ readiness, transferPending: 3 }),
    ['boat', 'rules', 'dossier', 'quotes', 'extras', 'transfer']);
});

test('un briefing esistente ma senza testo non è un regolamento attivo', () => {
  assert.deepEqual(setupSignals({ briefing: {}, contact: {} }), { rulesActive: false, dossierConfirmed: true });
  assert.deepEqual(setupSignals({}), { rulesActive: false, dossierConfirmed: false });
});

test('chi non ha chiesto il transfer ci arriva per conto suo, skipper compreso', () => {
  const breakdown = travelBreakdown({
    travelStatuses: [
      { outboundTransfer: 'requested', returnTransfer: 'requested' },
      { outboundTransfer: 'requested', returnTransfer: 'not_requested' },
      { outboundTransfer: 'not_requested', returnTransfer: 'requested' },
      {},
    ],
    memberCount: 4,
    skipperStatus: { outbound: true, return: false },
  });
  assert.equal(breakdown.total, 5);
  // Andata: 2 richieste + lo skipper = 3 sul pulmino, gli altri 2 per conto
  // loro — compresa la persona che non ha mai aperto il modulo.
  assert.deepEqual(breakdown.outbound, { requested: 3, pending: 0, independent: 2 });
  // Ritorno: lo skipper non lo ha chiesto, quindi sta fra gli altri 3.
  assert.deepEqual(breakdown.return, { requested: 2, pending: 0, independent: 3 });
});

test('resta contato a parte solo chi ha chiesto il transfer senza completarlo', () => {
  const breakdown = travelBreakdown({
    travelStatuses: [{ outboundTransfer: 'undecided' }, { outboundTransfer: 'requested' }],
    memberCount: 2,
    skipperStatus: {},
  });
  assert.deepEqual(breakdown.outbound, { requested: 1, pending: 1, independent: 1 });
});

test('senza il numero di iscritti il conteggio resta sconosciuto, non zero', () => {
  const breakdown = travelBreakdown({ travelStatuses: [], memberCount: null, skipperStatus: {} });
  assert.equal(breakdown.total, null);
  assert.equal(breakdown.outbound.independent, null);
  assert.equal(breakdown.return.independent, null);
});

test('del transfer skipper contano solo i record attivi della sua barca', () => {
  const records = [
    { boatId: 'karibu', inviteId: 'skipper', direction: 'arrivo' },
    { boatId: 'karibu', inviteId: 'skipper', direction: 'ritorno', recordState: 'revoked' },
    { boatId: 'karibu', inviteId: 'crew-1', direction: 'ritorno' },
    { boatId: 'altra-barca', inviteId: 'skipper', direction: 'ritorno' },
  ];
  assert.deepEqual(skipperTransferStatus(records, 'karibu'), { outbound: true, return: false });
  assert.deepEqual(skipperTransferStatus(records, 'barca-ignota'), { outbound: false, return: false });
  assert.deepEqual(skipperTransferStatus(undefined, 'karibu'), { outbound: false, return: false });
});

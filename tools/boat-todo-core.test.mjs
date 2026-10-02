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
  assert.deepEqual(openTodoKeys({ readiness, transferPending: 0, skipperStatus: { outbound: true, return: true } }), []);
});

test('barca completa ed equipaggio tutto deciso: nessuna cosa aperta', () => {
  const readiness = readinessOf({ economy: economySignals({ planExists: true, items: { cena: { state: 'extra' } }, projectionBerthCents: [45000, 45000] }) });
  assert.deepEqual(readiness, { boatConfigured: true, rulesActive: true, dossierConfirmed: true, quotesSet: true, extrasSet: true });
  assert.deepEqual(openTodoKeys({ readiness, transferPending: 0, skipperStatus: { outbound: true, return: true } }), []);
});

test('chi non ha mai aperto la parte economica compare con quote ed extra', () => {
  const readiness = readinessOf({ economy: economySignals({ planExists: false, items: undefined, projectionBerthCents: [] }) });
  assert.deepEqual(openTodoKeys({ readiness, transferPending: 0, skipperStatus: { outbound: true, return: true } }), ['quotes', 'extras']);
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
  assert.deepEqual(openTodoKeys({ readiness, transferPending: 3, skipperStatus: { outbound: false, return: false } }),
    ['boat', 'rules', 'dossier', 'quotes', 'extras', 'transfer', 'skipperTransfer']);
});

test('un briefing esistente ma senza testo non è un regolamento attivo', () => {
  assert.deepEqual(setupSignals({ briefing: {}, contact: {} }), { rulesActive: false, dossierConfirmed: true });
  assert.deepEqual(setupSignals({}), { rulesActive: false, dossierConfirmed: false });
});

test('il conteggio transfer comprende lo skipper, che occupa un posto come gli altri', () => {
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
  assert.deepEqual(breakdown.outbound, { requested: 3, independent: 1, pending: 1 });
  assert.deepEqual(breakdown.return, { requested: 2, independent: 1, pending: 2 });
});

test('senza il numero di iscritti il conteggio resta sconosciuto, non zero', () => {
  const breakdown = travelBreakdown({ travelStatuses: [], memberCount: null, skipperStatus: {} });
  assert.equal(breakdown.total, null);
  assert.equal(breakdown.outbound.pending, null);
  assert.equal(breakdown.return.pending, null);
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

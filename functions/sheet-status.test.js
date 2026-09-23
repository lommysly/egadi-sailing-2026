const assert = require('node:assert/strict');
const test = require('node:test');
const { sheetTransferRequestLabel, sheetTravelStatusLabel } = require('./sheet-status');

test('un viaggio confermato senza scelta non appare come transfer richiesto o revocato', () => {
  const record = { legState: 'ready', airportMarsalaChoice: '', contactConsent: false, status: 'revoked' };
  assert.equal(sheetTransferRequestLabel(record), 'Da scegliere');
  assert.equal(sheetTravelStatusLabel(record), 'Transfer da scegliere');
});

test('un viaggio autonomo resta distinto dalla richiesta di transfer', () => {
  const record = { legState: 'ready', airportMarsalaChoice: 'independent', contactConsent: false, status: 'new' };
  assert.equal(sheetTransferRequestLabel(record), 'No');
  assert.equal(sheetTravelStatusLabel(record), 'Transfer non richiesto');
});

test('una richiesta con consenso mostra lo stato operativo, anche in bozza', () => {
  const record = { legState: 'ready', airportMarsalaChoice: 'transfer', contactConsent: true, status: 'planned' };
  assert.equal(sheetTransferRequestLabel(record), 'Sì');
  assert.equal(sheetTravelStatusLabel(record), 'Pianificato');
  assert.equal(sheetTravelStatusLabel({ ...record, legState: 'draft' }), 'Bozza, non confermata');
});

test('transfer senza consenso non è ancora una richiesta condivisa', () => {
  const record = { legState: 'ready', airportMarsalaChoice: 'transfer', contactConsent: false, status: 'new' };
  assert.equal(sheetTransferRequestLabel(record), 'Consenso mancante');
  assert.equal(sheetTravelStatusLabel(record), 'Consenso transfer da confermare');
});

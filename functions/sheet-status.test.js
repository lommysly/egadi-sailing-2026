const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { sheetDate, sheetTimestamp, sheetTransferRequestLabel, sheetTravelStatusLabel } = require('./sheet-status');

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

// Il foglio lo legge una persona: "2026-10-08" si leggeva come 10 agosto.
test('nel foglio il giorno viene prima del mese', () => {
  assert.equal(sheetDate('2026-10-08'), '08/10/2026');
  assert.equal(sheetDate('2026-10-11'), '11/10/2026');
  // Vuoto resta vuoto, e un testo che non è una data non viene inventato.
  assert.equal(sheetDate(''), '');
  assert.equal(sheetDate(undefined), '');
  assert.equal(sheetDate('da definire'), 'da definire');
});

test('data e ora del foglio seguono l’orologio italiano, non UTC', () => {
  // Ora legale (UTC+2) e ora solare (UTC+1), compreso il cambio di giorno.
  assert.equal(sheetTimestamp(new Date('2026-09-30T10:21:30Z')), '30/09/2026 12:21');
  assert.equal(sheetTimestamp(new Date('2026-12-31T23:30:00Z')), '01/01/2027 00:30');
  // I record arrivano con un Timestamp di Firestore.
  assert.equal(sheetTimestamp({ toDate: () => new Date('2026-10-02T17:29:31Z') }), '02/10/2026 19:29');
  assert.equal(sheetTimestamp(null), '');
  assert.equal(sheetTimestamp('2026-10-02'), '');
});

test('le righe del foglio non ricevono più date anno-mese-giorno', () => {
  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  const human = source.slice(source.indexOf('function humanSheetRow('), source.indexOf('function technicalSheetRow('));
  assert.match(human, /sheetDate\(record\.date\)/);
  assert.match(human, /sheetDate\(record\.meetingDate\)/);
  assert.doesNotMatch(human, /record\.date \|\| ''/);
  const technical = source.slice(source.indexOf('function technicalSheetRow('), source.indexOf('let sheetTabsEnsuredFor'));
  assert.match(technical, /sheetTimestamp\(record\.updatedAt\)/);
  assert.doesNotMatch(technical, /toISOString/);
});

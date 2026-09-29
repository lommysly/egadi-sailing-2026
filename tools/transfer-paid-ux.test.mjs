import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const travelSource = readFileSync(new URL('../travel.js', import.meta.url), 'utf8');
const myAreaSource = readFileSync(new URL('../my-area.js', import.meta.url), 'utf8');
const publicHtml = readFileSync(new URL('../arrivi-partenze.html', import.meta.url), 'utf8');
const publicTranslations = readFileSync(new URL('../i18n-public-support.js', import.meta.url), 'utf8');

test('il modulo personale dichiara il costo prima e dopo la conferma', () => {
  assert.match(travelSource, /airportChoiceTransfer: 'Vorrei il transfer organizzato · servizio a pagamento'/);
  assert.match(travelSource, /Il transfer organizzato è un servizio a pagamento/);
  assert.match(travelSource, /The organised transfer is a paid service/);
  assert.match(travelSource, /paidServiceDetail = transferPriceNote\(terminalAirport\)/);
  assert.match(travelSource, /\$\{detail\} \$\{paidServiceDetail\}/);
  assert.match(travelSource, /String\(direction === 'return' \? leg\.originAirport \|\| '' : leg\.destinationAirport \|\| ''\)\.toUpperCase\(\)/);
});

test('prezzo mancante o aeroporto non valido usa il fallback e non la tariffa TPS', () => {
  assert.match(travelSource, /if \(!TERMINAL_AIRPORTS\.has\(terminalAirport\) \|\| !activeTransferPricing\) return fallback/);
  assert.match(travelSource, /terminalAirport === 'PMO'[\s\S]*pmoPricePerPersonCents[\s\S]*tpsPricePerPersonCents/);
  assert.match(travelSource, /if \(!Number\.isFinite\(perPersonCents\) \|\| perPersonCents <= 0\) return fallback/);
  assert.match(travelSource, /if \(!Number\.isInteger\(activeTransferPricing\.minimumBillablePersons\) \|\| activeTransferPricing\.minimumBillablePersons <= 0\) return fallback/);
});

test('la panoramica equipaggio mostra che il transfer richiesto è a pagamento', () => {
  assert.match(myAreaSource, /function crewTransferPaidNote\(\)/);
  assert.match(myAreaSource, /crewHasPaidTransferRequest\(\) \? crewTransferPaidNote\(\) : ''/);
  assert.match(myAreaSource, /events', 'egadi-2026', 'transferPricing', 'default'/);
  assert.match(myAreaSource, /Servizio a pagamento: Trapani/);
  assert.match(myAreaSource, /Paid service: Trapani/);
  assert.match(myAreaSource, /if \(!Number\.isInteger\(activeTransferPricing\?\.minimumBillablePersons\) \|\| activeTransferPricing\.minimumBillablePersons <= 0\) return fallback/);
  const stopStart = myAreaSource.indexOf('function stopDashboardSubscriptions()');
  const stopEnd = myAreaSource.indexOf('function startDashboardSubscriptions()', stopStart);
  assert.notEqual(stopStart, -1);
  assert.notEqual(stopEnd, -1);
  assert.doesNotMatch(myAreaSource.slice(stopStart, stopEnd), /activeTransferPricing = null/);
});

test('le pagine caricano gli script transfer con una versione nuova', () => {
  const travelHtml = readFileSync(new URL('../travel.html', import.meta.url), 'utf8');
  const myAreaHtml = readFileSync(new URL('../my-area.html', import.meta.url), 'utf8');
  assert.match(travelHtml, /travel\.js\?v=20260928-transfer-paid-v1/);
  assert.match(myAreaHtml, /my-area\.js\?v=20260929-skipper-transfer-lists-v2/);
  assert.match(publicHtml, /i18n-public-support\.js\?v=20260928-transfer-paid-v1/);
});

test('la pagina pubblica evidenzia il servizio a pagamento in italiano e inglese', () => {
  assert.match(publicHtml, /class="transfer-paid-notice"/);
  assert.match(publicHtml, /Il transfer organizzato è un servizio a pagamento/);
  assert.match(publicHtml, /La richiesta non genera un addebito automatico/);
  assert.match(publicTranslations, /paidTitle: 'The organised transfer is a paid service\.'/);
  assert.match(publicTranslations, /paidText: 'Submitting a request does not create an automatic charge\./);
});

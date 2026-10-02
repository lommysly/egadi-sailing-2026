import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { assertLoadsVersionedAsset, assertOneVersionPerAsset } from './asset-version-utils.mjs';

const travelSource = readFileSync(new URL('../travel.js', import.meta.url), 'utf8');
const myAreaSource = readFileSync(new URL('../my-area.js', import.meta.url), 'utf8');
const publicHtml = readFileSync(new URL('../arrivi-partenze.html', import.meta.url), 'utf8');
const publicTranslations = readFileSync(new URL('../i18n-public-support.js', import.meta.url), 'utf8');

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Marcatore iniziale non trovato: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Marcatore finale non trovato: ${endMarker}`);
  return source.slice(start, end);
}

test('il modulo personale dichiara il costo prima e dopo la conferma', () => {
  // Prima della conferma: la scelta e la nota esplicativa dicono già che si paga.
  assert.match(travelSource, /airportChoiceTransfer: '[^']*transfer organizzato · servizio a pagamento'/);
  assert.match(travelSource, /Il transfer organizzato è un servizio a pagamento/);
  assert.match(travelSource, /The organised transfer is a paid service/);

  // Dopo la conferma: il costo ricompare nel pannello di stato. Due assert
  // ricopiavano il codice carattere per carattere — `transferPriceNote(terminalAirport)`
  // e le due interpolazioni adiacenti `${detail} ${paidServiceDetail}`. Entrambe
  // le scritture sono cambiate per motivi legittimi (la nota ora dipende anche
  // dalla direzione, e fra le due interpolazioni è comparso l'orario di
  // ritrovo) senza che il comportamento protetto venisse meno. Il controllo è
  // ora circoscritto al renderer e verifica la sostanza: la nota di costo è
  // calcolata dall'aeroporto terminale giusto e finisce davvero nel markup
  // mostrato all'utente.
  const progressRenderer = sourceBetween(travelSource, 'function renderTransferProgress(', '\nfunction ');
  assert.match(
    progressRenderer,
    /const terminalAirport = String\(direction === 'return' \? leg\.originAirport \|\| '' : leg\.destinationAirport \|\| ''\)\.toUpperCase\(\)/,
  );
  assert.match(progressRenderer, /const paidServiceDetail = transferPriceNote\(terminalAirport\b/);
  assert.match(progressRenderer, /target\.innerHTML = `[^`]*\$\{paidServiceDetail\}[^`]*`/);
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

// Il test si chiamava "…con una versione nuova" ma confrontava tre stringhe di
// versione fissate a mano: diceva "la versione è quella del 28/9", che è
// l'opposto di "è nuova", e andava riscritto a ogni applicazione della regola
// 10 di AGENTS.md. Nessun test può sapere quale sia la versione giusta oggi;
// può però garantire le due condizioni che rendono la regola efficace — i tre
// script che portano il messaggio "servizio a pagamento" sono caricati con un
// `?v=`, e chi carica lo stesso file lo fa con la stessa stringa ovunque (un
// aggiornamento applicato solo su alcune pagine è l'incidente del 22/9/2026).
test('le pagine caricano gli script transfer versionati e allineati fra loro', () => {
  const travelHtml = readFileSync(new URL('../travel.html', import.meta.url), 'utf8');
  const myAreaHtml = readFileSync(new URL('../my-area.html', import.meta.url), 'utf8');
  assertLoadsVersionedAsset(assert, travelHtml, 'travel.js', 'travel.html');
  assertLoadsVersionedAsset(assert, myAreaHtml, 'my-area.js', 'my-area.html');
  assertLoadsVersionedAsset(assert, publicHtml, 'i18n-public-support.js', 'arrivi-partenze.html');
  assertOneVersionPerAsset(assert);
});

test('la pagina pubblica evidenzia il servizio a pagamento in italiano e inglese', () => {
  assert.match(publicHtml, /class="transfer-paid-notice"/);
  assert.match(publicHtml, /Il transfer organizzato è un servizio a pagamento/);
  assert.match(publicHtml, /La richiesta non genera un addebito automatico/);
  assert.match(publicTranslations, /paidTitle: 'The organised transfer is a paid service\.'/);
  assert.match(publicTranslations, /paidText: 'Submitting a request does not create an automatic charge\./);
});

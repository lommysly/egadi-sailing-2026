import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { assertLoadsVersionedAsset } from './asset-version-utils.mjs';

const html = await readFile(new URL('../transfer.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../transfer.js', import.meta.url), 'utf8');

test('la pagina usa card compatte con la stessa larghezza massima su desktop e mobile', () => {
  // La larghezza massima non è più ricopiata a mano ("320px") in due punti
  // diversi: si leggono i due valori reali, quello della griglia desktop e
  // quello della colonna singola sotto 800px, e si verifica che coincidano.
  // È letteralmente ciò che il titolo del test promette, e regge un cambio di
  // misura fallendo solo se le due viste divergono davvero.
  const desktopGrid = html.match(
    /\.transfer-operator-list \{[^}]*grid-template-columns:repeat\(auto-fill,minmax\(\d+px,(\d+px)\)\)/,
  );
  assert.ok(desktopGrid, 'la lista transfer non usa più una griglia auto-fill con larghezza massima per card');
  const mobileGrid = html.match(
    /@media \(max-width:800px\)[\s\S]*?\.transfer-operator-list \{ grid-template-columns:minmax\(0,(\d+px)\); \}/,
  );
  assert.ok(mobileGrid, 'sotto 800px la lista transfer non collassa più su una colonna con larghezza massima');
  assert.equal(mobileGrid[1], desktopGrid[1], 'desktop e mobile non usano la stessa larghezza massima per le card');

  // Una card aperta deve occupare tutta la riga, altrimenti il dettaglio resta
  // schiacciato nella colonna da 320px. Il selettore che porta questa regola è
  // cambiato quando le card sono state avvolte in `.transfer-record-row` per la
  // selezione multipla: il test ora verifica la regola e il contesto in cui si
  // applica, non il nome del contenitore che la ospita.
  assert.match(html, /\.transfer-operator-list > [^{]*\.transfer-record\[open\][^{]*\{ grid-column:1 \/ -1; \}/);
  assert.match(html, /\.transfer-operator-list > \.[a-z-]+ \{ margin-bottom:0;/);
});

test('la vista rende data, aeroporto e persone dalla timeline operativa', () => {
  assert.match(source, /groupTransferRecords\(records, direction\)/);
  assert.match(source, /class="transfer-date-group"/);
  assert.match(source, /renderAirportGroupBody\(records, direction\)/);
});

// Il controllo sul `?v=` di transfer.js stava in coda al test qui sopra, con la
// stringa `20260929-transfer-status-whatsapp-v3` scritta a mano: faceva fallire
// un test sul raggruppamento dei record ogni volta che transfer.js veniva
// aggiornato come prescrive la regola 10 di AGENTS.md. È staccato qui e
// riformulato sulla forma del riferimento, che è la cosa che protegge davvero
// l'utente: la pagina non deve caricare il suo script senza versione.
test('la pagina transfer carica il suo script con una stringa di versione', () => {
  assertLoadsVersionedAsset(assert, html, 'transfer.js', 'transfer.html');
});

test('ogni card mantiene lo stato leggibile anche attraverso il colore di sfondo', () => {
  for (const status of ['draft', 'new', 'planned', 'confirmed', 'completed', 'cancelled']) {
    assert.match(html, new RegExp(`\\.transfer-record--${status} \\{ --transfer-card-bg:#[0-9a-f]{6}; --transfer-card-border:#[0-9a-f]{6}; \\}`));
    assert.match(html, new RegExp(`\\.transfer-badge--${status}`));
  }
  assert.match(source, /class="transfer-record transfer-record--\$\{escapeHtml\(displayStatus\)\}"/);
  assert.match(source, /transfer-badge--\$\{escapeHtml\(displayStatus\)\}/);
});

test('la card espone un contatto WhatsApp diretto solo con un numero valido', () => {
  assert.match(source, /function whatsappMessage\(record\)/);
  assert.match(source, /digits\.length < 8 \|\| digits\.length > 15/);
  assert.match(source, /class="button button-whatsapp transfer-whatsapp-action"/);
  assert.match(source, /https:\/\/wa\.me\/\$\{digits\}\$\{query\}/);
});

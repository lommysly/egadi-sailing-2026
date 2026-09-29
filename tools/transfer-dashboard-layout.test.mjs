import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../transfer.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../transfer.js', import.meta.url), 'utf8');

test('la pagina usa card compatte con la stessa larghezza massima su desktop e mobile', () => {
  assert.match(html, /grid-template-columns:repeat\(auto-fill,minmax\(280px,320px\)\)/);
  assert.match(html, /\.transfer-record\[open\] \{ grid-column:1 \/ -1; \}/);
  assert.match(html, /@media \(max-width:800px\)[\s\S]*\.transfer-operator-list \{ grid-template-columns:minmax\(0,320px\); \}/);
  assert.match(html, /\.transfer-operator-list > \.transfer-record \{ margin-bottom:0; \}/);
});

test('la vista rende data, aeroporto e persone dalla timeline operativa', () => {
  assert.match(source, /groupTransferRecords\(records, direction\)/);
  assert.match(source, /class="transfer-date-group"/);
  assert.match(source, /renderAirportGroupBody\(records, direction\)/);
  assert.match(html, /transfer\.js\?v=20260929-transfer-status-whatsapp-v3/);
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

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
  assert.match(html, /transfer\.js\?v=20260929-transfer-timeline-v1/);
});

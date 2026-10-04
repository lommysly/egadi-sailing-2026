import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { rosterEntries, rosterHeading, rosterMarkup } from '../boat-roster.js';

// "Arrivi e partenze della tua barca" è la stessa sezione per lo skipper e per
// l'equipaggio. Due elenchi scritti separatamente avrebbero finito per
// mostrare la stessa barca in due modi: per questo il modulo è uno, e questi
// test lo provano davvero invece di cercarne il testo nei sorgenti.

const BARCA = [
  { id: 'c', displayName: 'Fabio', outboundDate: '2026-10-08', outboundTime: '13:15', outboundTransport: 'flight', outboundTransfer: 'requested', returnDate: '2026-10-12', returnTime: '07:50', returnTransport: 'flight' },
  { id: 'skipper', inviteId: 'skipper', isSkipper: true, displayName: 'Silvio', outboundDate: '2026-10-07', outboundTime: '20:05', outboundTransport: 'flight', outboundTransfer: 'requested' },
  { id: 'a', displayName: 'Carla', outboundDate: '2026-10-07', outboundTime: '17:30', outboundTransport: 'flight' },
  { id: 'z', displayName: 'Nessuno', outbound: 'draft' },
  { id: 'senza-nome', outboundDate: '2026-10-06' },
];

test('in cima chi arriva prima, perché è quello che apre la barca', () => {
  assert.deepEqual(rosterEntries(BARCA).map((v) => v.displayName), ['Carla', 'Silvio', 'Fabio', 'Nessuno']);
});

test('chi non ha un nome non compare, chi non ha orari resta in fondo', () => {
  const nomi = rosterEntries(BARCA).map((v) => v.displayName);
  assert.equal(nomi.includes(undefined), false);
  assert.equal(nomi.at(-1), 'Nessuno');
});

test('lo skipper è marcato, e ognuno riconosce la propria riga', () => {
  const perEquipaggio = rosterMarkup(BARCA, { currentId: 'a' });
  assert.match(perEquipaggio, /boat-roster-row--skipper/);
  assert.equal((perEquipaggio.match(/sei tu/g) || []).length, 1);
  assert.match(perEquipaggio, /Carla<\/strong>\s*<small>sei tu<\/small>/);

  const perSkipper = rosterMarkup(BARCA, { currentId: 'skipper' });
  assert.match(perSkipper, /boat-roster-row--skipper boat-roster-row--io/);
});

test('si legge chi è sul pulmino e con che mezzo arriva', () => {
  const html = rosterMarkup(BARCA, { currentId: '' });
  assert.match(html, /mer 7 ott · 17:30/);
  assert.match(html, /<small>volo<\/small>/);
  assert.equal((html.match(/col transfer/g) || []).length, 2);
});

test('un orario che manca è un’informazione, non un allarme', () => {
  const html = rosterMarkup([{ id: 'x', displayName: 'Gaia', returnDate: '2026-10-11', returnTime: '20:35' }]);
  assert.match(html, /boat-roster-leg--unknown">Arriva: non comunicato/);
  assert.doesNotMatch(html, /!|attenzione|manca/i);
});

test('i nomi non possono iniettare markup', () => {
  const html = rosterMarkup([{ id: 'x', displayName: '<img src=x onerror=alert(1)>', outboundDate: '2026-10-08' }]);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test('in inglese cambia la lingua, non l’ordine', () => {
  const html = rosterMarkup(BARCA, { currentId: 'a', english: true });
  assert.match(html, /Arrives/);
  assert.match(html, /on the shuttle/);
  assert.match(html, /that is you/);
});

test('titolo e spiegazione sono gli stessi dalle due parti', () => {
  const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
  assert.equal(rosterHeading(false).title, 'Arrivi e partenze della tua barca');
  ['area.js', 'my-area.js'].forEach((file) => {
    const source = read(file);
    assert.match(source, /from '\.\/boat-roster\.js/, `${file} non usa l'elenco condiviso`);
    assert.match(source, /rosterHeading\(/, `${file} scrive un titolo suo`);
    assert.match(source, /rosterMarkup\(/, `${file} disegna l'elenco da sé`);
  });
});

test('una barca senza viaggi non mostra un elenco vuoto senza spiegazione', () => {
  assert.match(rosterMarkup([]), /Nessuno ha ancora comunicato/);
});

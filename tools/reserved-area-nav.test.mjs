import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { simplifyReservedAreaNavigation } from '../reserved-area-nav.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
// I commenti nominano la promo per spiegare perché non c'è più: è il codice
// che non deve contenerla, non la memoria di com'era.
const senzaCommenti = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const nav = read('reserved-area-nav.js');
const navCode = senzaCommenti(nav);

// Fino al 2/10/2026 questo modulo appendeva in fondo a ogni area riservata il
// riquadro "Diventa Beta tester" di That's A Blast. Silvio lo ha fatto
// togliere: chi è dentro sta compilando un viaggio o sistemando l'equipaggio,
// e due link che portano fuori sito sono solo un modo per perdere il lavoro a
// metà. Questi test tengono il confine: niente promo dentro, promo fuori.

test('l’area riservata non contiene nessun invito alla Beta', () => {
  assert.doesNotMatch(navCode, /blast-experience/i);
  assert.doesNotMatch(navCode, /Beta tester/i);
  assert.doesNotMatch(navCode, /thatsablast\.it/);
  assert.doesNotMatch(navCode, /insertBlastExperience|blastExperienceMarkup/);
});

test('nessuna area riservata rimanda fuori sito', () => {
  ['area.js', 'my-area.js', 'transfer.js', 'travel.js', 'participant.js', 'crew-session.js', 'crew-login.js'].forEach((file) => {
    const source = read(file);
    // Gli import citano reserved-area-nav.js?v=…-blast-experience-v1: è solo
    // la stringa di versione, non un link. Qui cerchiamo i link veri.
    assert.doesNotMatch(senzaCommenti(source), /https:\/\/thatsablast\.it/, `${file} rimanda fuori sito`);
  });
});

test('gli stili della promo privata non restano a pesare nel CSS', () => {
  assert.doesNotMatch(read('styles.css'), /\.blast-experience/);
});

test('la promo resta sulla home pubblica, dove ha senso', () => {
  const home = read('index.html');
  assert.match(home, /class="section callout callout-blast"/);
  assert.match(home, /https:\/\/thatsablast\.it\/beta#form/);
  assert.match(read('styles.css'), /\.callout-blast/);
});

test('il modulo continua a fare le due cose per cui esiste', () => {
  // Menu ridotto alla sola uscita verso il sito pubblico...
  assert.match(nav, /reservedAreaSimplified/);
  assert.match(nav, /Sito pubblico/);
  // ...e piede di pagina pubblico nascosto, perché i suoi link con lo stesso
  // nome delle sezioni private facevano uscire dall'area per sbaglio.
  assert.match(nav, /\.site-footer'\)\?\.setAttribute\('hidden', ''\)/);
  assert.equal(typeof simplifyReservedAreaNavigation, 'function');
});

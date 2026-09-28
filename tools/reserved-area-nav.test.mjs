import assert from 'node:assert/strict';
import test from 'node:test';
import { blastExperienceMarkup } from '../reserved-area-nav.js';

test('il modulo privato racconta esplicitamente che Egadi è un Blast', () => {
  const markup = blastExperienceMarkup('it');

  assert.match(markup, /Egadi è un Blast/);
  assert.match(markup, /That’s A Blast/);
  assert.match(markup, /https:\/\/thatsablast\.it\/beta#form/);
  assert.match(markup, /Diventa Beta tester/);
  assert.equal((markup.match(/target="_blank"/g) || []).length, 2);
});

test('il modulo privato conserva una versione inglese editoriale', () => {
  const markup = blastExperienceMarkup('en');

  assert.match(markup, /Egadi is a Blast/);
  assert.match(markup, /Become a Beta tester/);
  assert.match(markup, /Discover That’s A Blast/);
});

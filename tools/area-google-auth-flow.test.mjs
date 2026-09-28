import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('l’area skipper usa un solo accesso Google popup, senza redirect mobile', async () => {
  const [script, page] = await Promise.all([
    readFile(new URL('../area.js', import.meta.url), 'utf8'),
    readFile(new URL('../area.html', import.meta.url), 'utf8'),
  ]);

  assert.match(script, /signInWithPopup\(auth, provider\)/);
  assert.doesNotMatch(script, /signInWithRedirect/);
  assert.doesNotMatch(script, /getRedirectResult/);
  assert.doesNotMatch(script, /shouldUseGoogleRedirect/);
  assert.match(page, /area\.js\?v=20260928-skipper-categories-v1/);
  assert.doesNotMatch(page, /signInRedirectButton/);
});

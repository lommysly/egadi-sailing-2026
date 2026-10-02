import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { assertLoadsVersionedAsset } from './asset-version-utils.mjs';

const page = await readFile(new URL('../area.html', import.meta.url), 'utf8');

test('l’area skipper usa un solo accesso Google popup, senza redirect mobile', async () => {
  const script = await readFile(new URL('../area.js', import.meta.url), 'utf8');

  assert.match(script, /signInWithPopup\(auth, provider\)/);
  assert.doesNotMatch(script, /signInWithRedirect/);
  assert.doesNotMatch(script, /getRedirectResult/);
  assert.doesNotMatch(script, /shouldUseGoogleRedirect/);
  assert.doesNotMatch(page, /signInRedirectButton/);
});

// Il controllo sul `?v=` stava dentro il test qui sopra, fissato sulla stringa
// `area.js?v=20260929-skipper-transfer-lists-v2`: faceva fallire un test sul
// flusso di accesso per un motivo che con l'accesso non c'entra nulla, e
// scadeva al primo aggiornamento legittimo della versione (regola 10 di
// AGENTS.md). È staccato qui e ridotto a ciò che conta davvero: il flusso
// popup vive in area.js, quindi la pagina non deve mai caricarlo senza una
// stringa di versione, altrimenti chi ha già visitato il sito continuerebbe a
// ricevere dalla cache la vecchia versione con il redirect.
test('area.html carica area.js con una stringa di versione', () => {
  assertLoadsVersionedAsset(assert, page, 'area.js', 'area.html');
});

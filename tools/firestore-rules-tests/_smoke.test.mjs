import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-sailing-2026',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

test.after(async () => {
  await testEnv?.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

test('smoke: un utente non autenticato non può leggere events/egadi-2026', async () => {
  const unauth = testEnv.unauthenticatedContext();
  await assertFails(getDoc(doc(unauth.firestore(), 'events/egadi-2026')));
});

test('smoke: area chiusa nega la lettura anche all’organizzatore; aperta la consente', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'events/egadi-2026'), { privateAreaEnabled: false, organizerIds: ['ORGANIZER_A'] });
  });
  const organizer = testEnv.authenticatedContext('ORGANIZER_A', { firebase: { sign_in_provider: 'google.com' } });
  // isPrivateAreaOpen() è nel percorso di "allow read" dell'evento stesso:
  // con privateAreaEnabled:false anche l'organizzatore è negato ("Nega tutto",
  // vedi riga "Area privata chiusa" della matrice).
  await assertFails(getDoc(doc(organizer.firestore(), 'events/egadi-2026')));
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'events/egadi-2026'), { privateAreaEnabled: true, organizerIds: ['ORGANIZER_A'] });
  });
  const snap = await assertSucceeds(getDoc(doc(organizer.firestore(), 'events/egadi-2026')));
  assert.equal(snap.data().privateAreaEnabled, true);
});

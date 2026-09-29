// list su boats/{boatId}: solo l'organizzatore, per costruire il riepilogo
// transfer per barca senza conoscere in anticipo ogni boatId. Vedi
// FIRESTORE_RULES_TEST_MATRIX.md, riga "Elenco barche (list)".

import test from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import {
  SKIPPER_A,
  crewAContext,
  eventDocData,
  organizerContext,
  outsiderContext,
  skipperContext,
} from './identities.mjs';

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-boats-list',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});

test.after(async () => {
  await testEnv?.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedEventAndBoat() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData());
    await setDoc(doc(ctx.firestore(), 'boats', SKIPPER_A), {
      name: 'Barca Fittizia',
      skipperId: SKIPPER_A,
      eventId: 'egadi-2026',
      capacity: 8,
      totalBerths: 9,
    });
  });
}

test('elenco barche: l’organizzatore può fare list su boats', async () => {
  await seedEventAndBoat();
  const organizer = organizerContext(testEnv);
  await assertSucceeds(getDocs(collection(organizer.firestore(), 'boats')));
});

test('elenco barche: skipper, equipaggio e outsider non possono fare list su boats', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv);
  const crew = crewAContext(testEnv);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDocs(collection(skipper.firestore(), 'boats')));
  await assertFails(getDocs(collection(crew.firestore(), 'boats')));
  await assertFails(getDocs(collection(outsider.firestore(), 'boats')));
});

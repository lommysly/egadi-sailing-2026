// Test delle Security Rules per la vetrina pubblica della flotta
// (events/egadi-2026/publicFleet/{publicId}). Vedi FIRESTORE_RULES_TEST_MATRIX.md,
// riga "Vetrina pubblica flotta".
//
// Nomi di campi verificati con grep su firestore.rules prima di scrivere
// questi test (hasValidPublicFleetProfile, isPublicFleetOwner,
// matchesPrivateFleetBoat, isPublicFleetEnabled).
//
// Copre in particolare la correzione del 30/09/2026: showAvailability non è
// più un'opt-out dello skipper (una barca registrata per l'evento fa parte
// della flotta e i suoi posti liberi devono sempre essere pubblici).

import test from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
  SKIPPER_A, organizerContext, skipperContext, outsiderContext,
  eventDocData, boatDocData,
} from './identities.mjs';

const PUBLIC_ID_A = 'e'.repeat(48);

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-public-fleet',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});
test.after(async () => { await testEnv?.cleanup(); });
test.beforeEach(async () => { await testEnv.clearFirestore(); });

async function seedEventOpen(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData(overrides));
  });
}

async function seedBoatAndOwner(boatOverrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'boats/SKIPPER_A'), boatDocData({
      publicFleetId: PUBLIC_ID_A,
      capacity: 8,
      ...boatOverrides,
    }));
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026/publicFleetOwners', PUBLIC_ID_A), { skipperId: SKIPPER_A });
  });
}

function validPublicFleetPayload(overrides = {}) {
  return {
    name: 'Karibu di test', model: 'Isla 40 di test', boatType: 'Catamarano',
    skipperName: 'Skipper di test', capacity: 8,
    showAvailability: true, availableSeats: 3, berthPreference: 'not_specified',
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

test('vetrina flotta: SKIPPER_A pubblica il proprio profilo con showAvailability true', async () => {
  await seedEventOpen();
  await seedBoatAndOwner();
  const skipper = skipperContext(testEnv);
  await assertSucceeds(setDoc(doc(skipper.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A), validPublicFleetPayload()));
});

test('vetrina flotta: SKIPPER_A aggiorna il proprio profilo gia pubblicato', async () => {
  await seedEventOpen();
  await seedBoatAndOwner();
  const skipper = skipperContext(testEnv);
  const ref = doc(skipper.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A);
  await assertSucceeds(setDoc(ref, validPublicFleetPayload()));
  await assertSucceeds(setDoc(ref, validPublicFleetPayload({ availableSeats: 1 })));
});

test('vetrina flotta: creazione negata con showAvailability false (niente piu opt-out, richiesta di Silvio 30/09/2026)', async () => {
  await seedEventOpen();
  await seedBoatAndOwner();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A),
    validPublicFleetPayload({ showAvailability: false, availableSeats: null, berthPreference: 'not_specified' }),
  ));
});

test('vetrina flotta: creazione negata con availableSeats assente', async () => {
  await seedEventOpen();
  await seedBoatAndOwner();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A),
    validPublicFleetPayload({ availableSeats: null }),
  ));
});

test('vetrina flotta: creazione negata con availableSeats superiore alla capienza', async () => {
  await seedEventOpen();
  await seedBoatAndOwner();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A),
    validPublicFleetPayload({ availableSeats: 99 }),
  ));
});

test('vetrina flotta: creazione negata da chi non e il proprietario tecnico dellID pubblico', async () => {
  await seedEventOpen();
  await seedBoatAndOwner();
  const outsider = outsiderContext(testEnv);
  await assertFails(setDoc(doc(outsider.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A), validPublicFleetPayload()));
});

test('vetrina flotta: creazione negata se i dati non combaciano con la barca privata', async () => {
  await seedEventOpen();
  await seedBoatAndOwner();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A),
    validPublicFleetPayload({ name: 'Nome diverso dalla barca privata' }),
  ));
});

test('vetrina flotta: get negato senza publicFleetEnabled anche se autenticati', async () => {
  await seedEventOpen(); // publicFleetEnabled: false di default
  await seedBoatAndOwner();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A), validPublicFleetPayload({ updatedAt: Timestamp.now() }));
  });
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A)));
});

test('vetrina flotta: get e list pubblici, anche senza login, quando publicFleetEnabled e true', async () => {
  await seedEventOpen({ publicFleetEnabled: true });
  await seedBoatAndOwner();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A), validPublicFleetPayload({ updatedAt: Timestamp.now() }));
  });
  const anon = testEnv.unauthenticatedContext();
  await assertSucceeds(getDoc(doc(anon.firestore(), 'events/egadi-2026/publicFleet', PUBLIC_ID_A)));
  await assertSucceeds(getDocs(collection(anon.firestore(), 'events/egadi-2026/publicFleet')));
});

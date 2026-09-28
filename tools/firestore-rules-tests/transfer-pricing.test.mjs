// Prezzo del transfer aeroporto <-> Marsala: leggibile da chiunque abbia
// superato l'accesso privato, scrivibile solo dall'organizzatore.
// Vedi FIRESTORE_RULES_TEST_MATRIX.md, riga "Prezzo transfer".

import test from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  CREW_A,
  ORGANIZER_A,
  OUTSIDER_A,
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
    projectId: 'egadi-rules-transfer-pricing',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});

test.after(async () => {
  await testEnv?.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

const PRICING_PATH = 'events/egadi-2026/transferPricing/default';

function validPricingPayload(overrides = {}) {
  return {
    tpsPricePerPersonCents: 1000,
    pmoPricePerPersonCents: 2000,
    minimumBillablePersons: 3,
    updatedAt: serverTimestamp(),
    updatedBy: ORGANIZER_A,
    ...overrides,
  };
}

async function seedEvent() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData());
  });
}

async function seedPricing() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), PRICING_PATH), validPricingPayload());
  });
}

test('prezzo transfer: l’organizzatore può crearlo con lo schema corretto', async () => {
  await seedEvent();
  const organizer = organizerContext(testEnv);
  await assertSucceeds(setDoc(doc(organizer.firestore(), PRICING_PATH), validPricingPayload()));
});

test('prezzo transfer: l’organizzatore non può salvare un campo extra, un prezzo negativo o un minimo sotto 1', async () => {
  await seedEvent();
  const organizer = organizerContext(testEnv);
  await assertFails(setDoc(doc(organizer.firestore(), PRICING_PATH), { ...validPricingPayload(), extraField: 'no' }));
  await assertFails(setDoc(doc(organizer.firestore(), PRICING_PATH), validPricingPayload({ tpsPricePerPersonCents: -100 })));
  await assertFails(setDoc(doc(organizer.firestore(), PRICING_PATH), validPricingPayload({ minimumBillablePersons: 0 })));
});

test('prezzo transfer: skipper, equipaggio e outsider non possono scriverlo', async () => {
  await seedEvent();
  const skipper = skipperContext(testEnv);
  const crew = crewAContext(testEnv);
  const outsider = outsiderContext(testEnv);
  await assertFails(setDoc(doc(skipper.firestore(), PRICING_PATH), validPricingPayload({ updatedBy: SKIPPER_A })));
  await assertFails(setDoc(doc(crew.firestore(), PRICING_PATH), validPricingPayload({ updatedBy: CREW_A })));
  await assertFails(setDoc(doc(outsider.firestore(), PRICING_PATH), validPricingPayload({ updatedBy: OUTSIDER_A })));
});

test('prezzo transfer: skipper ed equipaggio possono leggerlo, un utente non autenticato no', async () => {
  await seedEvent();
  await seedPricing();
  const skipper = skipperContext(testEnv);
  const crew = crewAContext(testEnv);
  const unauth = testEnv.unauthenticatedContext();
  await assertSucceeds(getDoc(doc(skipper.firestore(), PRICING_PATH)));
  await assertSucceeds(getDoc(doc(crew.firestore(), PRICING_PATH)));
  await assertFails(getDoc(doc(unauth.firestore(), PRICING_PATH)));
});

test('prezzo transfer: nessuno può eliminarlo dal client', async () => {
  await seedEvent();
  await seedPricing();
  const organizer = organizerContext(testEnv);
  await assertFails(deleteDoc(doc(organizer.firestore(), PRICING_PATH)));
});

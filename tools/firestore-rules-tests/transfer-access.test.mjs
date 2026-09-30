// Accesso transfer: credenziali create dalla regia, nessuna auto-richiesta.
// Vedi FIRESTORE_RULES_TEST_MATRIX.md, riga "Accessi transfer".

import test from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import {
  CREW_A,
  CREW_A_EMAIL,
  ORGANIZER_A,
  OUTSIDER_A,
  crewAContext,
  eventDocData,
  organizerContext,
  outsiderContext,
} from './identities.mjs';

const OPERATOR_A = 'TRANSFER_OPERATOR_A';
const OPERATOR_A_EMAIL = 'transfer@example.test';
const LEGACY_GOOGLE_A = 'LEGACY_GOOGLE_A';

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-transfer-access',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});

test.after(async () => {
  await testEnv?.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

function operatorContext() {
  return testEnv.authenticatedContext(OPERATOR_A, {
    firebase: { sign_in_provider: 'password' },
    email: OPERATOR_A_EMAIL,
  });
}

function legacyGoogleContext() {
  return testEnv.authenticatedContext(LEGACY_GOOGLE_A, {
    firebase: { sign_in_provider: 'google.com' },
  });
}

// Stesso UID del referente password, ma sign_in_provider "custom": è
// esattamente la sessione che nasce da impersonateTransferOperator, quando
// l'organizzatore entra come questo referente per vedere cosa vede lui.
function impersonatedOperatorContext() {
  return testEnv.authenticatedContext(OPERATOR_A, {
    firebase: { sign_in_provider: 'custom' },
    email: OPERATOR_A_EMAIL,
  });
}

function customProviderOutsiderContext() {
  return testEnv.authenticatedContext(OUTSIDER_A, {
    firebase: { sign_in_provider: 'custom' },
    email: 'outsider@example.test',
  });
}

async function seedEvent() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData());
  });
}

async function seedManagedOperator() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `events/egadi-2026/transferOperators/${OPERATOR_A}`), {
      role: 'transfer_operator',
      name: 'Referente transfer',
      email: OPERATOR_A_EMAIL,
      active: true,
      accessMode: 'managed_password',
      authProvider: 'password',
    });
  });
}

async function seedLegacyGoogleOperator() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `events/egadi-2026/transferOperators/${LEGACY_GOOGLE_A}`), {
      role: 'transfer_operator',
      name: 'Vecchio Google',
      email: 'legacy@example.test',
      active: true,
    });
  });
}

async function seedTransferRecord() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026/transferOpsRecords/record-a'), {
      recordState: 'active',
      status: 'new',
      participantName: 'Partecipante fittizio',
    });
  });
}

function accessRequestPayload(email) {
  return {
    name: 'Richiesta fittizia',
    email,
  };
}

test('accesso transfer: un account equipaggio non può inviare una richiesta', async () => {
  await seedEvent();
  const crew = crewAContext(testEnv);
  await assertFails(setDoc(
    doc(crew.firestore(), `events/egadi-2026/transferAccessRequests/${CREW_A}`),
    accessRequestPayload(CREW_A_EMAIL),
  ));
});

test('accesso transfer: un Google esterno non può inviare una richiesta', async () => {
  await seedEvent();
  const outsider = outsiderContext(testEnv);
  await assertFails(setDoc(
    doc(outsider.firestore(), `events/egadi-2026/transferAccessRequests/${OUTSIDER_A}`),
    accessRequestPayload('outsider@example.test'),
  ));
});

test('accesso transfer: l’organizzatore può rimuovere una richiesta storica ma non creare ruoli dal browser', async () => {
  await seedEvent();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `events/egadi-2026/transferAccessRequests/${CREW_A}`), accessRequestPayload(CREW_A_EMAIL));
  });
  const organizer = organizerContext(testEnv);
  await assertSucceeds(deleteDoc(doc(organizer.firestore(), `events/egadi-2026/transferAccessRequests/${CREW_A}`)));
  await assertFails(setDoc(doc(organizer.firestore(), `events/egadi-2026/transferOperators/${OPERATOR_A}`), {
    role: 'transfer_operator',
    name: 'Tentativo client',
    email: OPERATOR_A_EMAIL,
    active: true,
    accessMode: 'managed_password',
    authProvider: 'password',
  }));
});

test('accesso transfer: solo il referente password creato dalla regia legge la coda', async () => {
  await seedEvent();
  await seedManagedOperator();
  await seedTransferRecord();
  const operator = operatorContext();
  const crew = crewAContext(testEnv);
  const outsider = outsiderContext(testEnv);
  const recordPath = 'events/egadi-2026/transferOpsRecords/record-a';
  await assertSucceeds(getDoc(doc(operator.firestore(), recordPath)));
  await assertFails(getDoc(doc(crew.firestore(), recordPath)));
  await assertFails(getDoc(doc(outsider.firestore(), recordPath)));
});

test('accesso transfer: un vecchio ruolo Google non legge più la coda', async () => {
  await seedEvent();
  await seedLegacyGoogleOperator();
  await seedTransferRecord();
  const legacyGoogle = legacyGoogleContext();
  await assertFails(getDoc(doc(legacyGoogle.firestore(), 'events/egadi-2026/transferOpsRecords/record-a')));
});

test('accesso transfer: l’organizzatore impersonato (sign_in_provider custom) legge la coda come il referente', async () => {
  await seedEvent();
  await seedManagedOperator();
  await seedTransferRecord();
  const impersonated = impersonatedOperatorContext();
  await assertSucceeds(getDoc(doc(impersonated.firestore(), 'events/egadi-2026/transferOpsRecords/record-a')));
});

test('accesso transfer: sign_in_provider custom da solo non basta senza un documento operatore valido', async () => {
  await seedEvent();
  await seedTransferRecord();
  const outsider = customProviderOutsiderContext();
  await assertFails(getDoc(doc(outsider.firestore(), 'events/egadi-2026/transferOpsRecords/record-a')));
});

// Accesso transfer: credenziali create dalla regia, nessuna auto-richiesta.
// Vedi FIRESTORE_RULES_TEST_MATRIX.md, riga "Accessi transfer".

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
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

// Rispecchia il documento vero come lo scrive sempre materializeCrewTravel
// (safeOperationalFields): ogni campo operativo esiste già, anche se vuoto,
// non manca mai nulla come nel seed minimale sopra.
async function seedRealisticTransferRecord(recordId) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `events/egadi-2026/transferOpsRecords/${recordId}`), {
      recordState: 'active',
      status: 'new',
      participantName: 'Partecipante fittizio',
      assignedOperatorUid: '',
      groupName: '',
      meetingPoint: '',
      meetingTime: '',
      vehicleName: '',
      operatorNotes: '',
    });
  });
}

function accessRequestPayload(email) {
  return {
    name: 'Richiesta fittizia',
    email,
  };
}

for (const role of ['organizer', 'operator']) {
  test(`accompagnatori: ${role} salva +2 su un record legacy e può correggerlo`, async () => {
    await seedEvent();
    await seedManagedOperator();
    await seedRealisticTransferRecord('party');
    const context = role === 'organizer' ? organizerContext(testEnv) : operatorContext();
    const uid = role === 'organizer' ? ORGANIZER_A : OPERATOR_A;
    const ref = doc(context.firestore(), 'events/egadi-2026/transferOpsRecords/party');
    const metadata = { assignedOperatorUid: uid, updatedBy: uid, updatedAt: serverTimestamp() };
    await assertSucceeds(updateDoc(ref, { ...metadata, additionalPassengers: 2 }));
    assert.equal((await getDoc(ref)).data().additionalPassengers, 2);
    await assertSucceeds(updateDoc(ref, { ...metadata, additionalPassengers: 0 }));
    // Il batch esistente non manda il nuovo campo: non deve cancellarlo.
    await assertSucceeds(updateDoc(ref, { ...metadata, additionalPassengers: 1 }));
    await assertSucceeds(updateDoc(ref, { ...metadata, status: 'confirmed' }));
    assert.equal((await getDoc(ref)).data().additionalPassengers, 1);
  });
}

test('accompagnatori: rifiuta valori invalidi, modifiche di identità e accessi esterni', async () => {
  await seedEvent();
  await seedManagedOperator();
  await seedRealisticTransferRecord('party');
  const operator = operatorContext();
  const ref = doc(operator.firestore(), 'events/egadi-2026/transferOpsRecords/party');
  const metadata = { assignedOperatorUid: OPERATOR_A, updatedBy: OPERATOR_A, updatedAt: serverTimestamp() };
  for (const value of [-1, 9, 1.5, '2', null, true]) {
    await assertFails(updateDoc(ref, { ...metadata, additionalPassengers: value }));
  }
  await assertFails(updateDoc(ref, { ...metadata, additionalPassengers: 2, participantName: 'Identità cambiata' }));
  for (const context of [crewAContext(testEnv), outsiderContext(testEnv)]) {
    await assertFails(updateDoc(doc(context.firestore(), 'events/egadi-2026/transferOpsRecords/party'), { ...metadata, additionalPassengers: 2 }));
  }
});

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

// La selezione multipla (transfer.js, applyBulkUpdate) lascia fuori dal
// payload ogni campo che l'operatore non ha compilato, per non sovrascrivere
// dati già diversi persona per persona — a differenza del salvataggio
// singolo (saveRecord) che invece li scrive sempre tutti. Verifica che le
// Security Rules accettino comunque questo aggiornamento parziale (segnalato
// da Silvio come "non gestisce gli stati di tutti quanti insieme", 30/09/2026
// — va capito se è un problema di regole o di UX prima di intervenire).
test('accesso transfer: un referente può aggiornare solo alcuni campi operativi alla volta (come fa la selezione multipla)', async () => {
  await seedEvent();
  await seedManagedOperator();
  await seedRealisticTransferRecord('record-b');
  const operator = operatorContext();
  const recordPath = 'events/egadi-2026/transferOpsRecords/record-b';
  await assertSucceeds(updateDoc(doc(operator.firestore(), recordPath), {
    meetingPoint: 'Porto di Marsala',
    meetingTime: '09:30',
    assignedOperatorUid: OPERATOR_A,
    updatedAt: serverTimestamp(),
    updatedBy: OPERATOR_A,
  }));
});

test('accesso transfer: un referente può aggiornare solo lo stato di più movimenti in un batch, senza toccare gli altri campi', async () => {
  await seedEvent();
  await seedManagedOperator();
  await seedRealisticTransferRecord('record-c');
  await seedRealisticTransferRecord('record-d');
  const operator = operatorContext();
  const batch = writeBatch(operator.firestore());
  const updates = {
    status: 'confirmed',
    assignedOperatorUid: OPERATOR_A,
    updatedAt: serverTimestamp(),
    updatedBy: OPERATOR_A,
  };
  batch.update(doc(operator.firestore(), 'events/egadi-2026/transferOpsRecords/record-c'), updates);
  batch.update(doc(operator.firestore(), 'events/egadi-2026/transferOpsRecords/record-d'), updates);
  await assertSucceeds(batch.commit());
});

// Registro privato dei pagamenti al charter. Verifica lo schema chiuso e
// l'accesso esclusivo dello skipper associato alla barca.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  CREW_A,
  ORGANIZER_A,
  OUTSIDER_A,
  SKIPPER_A,
  boatDocData,
  crewAContext,
  eventDocData,
  organizerContext,
  outsiderContext,
  skipperContext,
} from './identities.mjs';

let testEnv;

const BOAT_ID = SKIPPER_A;
const PAYMENT_ID = 'charter-payment-a';

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-charter-payments',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});

test.after(async () => { await testEnv?.cleanup(); });
test.beforeEach(async () => { await testEnv.clearFirestore(); });

async function seedEventAndBoat({ open = true } = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData({ open }));
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}`), boatDocData());
  });
}

function validCharterPayment(overrides = {}) {
  return {
    amountCents: 125000,
    paymentKind: 'deposit',
    status: 'planned',
    dueOn: '2026-09-30',
    paidOn: '',
    method: 'Bonifico',
    reference: 'Acconto charter di test',
    note: 'Movimento fittizio per il test delle regole.',
    createdAt: serverTimestamp(),
    createdBy: SKIPPER_A,
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
    ...overrides,
  };
}

async function seedCharterPayment() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const now = Timestamp.fromDate(new Date('2026-09-28T10:00:00Z'));
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/charterPayments/${PAYMENT_ID}`), {
      amountCents: 125000,
      paymentKind: 'deposit',
      status: 'planned',
      dueOn: '2026-09-30',
      paidOn: '',
      method: 'Bonifico',
      reference: 'Acconto charter di test',
      note: 'Movimento fittizio per il test delle regole.',
      createdAt: now,
      createdBy: SKIPPER_A,
      updatedAt: now,
      updatedBy: SKIPPER_A,
    });
  });
}

test('registro charter: lo skipper crea, legge, elenca e aggiorna una riga valida', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const paymentRef = doc(skipper.firestore(), `boats/${BOAT_ID}/charterPayments/${PAYMENT_ID}`);

  await assertSucceeds(setDoc(paymentRef, validCharterPayment()));
  const snapshot = await assertSucceeds(getDoc(paymentRef));
  assert.equal(snapshot.data().amountCents, 125000);

  const list = await assertSucceeds(getDocs(collection(skipper.firestore(), `boats/${BOAT_ID}/charterPayments`)));
  assert.equal(list.size, 1);

  await assertSucceeds(updateDoc(paymentRef, {
    status: 'confirmed',
    paidOn: '2026-09-29',
    reference: 'Saldo confermato dal charter',
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  }));
  const updated = await assertSucceeds(getDoc(paymentRef));
  assert.equal(updated.data().status, 'confirmed');
  assert.equal(updated.data().paidOn, '2026-09-29');

  await assertSucceeds(updateDoc(paymentRef, {
    status: 'cancelled',
    note: 'Movimento annullato senza eliminarlo dalla cronologia.',
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  }));
  const cancelled = await assertSucceeds(getDoc(paymentRef));
  assert.equal(cancelled.data().status, 'cancelled');
});

test('registro charter: organizzatore, equipaggio, outsider e altro skipper non accedono', async () => {
  await seedEventAndBoat();
  await seedCharterPayment();

  const deniedContexts = [
    ['organizzatore', organizerContext(testEnv), ORGANIZER_A],
    ['equipaggio', crewAContext(testEnv), CREW_A],
    ['outsider', outsiderContext(testEnv), OUTSIDER_A],
    ['altro skipper', skipperContext(testEnv, 'SKIPPER_B'), 'SKIPPER_B'],
  ];

  for (const [label, context, uid] of deniedContexts) {
    const paymentRef = doc(context.firestore(), `boats/${BOAT_ID}/charterPayments/${PAYMENT_ID}`);
    await assertFails(getDoc(paymentRef), `${label}: get deve essere negato`);
    await assertFails(
      getDocs(collection(context.firestore(), `boats/${BOAT_ID}/charterPayments`)),
      `${label}: list deve essere negato`,
    );
    await assertFails(
      setDoc(doc(context.firestore(), `boats/${BOAT_ID}/charterPayments/new-${uid}`), validCharterPayment({
        createdBy: uid,
        updatedBy: uid,
      })),
      `${label}: create deve essere negato`,
    );
    await assertFails(updateDoc(paymentRef, {
      note: 'Modifica non autorizzata',
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    }), `${label}: update deve essere negato`);
  }
});

test('registro charter: lo schema chiuso respinge valori e metadati non validi', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);

  const invalidPayloads = [
    validCharterPayment({ amountCents: 0 }),
    validCharterPayment({ amountCents: 1000001 }),
    validCharterPayment({ amountCents: 12.5 }),
    validCharterPayment({ paymentKind: 'refund' }),
    validCharterPayment({ status: 'void' }),
    validCharterPayment({ status: 'planned', paidOn: '2026-09-30' }),
    validCharterPayment({ status: 'paid', paidOn: '' }),
    validCharterPayment({ status: 'confirmed', paidOn: '' }),
    validCharterPayment({ dueOn: '30/09/2026' }),
    validCharterPayment({ paidOn: '2026-9-30' }),
    validCharterPayment({ method: 'm'.repeat(81) }),
    validCharterPayment({ reference: 'r'.repeat(161) }),
    validCharterPayment({ note: 'n'.repeat(401) }),
    validCharterPayment({ extraField: true }),
    validCharterPayment({ createdAt: Timestamp.fromDate(new Date('2026-09-01T10:00:00Z')) }),
    validCharterPayment({ createdBy: OUTSIDER_A }),
    validCharterPayment({ updatedAt: Timestamp.fromDate(new Date('2026-09-01T10:00:00Z')) }),
    validCharterPayment({ updatedBy: OUTSIDER_A }),
  ];

  for (const [index, payload] of invalidPayloads.entries()) {
    await assertFails(setDoc(
      doc(skipper.firestore(), `boats/${BOAT_ID}/charterPayments/invalid-${index}`),
      payload,
    ));
  }

  const missingNote = validCharterPayment();
  delete missingNote.note;
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/charterPayments/missing-note`),
    missingNote,
  ));
});

test('registro charter: creazione e update non possono riscrivere origine o aggiungere campi', async () => {
  await seedEventAndBoat();
  await seedCharterPayment();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const paymentRef = doc(skipper.firestore(), `boats/${BOAT_ID}/charterPayments/${PAYMENT_ID}`);

  await assertFails(updateDoc(paymentRef, {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  }));
  await assertFails(updateDoc(paymentRef, {
    createdBy: OUTSIDER_A,
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  }));
  await assertFails(updateDoc(paymentRef, {
    extraField: 'non ammesso',
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  }));
  await assertFails(updateDoc(paymentRef, {
    amountCents: 0,
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  }));
});

test('registro charter: la cancellazione resta negata anche allo skipper', async () => {
  await seedEventAndBoat();
  await seedCharterPayment();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(deleteDoc(doc(skipper.firestore(), `boats/${BOAT_ID}/charterPayments/${PAYMENT_ID}`)));
});

test('registro charter: con area privata chiusa anche lo skipper resta bloccato', async () => {
  await seedEventAndBoat({ open: false });
  await seedCharterPayment();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const paymentRef = doc(skipper.firestore(), `boats/${BOAT_ID}/charterPayments/${PAYMENT_ID}`);

  await assertFails(getDoc(paymentRef));
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/charterPayments/new-payment`),
    validCharterPayment(),
  ));
});

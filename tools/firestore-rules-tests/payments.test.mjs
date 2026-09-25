// Test delle Security Rules per boats/{boatId}/paymentRequests e il suo
// figlio privato /private/message (vedi FIRESTORE_RULES_TEST_MATRIX.md,
// caso "Contributi e pagamenti"). Copre: creazione di una richiesta ordinaria,
// registrazione di un acconto storico (manual_receipt), lettura/stati per la
// crew, dichiarazione di pagamento e segnalazione spontanea (self_reported).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, collection, query, where,
  setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  ORGANIZER_A, SKIPPER_A, OUTSIDER_A, CREW_A, CREW_B,
  CREW_A_EMAIL, CREW_B_EMAIL,
  INVITE_A_ID, INVITE_B_ID, PROJECTION_A_ID,
  organizerContext, skipperContext, outsiderContext, crewAContext, crewBContext,
  googleContext, eventDocData, boatDocData,
} from './identities.mjs';

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-payments',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});
test.after(async () => { await testEnv?.cleanup(); });
test.beforeEach(async () => { await testEnv.clearFirestore(); });

const BOAT_ID = SKIPPER_A;
const SKIPPER_NAME = 'Skipper Test';
const RULES_VERSION = 2;

// ---------------------------------------------------------------------------
// Helper di seed (sempre con Rules disabilitate: seedano prerequisiti, non
// l'azione sotto test).
// ---------------------------------------------------------------------------

async function seedEventOpen() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData({ open: true }));
  });
}

async function seedBoat() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}`), boatDocData());
  });
}

async function seedInvite(inviteId, uid, loginEmail, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/invites/${inviteId}`), {
      boatId: BOAT_ID,
      status: 'active',
      participantUid: uid,
      accessVersion: 1,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
      preferredLocale: 'it',
      loginEmail,
      phoneFingerprint: 'd'.repeat(64),
      accessKey: 'c'.repeat(48),
      ...overrides,
    });
  });
}

async function seedCrewAccess(uid, inviteId, loginEmail) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `crewAccess/${uid}`), {
      boatId: BOAT_ID, inviteId, userId: uid, loginEmail, updatedAt: Timestamp.now(),
    });
  });
}

async function seedBriefing(rulesVersion = RULES_VERSION) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/briefing/board`), {
      rulesTitle: 'Regolamento di bordo',
      rulesSummary: 'Sintesi delle regole di bordo per test.',
      rulesText: 'Testo completo del regolamento di bordo per la fixture di test.',
      fullRulesRequired: true,
      rulesVersion,
      meetingPoint: 'Marina di Marsala',
      boardingAt: '',
      departureAt: '',
      returnAt: '',
      scheduleNote: '',
      updatedAt: Timestamp.now(),
      updatedBy: SKIPPER_A,
    });
  });
}

async function seedAcceptance(inviteId, uid, rulesVersion = RULES_VERSION) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/ruleAcceptances/${inviteId}`), {
      inviteId, acceptedBy: uid, rulesVersion, fullRulesRead: true,
      acceptedLocale: 'it', acceptedAt: Timestamp.now(),
    });
  });
}

async function seedCrewProjection(projectionId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/crewProjections/${projectionId}`), {
      status: 'projected', inviteId: null, firstName: 'Nome', lastName: 'Cognome test',
      whatsapp: '+39 000 0000000', contactConsent: true, role: 'crew',
      berthType: 'berth_double_cabin', language: 'it', contributesToCosts: true,
      pricingMode: 'dashboard', amountCents: 30000,
      createdAt: Timestamp.now(), createdBy: SKIPPER_A,
      ...overrides,
    });
  });
}

async function seedCollectionProfile(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/collectionProfile/default`), {
      collectorId: SKIPPER_A,
      collectorName: SKIPPER_NAME,
      paypalEnabled: true,
      satispayEnabled: false,
      revolutEnabled: false,
      bankTransferEnabled: false,
      paymentDetails: {
        paypal: 'https://paypal.me/skippertest',
        satispay: '',
        revolut: '',
        bankTransfer: { iban: '', accountHolder: '' },
      },
      updatedAt: Timestamp.now(),
      updatedBy: SKIPPER_A,
      ...overrides,
    });
  });
}

// Baseline completa per CREW_A: invito attivo, crewAccess, briefing corrente
// e (opzionale) accettazione corrente.
async function seedCrewABaseline({ withAcceptance = true, rulesVersion = RULES_VERSION } = {}) {
  await seedEventOpen();
  await seedBoat();
  await seedInvite(INVITE_A_ID, CREW_A, CREW_A_EMAIL);
  await seedCrewAccess(CREW_A, INVITE_A_ID, CREW_A_EMAIL);
  await seedBriefing(rulesVersion);
  if (withAcceptance) {
    await seedAcceptance(INVITE_A_ID, CREW_A, rulesVersion);
  }
}

async function seedCrewBBaseline({ withAcceptance = true, rulesVersion = RULES_VERSION } = {}) {
  await seedInvite(INVITE_B_ID, CREW_B, CREW_B_EMAIL);
  await seedCrewAccess(CREW_B, INVITE_B_ID, CREW_B_EMAIL);
  if (withAcceptance) {
    await seedAcceptance(INVITE_B_ID, CREW_B, rulesVersion);
  }
}

function allocationFor(amountCents, berthRatio = 0.8) {
  const berthCents = Math.round(amountCents * berthRatio);
  return { berthCents, protectionInsuranceCents: amountCents - berthCents };
}

// Payload di base per una richiesta "request" valida. Di default usa
// installmentType 'extra' (senza allocation) per isolare i test sui campi
// non legati alla rateizzazione.
function baseRequestPayload(overrides = {}) {
  const {
    recipientId = INVITE_A_ID,
    amountCents = 5000,
    contributionItemId = 'berth_double_cabin',
    accountingCategory = 'cost_recovery',
    installmentType = 'extra',
    allocation,
    paymentMethods = { paypal: true },
    extraTopLevel = {},
    omit = [],
  } = overrides;

  const payload = {
    recipientId,
    memberId: recipientId,
    payerInviteId: recipientId,
    contributionItemId,
    entryType: 'request',
    installmentType,
    amountCents,
    currency: 'EUR',
    reason: 'Quota posto letto - richiesta di test',
    accountingCategory,
    isOptional: false,
    dueDate: '2026-10-01',
    collectorId: SKIPPER_A,
    collectorName: SKIPPER_NAME,
    paymentMethods,
    status: 'prepared',
    createdAt: serverTimestamp(),
    createdBy: SKIPPER_A,
    verifiedAt: null,
    verifiedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    declaredAt: null,
    declaredBy: null,
    declaredMethod: null,
    ...extraTopLevel,
  };
  if (installmentType === 'extra') {
    // nessuna allocation
  } else {
    payload.allocation = allocation || allocationFor(amountCents);
  }
  for (const key of omit) delete payload[key];
  return payload;
}

function manualReceiptPayload(overrides = {}) {
  const {
    recipientId = INVITE_A_ID,
    amountCents = 30000,
    contributionItemId = 'berth_double_cabin',
    allocation,
    receivedOn = '2026-09-20',
    reason = 'Acconto registrato',
    createdBy = SKIPPER_A,
    createdAt = serverTimestamp(),
    omit = [],
  } = overrides;
  const payload = {
    recipientId,
    memberId: recipientId,
    payerInviteId: recipientId,
    contributionItemId,
    entryType: 'manual_receipt',
    installmentType: 'advance',
    allocation: allocation || allocationFor(amountCents),
    receivedOn,
    amountCents,
    currency: 'EUR',
    reason,
    accountingCategory: 'cost_recovery',
    isOptional: false,
    dueDate: '',
    collectorId: SKIPPER_A,
    collectorName: SKIPPER_NAME,
    paymentMethods: {},
    status: 'verified',
    createdAt,
    createdBy,
    verifiedAt: serverTimestamp(),
    verifiedBy: SKIPPER_A,
    cancelledAt: null,
    cancelledBy: null,
    declaredAt: null,
    declaredBy: null,
    declaredMethod: null,
  };
  for (const key of omit) delete payload[key];
  return payload;
}

// Doc "grezzo" (schema completo, valido come forma) scritto con Rules
// disabilitate: usato quando l'azione sotto test è la LETTURA o
// l'AGGIORNAMENTO di una richiesta già esistente, non la sua creazione.
async function seedRawPaymentRequest(requestId, overrides = {}) {
  const {
    recipientId = INVITE_A_ID,
    amountCents = 12000,
    status = 'prepared',
    paymentMethods = { paypal: true },
    entryType = 'request',
    installmentType = 'advance',
    allocation,
    declaredAt = null,
    declaredBy = null,
    declaredMethod = null,
    verifiedAt = null,
    verifiedBy = null,
    cancelledAt = null,
    cancelledBy = null,
    omit = [],
    extra = {},
  } = overrides;
  const data = {
    recipientId,
    memberId: recipientId,
    payerInviteId: recipientId,
    contributionItemId: 'berth_double_cabin',
    entryType,
    installmentType,
    allocation: allocation === undefined ? allocationFor(amountCents) : allocation,
    amountCents,
    currency: 'EUR',
    reason: entryType === 'manual_receipt' ? 'Acconto registrato' : 'Quota posto letto - richiesta di test',
    accountingCategory: 'cost_recovery',
    isOptional: false,
    dueDate: '',
    collectorId: SKIPPER_A,
    collectorName: SKIPPER_NAME,
    paymentMethods,
    status,
    createdAt: Timestamp.now(),
    createdBy: SKIPPER_A,
    verifiedAt,
    verifiedBy,
    cancelledAt,
    cancelledBy,
    declaredAt,
    declaredBy,
    declaredMethod,
    ...extra,
  };
  for (const key of omit) delete data[key];
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/paymentRequests/${requestId}`), data);
  });
}

function paymentDoc(ctx, requestId) {
  return doc(ctx.firestore(), `boats/${BOAT_ID}/paymentRequests/${requestId}`);
}

// ===========================================================================
// CASO 1: Richiesta contributo
// ===========================================================================

test('richiesta: SKIPPER_A crea una richiesta advance con allocation coerente', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'advance', amountCents: 20000 });
  await assertSucceeds(setDoc(paymentDoc(skipper, 'req-advance'), payload));
  let snap;
  await testEnv.withSecurityRulesDisabled(async (ctx) => { snap = await getDoc(paymentDoc(ctx, 'req-advance')); });
  assert.equal(snap.data().status, 'prepared');
  assert.equal(snap.data().declaredAt, null);
});

test('richiesta: SKIPPER_A crea una richiesta balance con allocation coerente', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'balance', amountCents: 15000 });
  await assertSucceeds(setDoc(paymentDoc(skipper, 'req-balance'), payload));
});

test('richiesta: SKIPPER_A crea una richiesta full con allocation coerente', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'full', amountCents: 35000 });
  await assertSucceeds(setDoc(paymentDoc(skipper, 'req-full'), payload));
});

test('richiesta: SKIPPER_A crea una richiesta extra senza allocation', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'extra', amountCents: 4000, contributionItemId: 'provisions' });
  await assertSucceeds(setDoc(paymentDoc(skipper, 'req-extra'), payload));
});

test('richiesta: installmentType fuori dai quattro valori ammessi viene negato', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'partial' });
  payload.installmentType = 'partial';
  await assertFails(setDoc(paymentDoc(skipper, 'req-bad-installment'), payload));
});

test('richiesta: una rata core (advance) senza allocation viene negata', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'advance', amountCents: 10000 });
  delete payload.allocation;
  await assertFails(setDoc(paymentDoc(skipper, 'req-advance-no-allocation'), payload));
});

test('richiesta: installmentType extra con allocation presente viene negato', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'extra', amountCents: 4000 });
  payload.allocation = allocationFor(4000);
  await assertFails(setDoc(paymentDoc(skipper, 'req-extra-with-allocation'), payload));
});

test('richiesta: receivedOn presente alla creazione viene negato', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'advance', amountCents: 10000 });
  payload.receivedOn = '2026-09-20';
  await assertFails(setDoc(paymentDoc(skipper, 'req-with-receivedon'), payload));
});

for (const badItem of ['starter_pack', 'linen_towels', 'refundable_deposit']) {
  test(`richiesta: contributionItemId "${badItem}" non e' richiedibile come pagamento`, async () => {
    await seedCrewABaseline();
    await seedCollectionProfile();
    const skipper = skipperContext(testEnv);
    const payload = baseRequestPayload({ contributionItemId: badItem });
    await assertFails(setDoc(paymentDoc(skipper, `req-item-${badItem}`), payload));
  });
}

test('richiesta: accountingCategory assente viene negata', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ omit: ['accountingCategory'] });
  await assertFails(setDoc(paymentDoc(skipper, 'req-no-accounting-category'), payload));
});

test('richiesta: accountingCategory diversa dai due valori ammessi viene negata', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ accountingCategory: 'donation' });
  await assertFails(setDoc(paymentDoc(skipper, 'req-bad-accounting-category'), payload));
});

test('richiesta: recipientId senza invito ne proiezione corrispondente viene negato', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const inexistentId = 'f'.repeat(48);
  const payload = baseRequestPayload({ recipientId: inexistentId });
  await assertFails(setDoc(paymentDoc(skipper, 'req-bad-recipient'), payload));
});

test('richiesta: amountCents decimale viene negato', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ amountCents: 1000.5 });
  await assertFails(setDoc(paymentDoc(skipper, 'req-decimal-amount'), payload));
});

test('richiesta: amountCents pari a zero viene negato', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ amountCents: 0 });
  await assertFails(setDoc(paymentDoc(skipper, 'req-zero-amount'), payload));
});

test('richiesta: un tag metodo non abilitato nel profilo di incasso viene negato', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile(); // solo paypalEnabled: true
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ paymentMethods: { satispay: true } });
  await assertFails(setDoc(paymentDoc(skipper, 'req-method-not-enabled'), payload));
});

test('richiesta: un campo libero non previsto (es. iban) nel documento viene negato', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ extraTopLevel: { iban: 'IT60X0542811101000000123456' } });
  await assertFails(setDoc(paymentDoc(skipper, 'req-free-field'), payload));
});

test('richiesta: status "verified" alla creazione viene negato', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({});
  payload.status = 'verified';
  await assertFails(setDoc(paymentDoc(skipper, 'req-status-verified'), payload));
});

// --- Nota privata (private/message) ---

test('richiesta: la nota privata puo essere creata nello stesso batch della richiesta', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'advance', amountCents: 20000 });
  const batch = writeBatch(skipper.firestore());
  batch.set(paymentDoc(skipper, 'req-with-note'), payload);
  batch.set(doc(skipper.firestore(), `boats/${BOAT_ID}/paymentRequests/req-with-note/private/message`), {
    messageDetails: 'Manda un messaggio WhatsApp con il link PayPal aggiornato.',
    createdAt: serverTimestamp(),
    createdBy: SKIPPER_A,
  });
  await assertSucceeds(batch.commit());
});

test('richiesta: la nota privata oltre 1000 caratteri viene negata', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'advance', amountCents: 20000 });
  const batch = writeBatch(skipper.firestore());
  batch.set(paymentDoc(skipper, 'req-note-too-long'), payload);
  batch.set(doc(skipper.firestore(), `boats/${BOAT_ID}/paymentRequests/req-note-too-long/private/message`), {
    messageDetails: 'x'.repeat(1001),
    createdAt: serverTimestamp(),
    createdBy: SKIPPER_A,
  });
  await assertFails(batch.commit());
});

test('richiesta: la nota privata aggiunta in un momento successivo alla richiesta viene negata', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'advance', amountCents: 20000 });
  await assertSucceeds(setDoc(paymentDoc(skipper, 'req-note-later'), payload));
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/paymentRequests/req-note-later/private/message`),
    { messageDetails: 'Nota aggiunta troppo tardi', createdAt: serverTimestamp(), createdBy: SKIPPER_A },
  ));
});

test('richiesta: la nota privata non puo essere modificata dopo la creazione', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'advance', amountCents: 20000 });
  const batch = writeBatch(skipper.firestore());
  batch.set(paymentDoc(skipper, 'req-note-immutable'), payload);
  const messageRef = doc(skipper.firestore(), `boats/${BOAT_ID}/paymentRequests/req-note-immutable/private/message`);
  batch.set(messageRef, { messageDetails: 'Nota originale', createdAt: serverTimestamp(), createdBy: SKIPPER_A });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(messageRef, { messageDetails: 'Nota modificata' }));
});

test('richiesta: la nota privata non puo essere cancellata dopo la creazione', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'advance', amountCents: 20000 });
  const batch = writeBatch(skipper.firestore());
  batch.set(paymentDoc(skipper, 'req-note-no-delete'), payload);
  const messageRef = doc(skipper.firestore(), `boats/${BOAT_ID}/paymentRequests/req-note-no-delete/private/message`);
  batch.set(messageRef, { messageDetails: 'Nota originale', createdAt: serverTimestamp(), createdBy: SKIPPER_A });
  await assertSucceeds(batch.commit());
  await assertFails(deleteDoc(messageRef));
});

test('richiesta: la nota privata non e leggibile da CREW_A, ORGANIZER_A o OUTSIDER_A', async () => {
  await seedCrewABaseline();
  await seedCollectionProfile();
  const skipper = skipperContext(testEnv);
  const payload = baseRequestPayload({ installmentType: 'advance', amountCents: 20000 });
  const batch = writeBatch(skipper.firestore());
  batch.set(paymentDoc(skipper, 'req-note-private'), payload);
  batch.set(doc(skipper.firestore(), `boats/${BOAT_ID}/paymentRequests/req-note-private/private/message`), {
    messageDetails: 'Nota riservata allo skipper', createdAt: serverTimestamp(), createdBy: SKIPPER_A,
  });
  await assertSucceeds(batch.commit());

  const messagePath = `boats/${BOAT_ID}/paymentRequests/req-note-private/private/message`;
  await assertFails(getDoc(doc(crewAContext(testEnv).firestore(), messagePath)));
  await assertFails(getDoc(doc(organizerContext(testEnv).firestore(), messagePath)));
  await assertFails(getDoc(doc(outsiderContext(testEnv).firestore(), messagePath)));
});

// ===========================================================================
// CASO 2: Acconto gia ricevuto (manual_receipt)
// ===========================================================================

test('acconto: SKIPPER_A registra un acconto storico su una proiezione senza collectionProfile', async () => {
  // Solo evento + barca: nessun invito con questo ID ancora, la proiezione
  // esiste da sola (PROJECTION_A_ID == INVITE_A_ID per fixture, ma qui
  // l'invito non e' stato creato) e collectionProfile/default non esiste.
  await seedEventOpen();
  await seedBoat();
  await seedCrewProjection(PROJECTION_A_ID);
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({ recipientId: PROJECTION_A_ID, amountCents: 25000 });
  await assertSucceeds(setDoc(paymentDoc(skipper, 'manual-on-projection'), payload));
});

test('acconto: SKIPPER_A registra un acconto storico su un invito esistente', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({ recipientId: INVITE_A_ID, amountCents: 30000 });
  await assertSucceeds(setDoc(paymentDoc(skipper, 'manual-on-invite'), payload));
});

test('acconto: entryType diverso da manual_receipt viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({});
  payload.entryType = 'request';
  await assertFails(setDoc(paymentDoc(skipper, 'manual-bad-entrytype'), payload));
});

test('acconto: installmentType "balance" e ammesso quando copre l intero saldo residuo', async () => {
  // Corretto il 25/09/2026 (caso reale Anna La Riccia): area.js scrive
  // "balance" quando l'importo ricevuto chiude il saldo, non solo "advance".
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({});
  payload.installmentType = 'balance';
  await assertSucceeds(setDoc(paymentDoc(skipper, 'manual-balance-ok'), payload));
});

test('acconto: installmentType fuori da advance/balance viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({});
  payload.installmentType = 'full';
  await assertFails(setDoc(paymentDoc(skipper, 'manual-bad-installment-full'), payload));
  const payload2 = manualReceiptPayload({});
  payload2.installmentType = 'extra';
  delete payload2.allocation;
  await assertFails(setDoc(paymentDoc(skipper, 'manual-bad-installment-extra'), payload2));
});

test('acconto: una causale libera diversa dal testo fisso viene negata', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({ reason: 'Acconto ricevuto in contanti' });
  await assertFails(setDoc(paymentDoc(skipper, 'manual-bad-reason'), payload));
});

test('acconto: receivedOn mancante viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({ omit: ['receivedOn'] });
  await assertFails(setDoc(paymentDoc(skipper, 'manual-no-receivedon'), payload));
});

test('acconto: receivedOn non nel formato ISO YYYY-MM-DD viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({ receivedOn: '20/09/2026' });
  await assertFails(setDoc(paymentDoc(skipper, 'manual-bad-date-format'), payload));
});

test('acconto: allocation mancante viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({ omit: ['allocation'] });
  await assertFails(setDoc(paymentDoc(skipper, 'manual-no-allocation'), payload));
});

test('acconto: allocation la cui somma non torna con amountCents viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({ amountCents: 30000 });
  payload.allocation = { berthCents: 1000, protectionInsuranceCents: 1000 };
  await assertFails(setDoc(paymentDoc(skipper, 'manual-bad-allocation-sum'), payload));
});

test('acconto: un tag metodo non vuoto in paymentMethods viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({});
  payload.paymentMethods = { paypal: true };
  await assertFails(setDoc(paymentDoc(skipper, 'manual-nonempty-methods'), payload));
});

test('acconto: un contributionItemId non di tipo posto/assicurazione viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({ contributionItemId: 'fuel' });
  await assertFails(setDoc(paymentDoc(skipper, 'manual-bad-item'), payload));
});

test('acconto: status "prepared" alla creazione viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({});
  payload.status = 'prepared';
  await assertFails(setDoc(paymentDoc(skipper, 'manual-status-prepared'), payload));
});

test('acconto: createdBy diverso dallo skipper autenticato viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({ createdBy: CREW_A });
  await assertFails(setDoc(paymentDoc(skipper, 'manual-bad-createdby'), payload));
});

test('acconto: createdAt non server (timestamp letterale) viene negato', async () => {
  await seedCrewABaseline();
  const skipper = skipperContext(testEnv);
  const payload = manualReceiptPayload({ createdAt: Timestamp.now() });
  await assertFails(setDoc(paymentDoc(skipper, 'manual-literal-createdat'), payload));
});

test('acconto: CREW_A non puo registrare un acconto storico', async () => {
  await seedCrewABaseline();
  const crewA = crewAContext(testEnv);
  const payload = manualReceiptPayload({ createdBy: CREW_A });
  await assertFails(setDoc(paymentDoc(crewA, 'manual-by-crew'), payload));
});

test('acconto: ORGANIZER_A non puo registrare un acconto storico', async () => {
  await seedCrewABaseline();
  const organizer = organizerContext(testEnv);
  const payload = manualReceiptPayload({ createdBy: ORGANIZER_A });
  await assertFails(setDoc(paymentDoc(organizer, 'manual-by-organizer'), payload));
});

test('acconto: OUTSIDER_A non puo registrare un acconto storico', async () => {
  await seedCrewABaseline();
  const outsider = outsiderContext(testEnv);
  const payload = manualReceiptPayload({ createdBy: OUTSIDER_A });
  await assertFails(setDoc(paymentDoc(outsider, 'manual-by-outsider'), payload));
});

test('acconto: un altro skipper non puo registrare un acconto sulla barca di SKIPPER_A', async () => {
  await seedCrewABaseline();
  const otherSkipper = googleContext(testEnv, 'SKIPPER_B');
  const payload = manualReceiptPayload({ createdBy: 'SKIPPER_B' });
  await assertFails(setDoc(paymentDoc(otherSkipper, 'manual-by-other-skipper'), payload));
});

// ===========================================================================
// CASO 2bis: Correggere una ricevuta manuale sbagliata (25/09/2026)
// Una ricevuta manuale verificata resta immutabile: l'unico modo di
// correggere un importo/data sbagliati e' annullarla (verified -> cancelled)
// e registrarne una nuova. Vedi canCancelManualReceipt() in firestore.rules.
// ===========================================================================

test('correzione: SKIPPER_A annulla una ricevuta manuale verificata', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('manual-to-cancel', {
    entryType: 'manual_receipt', status: 'verified', recipientId: INVITE_A_ID,
    amountCents: 20000, allocation: allocationFor(20000), paymentMethods: {},
    verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A,
  });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(updateDoc(paymentDoc(skipper, 'manual-to-cancel'), {
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: SKIPPER_A,
  }));
  let snap;
  await testEnv.withSecurityRulesDisabled(async (ctx) => { snap = await getDoc(paymentDoc(ctx, 'manual-to-cancel')); });
  assert.equal(snap.data().status, 'cancelled');
  assert.equal(snap.data().amountCents, 20000);
});

test('correzione: annullare una ricevuta manuale cambiando anche altri campi viene negato', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('manual-cancel-plus-amount', {
    entryType: 'manual_receipt', status: 'verified', recipientId: INVITE_A_ID,
    amountCents: 20000, allocation: allocationFor(20000), paymentMethods: {},
    verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A,
  });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(paymentDoc(skipper, 'manual-cancel-plus-amount'), {
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: SKIPPER_A, amountCents: 30000,
  }));
});

test('correzione: annullare una ricevuta manuale gia annullata viene negato', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('manual-already-cancelled', {
    entryType: 'manual_receipt', status: 'cancelled', recipientId: INVITE_A_ID,
    amountCents: 20000, allocation: allocationFor(20000), paymentMethods: {},
    cancelledAt: Timestamp.now(), cancelledBy: SKIPPER_A,
  });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(paymentDoc(skipper, 'manual-already-cancelled'), {
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: SKIPPER_A,
  }));
});

test('correzione: ORGANIZER_A non puo annullare una ricevuta manuale verificata', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('manual-organizer-cancel', {
    entryType: 'manual_receipt', status: 'verified', recipientId: INVITE_A_ID,
    amountCents: 20000, allocation: allocationFor(20000), paymentMethods: {},
    verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A,
  });
  const organizer = organizerContext(testEnv);
  await assertFails(updateDoc(paymentDoc(organizer, 'manual-organizer-cancel'), {
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: ORGANIZER_A,
  }));
});

test('correzione: CREW_A non puo annullare la propria ricevuta manuale verificata', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('manual-crew-cancel', {
    entryType: 'manual_receipt', status: 'verified', recipientId: INVITE_A_ID,
    amountCents: 20000, allocation: allocationFor(20000), paymentMethods: {},
    verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A,
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'manual-crew-cancel'), {
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: CREW_A,
  }));
});

test('correzione: una richiesta ordinaria (entryType request) gia verified non diventa cancellabile', async () => {
  // canCancelManualReceipt() richiede entryType manual_receipt: una richiesta
  // ordinaria gia verificata resta bloccata come prima (nessuna regressione).
  await seedCrewABaseline();
  await seedRawPaymentRequest('request-verified-not-cancellable', {
    entryType: 'request', status: 'verified', recipientId: INVITE_A_ID,
    amountCents: 20000, allocation: allocationFor(20000), paymentMethods: { paypal: true },
    verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A,
  });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(paymentDoc(skipper, 'request-verified-not-cancellable'), {
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: SKIPPER_A,
  }));
});

// ===========================================================================
// CASO 3: Lettura e stati contributo
// ===========================================================================

test('lettura: prima dell accettazione corrente, CREW_A non puo leggere (get) la propria richiesta', async () => {
  await seedCrewABaseline({ withAcceptance: false });
  await seedRawPaymentRequest('payment-a', { recipientId: INVITE_A_ID });
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(paymentDoc(crewA, 'payment-a')));
});

test('lettura: prima dell accettazione corrente, CREW_A non puo interrogare le proprie paymentRequests', async () => {
  await seedCrewABaseline({ withAcceptance: false });
  await seedRawPaymentRequest('payment-a', { recipientId: INVITE_A_ID });
  const crewA = crewAContext(testEnv);
  const q = query(collection(crewA.firestore(), `boats/${BOAT_ID}/paymentRequests`), where('recipientId', '==', INVITE_A_ID));
  await assertFails(getDocs(q));
});

test('lettura: prima dell accettazione corrente, CREW_A non puo leggere la propria ricevuta manuale', async () => {
  await seedCrewABaseline({ withAcceptance: false });
  await seedRawPaymentRequest('manual-advance-a', {
    recipientId: INVITE_A_ID, status: 'verified', entryType: 'manual_receipt',
    verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A,
  });
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(paymentDoc(crewA, 'manual-advance-a')));
});

test('lettura: dopo l accettazione corrente, CREW_A legge (get) la propria richiesta', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-a', { recipientId: INVITE_A_ID });
  const crewA = crewAContext(testEnv);
  const snap = await assertSucceeds(getDoc(paymentDoc(crewA, 'payment-a')));
  assert.equal(snap.data().recipientId, INVITE_A_ID);
});

test('lettura: dopo l accettazione corrente, CREW_A legge (get) la propria ricevuta manuale', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('manual-advance-a', {
    recipientId: INVITE_A_ID, status: 'verified', entryType: 'manual_receipt',
    verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A,
  });
  const crewA = crewAContext(testEnv);
  await assertSucceeds(getDoc(paymentDoc(crewA, 'manual-advance-a')));
});

test('lettura: CREW_A non puo leggere una ricevuta con recipientId di un altra persona', async () => {
  await seedCrewABaseline();
  await seedCrewBBaseline();
  await seedRawPaymentRequest('manual-advance-b', {
    recipientId: INVITE_B_ID, status: 'verified', entryType: 'manual_receipt',
    verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A,
  });
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(paymentDoc(crewA, 'manual-advance-b')));
});

test('lettura: CREW_A non puo eseguire una query non filtrata sull intera collezione paymentRequests', async () => {
  await seedCrewABaseline();
  await seedCrewBBaseline();
  await seedRawPaymentRequest('payment-a', { recipientId: INVITE_A_ID });
  await seedRawPaymentRequest('payment-b', { recipientId: INVITE_B_ID });
  const crewA = crewAContext(testEnv);
  await assertFails(getDocs(collection(crewA.firestore(), `boats/${BOAT_ID}/paymentRequests`)));
});

test('lettura: CREW_A non puo modificare il contenuto della propria richiesta', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-a', { recipientId: INVITE_A_ID, amountCents: 12000 });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'payment-a'), { amountCents: 99999 }));
});

test('lettura: CREW_B non puo leggere (get) la richiesta di CREW_A', async () => {
  await seedCrewABaseline();
  await seedCrewBBaseline();
  await seedRawPaymentRequest('payment-a', { recipientId: INVITE_A_ID });
  const crewB = crewBContext(testEnv);
  await assertFails(getDoc(paymentDoc(crewB, 'payment-a')));
});

test('lettura: CREW_B non puo interrogare per recipientId la richiesta di CREW_A', async () => {
  await seedCrewABaseline();
  await seedCrewBBaseline();
  await seedRawPaymentRequest('payment-a', { recipientId: INVITE_A_ID });
  const crewB = crewBContext(testEnv);
  const q = query(collection(crewB.firestore(), `boats/${BOAT_ID}/paymentRequests`), where('recipientId', '==', INVITE_A_ID));
  await assertFails(getDocs(q));
});

test('lettura: ORGANIZER_A non puo leggere la richiesta di CREW_A', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-a', { recipientId: INVITE_A_ID });
  const organizer = organizerContext(testEnv);
  await assertFails(getDoc(paymentDoc(organizer, 'payment-a')));
});

test('lettura: OUTSIDER_A non puo leggere la richiesta di CREW_A', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-a', { recipientId: INVITE_A_ID });
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(paymentDoc(outsider, 'payment-a')));
});

test('lettura: dopo un innalzamento di rulesVersion, la vecchia accettazione di CREW_A non e piu corrente', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-a', { recipientId: INVITE_A_ID });
  await seedBriefing(RULES_VERSION + 1); // lo skipper alza la versione del briefing
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(paymentDoc(crewA, 'payment-a')));
});

test('stati: SKIPPER_A verifica una richiesta preparata (prepared -> verified)', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-verify', { recipientId: INVITE_A_ID, status: 'prepared' });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(updateDoc(paymentDoc(skipper, 'payment-verify'), {
    status: 'verified', verifiedAt: serverTimestamp(), verifiedBy: SKIPPER_A,
  }));
});

test('stati: SKIPPER_A annulla una richiesta preparata (prepared -> cancelled)', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-cancel', { recipientId: INVITE_A_ID, status: 'prepared' });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(updateDoc(paymentDoc(skipper, 'payment-cancel'), {
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: SKIPPER_A,
  }));
});

test('stati: ORGANIZER_A non puo verificare una richiesta', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-verify-organizer', { recipientId: INVITE_A_ID, status: 'prepared' });
  const organizer = organizerContext(testEnv);
  await assertFails(updateDoc(paymentDoc(organizer, 'payment-verify-organizer'), {
    status: 'verified', verifiedAt: serverTimestamp(), verifiedBy: ORGANIZER_A,
  }));
});

test('stati: ORGANIZER_A non puo annullare una richiesta', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-cancel-organizer', { recipientId: INVITE_A_ID, status: 'prepared' });
  const organizer = organizerContext(testEnv);
  await assertFails(updateDoc(paymentDoc(organizer, 'payment-cancel-organizer'), {
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: ORGANIZER_A,
  }));
});

const forbiddenExtraFieldsOnVerify = [
  ['amountCents', 99999],
  ['recipientId', INVITE_B_ID],
  ['contributionItemId', 'fuel'],
  ['accountingCategory', 'other'],
  ['paymentMethods', { satispay: true }],
];
for (const [field, value] of forbiddenExtraFieldsOnVerify) {
  test(`stati: SKIPPER_A non puo verificare cambiando anche ${field} nello stesso update`, async () => {
    await seedCrewABaseline();
    const requestId = `payment-verify-plus-${field}`;
    await seedRawPaymentRequest(requestId, { recipientId: INVITE_A_ID, status: 'prepared' });
    const skipper = skipperContext(testEnv);
    await assertFails(updateDoc(paymentDoc(skipper, requestId), {
      status: 'verified', verifiedAt: serverTimestamp(), verifiedBy: SKIPPER_A,
      [field]: value,
    }));
  });
}

test('legacy: SKIPPER_A classifica una richiesta legacy verificata aggiungendo solo entryType/installmentType/allocation', async () => {
  await seedCrewABaseline();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/paymentRequests/legacy-a`), {
      recipientId: INVITE_A_ID, memberId: INVITE_A_ID, payerInviteId: INVITE_A_ID,
      contributionItemId: 'berth_double_cabin', amountCents: 20000, currency: 'EUR',
      reason: 'Quota posto letto', accountingCategory: 'cost_recovery', isOptional: false,
      dueDate: '', collectorId: SKIPPER_A, collectorName: SKIPPER_NAME, paymentMethods: { paypal: true },
      status: 'verified', createdAt: Timestamp.now(), createdBy: SKIPPER_A,
      verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A, cancelledAt: null, cancelledBy: null,
      declaredAt: null, declaredBy: null, declaredMethod: null,
    });
  });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(updateDoc(paymentDoc(skipper, 'legacy-a'), {
    entryType: 'request', installmentType: 'advance', allocation: allocationFor(20000),
  }));
});

test('legacy: la riclassificazione che cambia anche amountCents viene negata', async () => {
  await seedCrewABaseline();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/paymentRequests/legacy-b`), {
      recipientId: INVITE_A_ID, memberId: INVITE_A_ID, payerInviteId: INVITE_A_ID,
      contributionItemId: 'berth_double_cabin', amountCents: 20000, currency: 'EUR',
      reason: 'Quota posto letto', accountingCategory: 'cost_recovery', isOptional: false,
      dueDate: '', collectorId: SKIPPER_A, collectorName: SKIPPER_NAME, paymentMethods: { paypal: true },
      status: 'verified', createdAt: Timestamp.now(), createdBy: SKIPPER_A,
      verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A, cancelledAt: null, cancelledBy: null,
      declaredAt: null, declaredBy: null, declaredMethod: null,
    });
  });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(paymentDoc(skipper, 'legacy-b'), {
    entryType: 'request', installmentType: 'advance', allocation: allocationFor(20000),
    amountCents: 21000,
  }));
});

// ===========================================================================
// CASO 4: Dichiarazione di pagamento
// ===========================================================================

test('dichiarazione: CREW_A dichiara la propria richiesta con un metodo abilitato', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-ok', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true },
  });
  const crewA = crewAContext(testEnv);
  await assertSucceeds(updateDoc(paymentDoc(crewA, 'payment-declare-ok'), {
    declaredAt: serverTimestamp(), declaredBy: CREW_A, declaredMethod: 'paypal',
  }));
  let snap;
  await testEnv.withSecurityRulesDisabled(async (ctx) => { snap = await getDoc(paymentDoc(ctx, 'payment-declare-ok')); });
  assert.equal(snap.data().declaredMethod, 'paypal');
  assert.equal(snap.data().declaredBy, CREW_A);
});

test('dichiarazione: un metodo non abilitato in quella richiesta viene negato', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-bad-method', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true },
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'payment-declare-bad-method'), {
    declaredAt: serverTimestamp(), declaredBy: CREW_A, declaredMethod: 'bankTransfer',
  }));
});

test('dichiarazione: una seconda dichiarazione sulla stessa richiesta gia dichiarata viene negata', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-twice', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true },
    declaredAt: Timestamp.now(), declaredBy: CREW_A, declaredMethod: 'paypal',
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'payment-declare-twice'), {
    declaredAt: serverTimestamp(), declaredBy: CREW_A, declaredMethod: 'paypal',
  }));
});

test('dichiarazione: una ricevuta manuale gia verificata non puo essere dichiarata', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('manual-advance-declare', {
    recipientId: INVITE_A_ID, status: 'verified', entryType: 'manual_receipt',
    paymentMethods: {}, verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A,
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'manual-advance-declare'), {
    declaredAt: serverTimestamp(), declaredBy: CREW_A, declaredMethod: 'bankTransfer',
  }));
});

test('dichiarazione: una richiesta gia verified non puo essere dichiarata', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-verified', {
    recipientId: INVITE_A_ID, status: 'verified', paymentMethods: { paypal: true },
    verifiedAt: Timestamp.now(), verifiedBy: SKIPPER_A,
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'payment-declare-verified'), {
    declaredAt: serverTimestamp(), declaredBy: CREW_A, declaredMethod: 'paypal',
  }));
});

test('dichiarazione: una richiesta gia cancelled non puo essere dichiarata', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-cancelled', {
    recipientId: INVITE_A_ID, status: 'cancelled', paymentMethods: { paypal: true },
    cancelledAt: Timestamp.now(), cancelledBy: SKIPPER_A,
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'payment-declare-cancelled'), {
    declaredAt: serverTimestamp(), declaredBy: CREW_A, declaredMethod: 'paypal',
  }));
});

test('dichiarazione: CREW_A non puo dichiarare una richiesta che appartiene a CREW_B', async () => {
  await seedCrewABaseline();
  await seedCrewBBaseline();
  await seedRawPaymentRequest('payment-of-crew-b', {
    recipientId: INVITE_B_ID, status: 'prepared', paymentMethods: { paypal: true },
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'payment-of-crew-b'), {
    declaredAt: serverTimestamp(), declaredBy: CREW_A, declaredMethod: 'paypal',
  }));
});

test('dichiarazione: dichiarare e cambiare amountCents nello stesso update viene negato', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-plus-amount', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true }, amountCents: 12000,
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'payment-declare-plus-amount'), {
    declaredAt: serverTimestamp(), declaredBy: CREW_A, declaredMethod: 'paypal', amountCents: 1,
  }));
});

test('dichiarazione: dichiarare e cambiare status nello stesso update viene negato', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-plus-status', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true },
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'payment-declare-plus-status'), {
    declaredAt: serverTimestamp(), declaredBy: CREW_A, declaredMethod: 'paypal', status: 'verified',
  }));
});

test('dichiarazione: declaredBy diverso dal proprio uid viene negato', async () => {
  await seedCrewABaseline();
  await seedCrewBBaseline();
  await seedRawPaymentRequest('payment-declare-wrong-declaredby', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true },
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'payment-declare-wrong-declaredby'), {
    declaredAt: serverTimestamp(), declaredBy: CREW_B, declaredMethod: 'paypal',
  }));
});

test('dichiarazione: declaredAt come timestamp letterale invece di serverTimestamp viene negato', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-literal-timestamp', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true },
  });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(paymentDoc(crewA, 'payment-declare-literal-timestamp'), {
    declaredAt: Timestamp.now(), declaredBy: CREW_A, declaredMethod: 'paypal',
  }));
});

test('dichiarazione: SKIPPER_A non puo dichiarare la richiesta di CREW_A', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-by-skipper', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true },
  });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(paymentDoc(skipper, 'payment-declare-by-skipper'), {
    declaredAt: serverTimestamp(), declaredBy: SKIPPER_A, declaredMethod: 'paypal',
  }));
});

test('dichiarazione: ORGANIZER_A non puo dichiarare la richiesta di CREW_A', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-by-organizer', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true },
  });
  const organizer = organizerContext(testEnv);
  await assertFails(updateDoc(paymentDoc(organizer, 'payment-declare-by-organizer'), {
    declaredAt: serverTimestamp(), declaredBy: ORGANIZER_A, declaredMethod: 'paypal',
  }));
});

test('dichiarazione: OUTSIDER_A non puo dichiarare la richiesta di CREW_A', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declare-by-outsider', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true },
  });
  const outsider = outsiderContext(testEnv);
  await assertFails(updateDoc(paymentDoc(outsider, 'payment-declare-by-outsider'), {
    declaredAt: serverTimestamp(), declaredBy: OUTSIDER_A, declaredMethod: 'paypal',
  }));
});

test('dichiarazione: la verifica dello skipper non altera i campi di dichiarazione gia presenti', async () => {
  await seedCrewABaseline();
  await seedRawPaymentRequest('payment-declared-then-verified', {
    recipientId: INVITE_A_ID, status: 'prepared', paymentMethods: { paypal: true },
    declaredAt: Timestamp.now(), declaredBy: CREW_A, declaredMethod: 'paypal',
  });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(updateDoc(paymentDoc(skipper, 'payment-declared-then-verified'), {
    status: 'verified', verifiedAt: serverTimestamp(), verifiedBy: SKIPPER_A,
  }));
  let snap;
  await testEnv.withSecurityRulesDisabled(async (ctx) => { snap = await getDoc(paymentDoc(ctx, 'payment-declared-then-verified')); });
  assert.equal(snap.data().declaredBy, CREW_A);
  assert.equal(snap.data().declaredMethod, 'paypal');
  assert.notEqual(snap.data().declaredAt, null);
});

// ===========================================================================
// CASO 5: Pagamento segnalato spontaneamente (self_reported)
// ===========================================================================

function selfReportedPayload(overrides = {}) {
  const {
    recipientId = INVITE_A_ID,
    memberId = recipientId,
    payerInviteId = recipientId,
    amountCents = 8000,
    declaredMethod = 'bankTransfer',
    createdBy = CREW_A,
    declaredBy = CREW_A,
    status = 'prepared',
    extraTopLevel = {},
  } = overrides;
  return {
    recipientId, memberId, payerInviteId,
    entryType: 'self_reported',
    amountCents,
    currency: 'EUR',
    reason: 'Pagamento segnalato dalla persona',
    accountingCategory: 'cost_recovery',
    isOptional: false,
    dueDate: '',
    paymentMethods: {},
    status,
    createdAt: serverTimestamp(),
    createdBy,
    verifiedAt: null,
    verifiedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    declaredAt: serverTimestamp(),
    declaredBy,
    declaredMethod,
    ...extraTopLevel,
  };
}

test('self_reported: CREW_A segnala un proprio pagamento spontaneo', async () => {
  await seedCrewABaseline();
  const crewA = crewAContext(testEnv);
  await assertSucceeds(setDoc(paymentDoc(crewA, 'self-reported-ok'), selfReportedPayload({})));
});

test('self_reported: recipientId di un altra persona (CREW_B) viene negato', async () => {
  await seedCrewABaseline();
  await seedCrewBBaseline();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(paymentDoc(crewA, 'self-reported-wrong-recipient'), selfReportedPayload({ recipientId: INVITE_B_ID, memberId: INVITE_B_ID, payerInviteId: INVITE_B_ID })));
});

test('self_reported: memberId diverso dal proprio invito viene negato', async () => {
  await seedCrewABaseline();
  await seedCrewBBaseline();
  const crewA = crewAContext(testEnv);
  const payload = selfReportedPayload({});
  payload.memberId = INVITE_B_ID;
  await assertFails(setDoc(paymentDoc(crewA, 'self-reported-wrong-member'), payload));
});

test('self_reported: payerInviteId diverso dal proprio invito viene negato', async () => {
  await seedCrewABaseline();
  await seedCrewBBaseline();
  const crewA = crewAContext(testEnv);
  const payload = selfReportedPayload({});
  payload.payerInviteId = INVITE_B_ID;
  await assertFails(setDoc(paymentDoc(crewA, 'self-reported-wrong-payer'), payload));
});

test('self_reported: creazione diretta con status "verified" viene negata', async () => {
  await seedCrewABaseline();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(paymentDoc(crewA, 'self-reported-verified'), selfReportedPayload({ status: 'verified' })));
});

for (const [field, value] of [
  ['contributionItemId', 'berth_double_cabin'],
  ['collectorId', SKIPPER_A],
  ['collectorName', SKIPPER_NAME],
  ['allocation', { berthCents: 4000, protectionInsuranceCents: 4000 }],
]) {
  test(`self_reported: l aggiunta del campo riservato "${field}" viene negata`, async () => {
    await seedCrewABaseline();
    const crewA = crewAContext(testEnv);
    const payload = selfReportedPayload({ extraTopLevel: { [field]: value } });
    await assertFails(setDoc(paymentDoc(crewA, `self-reported-extra-${field}`), payload));
  });
}

test('self_reported: amountCents a 0 viene negato', async () => {
  await seedCrewABaseline();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(paymentDoc(crewA, 'self-reported-zero'), selfReportedPayload({ amountCents: 0 })));
});

test('self_reported: amountCents oltre il limite (1000001) viene negato', async () => {
  await seedCrewABaseline();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(paymentDoc(crewA, 'self-reported-over-limit'), selfReportedPayload({ amountCents: 1000001 })));
});

test('self_reported: senza una accettazione corrente del briefing viene negato', async () => {
  await seedCrewABaseline({ withAcceptance: false });
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(paymentDoc(crewA, 'self-reported-no-acceptance'), selfReportedPayload({})));
});

test('self_reported: SKIPPER_A verifica il documento appena segnalato con la stessa logica di verifica ordinaria', async () => {
  await seedCrewABaseline();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(paymentDoc(ctx, 'self-reported-to-verify'), selfReportedPayload({}));
  });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(updateDoc(paymentDoc(skipper, 'self-reported-to-verify'), {
    status: 'verified', verifiedAt: serverTimestamp(), verifiedBy: SKIPPER_A,
  }));
});

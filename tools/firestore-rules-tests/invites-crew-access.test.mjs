// Matrice: inviti (schema, claim, riemissione, revoca) e catena di accesso
// equipaggio (crewAccess, crewLoginIndex), piu' il percorso legacy
// participantAccess. Vedi FIRESTORE_RULES_TEST_MATRIX.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  ORGANIZER_A,
  SKIPPER_A,
  OUTSIDER_A,
  CREW_A,
  CREW_B,
  CREW_A_EMAIL,
  CREW_B_EMAIL,
  ANON_A,
  INVITE_A_ID,
  INVITE_B_ID,
  ACCESS_KEY_A,
  PHONE_FINGERPRINT_A,
  organizerContext,
  skipperContext,
  outsiderContext,
  crewContext,
  crewAContext,
  crewBContext,
  anonContext,
  eventDocData,
  boatDocData,
} from './identities.mjs';

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-invites',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});
test.after(async () => { await testEnv?.cleanup(); });
test.beforeEach(async () => { await testEnv.clearFirestore(); });

// ---------------------------------------------------------------------------
// Costanti e helper locali (fittizi, coerenti con la fixture della matrice)
// ---------------------------------------------------------------------------

const OTHER_BOAT_ID = 'OTHER_BOAT_TEST';
const NEW_ACCESS_KEY_A = 'f'.repeat(48);
const PHONE_FINGERPRINT_OTHER = 'e'.repeat(64);

function futureTimestamp(offsetMs = 7 * 24 * 3600 * 1000) {
  return Timestamp.fromMillis(Date.now() + offsetMs);
}
function pastTimestamp(offsetMs = 3600 * 1000) {
  return Timestamp.fromMillis(Date.now() - offsetMs);
}

async function seedOpenEventAndBoat(boatOverrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData({ open: true }));
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}`), boatDocData(boatOverrides));
  });
}

// Seeda (bypassando le Rules) un invito con lo schema completo; ritorna
// { boatId, inviteId } per comodita' del chiamante.
async function seedInviteDoc(overrides = {}) {
  const data = {
    id: INVITE_A_ID,
    boatId: SKIPPER_A,
    displayName: 'Crew Uno di test',
    whatsappNumber: '+39 333 0000001',
    phoneFingerprint: PHONE_FINGERPRINT_A,
    loginEmail: CREW_A_EMAIL,
    accessKey: ACCESS_KEY_A,
    participantUid: null,
    status: 'pending',
    accessVersion: 1,
    expiresAt: futureTimestamp(),
    preferredLocale: 'it',
    createdAt: Timestamp.now(),
    createdBy: SKIPPER_A,
    ...overrides,
  };
  const boatId = data.boatId;
  const inviteId = data.id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/invites/${inviteId}`), data);
  });
  return { boatId, inviteId };
}

async function seedCrewAccessDoc({ uid, boatId, inviteId, email }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `crewAccess/${uid}`), {
      boatId, inviteId, userId: uid, loginEmail: email, updatedAt: Timestamp.now(),
    });
  });
}

async function seedCrewLoginIndex({ phoneFingerprint, boatId, inviteId, email }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `crewLoginIndex/${phoneFingerprint}`), {
      loginEmail: email, boatId, inviteId, updatedAt: Timestamp.now(),
    });
  });
}

async function seedCrewDraft({ boatId = SKIPPER_A, inviteId, uid, accessVersion = 1 }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/crewDrafts/${inviteId}`), {
      participantUid: uid,
      accessVersion,
      firstName: 'Crew', lastName: 'Bozza di test', displayName: 'Crew Bozza di test',
    });
  });
}

async function seedBriefingBoard(boatId = SKIPPER_A) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/briefing/board`), {
      rulesTitle: 'Regolamento di bordo di test',
      rulesSummary: 'Sintesi regole di test',
      rulesText: 'Testo completo del regolamento di bordo, fittizio.',
      fullRulesRequired: true,
      rulesVersion: 2,
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

async function seedRuleAcceptance({ boatId = SKIPPER_A, inviteId, uid }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/ruleAcceptances/${inviteId}`), {
      inviteId, acceptedBy: uid, rulesVersion: 2, fullRulesRead: true,
      acceptedLocale: 'it', acceptedAt: Timestamp.now(),
    });
  });
}

async function seedMemberDoc({ boatId = SKIPPER_A, memberId }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/members/${memberId}`), {
      firstName: 'Crew', lastName: 'Test', displayName: 'Crew Test', updatedAt: Timestamp.now(),
    });
  });
}

async function seedPaymentRequest({ boatId = SKIPPER_A, requestId, recipientId }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/paymentRequests/${requestId}`), {
      recipientId,
      contributionItemId: 'berth_double_cabin',
      entryType: 'request',
      installmentType: 'advance',
      amountCents: 10000,
      currency: 'EUR',
      accountingCategory: 'cost_recovery',
      status: 'prepared',
      declaredAt: null,
      declaredBy: null,
      declaredMethod: null,
    });
  });
}

async function seedCrewTravelStatus({ boatId = SKIPPER_A, inviteId }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/crewTravelStatus/${inviteId}`), {
      inviteId,
      outbound: 'missing',
      return: 'missing',
      outboundOperationStatus: 'new',
      returnOperationStatus: 'new',
      outboundRevision: 1,
      returnRevision: 1,
      updatedAt: Timestamp.now(),
    });
  });
}

// ===========================================================================
// Caso: Schema invito
// ===========================================================================

function buildInvitePayload(overrides = {}) {
  const payload = {
    id: INVITE_A_ID,
    boatId: SKIPPER_A,
    displayName: 'Crew Uno di test',
    whatsappNumber: '+39 333 0000001',
    phoneFingerprint: PHONE_FINGERPRINT_A,
    loginEmail: CREW_A_EMAIL,
    accessKey: ACCESS_KEY_A,
    participantUid: null,
    status: 'pending',
    accessVersion: 1,
    expiresAt: futureTimestamp(),
    preferredLocale: 'it',
    createdAt: serverTimestamp(),
    createdBy: SKIPPER_A,
    ...overrides,
  };
  return payload;
}

test('schema invito: lo skipper crea un invito con payload esatto e preferredLocale it', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertSucceeds(setDoc(
    doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`),
    buildInvitePayload({ preferredLocale: 'it' }),
  ));
});

test('schema invito: lo skipper crea un invito con payload esatto e preferredLocale en', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertSucceeds(setDoc(
    doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`),
    buildInvitePayload({ preferredLocale: 'en' }),
  ));
});

test('schema invito: lo skipper crea un invito senza il campo preferredLocale (compatibilita legacy)', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  const payload = buildInvitePayload();
  delete payload.preferredLocale;
  await assertSucceeds(setDoc(
    doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`),
    payload,
  ));
});

test('schema invito: un campo extra nel payload nega la creazione', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`),
    buildInvitePayload({ note: 'campo non previsto' }),
  ));
});

test('schema invito: preferredLocale diverso da it/en nega la creazione', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`),
    buildInvitePayload({ preferredLocale: 'fr' }),
  ));
});

test('schema invito: status diverso da pending nega la creazione', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`),
    buildInvitePayload({ status: 'active' }),
  ));
});

test('schema invito: accessKey piu corta di 48 caratteri nega la creazione', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`),
    buildInvitePayload({ accessKey: 'a'.repeat(20) }),
  ));
});

test('schema invito: boatId diverso da SKIPPER_A nega la creazione', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`),
    buildInvitePayload({ boatId: OTHER_BOAT_ID }),
  ));
});

test('schema invito: id del payload non coerente col path nega la creazione', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`),
    buildInvitePayload({ id: INVITE_B_ID }),
  ));
});

test('schema invito: expiresAt nel passato nega la creazione', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`),
    buildInvitePayload({ expiresAt: pastTimestamp() }),
  ));
});

// ===========================================================================
// Caso: Invito prima dell'attivazione
// ===========================================================================

test('invito prima dellattivazione: nessuno tranne organizzatore/skipper puo leggere linvito', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null });
  const actors = [crewAContext(testEnv), anonContext(testEnv), outsiderContext(testEnv)];
  for (const actor of actors) {
    await assertFails(getDoc(doc(actor.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`)));
  }
});

test('invito prima dellattivazione: nessuno tranne organizzatore/skipper puo leggere members/{id}', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null });
  const actors = [crewAContext(testEnv), anonContext(testEnv), outsiderContext(testEnv)];
  for (const actor of actors) {
    await assertFails(getDoc(doc(actor.firestore(), `boats/${SKIPPER_A}/members/${INVITE_A_ID}`)));
  }
});

test('invito prima dellattivazione: nessuno puo creare crewAccess sul proprio uid prima del claim', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null });
  const attempts = [
    { ctx: crewAContext(testEnv), uid: CREW_A, email: CREW_A_EMAIL },
    { ctx: anonContext(testEnv), uid: ANON_A, email: null },
    { ctx: outsiderContext(testEnv), uid: OUTSIDER_A, email: null },
  ];
  for (const { ctx, uid, email } of attempts) {
    await assertFails(setDoc(doc(ctx.firestore(), `crewAccess/${uid}`), {
      boatId: SKIPPER_A, inviteId: INVITE_A_ID, userId: uid, loginEmail: email ?? CREW_A_EMAIL, updatedAt: serverTimestamp(),
    }));
  }
});

// ===========================================================================
// Caso: Claim iniziale
// ===========================================================================

test('claim iniziale: CREW_A reclama linvito con laggiornamento minimo esatto', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertSucceeds(updateDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: CREW_A, status: 'active', activatedAt: serverTimestamp(),
  }));
});

test('claim iniziale: email del token diversa da loginEmail nega il claim anche con lo stesso uid', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const mismatched = crewContext(testEnv, CREW_A, 'altra-email@crew.egadi.thatsablast.it');
  await assertFails(updateDoc(doc(mismatched.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: CREW_A, status: 'active', activatedAt: serverTimestamp(),
  }));
});

test('claim iniziale: cambiare anche boatId nello stesso update nega tutta loperazione', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: CREW_A, status: 'active', activatedAt: serverTimestamp(), boatId: OTHER_BOAT_ID,
  }));
});

test('claim iniziale: cambiare anche accessKey nello stesso update nega tutta loperazione', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: CREW_A, status: 'active', activatedAt: serverTimestamp(), accessKey: NEW_ACCESS_KEY_A,
  }));
});

test('claim iniziale: cambiare anche loginEmail nello stesso update nega tutta loperazione', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: CREW_A, status: 'active', activatedAt: serverTimestamp(), loginEmail: 'nuova@crew.egadi.thatsablast.it',
  }));
});

test('claim iniziale: cambiare anche expiresAt nello stesso update nega tutta loperazione', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: CREW_A, status: 'active', activatedAt: serverTimestamp(), expiresAt: futureTimestamp(14 * 24 * 3600 * 1000),
  }));
});

// ===========================================================================
// Caso: Claim errato
// ===========================================================================

test('claim errato: CREW_B con email diversa non puo reclamare linvito di CREW_A', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const crewB = crewBContext(testEnv);
  await assertFails(updateDoc(doc(crewB.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: CREW_B, status: 'active', activatedAt: serverTimestamp(),
  }));
});

test('claim errato: un account Google (skipper) non puo reclamare linvito', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: SKIPPER_A, status: 'active', activatedAt: serverTimestamp(),
  }));
});

test('claim errato: un account Google (organizzatore) non puo reclamare linvito', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const organizer = organizerContext(testEnv);
  await assertFails(updateDoc(doc(organizer.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: ORGANIZER_A, status: 'active', activatedAt: serverTimestamp(),
  }));
});

test('claim errato: un utente anonimo non puo reclamare linvito', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const anon = anonContext(testEnv);
  await assertFails(updateDoc(doc(anon.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: ANON_A, status: 'active', activatedAt: serverTimestamp(),
  }));
});

test('claim errato: CREW_A non puo reclamare un invito scaduto', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL, expiresAt: pastTimestamp() });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: CREW_A, status: 'active', activatedAt: serverTimestamp(),
  }));
});

test('claim errato: CREW_A non puo ri-reclamare un invito gia attivo', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(updateDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: CREW_A, status: 'active', activatedAt: serverTimestamp(),
  }));
});

// ===========================================================================
// Caso: Record di accesso (crewAccess)
// ===========================================================================

test('record di accesso: CREW_A crea crewAccess/CREW_A dopo il claim con campi coerenti', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertSucceeds(setDoc(doc(crewA.firestore(), `crewAccess/${CREW_A}`), {
    boatId: SKIPPER_A, inviteId: INVITE_A_ID, userId: CREW_A, loginEmail: CREW_A_EMAIL, updatedAt: serverTimestamp(),
  }));
});

test('record di accesso: id del documento diverso dal proprio uid nega la creazione', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `crewAccess/${OUTSIDER_A}`), {
    boatId: SKIPPER_A, inviteId: INVITE_A_ID, userId: CREW_A, loginEmail: CREW_A_EMAIL, updatedAt: serverTimestamp(),
  }));
});

test('record di accesso: boatId diverso da quello dellinvito reclamato nega la creazione', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `crewAccess/${CREW_A}`), {
    boatId: OTHER_BOAT_ID, inviteId: INVITE_A_ID, userId: CREW_A, loginEmail: CREW_A_EMAIL, updatedAt: serverTimestamp(),
  }));
});

test('record di accesso: inviteId diverso da quello dellinvito reclamato nega la creazione', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `crewAccess/${CREW_A}`), {
    boatId: SKIPPER_A, inviteId: INVITE_B_ID, userId: CREW_A, loginEmail: CREW_A_EMAIL, updatedAt: serverTimestamp(),
  }));
});

test('record di accesso: la creazione prima del claim (invito ancora pending) e negata', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, loginEmail: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `crewAccess/${CREW_A}`), {
    boatId: SKIPPER_A, inviteId: INVITE_A_ID, userId: CREW_A, loginEmail: CREW_A_EMAIL, updatedAt: serverTimestamp(),
  }));
});

// ===========================================================================
// Caso: Indice del numero (crewLoginIndex)
// ===========================================================================

test('indice del numero: CREW_A crea crewLoginIndex sulla propria impronta dopo crewAccess', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, loginEmail: CREW_A_EMAIL, phoneFingerprint: PHONE_FINGERPRINT_A });
  await seedCrewAccessDoc({ uid: CREW_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertSucceeds(setDoc(doc(crewA.firestore(), `crewLoginIndex/${PHONE_FINGERPRINT_A}`), {
    loginEmail: CREW_A_EMAIL, boatId: SKIPPER_A, inviteId: INVITE_A_ID, updatedAt: serverTimestamp(),
  }));
});

test('indice del numero: un impronta diversa da quella dellinvito reclamato nega la creazione', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, loginEmail: CREW_A_EMAIL, phoneFingerprint: PHONE_FINGERPRINT_A });
  await seedCrewAccessDoc({ uid: CREW_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `crewLoginIndex/${PHONE_FINGERPRINT_OTHER}`), {
    loginEmail: CREW_A_EMAIL, boatId: SKIPPER_A, inviteId: INVITE_A_ID, updatedAt: serverTimestamp(),
  }));
});

test('indice del numero: campi extra nel payload negano la creazione', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, loginEmail: CREW_A_EMAIL, phoneFingerprint: PHONE_FINGERPRINT_A });
  await seedCrewAccessDoc({ uid: CREW_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `crewLoginIndex/${PHONE_FINGERPRINT_A}`), {
    loginEmail: CREW_A_EMAIL, boatId: SKIPPER_A, inviteId: INVITE_A_ID, updatedAt: serverTimestamp(),
    displayName: 'Nome non previsto',
  }));
});

test('indice del numero: la lettura puntuale con area aperta e consentita a un contesto non autenticato', async () => {
  await seedOpenEventAndBoat();
  await seedCrewLoginIndex({ phoneFingerprint: PHONE_FINGERPRINT_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  const unauth = testEnv.unauthenticatedContext();
  const snap = await assertSucceeds(getDoc(doc(unauth.firestore(), `crewLoginIndex/${PHONE_FINGERPRINT_A}`)));
  assert.equal(snap.data().inviteId, INVITE_A_ID);
});

test('indice del numero: il list sulla collezione e sempre negato a un contesto non autenticato', async () => {
  await seedOpenEventAndBoat();
  await seedCrewLoginIndex({ phoneFingerprint: PHONE_FINGERPRINT_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  const unauth = testEnv.unauthenticatedContext();
  await assertFails(getDocs(collection(unauth.firestore(), 'crewLoginIndex')));
});

test('indice del numero: il list sulla collezione e negato anche a un titolare autenticato', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, loginEmail: CREW_A_EMAIL, phoneFingerprint: PHONE_FINGERPRINT_A });
  await seedCrewAccessDoc({ uid: CREW_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  await seedCrewLoginIndex({ phoneFingerprint: PHONE_FINGERPRINT_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(getDocs(collection(crewA.firestore(), 'crewLoginIndex')));
});

// ===========================================================================
// Caso: Un numero, una barca (solo la parte Rules)
// ===========================================================================

test('un numero una barca: CREW_B non puo aggiornare lindice esistente per farlo puntare a un altro invito', async () => {
  await seedOpenEventAndBoat();
  // INVITE_A attivo su boats/SKIPPER_A, indice esistente che punta a lui.
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, loginEmail: CREW_A_EMAIL, phoneFingerprint: PHONE_FINGERPRINT_A });
  await seedCrewLoginIndex({ phoneFingerprint: PHONE_FINGERPRINT_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  // Un secondo invito (altra barca) con la STESSA impronta, reclamato da CREW_B.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${OTHER_BOAT_ID}/invites/${INVITE_B_ID}`), {
      id: INVITE_B_ID, boatId: OTHER_BOAT_ID, displayName: 'Crew Due di test', whatsappNumber: '+39 333 0000002',
      phoneFingerprint: PHONE_FINGERPRINT_A, loginEmail: CREW_B_EMAIL, accessKey: NEW_ACCESS_KEY_A,
      participantUid: CREW_B, status: 'active', accessVersion: 1, expiresAt: futureTimestamp(), createdAt: Timestamp.now(), createdBy: SKIPPER_A,
    });
  });
  await seedCrewAccessDoc({ uid: CREW_B, boatId: OTHER_BOAT_ID, inviteId: INVITE_B_ID, email: CREW_B_EMAIL });

  const crewB = crewBContext(testEnv);
  await assertFails(updateDoc(doc(crewB.firestore(), `crewLoginIndex/${PHONE_FINGERPRINT_A}`), {
    boatId: OTHER_BOAT_ID, inviteId: INVITE_B_ID, loginEmail: CREW_B_EMAIL, updatedAt: serverTimestamp(),
  }));
});

// ===========================================================================
// Caso: Riemissione
// ===========================================================================

test('riemissione: schema atomico completo senza bozza esistente e consentito', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, accessVersion: 1, loginEmail: CREW_A_EMAIL });
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    status: 'pending', participantUid: null, accessKey: NEW_ACCESS_KEY_A, expiresAt: futureTimestamp(14 * 24 * 3600 * 1000),
    accessVersion: 2, reissuedAt: serverTimestamp(), reissuedBy: SKIPPER_A,
  });
  await assertSucceeds(batch.commit());
});

test('riemissione: schema atomico completo con cancellazione della bozza esistente e consentito', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, accessVersion: 1, loginEmail: CREW_A_EMAIL });
  await seedCrewDraft({ inviteId: INVITE_A_ID, uid: CREW_A, accessVersion: 1 });
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    status: 'pending', participantUid: null, accessKey: NEW_ACCESS_KEY_A, expiresAt: futureTimestamp(14 * 24 * 3600 * 1000),
    accessVersion: 2, reissuedAt: serverTimestamp(), reissuedBy: SKIPPER_A,
  });
  batch.delete(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewDrafts/${INVITE_A_ID}`));
  await assertSucceeds(batch.commit());
});

test('riemissione: senza cancellare la bozza esistente nello stesso batch e negata', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, accessVersion: 1, loginEmail: CREW_A_EMAIL });
  await seedCrewDraft({ inviteId: INVITE_A_ID, uid: CREW_A, accessVersion: 1 });
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    status: 'pending', participantUid: null, accessKey: NEW_ACCESS_KEY_A, expiresAt: futureTimestamp(14 * 24 * 3600 * 1000),
    accessVersion: 2, reissuedAt: serverTimestamp(), reissuedBy: SKIPPER_A,
  });
  await assertFails(batch.commit());
});

test('riemissione: cancellare la bozza da sola senza gli altri campi di riemissione e negata', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, accessVersion: 1, loginEmail: CREW_A_EMAIL });
  await seedCrewDraft({ inviteId: INVITE_A_ID, uid: CREW_A, accessVersion: 1 });
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.delete(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewDrafts/${INVITE_A_ID}`));
  await assertFails(batch.commit());
});

test('riemissione: cambiare boatId nello stesso update e negato', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, accessVersion: 1, loginEmail: CREW_A_EMAIL });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    status: 'pending', participantUid: null, accessKey: NEW_ACCESS_KEY_A, expiresAt: futureTimestamp(),
    accessVersion: 2, reissuedAt: serverTimestamp(), reissuedBy: SKIPPER_A, boatId: OTHER_BOAT_ID,
  }));
});

test('riemissione: cambiare lid nello stesso update e negato', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, accessVersion: 1, loginEmail: CREW_A_EMAIL });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    status: 'pending', participantUid: null, accessKey: NEW_ACCESS_KEY_A, expiresAt: futureTimestamp(),
    accessVersion: 2, reissuedAt: serverTimestamp(), reissuedBy: SKIPPER_A, id: INVITE_B_ID,
  }));
});

test('riemissione: un salto di accessVersion da 1 a 3 e negato', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, accessVersion: 1, loginEmail: CREW_A_EMAIL });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    status: 'pending', participantUid: null, accessKey: NEW_ACCESS_KEY_A, expiresAt: futureTimestamp(),
    accessVersion: 3, reissuedAt: serverTimestamp(), reissuedBy: SKIPPER_A,
  }));
});

// ===========================================================================
// Caso: Due schede skipper (riemissioni in corsa)
// ===========================================================================

test('due schede skipper: la prima riemissione riesce, la seconda basata sulla versione ormai superata e negata', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'active', participantUid: CREW_A, accessVersion: 1, loginEmail: CREW_A_EMAIL });
  const skipper = skipperContext(testEnv);
  const inviteDocRef = doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`);

  await assertSucceeds(updateDoc(inviteDocRef, {
    status: 'pending', participantUid: null, accessKey: NEW_ACCESS_KEY_A, expiresAt: futureTimestamp(),
    accessVersion: 2, reissuedAt: serverTimestamp(), reissuedBy: SKIPPER_A,
  }));

  // Seconda "scheda" aperta prima del refresh: crede ancora che si parta da
  // accessVersion 1, quindi scrive di nuovo accessVersion 2 — ma il documento
  // e' gia' a 2, quindi il vincolo accessVersion == before + 1 (2+1=3) fallisce.
  await assertFails(updateDoc(inviteDocRef, {
    status: 'pending', participantUid: null, accessKey: 'a'.repeat(48), expiresAt: futureTimestamp(),
    accessVersion: 2, reissuedAt: serverTimestamp(), reissuedBy: SKIPPER_A,
  }));
});

// ===========================================================================
// Caso: Revoca effettiva
// ===========================================================================

test('revoca effettiva: il vecchio CREW_A non legge piu members/INVITE_A dopo la riemissione', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, accessVersion: 2, loginEmail: CREW_B_EMAIL });
  await seedCrewAccessDoc({ uid: CREW_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  await seedMemberDoc({ memberId: INVITE_A_ID });
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/members/${INVITE_A_ID}`)));
});

test('revoca effettiva: il vecchio CREW_A non legge piu la bacheca/briefing della barca', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, accessVersion: 2, loginEmail: CREW_B_EMAIL });
  await seedCrewAccessDoc({ uid: CREW_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  await seedBriefingBoard();
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/briefing/board`)));
});

test('revoca effettiva: il vecchio CREW_A non legge piu le paymentRequests della barca', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, accessVersion: 2, loginEmail: CREW_B_EMAIL });
  await seedCrewAccessDoc({ uid: CREW_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  await seedBriefingBoard();
  await seedRuleAcceptance({ inviteId: INVITE_A_ID, uid: CREW_A });
  await seedPaymentRequest({ requestId: 'payment-a', recipientId: INVITE_A_ID });
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/paymentRequests/payment-a`)));
});

test('revoca effettiva: il vecchio CREW_A non legge piu invites/INVITE_A', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, accessVersion: 2, loginEmail: CREW_B_EMAIL });
  await seedCrewAccessDoc({ uid: CREW_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`)));
});

test('revoca effettiva: il vecchio CREW_A non legge piu crewTravelStatus/INVITE_A', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, accessVersion: 2, loginEmail: CREW_B_EMAIL });
  await seedCrewAccessDoc({ uid: CREW_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  await seedMemberDoc({ memberId: INVITE_A_ID });
  await seedCrewTravelStatus({ inviteId: INVITE_A_ID });
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
});

test('revoca effettiva: il vecchio CREW_A non puo ricreare crewLoginIndex con la vecchia impronta', async () => {
  await seedOpenEventAndBoat();
  await seedInviteDoc({ status: 'pending', participantUid: null, accessVersion: 2, loginEmail: CREW_B_EMAIL, phoneFingerprint: PHONE_FINGERPRINT_A });
  await seedCrewAccessDoc({ uid: CREW_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `crewLoginIndex/${PHONE_FINGERPRINT_A}`), {
    loginEmail: CREW_A_EMAIL, boatId: SKIPPER_A, inviteId: INVITE_A_ID, updatedAt: serverTimestamp(),
  }));
});

// ===========================================================================
// Caso: Nuova attivazione
// ===========================================================================

async function seedReissuedInviteAwaitingCrewB() {
  await seedOpenEventAndBoat();
  await seedInviteDoc({
    status: 'pending', participantUid: null, accessVersion: 2, loginEmail: CREW_B_EMAIL,
    phoneFingerprint: PHONE_FINGERPRINT_A, accessKey: NEW_ACCESS_KEY_A,
  });
  await seedCrewLoginIndex({ phoneFingerprint: PHONE_FINGERPRINT_A, boatId: SKIPPER_A, inviteId: INVITE_A_ID, email: CREW_A_EMAIL });
  await seedMemberDoc({ memberId: INVITE_A_ID });
}

async function claimAndRegisterCrewB() {
  const crewB = crewBContext(testEnv);
  await assertSucceeds(updateDoc(doc(crewB.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    participantUid: CREW_B, status: 'active', activatedAt: serverTimestamp(),
  }));
  await assertSucceeds(setDoc(doc(crewB.firestore(), `crewAccess/${CREW_B}`), {
    boatId: SKIPPER_A, inviteId: INVITE_A_ID, userId: CREW_B, loginEmail: CREW_B_EMAIL, updatedAt: serverTimestamp(),
  }));
  return crewB;
}

test('nuova attivazione: CREW_B reclama linvito riemesso con il claim minimo', async () => {
  await seedReissuedInviteAwaitingCrewB();
  await claimAndRegisterCrewB();
});

test('nuova attivazione: CREW_B aggiorna crewLoginIndex sulla stessa impronta verso il proprio participantUid', async () => {
  await seedReissuedInviteAwaitingCrewB();
  const crewB = await claimAndRegisterCrewB();
  await assertSucceeds(updateDoc(doc(crewB.firestore(), `crewLoginIndex/${PHONE_FINGERPRINT_A}`), {
    boatId: SKIPPER_A, inviteId: INVITE_A_ID, loginEmail: CREW_B_EMAIL, updatedAt: serverTimestamp(),
  }));
});

test('nuova attivazione: members/INVITE_A resta leggibile al nuovo titolare CREW_B', async () => {
  await seedReissuedInviteAwaitingCrewB();
  const crewB = await claimAndRegisterCrewB();
  await assertSucceeds(getDoc(doc(crewB.firestore(), `boats/${SKIPPER_A}/members/${INVITE_A_ID}`)));
});

test('nuova attivazione: le paymentRequests esistenti dello stesso invito restano leggibili a CREW_B', async () => {
  await seedReissuedInviteAwaitingCrewB();
  await seedBriefingBoard();
  await seedPaymentRequest({ requestId: 'payment-a', recipientId: INVITE_A_ID });
  const crewB = await claimAndRegisterCrewB();
  await seedRuleAcceptance({ inviteId: INVITE_A_ID, uid: CREW_B });
  await assertSucceeds(getDoc(doc(crewB.firestore(), `boats/${SKIPPER_A}/paymentRequests/payment-a`)));
});

// ===========================================================================
// Caso: Percorso legacy (participantAccess)
// ===========================================================================

async function assertParticipantAccessFullyDenied(ctx) {
  const existingRef = doc(ctx.firestore(), `boats/${SKIPPER_A}/participantAccess/placeholder`);
  const newRef = doc(ctx.firestore(), `boats/${SKIPPER_A}/participantAccess/altro-uid`);
  await assertFails(getDoc(existingRef));
  await assertFails(getDocs(collection(ctx.firestore(), `boats/${SKIPPER_A}/participantAccess`)));
  await assertFails(setDoc(newRef, { note: 'tentativo di test' }));
  await assertFails(updateDoc(existingRef, { note: 'tentativo di test' }));
  await assertFails(deleteDoc(existingRef));
}

test('percorso legacy: lo skipper non ha alcun accesso a participantAccess', async () => {
  await seedOpenEventAndBoat();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/participantAccess/placeholder`), { legacy: true });
  });
  await assertParticipantAccessFullyDenied(skipperContext(testEnv));
});

test('percorso legacy: CREW_A non ha alcun accesso a participantAccess', async () => {
  await seedOpenEventAndBoat();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/participantAccess/placeholder`), { legacy: true });
  });
  await assertParticipantAccessFullyDenied(crewAContext(testEnv));
});

test('percorso legacy: lorganizzatore non ha alcun accesso a participantAccess', async () => {
  await seedOpenEventAndBoat();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/participantAccess/placeholder`), { legacy: true });
  });
  await assertParticipantAccessFullyDenied(organizerContext(testEnv));
});

test('percorso legacy: un outsider non ha alcun accesso a participantAccess', async () => {
  await seedOpenEventAndBoat();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/participantAccess/placeholder`), { legacy: true });
  });
  await assertParticipantAccessFullyDenied(outsiderContext(testEnv));
});

test('percorso legacy: un utente non autenticato non ha alcun accesso a participantAccess', async () => {
  await seedOpenEventAndBoat();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/participantAccess/placeholder`), { legacy: true });
  });
  await assertParticipantAccessFullyDenied(testEnv.unauthenticatedContext());
});

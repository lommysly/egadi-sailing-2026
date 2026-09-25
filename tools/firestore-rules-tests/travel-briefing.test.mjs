// Test delle Security Rules Firestore per: viaggio operativo privato dello
// skipper (skipperTravel), riepilogo viaggio/transfer della crew
// (crewTravelStatus), bacheca (briefing + announcements), regole di bordo
// (ruleAcceptances) e la parte Firestore-only dell'abbinamento passaggi
// (matchCandidates / travelMatchPairs). Vedi FIRESTORE_RULES_TEST_MATRIX.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
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
  organizerContext,
  skipperContext,
  outsiderContext,
  crewAContext,
  crewBContext,
  anonContext,
  eventDocData,
  boatDocData,
} from './identities.mjs';

let testEnv;

// Un secondo skipper, associato a una barca diversa da quella sotto test:
// serve solo a dimostrare che "essere skipper" non basta, serve esserlo
// DELLA barca giusta.
const SKIPPER_B = 'SKIPPER_B';
// Una barca che non esiste affatto nella fixture: usata per i casi
// "un'altra barca" del caso Bacheca.
const OTHER_BOAT_ID = 'OTHER_BOAT_NOT_SEEDED';

const MATCH_ID = 'matchcandidate0001';
const MATCH_PAIR_ID = 'travelmatchpair0001';

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-travel',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});
test.after(async () => { await testEnv?.cleanup(); });
test.beforeEach(async () => { await testEnv.clearFirestore(); });

// ---------------------------------------------------------------------------
// Helper di seeding (tutti eseguiti con testEnv.withSecurityRulesDisabled:
// preparano solo i prerequisiti, mai l'azione sotto test).
// ---------------------------------------------------------------------------

async function seedOpenEvent() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData({ open: true }));
  });
}

async function seedBoatA(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}`), boatDocData(overrides));
  });
}

async function seedInviteA(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
      boatId: SKIPPER_A,
      status: 'active',
      participantUid: CREW_A,
      accessVersion: 1,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
      preferredLocale: 'it',
      loginEmail: CREW_A_EMAIL,
      phoneFingerprint: 'd'.repeat(64),
      accessKey: 'c'.repeat(48),
      ...overrides,
    });
  });
}

async function seedInviteB(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_B_ID}`), {
      boatId: SKIPPER_A,
      status: 'active',
      participantUid: CREW_B,
      accessVersion: 1,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
      preferredLocale: 'it',
      loginEmail: CREW_B_EMAIL,
      phoneFingerprint: 'e'.repeat(64),
      accessKey: 'f'.repeat(48),
      ...overrides,
    });
  });
}

async function seedMembersA(inviteId = INVITE_A_ID) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/members/${inviteId}`), {
      inviteId,
      firstName: 'Crew',
      lastName: 'Di Test',
    });
  });
}

async function seedCrewAccess(uid, email, inviteId) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `crewAccess/${uid}`), {
      userId: uid,
      loginEmail: email,
      boatId: SKIPPER_A,
      inviteId,
      updatedAt: Timestamp.now(),
    });
  });
}

async function seedBriefingBoard(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/briefing/board`), {
      rulesTitle: 'Regole di bordo di test',
      rulesSummary: 'Sintesi di test',
      rulesText: 'Testo del regolamento di test',
      fullRulesRequired: true,
      rulesVersion: 2,
      meetingPoint: 'Marina di Marsala',
      boardingAt: '2026-10-08 09:00',
      departureAt: '2026-10-08 10:00',
      returnAt: '2026-10-11 18:00',
      scheduleNote: 'Nota di programma di test',
      updatedAt: Timestamp.now(),
      updatedBy: SKIPPER_A,
      ...overrides,
    });
  });
}

async function seedBriefingBoardWithEnglish(complete = true) {
  await seedBriefingBoard(
    complete
      ? {
          rulesTitleEn: 'Onboard rules (test)',
          rulesSummaryEn: 'Summary (test)',
          rulesTextEn: 'Full rules text (test)',
          scheduleNoteEn: 'Schedule note (test)',
        }
      : {
          // incompleto: un solo testo EN valorizzato, gli altri vuoti.
          rulesTitleEn: 'Onboard rules (test)',
          rulesSummaryEn: '',
          rulesTextEn: '',
          scheduleNoteEn: '',
        },
  );
}

async function seedRuleAcceptanceA(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`), {
      inviteId: INVITE_A_ID,
      acceptedBy: CREW_A,
      rulesVersion: 2,
      fullRulesRead: true,
      acceptedLocale: 'it',
      acceptedAt: Timestamp.now(),
      ...overrides,
    });
  });
}

async function seedCrewTravelStatusA(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`), {
      inviteId: INVITE_A_ID,
      outbound: 'draft',
      return: 'missing',
      outboundOperationStatus: 'new',
      returnOperationStatus: 'new',
      outboundRevision: 1,
      returnRevision: 0,
      updatedAt: Timestamp.now(),
      ...overrides,
    });
  });
}

// Prepara lo scenario completo "CREW_A puo leggere il proprio stato/i propri
// annunci perche' ha un invito attivo e un'accettazione corrente".
async function seedCrewAFullyOnboarded({ rulesVersion = 2, withAcceptance = true, english = null } = {}) {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedMembersA(INVITE_A_ID);
  await seedCrewAccess(CREW_A, CREW_A_EMAIL, INVITE_A_ID);
  if (english === true) await seedBriefingBoardWithEnglish(true);
  else if (english === false) await seedBriefingBoardWithEnglish(false);
  else await seedBriefingBoard({ rulesVersion });
  if (withAcceptance) await seedRuleAcceptanceA({ rulesVersion });
}

function emptySkipperTravelPayload(overrides = {}) {
  return {
    schemaVersion: 3,
    transportMode: '',
    originCity: '',
    originAirport: '',
    destinationCity: '',
    destinationAirport: '',
    departureDate: '',
    departureTime: '',
    arrivalDate: '',
    arrivalTime: '',
    carrier: '',
    serviceNumber: '',
    luggageCount: 0,
    bulkyLuggage: false,
    needsAirportMarsalaTransfer: false,
    airportMarsalaPlan: '',
    transferOperatorConsent: false,
    rideOfferSeats: 0,
    rideOfferConsent: false,
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
    ...overrides,
  };
}

function flightSkipperTravelPayload(overrides = {}) {
  return emptySkipperTravelPayload({
    transportMode: 'flight',
    originCity: 'Milano di test',
    originAirport: 'MXP',
    destinationCity: 'Trapani di test',
    destinationAirport: 'TPS',
    departureDate: '2026-10-08',
    departureTime: '07:30',
    arrivalDate: '2026-10-08',
    arrivalTime: '09:10',
    carrier: 'Vettore di test',
    serviceNumber: 'TX1234',
    luggageCount: 2,
    bulkyLuggage: false,
    needsAirportMarsalaTransfer: true,
    airportMarsalaPlan: 'transfer',
    transferOperatorConsent: true,
    ...overrides,
  });
}

function allOtherRoleContexts() {
  return [
    { name: 'ORGANIZER_A', ctx: organizerContext(testEnv) },
    { name: 'CREW_A', ctx: crewAContext(testEnv) },
    { name: 'CREW_B', ctx: crewBContext(testEnv) },
    { name: 'altro skipper (SKIPPER_B)', ctx: skipperContext(testEnv, SKIPPER_B) },
    { name: 'OUTSIDER_A', ctx: outsiderContext(testEnv) },
    { name: 'ANON_A', ctx: anonContext(testEnv) },
  ];
}

// ===========================================================================
// Caso: Viaggio operativo privato skipper (skipperTravel)
// ===========================================================================

test('skipperTravel: lo skipper associato crea outbound vuoto/nullo e lo rilegge', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`), emptySkipperTravelPayload()));
  const snap = await assertSucceeds(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`)));
  assert.equal(snap.data().transportMode, '');
});

test('skipperTravel: lo skipper associato crea return vuoto/nullo e lo rilegge', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/return`), emptySkipperTravelPayload()));
  await assertSucceeds(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/return`)));
});

test('skipperTravel: lo skipper aggiorna outbound con dati fittizi di un volo con transfer TPS', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`), emptySkipperTravelPayload()));
  await assertSucceeds(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`), flightSkipperTravelPayload()));
});

test('skipperTravel: lo skipper aggiorna return con dati fittizi di un volo con transfer PMO', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/return`), emptySkipperTravelPayload()));
  await assertSucceeds(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/return`), flightSkipperTravelPayload({
    originCity: 'Palermo di test',
    originAirport: 'PMO',
    destinationCity: 'Milano di test',
    destinationAirport: '',
  })));
});

test('skipperTravel: un id diverso da outbound/return e sempre rifiutato', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/andata`), emptySkipperTravelPayload()));
});

test('skipperTravel: una chiave extra nel payload e rifiutata', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const payload = emptySkipperTravelPayload();
  payload.extraField = 'non ammesso';
  await assertFails(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`), payload));
});

test('skipperTravel: un IATA non valido (XX) e rifiutato', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`), flightSkipperTravelPayload({
    destinationAirport: 'XX',
    airportMarsalaPlan: '',
    transferOperatorConsent: false,
    needsAirportMarsalaTransfer: false,
  })));
});

test('skipperTravel: un orario non in formato 24h e rifiutato', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`), flightSkipperTravelPayload({
    departureTime: '25:00',
  })));
});

test('skipperTravel: piu di 12 bagagli e rifiutato', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`), flightSkipperTravelPayload({
    luggageCount: 13,
  })));
});

test('skipperTravel: un mezzo di trasporto non ammesso e rifiutato', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`), emptySkipperTravelPayload({
    transportMode: 'bicicletta',
  })));
});

test('skipperTravel: un flag transfer attivo con aeroporto diverso da TPS/PMO e rifiutato', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`), flightSkipperTravelPayload({
    destinationAirport: 'FCO',
  })));
});

test('skipperTravel: list e sempre negato, anche allo skipper associato', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(getDocs(collection(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel`)));
});

test('skipperTravel: delete e sempre negato, anche allo skipper associato', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`), emptySkipperTravelPayload({ updatedAt: Timestamp.now() }));
  });
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(deleteDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/skipperTravel/outbound`)));
});

for (const leg of ['outbound', 'return']) {
  test(`skipperTravel/${leg}: nessun altro ruolo puo leggere il documento`, async () => {
    await seedOpenEvent();
    await seedBoatA();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/skipperTravel/${leg}`), emptySkipperTravelPayload({ updatedAt: Timestamp.now() }));
    });
    for (const { ctx } of allOtherRoleContexts()) {
      await assertFails(getDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/skipperTravel/${leg}`)));
    }
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), `boats/${SKIPPER_A}/skipperTravel/${leg}`)));
  });

  test(`skipperTravel/${leg}: nessun altro ruolo puo creare/aggiornare/cancellare il documento`, async () => {
    await seedOpenEvent();
    await seedBoatA();
    for (const { ctx } of allOtherRoleContexts()) {
      await assertFails(setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/skipperTravel/${leg}`), emptySkipperTravelPayload()));
      await assertFails(updateDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/skipperTravel/${leg}`), { luggageCount: 1 }));
      await assertFails(deleteDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/skipperTravel/${leg}`)));
    }
    const unauth = testEnv.unauthenticatedContext();
    await assertFails(setDoc(doc(unauth.firestore(), `boats/${SKIPPER_A}/skipperTravel/${leg}`), emptySkipperTravelPayload()));
  });

  test(`skipperTravel/${leg}: nessun altro ruolo puo fare list sulla collezione`, async () => {
    await seedOpenEvent();
    await seedBoatA();
    for (const { ctx } of allOtherRoleContexts()) {
      await assertFails(getDocs(collection(ctx.firestore(), `boats/${SKIPPER_A}/skipperTravel`)));
    }
  });
}

// ===========================================================================
// Caso: Riepilogo viaggio e avanzamento transfer (crewTravelStatus)
// ===========================================================================

test('crewTravelStatus: lo skipper legge get e list liberamente', async () => {
  await seedCrewAFullyOnboarded();
  await seedCrewTravelStatusA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
  await assertSucceeds(getDocs(collection(skipper.firestore(), `boats/${SKIPPER_A}/crewTravelStatus`)));
});

test('crewTravelStatus: l organizzatore legge get e list liberamente', async () => {
  await seedCrewAFullyOnboarded();
  await seedCrewTravelStatusA();
  const organizer = organizerContext(testEnv);
  await assertSucceeds(getDoc(doc(organizer.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
  await assertSucceeds(getDocs(collection(organizer.firestore(), `boats/${SKIPPER_A}/crewTravelStatus`)));
});

test('crewTravelStatus: CREW_A legge il proprio documento solo con accettazione corrente del briefing', async () => {
  await seedCrewAFullyOnboarded({ rulesVersion: 2, withAcceptance: true });
  await seedCrewTravelStatusA();
  const crewA = crewAContext(testEnv);
  const snap = await assertSucceeds(getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
  assert.equal(snap.data().inviteId, INVITE_A_ID);
});

test('crewTravelStatus: CREW_A perde la lettura quando il briefing sale di versione senza nuova accettazione', async () => {
  await seedCrewAFullyOnboarded({ rulesVersion: 2, withAcceptance: true });
  await seedCrewTravelStatusA();
  const crewA = crewAContext(testEnv);
  await assertSucceeds(getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
  // Lo skipper alza rulesVersion senza che CREW_A rifaccia l'accettazione.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/briefing/board`), {
      rulesTitle: 'Regole di bordo di test',
      rulesSummary: 'Sintesi di test',
      rulesText: 'Testo del regolamento AGGIORNATO di test',
      fullRulesRequired: true,
      rulesVersion: 3,
      meetingPoint: 'Marina di Marsala',
      boardingAt: '2026-10-08 09:00',
      departureAt: '2026-10-08 10:00',
      returnAt: '2026-10-11 18:00',
      scheduleNote: 'Nota di programma di test',
      updatedAt: Timestamp.now(),
      updatedBy: SKIPPER_A,
    });
  });
  await assertFails(getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
});

test('crewTravelStatus: CREW_B non legge il documento di INVITE_A perche non e il suo invito', async () => {
  await seedCrewAFullyOnboarded();
  await seedInviteB();
  await seedMembersA(INVITE_B_ID);
  await seedCrewAccess(CREW_B, CREW_B_EMAIL, INVITE_B_ID);
  await seedCrewTravelStatusA();
  const crewB = crewBContext(testEnv);
  await assertFails(getDoc(doc(crewB.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
});

test('crewTravelStatus: nessuna crew puo fare list sulla collezione', async () => {
  await seedCrewAFullyOnboarded();
  await seedCrewTravelStatusA();
  const crewA = crewAContext(testEnv);
  const crewB = crewBContext(testEnv);
  await assertFails(getDocs(collection(crewA.firestore(), `boats/${SKIPPER_A}/crewTravelStatus`)));
  await assertFails(getDocs(collection(crewB.firestore(), `boats/${SKIPPER_A}/crewTravelStatus`)));
});

test('crewTravelStatus: OUTSIDER_A e ANON_A non leggono ne get ne list', async () => {
  await seedCrewAFullyOnboarded();
  await seedCrewTravelStatusA();
  const outsider = outsiderContext(testEnv);
  const anon = anonContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
  await assertFails(getDocs(collection(outsider.firestore(), `boats/${SKIPPER_A}/crewTravelStatus`)));
  await assertFails(getDoc(doc(anon.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
  await assertFails(getDocs(collection(anon.firestore(), `boats/${SKIPPER_A}/crewTravelStatus`)));
});

test('crewTravelStatus: ogni scrittura client e sempre negata, incluso lo skipper', async () => {
  await seedCrewAFullyOnboarded();
  const payload = {
    inviteId: INVITE_A_ID,
    outbound: 'draft',
    return: 'missing',
    outboundOperationStatus: 'new',
    returnOperationStatus: 'new',
    updatedAt: serverTimestamp(),
  };
  const roles = [
    skipperContext(testEnv, SKIPPER_A),
    organizerContext(testEnv),
    crewAContext(testEnv),
    outsiderContext(testEnv),
    anonContext(testEnv),
  ];
  for (const ctx of roles) {
    await assertFails(setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`), payload));
  }
  // Anche un update/delete su un documento gia' esistente (seedato lato server) e' negato.
  await seedCrewTravelStatusA();
  for (const ctx of roles) {
    await assertFails(updateDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`), { outbound: 'ready' }));
    await assertFails(deleteDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
  }
});

// ===========================================================================
// Caso: Bacheca (briefing/board + announcements)
// ===========================================================================

test('bacheca: CREW_A legge il briefing prima dell accettazione', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedMembersA();
  await seedCrewAccess(CREW_A, CREW_A_EMAIL, INVITE_A_ID);
  await seedBriefingBoard();
  const crewA = crewAContext(testEnv);
  const snap = await assertSucceeds(getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/briefing/board`)));
  assert.equal(snap.data().rulesVersion, 2);
});

test('bacheca: CREW_A NON legge gli annunci prima dell accettazione', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedMembersA();
  await seedCrewAccess(CREW_A, CREW_A_EMAIL, INVITE_A_ID);
  await seedBriefingBoard();
  const crewA = crewAContext(testEnv);
  await assertFails(getDocs(query(collection(crewA.firestore(), `boats/${SKIPPER_A}/announcements`))));
});

test('bacheca: CREW_A legge gli annunci dopo l accettazione corrente', async () => {
  await seedCrewAFullyOnboarded({ rulesVersion: 2, withAcceptance: true });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/announcements/annuncio-1`), {
      text: 'Avviso di test',
      updatedAt: Timestamp.now(),
    });
  });
  const crewA = crewAContext(testEnv);
  await assertSucceeds(getDocs(query(collection(crewA.firestore(), `boats/${SKIPPER_A}/announcements`))));
});

test('bacheca: dopo un salto di versione del briefing, gli annunci tornano illeggibili a CREW_A', async () => {
  await seedCrewAFullyOnboarded({ rulesVersion: 2, withAcceptance: true });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/announcements/annuncio-1`), {
      text: 'Avviso di test',
      updatedAt: Timestamp.now(),
    });
  });
  const crewA = crewAContext(testEnv);
  await assertSucceeds(getDocs(query(collection(crewA.firestore(), `boats/${SKIPPER_A}/announcements`))));
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/briefing/board`), {
      rulesTitle: 'Regole di bordo di test',
      rulesSummary: 'Sintesi di test',
      rulesText: 'Testo AGGIORNATO di test',
      fullRulesRequired: true,
      rulesVersion: 3,
      meetingPoint: 'Marina di Marsala',
      boardingAt: '2026-10-08 09:00',
      departureAt: '2026-10-08 10:00',
      returnAt: '2026-10-11 18:00',
      scheduleNote: 'Nota di programma di test',
      updatedAt: Timestamp.now(),
      updatedBy: SKIPPER_A,
    });
  });
  await assertFails(getDocs(query(collection(crewA.firestore(), `boats/${SKIPPER_A}/announcements`))));
});

test('bacheca: CREW_A non legge mai briefing/annunci di un altra barca', async () => {
  await seedCrewAFullyOnboarded({ rulesVersion: 2, withAcceptance: true });
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(doc(crewA.firestore(), `boats/${OTHER_BOAT_ID}/briefing/board`)));
  await assertFails(getDocs(query(collection(crewA.firestore(), `boats/${OTHER_BOAT_ID}/announcements`))));
});

test('bacheca: senza accettazione, CREW_A non legge nemmeno gli annunci di un altra barca', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedMembersA();
  await seedCrewAccess(CREW_A, CREW_A_EMAIL, INVITE_A_ID);
  const crewA = crewAContext(testEnv);
  await assertFails(getDoc(doc(crewA.firestore(), `boats/${OTHER_BOAT_ID}/briefing/board`)));
});

test('bacheca: lo skipper pubblica il briefing (create) con successo', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/briefing/board`), {
    rulesTitle: 'Regole di bordo di test',
    rulesSummary: 'Sintesi di test',
    rulesText: 'Testo del regolamento di test',
    fullRulesRequired: true,
    rulesVersion: 1,
    meetingPoint: 'Marina di Marsala',
    boardingAt: '2026-10-08 09:00',
    departureAt: '2026-10-08 10:00',
    returnAt: '2026-10-11 18:00',
    scheduleNote: 'Nota di test',
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  }));
});

test('bacheca: l organizzatore aggiorna il briefing con successo (nuova versione, testo cambiato)', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedBriefingBoard({ rulesVersion: 1, rulesText: 'Testo iniziale di test', updatedBy: ORGANIZER_A });
  const organizer = organizerContext(testEnv);
  await assertSucceeds(updateDoc(doc(organizer.firestore(), `boats/${SKIPPER_A}/briefing/board`), {
    rulesTitle: 'Regole di bordo di test',
    rulesSummary: 'Sintesi di test',
    rulesText: 'Testo CAMBIATO di test',
    fullRulesRequired: true,
    rulesVersion: 2,
    meetingPoint: 'Marina di Marsala',
    boardingAt: '2026-10-08 09:00',
    departureAt: '2026-10-08 10:00',
    returnAt: '2026-10-11 18:00',
    scheduleNote: 'Nota di test',
    updatedAt: serverTimestamp(),
    updatedBy: ORGANIZER_A,
  }));
});

test('bacheca: lo skipper pubblica e aggiorna un annuncio con successo', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/announcements/annuncio-1`), {
    text: 'Avviso di test',
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/announcements/annuncio-1`), {
    text: 'Avviso aggiornato di test',
    updatedAt: serverTimestamp(),
  }));
});

test('bacheca: l organizzatore crea ed elimina un annuncio con successo', async () => {
  await seedOpenEvent();
  await seedBoatA();
  const organizer = organizerContext(testEnv);
  await assertSucceeds(setDoc(doc(organizer.firestore(), `boats/${SKIPPER_A}/announcements/annuncio-2`), {
    text: 'Avviso organizzatore di test',
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(deleteDoc(doc(organizer.firestore(), `boats/${SKIPPER_A}/announcements/annuncio-2`)));
});

// ===========================================================================
// Caso: Regole di bordo (ruleAcceptances)
// ===========================================================================

test('ruleAcceptances: rifiutata senza fullRulesRead quando il briefing lo richiede', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedBriefingBoard({ rulesVersion: 2 });
  const crewA = crewAContext(testEnv);
  const payload = {
    inviteId: INVITE_A_ID,
    acceptedBy: CREW_A,
    rulesVersion: 2,
    acceptedLocale: 'it',
    acceptedAt: serverTimestamp(),
  };
  await assertFails(setDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`), payload));
});

test('ruleAcceptances: rifiutata con fullRulesRead: false', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedBriefingBoard({ rulesVersion: 2 });
  const crewA = crewAContext(testEnv);
  const payload = {
    inviteId: INVITE_A_ID,
    acceptedBy: CREW_A,
    rulesVersion: 2,
    fullRulesRead: false,
    acceptedLocale: 'it',
    acceptedAt: serverTimestamp(),
  };
  await assertFails(setDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`), payload));
});

test('ruleAcceptances: rifiutata con rulesVersion diversa da quella corrente del briefing', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedBriefingBoard({ rulesVersion: 2 });
  const crewA = crewAContext(testEnv);
  const payload = {
    inviteId: INVITE_A_ID,
    acceptedBy: CREW_A,
    rulesVersion: 1,
    fullRulesRead: true,
    acceptedLocale: 'it',
    acceptedAt: serverTimestamp(),
  };
  await assertFails(setDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`), payload));
});

test('ruleAcceptances: rifiutata con acceptedAt non server (Timestamp letterale)', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedBriefingBoard({ rulesVersion: 2 });
  const crewA = crewAContext(testEnv);
  const payload = {
    inviteId: INVITE_A_ID,
    acceptedBy: CREW_A,
    rulesVersion: 2,
    fullRulesRead: true,
    acceptedLocale: 'it',
    acceptedAt: Timestamp.now(),
  };
  await assertFails(setDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`), payload));
});

test('ruleAcceptances: accettata con tutti i valori corretti in italiano', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedBriefingBoard({ rulesVersion: 2 });
  const crewA = crewAContext(testEnv);
  const payload = {
    inviteId: INVITE_A_ID,
    acceptedBy: CREW_A,
    rulesVersion: 2,
    fullRulesRead: true,
    acceptedLocale: 'it',
    acceptedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`), payload));
});

test('ruleAcceptances: acceptedLocale "en" rifiutata se il briefing e solo in italiano', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedBriefingBoard({ rulesVersion: 2 });
  const crewA = crewAContext(testEnv);
  const payload = {
    inviteId: INVITE_A_ID,
    acceptedBy: CREW_A,
    rulesVersion: 2,
    fullRulesRead: true,
    acceptedLocale: 'en',
    acceptedAt: serverTimestamp(),
  };
  await assertFails(setDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`), payload));
});

test('ruleAcceptances: acceptedLocale "en" accettata con briefing inglese completo', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedBriefingBoardWithEnglish(true);
  const crewA = crewAContext(testEnv);
  const payload = {
    inviteId: INVITE_A_ID,
    acceptedBy: CREW_A,
    rulesVersion: 2,
    fullRulesRead: true,
    acceptedLocale: 'en',
    acceptedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`), payload));
});

test('ruleAcceptances: acceptedLocale "en" rifiutata con briefing inglese incompleto', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedBriefingBoardWithEnglish(false);
  const crewA = crewAContext(testEnv);
  const payload = {
    inviteId: INVITE_A_ID,
    acceptedBy: CREW_A,
    rulesVersion: 2,
    fullRulesRead: true,
    acceptedLocale: 'en',
    acceptedAt: serverTimestamp(),
  };
  await assertFails(setDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`), payload));
});

test('ruleAcceptances: un cambio di regolamento con nuova rulesVersion invalida la vecchia accettazione (verificato sugli annunci)', async () => {
  await seedCrewAFullyOnboarded({ rulesVersion: 2, withAcceptance: true });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/announcements/annuncio-1`), {
      text: 'Avviso di test',
      updatedAt: Timestamp.now(),
    });
  });
  const crewA = crewAContext(testEnv);
  await assertSucceeds(getDocs(query(collection(crewA.firestore(), `boats/${SKIPPER_A}/announcements`))));

  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/briefing/board`), {
    rulesTitle: 'Regole di bordo di test',
    rulesSummary: 'Sintesi di test',
    rulesText: 'Testo del regolamento MODIFICATO di test',
    fullRulesRequired: true,
    rulesVersion: 3,
    meetingPoint: 'Marina di Marsala',
    boardingAt: '2026-10-08 09:00',
    departureAt: '2026-10-08 10:00',
    returnAt: '2026-10-11 18:00',
    scheduleNote: 'Nota di programma di test',
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  }));

  await assertFails(getDocs(query(collection(crewA.firestore(), `boats/${SKIPPER_A}/announcements`))));
});

test('ruleAcceptances: un aggiornamento che non tocca il regolamento e non alza la versione non invalida la vecchia accettazione', async () => {
  await seedCrewAFullyOnboarded({ rulesVersion: 2, withAcceptance: true });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/announcements/annuncio-1`), {
      text: 'Avviso di test',
      updatedAt: Timestamp.now(),
    });
  });
  const crewA = crewAContext(testEnv);
  await assertSucceeds(getDocs(query(collection(crewA.firestore(), `boats/${SKIPPER_A}/announcements`))));

  const skipper = skipperContext(testEnv, SKIPPER_A);
  // Cambia solo la nota di programma (non e' testo del regolamento) e non alza rulesVersion.
  await assertSucceeds(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/briefing/board`), {
    rulesTitle: 'Regole di bordo di test',
    rulesSummary: 'Sintesi di test',
    rulesText: 'Testo del regolamento di test',
    fullRulesRequired: true,
    rulesVersion: 2,
    meetingPoint: 'Marina di Marsala',
    boardingAt: '2026-10-08 09:00',
    departureAt: '2026-10-08 10:00',
    returnAt: '2026-10-11 18:00',
    scheduleNote: 'Nota di ritrovo AGGIORNATA di test',
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  }));

  await assertSucceeds(getDocs(query(collection(crewA.firestore(), `boats/${SKIPPER_A}/announcements`))));
});

test('ruleAcceptances: get consentito allo skipper, all organizzatore e al titolare dell invito', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedBriefingBoard({ rulesVersion: 2 });
  await seedRuleAcceptanceA();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const organizer = organizerContext(testEnv);
  const crewA = crewAContext(testEnv);
  await assertSucceeds(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`)));
  await assertSucceeds(getDoc(doc(organizer.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`)));
  await assertSucceeds(getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`)));
});

test('ruleAcceptances: get negato a CREW_B sull accettazione di CREW_A, e list negata alla crew', async () => {
  await seedOpenEvent();
  await seedBoatA();
  await seedInviteA();
  await seedInviteB();
  await seedBriefingBoard({ rulesVersion: 2 });
  await seedRuleAcceptanceA();
  const crewB = crewBContext(testEnv);
  await assertFails(getDoc(doc(crewB.firestore(), `boats/${SKIPPER_A}/ruleAcceptances/${INVITE_A_ID}`)));
  const crewA = crewAContext(testEnv);
  await assertFails(getDocs(collection(crewA.firestore(), `boats/${SKIPPER_A}/ruleAcceptances`)));
});

// ===========================================================================
// Caso extra: parte Firestore-only dell abbinamento passaggi
// (matchCandidates sotto crewTravel/{inviteId}/legs/{legId}, e
// travelMatchPairs sotto events/egadi-2026 — MAI le Cloud Functions).
// ===========================================================================

test('travelMatchPairs: get e sempre negato a chiunque, anche al diretto interessato', async () => {
  await seedCrewAFullyOnboarded();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `events/egadi-2026/travelMatchPairs/${MATCH_PAIR_ID}`), {
      boatIdA: SKIPPER_A,
      inviteIdA: INVITE_A_ID,
      boatIdB: SKIPPER_A,
      inviteIdB: INVITE_B_ID,
      createdAt: Timestamp.now(),
    });
  });
  const crewA = crewAContext(testEnv);
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(crewA.firestore(), `events/egadi-2026/travelMatchPairs/${MATCH_PAIR_ID}`)));
  await assertFails(getDoc(doc(skipper.firestore(), `events/egadi-2026/travelMatchPairs/${MATCH_PAIR_ID}`)));
  await assertFails(getDoc(doc(outsider.firestore(), `events/egadi-2026/travelMatchPairs/${MATCH_PAIR_ID}`)));
});

test('travelMatchPairs: list e sempre negato a chiunque', async () => {
  await seedCrewAFullyOnboarded();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `events/egadi-2026/travelMatchPairs/${MATCH_PAIR_ID}`), {
      boatIdA: SKIPPER_A,
      inviteIdA: INVITE_A_ID,
      createdAt: Timestamp.now(),
    });
  });
  const crewA = crewAContext(testEnv);
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDocs(collection(crewA.firestore(), 'events/egadi-2026/travelMatchPairs')));
  await assertFails(getDocs(collection(skipper.firestore(), 'events/egadi-2026/travelMatchPairs')));
  await assertFails(getDocs(collection(outsider.firestore(), 'events/egadi-2026/travelMatchPairs')));
});

test('travelMatchPairs: nessuna scrittura client e mai consentita, da nessun ruolo', async () => {
  await seedCrewAFullyOnboarded();
  const payload = { boatIdA: SKIPPER_A, inviteIdA: INVITE_A_ID, createdAt: serverTimestamp() };
  const roles = [crewAContext(testEnv), skipperContext(testEnv, SKIPPER_A), organizerContext(testEnv), outsiderContext(testEnv)];
  for (const ctx of roles) {
    await assertFails(setDoc(doc(ctx.firestore(), `events/egadi-2026/travelMatchPairs/${MATCH_PAIR_ID}`), payload));
  }
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `events/egadi-2026/travelMatchPairs/${MATCH_PAIR_ID}`), payload);
  });
  for (const ctx of roles) {
    await assertFails(updateDoc(doc(ctx.firestore(), `events/egadi-2026/travelMatchPairs/${MATCH_PAIR_ID}`), { boatIdA: SKIPPER_A }));
    await assertFails(deleteDoc(doc(ctx.firestore(), `events/egadi-2026/travelMatchPairs/${MATCH_PAIR_ID}`)));
  }
});

test('matchCandidates: il proprietario (CREW_A) puo fare get e list sulla propria sotto-collezione', async () => {
  await seedCrewAFullyOnboarded({ rulesVersion: 2, withAcceptance: true });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates/${MATCH_ID}`),
      { status: 'pending', createdAt: Timestamp.now() },
    );
  });
  const crewA = crewAContext(testEnv);
  const snap = await assertSucceeds(
    getDoc(doc(crewA.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates/${MATCH_ID}`)),
  );
  assert.equal(snap.data().status, 'pending');
  await assertSucceeds(
    getDocs(collection(crewA.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates`)),
  );
});

test('matchCandidates: get e list sono negati a chi non e il proprietario della sotto-collezione', async () => {
  await seedCrewAFullyOnboarded({ rulesVersion: 2, withAcceptance: true });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates/${MATCH_ID}`),
      { status: 'pending', createdAt: Timestamp.now() },
    );
  });
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates/${MATCH_ID}`)));
  await assertFails(getDocs(collection(skipper.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates`)));
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates/${MATCH_ID}`)));
  await assertFails(getDocs(collection(outsider.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates`)));
});

test('matchCandidates: nessuna scrittura client e mai consentita, da nessun ruolo (incluso il proprietario)', async () => {
  await seedCrewAFullyOnboarded({ rulesVersion: 2, withAcceptance: true });
  const payload = { status: 'pending', createdAt: serverTimestamp() };
  const roles = [crewAContext(testEnv), skipperContext(testEnv, SKIPPER_A), outsiderContext(testEnv)];
  for (const ctx of roles) {
    await assertFails(
      setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates/${MATCH_ID}`), payload),
    );
  }
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates/${MATCH_ID}`), payload);
  });
  for (const ctx of roles) {
    await assertFails(
      updateDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates/${MATCH_ID}`), { status: 'matched' }),
    );
    await assertFails(
      deleteDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/crewTravel/${INVITE_A_ID}/legs/outbound/matchCandidates/${MATCH_ID}`)),
    );
  }
});

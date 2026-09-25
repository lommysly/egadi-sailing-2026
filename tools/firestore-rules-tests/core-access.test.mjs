// Gruppo "Core access": area privata aperta/chiusa, apertura di test,
// separazione barca/skipper, separazione skipper/crew, barca estranea.
// Vedi FIRESTORE_RULES_TEST_MATRIX.md e la fixture fittizia in identities.mjs.

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
} from 'firebase/firestore';
import {
  ORGANIZER_A,
  SKIPPER_A,
  OUTSIDER_A,
  CREW_A,
  CREW_B,
  ANON_A,
  INVITE_A_ID,
  PROJECTION_A_ID,
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

const OTHER_BOAT_ID = 'OTHER_BOAT';
const OTHER_SKIPPER_ID = 'OTHER_SKIPPER';

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-core',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});

test.after(async () => {
  await testEnv?.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

// --- Helper di seed (sempre con Rules disabilitate: prerequisiti, mai
// l'azione sotto test). ---

async function seedEvent({ open, organizerIds = [ORGANIZER_A] } = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData({ open, organizerIds }));
  });
}

async function seedBoat(boatId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}`), boatDocData(overrides));
  });
}

async function seedInvite(boatId, inviteId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/invites/${inviteId}`), {
      boatId,
      status: 'pending',
      participantUid: null,
      accessVersion: 1,
      ...overrides,
    });
  });
}

async function seedProjection(boatId, projectionId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/crewProjections/${projectionId}`), {
      status: 'projected',
      inviteId: null,
      firstName: 'Mario',
      lastName: 'Rossi',
      ...overrides,
    });
  });
}

async function seedMember(boatId, memberId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/members/${memberId}`), {
      firstName: 'Mario',
      lastName: 'Rossi',
      ...overrides,
    });
  });
}

async function seedBriefing(boatId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/briefing/board`), {
      rulesText: 'Regole di bordo fittizie',
      rulesVersion: 2,
      fullRulesRequired: true,
      ...overrides,
    });
  });
}

async function seedContributionPlan(boatId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/contributionPlan/default`), {
      version: 4,
      ...overrides,
    });
  });
}

async function seedCostPlan(boatId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/costPlan/default`), {
      version: 7,
      ...overrides,
    });
  });
}

async function seedCollectionProfile(boatId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/collectionProfile/default`), {
      collectorId: SKIPPER_A,
      ...overrides,
    });
  });
}

async function seedCrewTravelStatus(boatId, inviteId, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${boatId}/crewTravelStatus/${inviteId}`), {
      inviteId,
      outbound: 'missing',
      return: 'missing',
      ...overrides,
    });
  });
}

// =====================================================================
// Caso: Area privata chiusa (UNICO gruppo che testa privateAreaEnabled: false)
// =====================================================================

test('area chiusa: skipper non legge events/egadi-2026', async () => {
  await seedEvent({ open: false });
  const skipper = skipperContext(testEnv);
  await assertFails(getDoc(doc(skipper.firestore(), 'events/egadi-2026')));
});

test('area chiusa: crew (password) non legge events/egadi-2026', async () => {
  await seedEvent({ open: false });
  const crew = crewAContext(testEnv);
  await assertFails(getDoc(doc(crew.firestore(), 'events/egadi-2026')));
});

test('area chiusa: anonimo non legge events/egadi-2026', async () => {
  await seedEvent({ open: false });
  const anon = anonContext(testEnv);
  await assertFails(getDoc(doc(anon.firestore(), 'events/egadi-2026')));
});

test('area chiusa: outsider non legge events/egadi-2026', async () => {
  await seedEvent({ open: false });
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), 'events/egadi-2026')));
});

test('area chiusa: skipper non legge la propria barca boats/SKIPPER_A', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  const skipper = skipperContext(testEnv);
  await assertFails(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}`)));
});

test('area chiusa: crew (password) non legge boats/SKIPPER_A', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  const crew = crewAContext(testEnv);
  await assertFails(getDoc(doc(crew.firestore(), `boats/${SKIPPER_A}`)));
});

test('area chiusa: anonimo non legge boats/SKIPPER_A', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  const anon = anonContext(testEnv);
  await assertFails(getDoc(doc(anon.firestore(), `boats/${SKIPPER_A}`)));
});

test('area chiusa: outsider non legge boats/SKIPPER_A', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}`)));
});

test('area chiusa: skipper non aggiorna la propria barca', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}`), { name: 'Nuovo nome' }));
});

test('area chiusa: skipper non crea un invito', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`), {
    boatId: SKIPPER_A,
    status: 'pending',
    participantUid: null,
    accessVersion: 1,
  }));
});

test('area chiusa: skipper non legge un invito esistente', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  await seedInvite(SKIPPER_A, INVITE_A_ID);
  const skipper = skipperContext(testEnv);
  await assertFails(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`)));
});

test('area chiusa: skipper non legge una proiezione esistente', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  await seedProjection(SKIPPER_A, PROJECTION_A_ID);
  const skipper = skipperContext(testEnv);
  await assertFails(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('area chiusa: skipper non legge la Crew List (members)', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  await seedMember(SKIPPER_A, INVITE_A_ID);
  const skipper = skipperContext(testEnv);
  await assertFails(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/members/${INVITE_A_ID}`)));
});

test('area chiusa: crew (password) non legge la bacheca (briefing)', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  await seedBriefing(SKIPPER_A);
  const crew = crewAContext(testEnv);
  await assertFails(getDoc(doc(crew.firestore(), `boats/${SKIPPER_A}/briefing/board`)));
});

test('area chiusa: skipper non crea una richiesta di pagamento', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(doc(collection(skipper.firestore(), `boats/${SKIPPER_A}/paymentRequests`)), {
    entryType: 'manual_receipt',
  }));
});

test('area chiusa: crew (password) non legge un record tecnico crewTravelStatus', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  await seedCrewTravelStatus(SKIPPER_A, INVITE_A_ID);
  const crew = crewAContext(testEnv);
  await assertFails(getDoc(doc(crew.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
});

test('area chiusa: outsider non legge crewProjections tramite list', async () => {
  await seedEvent({ open: false });
  await seedBoat(SKIPPER_A);
  await seedProjection(SKIPPER_A, PROJECTION_A_ID);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDocs(collection(outsider.firestore(), `boats/${SKIPPER_A}/crewProjections`)));
});

// =====================================================================
// Caso: Apertura di test (solo ORGANIZER_A può impostare privateAreaEnabled: true)
// =====================================================================

test('apertura di test: ORGANIZER_A può impostare privateAreaEnabled a true', async () => {
  await seedEvent({ open: false });
  const organizer = organizerContext(testEnv);
  await assertSucceeds(updateDoc(doc(organizer.firestore(), 'events/egadi-2026'), { privateAreaEnabled: true }));
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), 'events/egadi-2026'));
    assert.equal(snap.data().privateAreaEnabled, true);
  });
});

test('apertura di test: skipper non può impostare privateAreaEnabled a true', async () => {
  await seedEvent({ open: false });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(doc(skipper.firestore(), 'events/egadi-2026'), { privateAreaEnabled: true }));
});

test('apertura di test: outsider non può impostare privateAreaEnabled a true', async () => {
  await seedEvent({ open: false });
  const outsider = outsiderContext(testEnv);
  await assertFails(updateDoc(doc(outsider.firestore(), 'events/egadi-2026'), { privateAreaEnabled: true }));
});

// =====================================================================
// Caso: Barca skipper
// =====================================================================

test('barca skipper: SKIPPER_A crea la propria barca boats/SKIPPER_A', async () => {
  await seedEvent({ open: true });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}`), boatDocData({ capacity: 9 })));
});

test('barca skipper: SKIPPER_A legge la propria barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  const skipper = skipperContext(testEnv);
  const snap = await assertSucceeds(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}`)));
  assert.equal(snap.data().skipperId, SKIPPER_A);
});

test('barca skipper: SKIPPER_A aggiorna la propria barca senza cambiare skipperId/eventId', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}`), { name: 'Karibu aggiornata' }));
});

test('barca skipper: SKIPPER_A non può cambiare skipperId della propria barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}`), { skipperId: OUTSIDER_A }));
});

test('barca skipper: SKIPPER_A non può cambiare eventId della propria barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}`), { eventId: 'altro-evento' }));
});

test('barca skipper: neanche ORGANIZER_A può cambiare skipperId di boats/SKIPPER_A', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  const organizer = organizerContext(testEnv);
  await assertFails(updateDoc(doc(organizer.firestore(), `boats/${SKIPPER_A}`), { skipperId: ORGANIZER_A }));
});

test('barca skipper: neanche ORGANIZER_A può cambiare eventId di boats/SKIPPER_A', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  const organizer = organizerContext(testEnv);
  await assertFails(updateDoc(doc(organizer.firestore(), `boats/${SKIPPER_A}`), { eventId: 'altro-evento' }));
});

test('barca skipper: SKIPPER_A non legge una seconda barca (boats/OTHER_BOAT)', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedBoat(OTHER_BOAT_ID, { skipperId: OTHER_SKIPPER_ID, capacity: 9 });
  const skipper = skipperContext(testEnv);
  await assertFails(getDoc(doc(skipper.firestore(), `boats/${OTHER_BOAT_ID}`)));
});

test('barca skipper: SKIPPER_A non aggiorna un\'altra barca (boats/OTHER_BOAT)', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedBoat(OTHER_BOAT_ID, { skipperId: OTHER_SKIPPER_ID, capacity: 9 });
  const skipper = skipperContext(testEnv);
  await assertFails(updateDoc(doc(skipper.firestore(), `boats/${OTHER_BOAT_ID}`), { name: 'Presa di forza' }));
});

test('barca skipper: SKIPPER_A non può creare una seconda barca con un altro ID', async () => {
  await seedEvent({ open: true });
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(doc(skipper.firestore(), `boats/${OTHER_BOAT_ID}`), boatDocData({ capacity: 9 })));
});

// =====================================================================
// Caso: Separazione skipper / crew
// =====================================================================

test('separazione skipper/crew: CREW_A non può creare boats/CREW_A', async () => {
  await seedEvent({ open: true });
  const crew = crewAContext(testEnv);
  await assertFails(setDoc(doc(crew.firestore(), `boats/${CREW_A}`), boatDocData({ skipperId: CREW_A, capacity: 9 })));
});

test('separazione skipper/crew: CREW_B non può creare boats/CREW_B', async () => {
  await seedEvent({ open: true });
  const crew = crewBContext(testEnv);
  await assertFails(setDoc(doc(crew.firestore(), `boats/${CREW_B}`), boatDocData({ skipperId: CREW_B, capacity: 9 })));
});

test('separazione skipper/crew: ANON_A non può creare boats/ANON_A', async () => {
  await seedEvent({ open: true });
  const anon = anonContext(testEnv);
  await assertFails(setDoc(doc(anon.firestore(), `boats/${ANON_A}`), boatDocData({ skipperId: ANON_A, capacity: 9 })));
});

test('separazione skipper/crew: CREW_A non legge events/egadi-2026', async () => {
  await seedEvent({ open: true });
  const crew = crewAContext(testEnv);
  await assertFails(getDoc(doc(crew.firestore(), 'events/egadi-2026')));
});

test('separazione skipper/crew: ANON_A non legge events/egadi-2026', async () => {
  await seedEvent({ open: true });
  const anon = anonContext(testEnv);
  await assertFails(getDoc(doc(anon.firestore(), 'events/egadi-2026')));
});

test('separazione skipper/crew: CREW_A non può aggiornare boats/SKIPPER_A come farebbe uno skipper', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  const crew = crewAContext(testEnv);
  await assertFails(updateDoc(doc(crew.firestore(), `boats/${SKIPPER_A}`), { name: 'Presa di forza crew' }));
});

test('separazione skipper/crew: ANON_A non può aggiornare boats/SKIPPER_A come farebbe uno skipper', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  const anon = anonContext(testEnv);
  await assertFails(updateDoc(doc(anon.firestore(), `boats/${SKIPPER_A}`), { name: 'Presa di forza anon' }));
});

test('separazione skipper/crew: OUTSIDER_A (Google) può creare solo la propria barca boats/OUTSIDER_A', async () => {
  await seedEvent({ open: true });
  const outsider = outsiderContext(testEnv);
  await assertSucceeds(setDoc(doc(outsider.firestore(), `boats/${OUTSIDER_A}`), boatDocData({ skipperId: OUTSIDER_A, capacity: 9 })));
});

test('separazione skipper/crew: OUTSIDER_A non può creare boats/OUTSIDER_A con uno skipperId diverso dal proprio uid', async () => {
  await seedEvent({ open: true });
  const outsider = outsiderContext(testEnv);
  await assertFails(setDoc(doc(outsider.firestore(), `boats/${OUTSIDER_A}`), boatDocData({ skipperId: SKIPPER_A, capacity: 9 })));
});

// =====================================================================
// Caso: Barca estranea (OUTSIDER_A contro la barca di SKIPPER_A)
// =====================================================================

test('barca estranea: outsider non legge boats/SKIPPER_A', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}`)));
});

test('barca estranea: outsider non aggiorna boats/SKIPPER_A', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  const outsider = outsiderContext(testEnv);
  await assertFails(updateDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}`), { name: 'Furto barca' }));
});

test('barca estranea: outsider non legge una crewProjection della barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedProjection(SKIPPER_A, PROJECTION_A_ID);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('barca estranea: outsider non elenca (list) crewProjections della barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedProjection(SKIPPER_A, PROJECTION_A_ID);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDocs(collection(outsider.firestore(), `boats/${SKIPPER_A}/crewProjections`)));
});

test('barca estranea: outsider non legge un invito della barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedInvite(SKIPPER_A, INVITE_A_ID);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_A_ID}`)));
});

test('barca estranea: outsider non elenca (list) gli inviti della barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedInvite(SKIPPER_A, INVITE_A_ID);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDocs(collection(outsider.firestore(), `boats/${SKIPPER_A}/invites`)));
});

test('barca estranea: outsider non legge un membro della Crew List', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedMember(SKIPPER_A, INVITE_A_ID);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/members/${INVITE_A_ID}`)));
});

test('barca estranea: outsider non legge il contributionPlan della barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedContributionPlan(SKIPPER_A);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/contributionPlan/default`)));
});

test('barca estranea: outsider non modifica il contributionPlan della barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedContributionPlan(SKIPPER_A);
  const outsider = outsiderContext(testEnv);
  await assertFails(updateDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/contributionPlan/default`), { version: 99 }));
});

test('barca estranea: outsider non legge il costPlan della barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedCostPlan(SKIPPER_A);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/costPlan/default`)));
});

test('barca estranea: outsider non legge il collectionProfile della barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedCollectionProfile(SKIPPER_A);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/collectionProfile/default`)));
});

test('barca estranea: outsider non legge il crewTravelStatus della barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedCrewTravelStatus(SKIPPER_A, INVITE_A_ID);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/crewTravelStatus/${INVITE_A_ID}`)));
});

test('barca estranea: outsider non elenca (list) il crewTravelStatus della barca', async () => {
  await seedEvent({ open: true });
  await seedBoat(SKIPPER_A, { capacity: 9 });
  await seedCrewTravelStatus(SKIPPER_A, INVITE_A_ID);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDocs(collection(outsider.firestore(), `boats/${SKIPPER_A}/crewTravelStatus`)));
});

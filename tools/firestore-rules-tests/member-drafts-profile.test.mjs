// Test delle Security Rules per: scheda personale (members/{memberId}),
// bozza personale crew (crewDrafts/{inviteId}), inserimento manuale skipper
// (members/{memberId} via flusso owner), dossier skipper (skipperProfile) e
// bozza dossier skipper (skipperProfileDraft). Vedi FIRESTORE_RULES_TEST_MATRIX.md.
//
// Nomi di campi/percorsi verificati con grep su firestore.rules prima di
// scrivere questi test (isValidCrewMemberCreate/Update, isValidOwnerMemberCreate/
// Update, hasValidMemberPayload, hasValidCrewDraftPayload, hasCurrentCrewDraftAudience,
// isCrewDraftCleanupDuringInviteReissue, canReissueInvite, hasValidSkipperProfilePayload,
// hasValidSkipperProfileDraftPayload, hasCurrentBriefingAcceptance).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, collection, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  ORGANIZER_A, SKIPPER_A, CREW_A, CREW_B, CREW_A_EMAIL, CREW_B_EMAIL,
  INVITE_A_ID, INVITE_B_ID, ACCESS_KEY_A, PHONE_FINGERPRINT_A,
  organizerContext, skipperContext, outsiderContext, crewAContext, crewBContext,
  anonContext, eventDocData, boatDocData,
} from './identities.mjs';

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-member-drafts',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});
test.after(async () => { await testEnv?.cleanup(); });
test.beforeEach(async () => { await testEnv.clearFirestore(); });

// ---------------------------------------------------------------------------
// Helper di seeding (solo prerequisiti, mai l'azione sotto test)
// ---------------------------------------------------------------------------

function futureTimestamp(days = 7) {
  return Timestamp.fromDate(new Date(Date.now() + days * 24 * 3600 * 1000));
}

async function seedEventOpen() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData({ open: true, organizerIds: [ORGANIZER_A] }));
  });
}

async function seedBoat() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'boats/SKIPPER_A'), boatDocData());
  });
}

async function seedInviteA(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/SKIPPER_A/invites/${INVITE_A_ID}`), {
      id: INVITE_A_ID,
      boatId: 'SKIPPER_A',
      displayName: 'Crew A di test',
      whatsappNumber: '+390000000001',
      phoneFingerprint: PHONE_FINGERPRINT_A,
      loginEmail: CREW_A_EMAIL,
      accessKey: ACCESS_KEY_A,
      participantUid: CREW_A,
      status: 'active',
      accessVersion: 1,
      expiresAt: futureTimestamp(),
      createdAt: Timestamp.now(),
      createdBy: SKIPPER_A,
      preferredLocale: 'it',
      activatedAt: Timestamp.now(),
      ...overrides,
    });
  });
}

async function seedBriefingBoard(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'boats/SKIPPER_A/briefing/board'), {
      rulesTitle: 'Regolamento di bordo di test',
      rulesSummary: 'Sintesi del regolamento di test.',
      rulesText: 'Testo regolamento di bordo fittizio, non vuoto.',
      fullRulesRequired: true,
      rulesVersion: 2,
      meetingPoint: 'Marina di Marsala',
      boardingAt: '2026-10-08T09:00',
      departureAt: '2026-10-08T10:00',
      returnAt: '2026-10-11T18:00',
      scheduleNote: 'Nota di programma di test.',
      updatedAt: Timestamp.now(),
      updatedBy: SKIPPER_A,
      ...overrides,
    });
  });
}

async function seedAcceptance(uid = CREW_A, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/SKIPPER_A/ruleAcceptances/${INVITE_A_ID}`), {
      inviteId: INVITE_A_ID,
      acceptedBy: uid,
      rulesVersion: 2,
      fullRulesRead: true,
      acceptedLocale: 'it',
      acceptedAt: Timestamp.now(),
      ...overrides,
    });
  });
}

// Prerequisiti standard: evento aperto, barca, invito attivo di CREW_A,
// bacheca pubblicata (BRIEFING_A) e accettazione corrente di CREW_A
// (ACCEPTANCE_A). Ogni test che deve negare per uno di questi motivi
// specifici lo seeda diversamente da capo.
async function seedBaseline() {
  await seedEventOpen();
  await seedBoat();
  await seedInviteA();
  await seedBriefingBoard();
  await seedAcceptance();
}

async function seedCrewDraft(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`), {
      firstName: '', lastName: '', birthDate: '', birthPlace: '', nationality: '',
      gender: '', documentType: '', documentNumber: '', documentExpiry: '', role: '',
      email: '', phone: '', charterConsent: false, displayName: '',
      participantUid: CREW_A, accessVersion: 1,
      updatedAt: Timestamp.now(), updatedBy: CREW_A,
      ...overrides,
    });
  });
}

function validCrewMemberPayload(overrides = {}) {
  return {
    firstName: 'Crew', lastName: 'Alfa', birthDate: '1990-05-15', birthPlace: 'Marsala',
    nationality: 'Italiana', gender: 'F', documentType: "Carta d'identità",
    documentNumber: 'AB1234567', documentExpiry: '2030-01-01', role: 'Ospite',
    email: CREW_A_EMAIL, phone: '+390000000001', charterConsent: true,
    displayName: 'Crew Alfa', roleConfirmed: false,
    updatedAt: serverTimestamp(), updatedBy: CREW_A,
    ...overrides,
  };
}

// Payload del flusso owner (SKIPPER_A/ORGANIZER_A) per members/{memberId}:
// niente participantUid/accessVersion/updatedBy, ma createdAt/createdBy
// fissati alla creazione (isValidOwnerMemberCreate).
function validOwnerMemberPayload(overrides = {}) {
  return {
    firstName: 'Crew', lastName: 'Manuale', birthDate: '1990-05-15', birthPlace: 'Marsala',
    nationality: 'Italiana', gender: 'F', documentType: "Carta d'identità",
    documentNumber: 'CD7654321', documentExpiry: '2030-01-01', role: 'Ospite',
    email: 'crew-manuale@test.local', phone: '+390000000050', charterConsent: true,
    displayName: 'Crew Manuale',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(), createdBy: SKIPPER_A,
    ...overrides,
  };
}

function validCrewDraftPayload(overrides = {}) {
  return {
    firstName: '', lastName: '', birthDate: '', birthPlace: '', nationality: '',
    gender: '', documentType: '', documentNumber: '', documentExpiry: '', role: '',
    email: '', phone: '', charterConsent: false, displayName: '',
    participantUid: CREW_A, accessVersion: 1,
    updatedAt: serverTimestamp(), updatedBy: CREW_A,
    ...overrides,
  };
}

function validSkipperProfilePayload(overrides = {}) {
  return {
    firstName: 'Silvio', lastName: 'Skipper', birthDate: '1980-06-01', birthPlace: 'Marsala',
    nationality: 'Italiana', gender: 'M', documentType: "Carta d'identità",
    documentNumber: 'CI1234567', documentExpiry: '2031-01-01',
    email: 'skipper@test.local', phone: '+390000000010',
    sailingLicenseNumber: 'PN123456', sailingLicenseExpiry: '2029-01-01',
    radioCertificateType: 'SRC', radioCertificateNumber: 'RC123456', radioCertificateExpiry: '2028-01-01',
    identityDocumentStatus: 'ready', sailingLicenseStatus: 'ready', radioCertificateStatus: 'to_prepare',
    charterConsent: true, updatedAt: serverTimestamp(), updatedBy: SKIPPER_A,
    ...overrides,
  };
}

function validSkipperProfileDraftPayload(overrides = {}) {
  return {
    firstName: 'Silvio', lastName: '', birthDate: '', birthPlace: '', nationality: '',
    gender: '', documentType: '', documentNumber: '', documentExpiry: '',
    email: '', phone: '',
    sailingLicenseNumber: '', sailingLicenseExpiry: '',
    radioCertificateType: '', radioCertificateNumber: '', radioCertificateExpiry: '',
    identityDocumentStatus: '', sailingLicenseStatus: '', radioCertificateStatus: '',
    charterConsent: false, updatedAt: serverTimestamp(), updatedBy: SKIPPER_A,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Caso: Scheda personale (boats/SKIPPER_A/members/{INVITE_A})
// ---------------------------------------------------------------------------

test('scheda personale: CREW_A crea la propria scheda con dati validi dopo accettazione corrente', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  await assertSucceeds(setDoc(doc(crewA.firestore(), `boats/SKIPPER_A/members/${INVITE_A_ID}`), validCrewMemberPayload()));
});

test('scheda personale: CREW_A aggiorna la propria scheda gia creata', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  const ref = doc(crewA.firestore(), `boats/SKIPPER_A/members/${INVITE_A_ID}`);
  await assertSucceeds(setDoc(ref, validCrewMemberPayload()));
  await assertSucceeds(updateDoc(ref, {
    phone: '+390000000099',
    updatedAt: serverTimestamp(),
    updatedBy: CREW_A,
  }));
});

test('scheda personale: creazione negata senza una ACCEPTANCE_A corrente', async () => {
  await seedEventOpen();
  await seedBoat();
  await seedInviteA();
  await seedBriefingBoard();
  // Nessuna accettazione seedata.
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `boats/SKIPPER_A/members/${INVITE_A_ID}`), validCrewMemberPayload()));
});

test('scheda personale: creazione negata con ACCEPTANCE_A di rulesVersion vecchia rispetto al BRIEFING_A attuale', async () => {
  await seedEventOpen();
  await seedBoat();
  await seedInviteA();
  await seedBriefingBoard(); // rulesVersion: 2
  await seedAcceptance(CREW_A, { rulesVersion: 1 }); // vecchia
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `boats/SKIPPER_A/members/${INVITE_A_ID}`), validCrewMemberPayload()));
});

test('scheda personale: creazione negata con un memberId diverso dal proprio invito', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `boats/SKIPPER_A/members/${INVITE_B_ID}`), validCrewMemberPayload()));
});

test('scheda personale: creazione negata con campi anagrafici extra non previsti', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(
    doc(crewA.firestore(), `boats/SKIPPER_A/members/${INVITE_A_ID}`),
    validCrewMemberPayload({ noteExtra: 'non prevista' }),
  ));
});

test('scheda personale: creazione negata con createdBy impostato lato client', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(
    doc(crewA.firestore(), `boats/SKIPPER_A/members/${INVITE_A_ID}`),
    validCrewMemberPayload({ createdAt: serverTimestamp(), createdBy: CREW_A }),
  ));
});

test('scheda personale: creazione negata dopo che linvito e stato revocato', async () => {
  await seedEventOpen();
  await seedBoat();
  await seedInviteA({ status: 'revoked' });
  await seedBriefingBoard();
  await seedAcceptance();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `boats/SKIPPER_A/members/${INVITE_A_ID}`), validCrewMemberPayload()));
});

// ---------------------------------------------------------------------------
// Caso: Bozza personale crew (boats/SKIPPER_A/crewDrafts/{INVITE_A})
// ---------------------------------------------------------------------------

test('bozza personale crew: CREW_A crea la propria bozza con schema chiuso e campi parziali', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  await assertSucceeds(setDoc(doc(crewA.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`), validCrewDraftPayload()));
});

test('bozza personale crew: CREW_A aggiorna (riprende) la propria bozza gia creata', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  const ref = doc(crewA.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`);
  await assertSucceeds(setDoc(ref, validCrewDraftPayload()));
  await assertSucceeds(setDoc(ref, validCrewDraftPayload({ firstName: 'Crew', displayName: 'Crew' })));
});

for (const [label, getContext] of [
  ['SKIPPER_A', () => skipperContext(testEnv)],
  ['ORGANIZER_A', () => organizerContext(testEnv)],
  ['CREW_B', () => crewBContext(testEnv)],
  ['ANON_A', () => anonContext(testEnv)],
]) {
  test(`bozza personale crew: ${label} non puo leggere la bozza di CREW_A`, async () => {
    await seedBaseline();
    await seedCrewDraft();
    const ctx = getContext();
    await assertFails(getDoc(doc(ctx.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`)));
  });

  test(`bozza personale crew: ${label} non puo scrivere sulla bozza di CREW_A`, async () => {
    await seedBaseline();
    await seedCrewDraft();
    const ctx = getContext();
    await assertFails(setDoc(doc(ctx.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`), validCrewDraftPayload()));
  });
}

test('bozza personale crew: list sulla collezione crewDrafts e sempre negata', async () => {
  await seedBaseline();
  await seedCrewDraft();
  const skipper = skipperContext(testEnv);
  await assertFails(getDocs(collection(skipper.firestore(), 'boats/SKIPPER_A/crewDrafts')));
});

test('bozza personale crew: creazione negata con un campo extra non previsto dallo schema', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(
    doc(crewA.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`),
    validCrewDraftPayload({ noteExtra: 'non prevista' }),
  ));
});

test('bozza personale crew: creazione negata con un participantUid diverso dal proprio', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(
    doc(crewA.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`),
    validCrewDraftPayload({ participantUid: CREW_B }),
  ));
});

test('bozza personale crew: creazione negata con un accessVersion diverso da quello dellinvito', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(
    doc(crewA.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`),
    validCrewDraftPayload({ accessVersion: 2 }),
  ));
});

test('bozza personale crew: creazione negata senza una ACCEPTANCE_A corrente', async () => {
  await seedEventOpen();
  await seedBoat();
  await seedInviteA();
  await seedBriefingBoard();
  // Nessuna accettazione seedata.
  const crewA = crewAContext(testEnv);
  await assertFails(setDoc(doc(crewA.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`), validCrewDraftPayload()));
});

test('bozza personale crew: la creazione di members/INVITE_A con dati incompleti resta negata (stessa validazione della scheda personale)', async () => {
  await seedBaseline();
  const crewA = crewAContext(testEnv);
  const incomplete = validCrewMemberPayload();
  delete incomplete.birthPlace;
  await assertFails(setDoc(doc(crewA.firestore(), `boats/SKIPPER_A/members/${INVITE_A_ID}`), incomplete));
});

test('bozza personale crew: riemissione in un unico batch aggiorna accessVersion e cancella la bozza precedente', async () => {
  await seedBaseline();
  await seedCrewDraft();
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.update(doc(skipper.firestore(), `boats/SKIPPER_A/invites/${INVITE_A_ID}`), {
    status: 'pending',
    participantUid: null,
    accessVersion: 2,
    expiresAt: futureTimestamp(),
    reissuedAt: serverTimestamp(),
    reissuedBy: SKIPPER_A,
  });
  batch.delete(doc(skipper.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`));
  await assertSucceeds(batch.commit());
});

test('bozza personale crew: dopo la riemissione, il nuovo titolare CREW_B non trova (ne vede) la bozza precedente', async () => {
  await seedEventOpen();
  await seedBoat();
  await seedBriefingBoard();
  // L'invito e' gia stato riemesso e reclamato da CREW_B con accessVersion 2;
  // la bozza precedente (di CREW_A) non viene ricreata: non esiste piu'.
  await seedInviteA({ participantUid: CREW_B, accessVersion: 2, loginEmail: CREW_B_EMAIL });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `crewAccess/${CREW_B}`), {
      boatId: 'SKIPPER_A', inviteId: INVITE_A_ID, userId: CREW_B, loginEmail: CREW_B_EMAIL,
      updatedAt: Timestamp.now(),
    });
  });
  // CREW_B ha comunque una propria accettazione corrente del briefing.
  await seedAcceptance(CREW_B);
  const crewB = crewBContext(testEnv);
  const snap = await assertSucceeds(getDoc(doc(crewB.firestore(), `boats/SKIPPER_A/crewDrafts/${INVITE_A_ID}`)));
  assert.equal(snap.exists(), false);
});

// ---------------------------------------------------------------------------
// Caso: Inserimento skipper (boats/SKIPPER_A/members/{id scelto dallo skipper})
// ---------------------------------------------------------------------------
// Grep su firestore.rules: members/{memberId} allow create/update autorizzano
// anche isValidOwnerMemberCreate/isValidOwnerMemberUpdate per (isOrganizer()
// || isSkipper(boatId)) — non c'e' un percorso distinto dedicato alla "scheda
// manuale": e' lo stesso /members/{memberId}, ma con lo schema e i controlli
// del flusso owner (createdAt/createdBy fissati alla creazione, nessun invito
// richiesto). Vedi assumptions nella risposta finale.

test('inserimento skipper: SKIPPER_A crea una scheda manuale con i soli campi Crew List previsti', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  await assertSucceeds(setDoc(
    doc(skipper.firestore(), 'boats/SKIPPER_A/members/manual-1'),
    validOwnerMemberPayload(),
  ));
});

test('inserimento skipper: SKIPPER_A aggiorna la scheda manuale gia creata', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  const ref = doc(skipper.firestore(), 'boats/SKIPPER_A/members/manual-1');
  await assertSucceeds(setDoc(ref, validOwnerMemberPayload()));
  await assertSucceeds(updateDoc(ref, { phone: '+390000000098', updatedAt: serverTimestamp() }));
});

test('inserimento skipper: creazione negata con campi extra non previsti dalla Crew List', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), 'boats/SKIPPER_A/members/manual-1'),
    validOwnerMemberPayload({ noteExtra: 'non prevista' }),
  ));
});

// ---------------------------------------------------------------------------
// Caso: Dossier skipper (boats/SKIPPER_A/skipperProfile/default)
// ---------------------------------------------------------------------------

test('dossier skipper: SKIPPER_A crea il proprio dossier con schema esatto', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  await assertSucceeds(setDoc(doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfile/default'), validSkipperProfilePayload()));
});

test('dossier skipper: SKIPPER_A aggiorna il proprio dossier gia creato', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  const ref = doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfile/default');
  await assertSucceeds(setDoc(ref, validSkipperProfilePayload()));
  await assertSucceeds(setDoc(ref, validSkipperProfilePayload({ phone: '+390000000097' })));
});

test('dossier skipper: creazione negata con una data in formato libero non ISO', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfile/default'),
    validSkipperProfilePayload({ birthDate: '01/06/1980' }),
  ));
});

test('dossier skipper: creazione negata con un ID documento diverso da default', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfile/other'), validSkipperProfilePayload()));
});

test('dossier skipper: creazione negata con un campo extra non previsto', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfile/default'),
    validSkipperProfilePayload({ noteExtra: 'non prevista' }),
  ));
});

test('dossier skipper: creazione negata con un valore di stato documentale non ammesso', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfile/default'),
    validSkipperProfilePayload({ identityDocumentStatus: 'done' }),
  ));
});

test('dossier skipper: list sulla collezione e sempre negata', async () => {
  await seedEventOpen();
  await seedBoat();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'boats/SKIPPER_A/skipperProfile/default'), validSkipperProfilePayload({ updatedAt: Timestamp.now() }));
  });
  const skipper = skipperContext(testEnv);
  await assertFails(getDocs(collection(skipper.firestore(), 'boats/SKIPPER_A/skipperProfile')));
});

for (const [label, getContext] of [
  ['ORGANIZER_A', () => organizerContext(testEnv)],
  ['CREW_A', () => crewAContext(testEnv)],
  ['OUTSIDER_A', () => outsiderContext(testEnv)],
  ['SKIPPER_B', () => skipperContext(testEnv, 'SKIPPER_B')],
]) {
  test(`dossier skipper: ${label} non puo leggere il dossier di SKIPPER_A`, async () => {
    await seedEventOpen();
    await seedBoat();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'boats/SKIPPER_A/skipperProfile/default'), validSkipperProfilePayload({ updatedAt: Timestamp.now() }));
    });
    const ctx = getContext();
    await assertFails(getDoc(doc(ctx.firestore(), 'boats/SKIPPER_A/skipperProfile/default')));
  });

  test(`dossier skipper: ${label} non puo creare/scrivere il dossier di SKIPPER_A`, async () => {
    await seedEventOpen();
    await seedBoat();
    const ctx = getContext();
    await assertFails(setDoc(doc(ctx.firestore(), 'boats/SKIPPER_A/skipperProfile/default'), validSkipperProfilePayload()));
  });
}

// ---------------------------------------------------------------------------
// Caso: Bozza dossier skipper (boats/SKIPPER_A/skipperProfileDraft/default)
// ---------------------------------------------------------------------------

test('bozza dossier skipper: SKIPPER_A crea la propria bozza incompleta', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  await assertSucceeds(setDoc(doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfileDraft/default'), validSkipperProfileDraftPayload()));
});

test('bozza dossier skipper: SKIPPER_A aggiorna la propria bozza gia creata', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  const ref = doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfileDraft/default');
  await assertSucceeds(setDoc(ref, validSkipperProfileDraftPayload()));
  await assertSucceeds(setDoc(ref, validSkipperProfileDraftPayload({ lastName: 'Skipper' })));
});

for (const [label, getContext] of [
  ['SKIPPER_B', () => skipperContext(testEnv, 'SKIPPER_B')],
  ['ORGANIZER_A', () => organizerContext(testEnv)],
  ['CREW_A', () => crewAContext(testEnv)],
  ['OUTSIDER_A', () => outsiderContext(testEnv)],
]) {
  test(`bozza dossier skipper: ${label} non puo leggere la bozza di SKIPPER_A`, async () => {
    await seedEventOpen();
    await seedBoat();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'boats/SKIPPER_A/skipperProfileDraft/default'), validSkipperProfileDraftPayload({ updatedAt: Timestamp.now() }));
    });
    const ctx = getContext();
    await assertFails(getDoc(doc(ctx.firestore(), 'boats/SKIPPER_A/skipperProfileDraft/default')));
  });
}

test('bozza dossier skipper: list sulla collezione e sempre negata', async () => {
  await seedEventOpen();
  await seedBoat();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'boats/SKIPPER_A/skipperProfileDraft/default'), validSkipperProfileDraftPayload({ updatedAt: Timestamp.now() }));
  });
  const skipper = skipperContext(testEnv);
  await assertFails(getDocs(collection(skipper.firestore(), 'boats/SKIPPER_A/skipperProfileDraft')));
});

test('bozza dossier skipper: creazione negata con un ID diverso da default', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfileDraft/other'), validSkipperProfileDraftPayload()));
});

test('bozza dossier skipper: creazione negata con un campo extra non previsto', async () => {
  await seedEventOpen();
  await seedBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(setDoc(
    doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfileDraft/default'),
    validSkipperProfileDraftPayload({ noteExtra: 'non prevista' }),
  ));
});

test('bozza dossier skipper: in un unico batch, il dossier completo viene confermato e la bozza cancellata', async () => {
  await seedEventOpen();
  await seedBoat();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'boats/SKIPPER_A/skipperProfileDraft/default'), validSkipperProfileDraftPayload({ updatedAt: Timestamp.now() }));
  });
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfile/default'), validSkipperProfilePayload());
  batch.delete(doc(skipper.firestore(), 'boats/SKIPPER_A/skipperProfileDraft/default'));
  await assertSucceeds(batch.commit());
});

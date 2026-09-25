// Matrice: "Profilo incasso", "Schema piano quote", "Visibilita piano quote",
// "Preventivo barca privato" (vedi FIRESTORE_RULES_TEST_MATRIX.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  ORGANIZER_A, SKIPPER_A, OUTSIDER_A, CREW_A, CREW_A_EMAIL,
  INVITE_A_ID, ACCESS_KEY_A, PHONE_FINGERPRINT_A,
  organizerContext, skipperContext, outsiderContext, crewAContext, crewBContext,
  eventDocData, boatDocData,
} from './identities.mjs';

let testEnv;

const BOAT_ID = SKIPPER_A;
const SKIPPER_B = 'SKIPPER_B';

const PAYPAL_LINK = 'https://paypal.me/skipper-karibu-test';
const SATISPAY_LINK = 'https://satispay.com/skipper-karibu-test';
const REVOLUT_LINK = 'https://revolut.me/skipper-karibu-test';
const VALID_IBAN = 'IT60X0542811100000123456';
const ACCOUNT_HOLDER = 'Skipper Di Test';

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-finance',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});
test.after(async () => { await testEnv?.cleanup(); });
test.beforeEach(async () => { await testEnv.clearFirestore(); });

// ---------------------------------------------------------------------------
// Helper di seed (prerequisiti, sempre con Rules disabilitate)
// ---------------------------------------------------------------------------

async function seedEventAndBoat(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData());
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}`), boatDocData(overrides));
  });
}

async function seedBriefingBoard(rulesVersion = 2) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/briefing/board`), {
      rulesTitle: 'Regolamento di bordo di test',
      rulesSummary: 'Sintesi delle regole di sicurezza di test',
      rulesText: 'Testo completo del regolamento di bordo, fittizio.',
      fullRulesRequired: true,
      rulesVersion,
      meetingPoint: 'Marina di Marsala',
      boardingAt: '2026-10-08T09:00',
      departureAt: '2026-10-08T10:00',
      returnAt: '2026-10-11T18:00',
      scheduleNote: 'Nota di viaggio di test',
      updatedAt: serverTimestamp(),
      updatedBy: SKIPPER_A,
    });
  });
}

async function seedActiveCrewClaim() {
  // Invito attivo + crewAccess + accettazione corrente per CREW_A: la
  // combinazione che fa risultare vero isBoatParticipant/hasCurrentBriefingAcceptance.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/invites/${INVITE_A_ID}`), {
      boatId: BOAT_ID,
      status: 'active',
      participantUid: CREW_A,
      accessVersion: 1,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
      preferredLocale: 'it',
      loginEmail: CREW_A_EMAIL,
      phoneFingerprint: PHONE_FINGERPRINT_A,
      accessKey: ACCESS_KEY_A,
    });
    await setDoc(doc(ctx.firestore(), `crewAccess/${CREW_A}`), {
      boatId: BOAT_ID,
      userId: CREW_A,
      inviteId: INVITE_A_ID,
      loginEmail: CREW_A_EMAIL,
      updatedAt: serverTimestamp(),
    });
  });
}

async function seedCurrentAcceptance(rulesVersion = 2) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/ruleAcceptances/${INVITE_A_ID}`), {
      inviteId: INVITE_A_ID,
      acceptedBy: CREW_A,
      rulesVersion,
      fullRulesRead: true,
      acceptedLocale: 'it',
      acceptedAt: serverTimestamp(),
    });
  });
}

function validPaymentDetails(overrides = {}) {
  return {
    paypal: PAYPAL_LINK,
    satispay: SATISPAY_LINK,
    revolut: REVOLUT_LINK,
    bankTransfer: { iban: VALID_IBAN, accountHolder: ACCOUNT_HOLDER },
    ...overrides,
  };
}

function validCollectionProfileData(overrides = {}) {
  return {
    collectorId: SKIPPER_A,
    collectorName: 'Skipper Karibu di test',
    paypalEnabled: true,
    satispayEnabled: true,
    revolutEnabled: true,
    bankTransferEnabled: true,
    paymentDetails: validPaymentDetails(),
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
    ...overrides,
  };
}

function validPaymentInstructionsData(overrides = {}) {
  return {
    schemaVersion: 1,
    collectorName: 'Skipper Karibu di test',
    paymentMethods: { paypal: true, satispay: true, revolut: true, bankTransfer: true },
    paymentDetails: validPaymentDetails(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

async function seedValidCollectionProfile() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/collectionProfile/default`), validCollectionProfileData());
  });
}

function baseContributionItemsV4() {
  return {
    berth: { state: 'to_define', amountCents: 0 },
    starter_pack: { state: 'local', amountCents: 0 },
    linen_towels: { state: 'included', amountCents: 0 },
    protection_insurance: { state: 'to_define', amountCents: 0 },
    provisions: { state: 'to_define', amountCents: 0 },
    fuel: { state: 'to_define', amountCents: 0 },
    transfer: { state: 'extra', amountCents: 1500 },
    shore_dinner: { state: 'not_applicable', amountCents: 0 },
    mooring_fee: { state: 'to_define', amountCents: 0 },
    refundable_deposit: { state: 'local', amountCents: 5000 },
  };
}

function validContributionPlanV4Data(overrides = {}) {
  return {
    items: baseContributionItemsV4(),
    starterPackItems: ['bed_linen', 'bath_kit'],
    starterPackSettlementMode: 'cash_on_board',
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
    ...overrides,
  };
}

async function seedValidContributionPlan() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/contributionPlan/default`), validContributionPlanV4Data());
  });
}

function validCostPlanV7Data(overrides = {}) {
  return {
    charterCents: 500000,
    skipperFlightTrainCents: 0,
    skipperCarCents: 0,
    skipperLocalTransferCents: 0,
    otherRecoverableCents: 0,
    starterPackTotalCents: 30000,
    starterPackRateMode: 'total_divided',
    starterPackFixedPerPersonCents: 0,
    starterPackIncludedInCharter: false,
    protectionInsuranceTotalCents: 10000,
    protectionInsuranceRateMode: 'total_divided',
    protectionInsuranceFixedPerPersonCents: 0,
    refundableDepositTotalCents: 20000,
    payingParticipants: 8,
    depositParticipants: 8,
    dinettePayingParticipants: 0,
    dinetteWeightPercent: 50,
    dinetteRateMode: 'percentage',
    dinetteFixedCents: 0,
    berthRoundingMode: 'automatic',
    berthRoundingIncrementCents: 0,
    manualStandardBerthCents: 0,
    starterPackDescription: 'Kit dotazioni di bordo',
    protectionInsuranceDescription: 'Assicurazione base inclusa',
    refundableDepositDescription: 'Cauzione da regolare in loco',
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
    ...overrides,
  };
}

async function seedValidCostPlan() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/costPlan/default`), validCostPlanV7Data());
  });
}

// ---------------------------------------------------------------------------
// Caso: Profilo incasso (collectionProfile)
// ---------------------------------------------------------------------------

test('profilo incasso: la creazione da sola (senza paymentInstructions gemello nello stesso batch) viene rifiutata anche con schema valido', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile/default`),
    validCollectionProfileData(),
  ));
});

test('profilo incasso: SKIPPER_A crea profilo e paymentInstructions gemello nello stesso batch con successo', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile/default`), validCollectionProfileData());
  batch.set(doc(skipper.firestore(), `boats/${BOAT_ID}/paymentInstructions/default`), validPaymentInstructionsData());
  await assertSucceeds(batch.commit());
});

test('profilo incasso: SKIPPER_A puo rileggere il proprio profilo', async () => {
  await seedEventAndBoat();
  await seedValidCollectionProfile();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const snap = await assertSucceeds(getDoc(doc(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile/default`)));
  assert.equal(snap.data().collectorId, SKIPPER_A);
});

test('profilo incasso: CREW_A non puo leggere il profilo di incasso dello skipper', async () => {
  await seedEventAndBoat();
  await seedValidCollectionProfile();
  const crew = crewAContext(testEnv);
  await assertFails(getDoc(doc(crew.firestore(), `boats/${BOAT_ID}/collectionProfile/default`)));
});

test('profilo incasso: ORGANIZER_A non puo leggere il profilo di incasso', async () => {
  await seedEventAndBoat();
  await seedValidCollectionProfile();
  const organizer = organizerContext(testEnv);
  await assertFails(getDoc(doc(organizer.firestore(), `boats/${BOAT_ID}/collectionProfile/default`)));
});

test('profilo incasso: OUTSIDER_A non puo leggere il profilo di incasso', async () => {
  await seedEventAndBoat();
  await seedValidCollectionProfile();
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${BOAT_ID}/collectionProfile/default`)));
});

test('profilo incasso: nessuno, incluso lo skipper, puo elencare la collezione', async () => {
  await seedEventAndBoat();
  await seedValidCollectionProfile();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const organizer = organizerContext(testEnv);
  const crew = crewAContext(testEnv);
  const outsider = outsiderContext(testEnv);
  await assertFails(getDocs(collection(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile`)));
  await assertFails(getDocs(collection(organizer.firestore(), `boats/${BOAT_ID}/collectionProfile`)));
  await assertFails(getDocs(collection(crew.firestore(), `boats/${BOAT_ID}/collectionProfile`)));
  await assertFails(getDocs(collection(outsider.firestore(), `boats/${BOAT_ID}/collectionProfile`)));
});

test('profilo incasso: una chiave extra nel payload viene rifiutata', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile/default`),
    validCollectionProfileData({ note: 'campo non previsto' }),
  ));
});

test('profilo incasso: un URL non https per paypal viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile/default`),
    validCollectionProfileData({ paymentDetails: validPaymentDetails({ paypal: 'http://paypal.me/skipper-karibu-test' }) }),
  ));
});

test('profilo incasso: un URL non https per satispay viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile/default`),
    validCollectionProfileData({ paymentDetails: validPaymentDetails({ satispay: 'http://satispay.com/skipper-karibu-test' }) }),
  ));
});

test('profilo incasso: un IBAN con formato palesemente non valido viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile/default`),
    validCollectionProfileData({ paymentDetails: validPaymentDetails({ bankTransfer: { iban: '12345', accountHolder: ACCOUNT_HOLDER } }) }),
  ));
});

test('profilo incasso: un bankTransfer senza accountHolder viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile/default`),
    validCollectionProfileData({ paymentDetails: validPaymentDetails({ bankTransfer: { iban: VALID_IBAN, accountHolder: '' } }) }),
  ));
});

test('profilo incasso: lo schema precedente senza loggetto paymentDetails viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const legacyData = validCollectionProfileData();
  delete legacyData.paymentDetails;
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile/default`),
    legacyData,
  ));
});

test('profilo incasso: un metodo abilitato con il dettaglio corrispondente vuoto viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/collectionProfile/default`),
    validCollectionProfileData({ paymentDetails: validPaymentDetails({ revolut: '' }) }),
  ));
});

// ---------------------------------------------------------------------------
// Caso: Schema piano quote (contributionPlan V4)
// ---------------------------------------------------------------------------

test('piano quote: SKIPPER_A crea lo schema V4 esatto con le dieci voci', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data(),
  ));
});

test('piano quote: un id di documento diverso da default viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/other`),
    validContributionPlanV4Data(),
  ));
});

test('piano quote: una voce mancante tra le dieci viene rifiutata', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = baseContributionItemsV4();
  delete items.mooring_fee;
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: una voce extra oltre le dieci viene rifiutata', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = { ...baseContributionItemsV4(), extra_item: { state: 'to_define', amountCents: 0 } };
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: un campo description su una voce viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = baseContributionItemsV4();
  items.provisions = { ...items.provisions, description: 'Spesa di bordo' };
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: uno state non tra i valori ammessi viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = baseContributionItemsV4();
  items.provisions = { state: 'inventato', amountCents: 0 };
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: un amountCents negativo viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = baseContributionItemsV4();
  items.transfer = { state: 'extra', amountCents: -100 };
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: un amountCents decimale viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = baseContributionItemsV4();
  items.transfer = { state: 'extra', amountCents: 150.5 };
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: un amountCents diverso da zero su una voce con state to_define viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = baseContributionItemsV4();
  items.provisions = { state: 'to_define', amountCents: 100 };
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: un amountCents diverso da zero su una voce con state included viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = baseContributionItemsV4();
  items.linen_towels = { state: 'included', amountCents: 100 };
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: un amountCents diverso da zero su una voce con state not_applicable viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = baseContributionItemsV4();
  items.shore_dinner = { state: 'not_applicable', amountCents: 100 };
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: un ID non ammesso in starterPackItems viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ starterPackItems: ['bed_linen', 'id_non_valido'] }),
  ));
});

test('piano quote: un duplicato in starterPackItems viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ starterPackItems: ['bed_linen', 'bed_linen'] }),
  ));
});

test('piano quote: linen_towels con state diverso da included viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = baseContributionItemsV4();
  items.linen_towels = { state: 'to_define', amountCents: 0 };
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: refundable_deposit con state diverso da local viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const items = baseContributionItemsV4();
  items.refundable_deposit = { state: 'to_define', amountCents: 0 };
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data({ items }),
  ));
});

test('piano quote: la migrazione da uno schema V3 esistente a V4 viene accettata', async () => {
  await seedEventAndBoat();
  // Documento V3 storico (formato legacy con description e starterPackSettlementMode,
  // senza starterPackItems): seedato con Rules disabilitate come prerequisito.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${BOAT_ID}/contributionPlan/default`), {
      items: {
        berth: { state: 'to_define', amountCents: 0, description: 'Quota cabina' },
        starter_pack: { state: 'local', amountCents: 0, description: 'Kit di bordo' },
        linen_towels: { state: 'included', amountCents: 0, description: 'Incluso' },
        protection_insurance: { state: 'to_define', amountCents: 0, description: 'Da definire' },
        provisions: { state: 'to_define', amountCents: 0, description: 'Da definire' },
        fuel: { state: 'to_define', amountCents: 0, description: 'Da definire' },
        transfer: { state: 'extra', amountCents: 1000, description: 'Transfer porto' },
        shore_dinner: { state: 'not_applicable', amountCents: 0, description: 'Non previsto' },
        mooring_fee: { state: 'to_define', amountCents: 0, description: 'Da definire' },
        refundable_deposit: { state: 'local', amountCents: 5000, description: 'Cauzione' },
      },
      starterPackSettlementMode: 'cash_on_board',
      updatedAt: serverTimestamp(),
      updatedBy: SKIPPER_A,
    });
  });
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(updateDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data(),
  ));
});

// ---------------------------------------------------------------------------
// Caso: Visibilita piano quote
// ---------------------------------------------------------------------------

test('visibilita piano quote: CREW_A non puo leggere prima che esista laccettazione corrente del briefing', async () => {
  await seedEventAndBoat();
  await seedBriefingBoard();
  await seedActiveCrewClaim();
  await seedValidContributionPlan();
  // Nota: ACCEPTANCE_A non e ancora stata seedata a questo punto.
  const crew = crewAContext(testEnv);
  await assertFails(getDoc(doc(crew.firestore(), `boats/${BOAT_ID}/contributionPlan/default`)));
});

test('visibilita piano quote: CREW_A rilegge dopo claim attivo e accettazione corrente', async () => {
  await seedEventAndBoat();
  await seedBriefingBoard();
  await seedActiveCrewClaim();
  await seedCurrentAcceptance();
  await seedValidContributionPlan();
  const crew = crewAContext(testEnv);
  const snap = await assertSucceeds(getDoc(doc(crew.firestore(), `boats/${BOAT_ID}/contributionPlan/default`)));
  assert.equal(snap.data().starterPackSettlementMode, 'cash_on_board');
});

test('visibilita piano quote: CREW_A non puo elencare la collezione anche con accettazione corrente', async () => {
  await seedEventAndBoat();
  await seedBriefingBoard();
  await seedActiveCrewClaim();
  await seedCurrentAcceptance();
  await seedValidContributionPlan();
  const crew = crewAContext(testEnv);
  await assertFails(getDocs(collection(crew.firestore(), `boats/${BOAT_ID}/contributionPlan`)));
});

test('visibilita piano quote: CREW_B senza invito su questa barca non puo leggere', async () => {
  await seedEventAndBoat();
  await seedBriefingBoard();
  await seedActiveCrewClaim();
  await seedCurrentAcceptance();
  await seedValidContributionPlan();
  const crewB = crewBContext(testEnv);
  await assertFails(getDoc(doc(crewB.firestore(), `boats/${BOAT_ID}/contributionPlan/default`)));
});

test('visibilita piano quote: OUTSIDER_A non puo leggere', async () => {
  await seedEventAndBoat();
  await seedBriefingBoard();
  await seedActiveCrewClaim();
  await seedCurrentAcceptance();
  await seedValidContributionPlan();
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${BOAT_ID}/contributionPlan/default`)));
});

test('visibilita piano quote: SKIPPER_A legge sempre il proprio piano quote', async () => {
  await seedEventAndBoat();
  await seedValidContributionPlan();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(getDoc(doc(skipper.firestore(), `boats/${BOAT_ID}/contributionPlan/default`)));
});

test('visibilita piano quote: ORGANIZER_A legge sempre il piano quote', async () => {
  await seedEventAndBoat();
  await seedValidContributionPlan();
  const organizer = organizerContext(testEnv);
  await assertSucceeds(getDoc(doc(organizer.firestore(), `boats/${BOAT_ID}/contributionPlan/default`)));
});

test('visibilita piano quote: CREW_A non puo aggiornare il piano quote, solo lo skipper scrive', async () => {
  await seedEventAndBoat();
  await seedBriefingBoard();
  await seedActiveCrewClaim();
  await seedCurrentAcceptance();
  await seedValidContributionPlan();
  const crew = crewAContext(testEnv);
  await assertFails(updateDoc(
    doc(crew.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data(),
  ));
});

test('visibilita piano quote: ORGANIZER_A non puo aggiornare il piano quote, solo lo skipper scrive', async () => {
  await seedEventAndBoat();
  await seedValidContributionPlan();
  const organizer = organizerContext(testEnv);
  await assertFails(updateDoc(
    doc(organizer.firestore(), `boats/${BOAT_ID}/contributionPlan/default`),
    validContributionPlanV4Data(),
  ));
});

// ---------------------------------------------------------------------------
// Caso: Preventivo barca privato (costPlan V7)
// ---------------------------------------------------------------------------

test('preventivo barca: SKIPPER_A crea lo schema V7 valido', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertSucceeds(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`),
    validCostPlanV7Data(),
  ));
});

test('preventivo barca: un importo cents negativo viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`),
    validCostPlanV7Data({ charterCents: -500 }),
  ));
});

test('preventivo barca: un importo cents decimale viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`),
    validCostPlanV7Data({ charterCents: 500000.25 }),
  ));
});

test('preventivo barca: starterPackRateMode fixed_per_person con importo per persona a zero viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`),
    validCostPlanV7Data({
      starterPackRateMode: 'fixed_per_person',
      starterPackFixedPerPersonCents: 0,
      starterPackTotalCents: 0,
    }),
  ));
});

test('preventivo barca: berthRoundingMode automatic con berthRoundingIncrementCents diverso da zero viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`),
    validCostPlanV7Data({ berthRoundingMode: 'automatic', berthRoundingIncrementCents: 500 }),
  ));
});

test('preventivo barca: berthRoundingMode automatic con manualStandardBerthCents diverso da zero viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`),
    validCostPlanV7Data({ berthRoundingMode: 'automatic', manualStandardBerthCents: 5000 }),
  ));
});

test('preventivo barca: berthRoundingMode ceil_increment con incremento non tra 100/500/1000 viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`),
    validCostPlanV7Data({ berthRoundingMode: 'ceil_increment', berthRoundingIncrementCents: 250 }),
  ));
});

test('preventivo barca: berthRoundingMode manual_up con manualStandardBerthCents a zero viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`),
    validCostPlanV7Data({ berthRoundingMode: 'manual_up', manualStandardBerthCents: 0 }),
  ));
});

test('preventivo barca: berthRoundingMode manual_up senza manualStandardBerthCents viene rifiutato', async () => {
  await seedEventAndBoat();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const data = validCostPlanV7Data({ berthRoundingMode: 'manual_up' });
  delete data.manualStandardBerthCents;
  await assertFails(setDoc(
    doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`),
    data,
  ));
});

test('preventivo barca: get e consentito solo allo skipper della barca', async () => {
  await seedEventAndBoat();
  await seedValidCostPlan();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const organizer = organizerContext(testEnv);
  const crew = crewAContext(testEnv);
  const outsider = outsiderContext(testEnv);
  const anotherSkipper = skipperContext(testEnv, SKIPPER_B);
  await assertSucceeds(getDoc(doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`)));
  await assertFails(getDoc(doc(organizer.firestore(), `boats/${BOAT_ID}/costPlan/default`)));
  await assertFails(getDoc(doc(crew.firestore(), `boats/${BOAT_ID}/costPlan/default`)));
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${BOAT_ID}/costPlan/default`)));
  await assertFails(getDoc(doc(anotherSkipper.firestore(), `boats/${BOAT_ID}/costPlan/default`)));
});

test('preventivo barca: list e sempre negato, incluso allo skipper', async () => {
  await seedEventAndBoat();
  await seedValidCostPlan();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  const organizer = organizerContext(testEnv);
  const crew = crewAContext(testEnv);
  const outsider = outsiderContext(testEnv);
  const anotherSkipper = skipperContext(testEnv, SKIPPER_B);
  await assertFails(getDocs(collection(skipper.firestore(), `boats/${BOAT_ID}/costPlan`)));
  await assertFails(getDocs(collection(organizer.firestore(), `boats/${BOAT_ID}/costPlan`)));
  await assertFails(getDocs(collection(crew.firestore(), `boats/${BOAT_ID}/costPlan`)));
  await assertFails(getDocs(collection(outsider.firestore(), `boats/${BOAT_ID}/costPlan`)));
  await assertFails(getDocs(collection(anotherSkipper.firestore(), `boats/${BOAT_ID}/costPlan`)));
});

test('preventivo barca: create e negato a chiunque non sia lo skipper della barca, anche con schema valido', async () => {
  await seedEventAndBoat();
  const organizer = organizerContext(testEnv);
  const crew = crewAContext(testEnv);
  const outsider = outsiderContext(testEnv);
  const anotherSkipper = skipperContext(testEnv, SKIPPER_B);
  await assertFails(setDoc(doc(organizer.firestore(), `boats/${BOAT_ID}/costPlan/default`), validCostPlanV7Data()));
  await assertFails(setDoc(doc(crew.firestore(), `boats/${BOAT_ID}/costPlan/default`), validCostPlanV7Data()));
  await assertFails(setDoc(doc(outsider.firestore(), `boats/${BOAT_ID}/costPlan/default`), validCostPlanV7Data()));
  await assertFails(setDoc(doc(anotherSkipper.firestore(), `boats/${BOAT_ID}/costPlan/default`), validCostPlanV7Data()));
});

test('preventivo barca: update e negato a chiunque non sia lo skipper della barca, anche con schema valido', async () => {
  await seedEventAndBoat();
  await seedValidCostPlan();
  const organizer = organizerContext(testEnv);
  const crew = crewAContext(testEnv);
  const outsider = outsiderContext(testEnv);
  const anotherSkipper = skipperContext(testEnv, SKIPPER_B);
  await assertFails(updateDoc(doc(organizer.firestore(), `boats/${BOAT_ID}/costPlan/default`), validCostPlanV7Data()));
  await assertFails(updateDoc(doc(crew.firestore(), `boats/${BOAT_ID}/costPlan/default`), validCostPlanV7Data()));
  await assertFails(updateDoc(doc(outsider.firestore(), `boats/${BOAT_ID}/costPlan/default`), validCostPlanV7Data()));
  await assertFails(updateDoc(doc(anotherSkipper.firestore(), `boats/${BOAT_ID}/costPlan/default`), validCostPlanV7Data()));
});

test('preventivo barca: delete e sempre negato, incluso allo skipper', async () => {
  await seedEventAndBoat();
  await seedValidCostPlan();
  const skipper = skipperContext(testEnv, SKIPPER_A);
  await assertFails(deleteDoc(doc(skipper.firestore(), `boats/${BOAT_ID}/costPlan/default`)));
});

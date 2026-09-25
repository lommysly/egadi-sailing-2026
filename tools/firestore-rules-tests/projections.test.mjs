// Test delle Security Rules per boats/{boatId}/crewProjections/{projectionId}.
// Vedi FIRESTORE_RULES_TEST_MATRIX.md, casi "Proiezione privata",
// "Cabina doppia nel Piano", "Proiezione -> invito", "Invito storico -> Piano",
// "Proiezione della propria area", "Liberazione e capienza".

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
  CREW_A_EMAIL,
  ANON_A,
  INVITE_A_ID,
  INVITE_B_ID,
  PROJECTION_A_ID,
  ACCESS_KEY_A,
  PHONE_FINGERPRINT_A,
  organizerContext,
  skipperContext,
  outsiderContext,
  crewAContext,
  anonContext,
  eventDocData,
  boatDocData,
} from './identities.mjs';

let testEnv;

const PROJECTION_B_ID = INVITE_B_ID;
const OTHER_SKIPPER = 'OTHER_SKIPPER_B';
const OTHER_BOAT_ID = OTHER_SKIPPER;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'egadi-rules-projections',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
});
test.after(async () => { await testEnv?.cleanup(); });
test.beforeEach(async () => { await testEnv.clearFirestore(); });

// ---------------------------------------------------------------------------
// Helper di seed (solo prerequisiti, mai l'azione sotto test)
// ---------------------------------------------------------------------------

async function seedOpenEventAndBoat(boatOverrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData());
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}`), boatDocData(boatOverrides));
  });
}

async function seedOtherSkipperBoat() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${OTHER_BOAT_ID}`), boatDocData({ skipperId: OTHER_SKIPPER }));
  });
}

function baseProjectionFields(overrides = {}) {
  return {
    id: PROJECTION_A_ID,
    firstName: 'Carla',
    lastName: 'Bianchi',
    displayName: 'Carla Bianchi',
    whatsappNumber: '+390000000001',
    plannedRole: 'Equipaggio',
    berthType: 'to_define',
    berthCents: 50000,
    starterPackCents: 2000,
    protectionInsuranceCents: 1000,
    refundableDepositCents: 10000,
    preferredLocale: 'it',
    contactConsent: true,
    contributesToCosts: true,
    pricingMode: 'dashboard',
    status: 'projected',
    inviteId: null,
    invitedAt: null,
    createdAt: serverTimestamp(),
    createdBy: SKIPPER_A,
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
    ...overrides,
  };
}

async function seedProjection(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields(overrides),
    );
  });
}

function inviteFields(overrides = {}) {
  return {
    id: PROJECTION_A_ID,
    boatId: SKIPPER_A,
    displayName: 'Carla Bianchi',
    whatsappNumber: '+390000000001',
    phoneFingerprint: PHONE_FINGERPRINT_A,
    loginEmail: CREW_A_EMAIL,
    accessKey: ACCESS_KEY_A,
    participantUid: null,
    status: 'pending',
    accessVersion: 1,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
    preferredLocale: 'it',
    createdAt: serverTimestamp(),
    createdBy: SKIPPER_A,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Caso: Proiezione privata
// ---------------------------------------------------------------------------

test('proiezione privata: SKIPPER_A puo creare PROJECTION_A con schema valido', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertSucceeds(
    setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), baseProjectionFields()),
  );
});

test('proiezione privata: ORGANIZER_A puo creare una proiezione con schema valido', async () => {
  await seedOpenEventAndBoat();
  const organizer = organizerContext(testEnv);
  await assertSucceeds(
    setDoc(
      doc(organizer.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_B_ID}`),
      baseProjectionFields({ id: PROJECTION_B_ID, createdBy: ORGANIZER_A, updatedBy: ORGANIZER_A }),
    ),
  );
});

test('proiezione privata: OUTSIDER_A non puo creare una proiezione', async () => {
  await seedOpenEventAndBoat();
  const outsider = outsiderContext(testEnv);
  await assertFails(
    setDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), baseProjectionFields()),
  );
});

test('proiezione privata: CREW_A non puo creare una proiezione', async () => {
  await seedOpenEventAndBoat();
  const crew = crewAContext(testEnv);
  await assertFails(
    setDoc(doc(crew.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), baseProjectionFields()),
  );
});

test('proiezione privata: ANON_A non puo creare una proiezione', async () => {
  await seedOpenEventAndBoat();
  const anon = anonContext(testEnv);
  await assertFails(
    setDoc(doc(anon.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), baseProjectionFields()),
  );
});

test('proiezione privata: nega la creazione con un campo extra non previsto dallo schema', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ extraField: 'non ammesso' }),
    ),
  );
});

test('proiezione privata: nega un importo negativo', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ berthCents: -100 }),
    ),
  );
});

test('proiezione privata: nega un importo decimale (non intero)', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ berthCents: 100.5 }),
    ),
  );
});

test('proiezione privata: nega un ruolo vuoto', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ plannedRole: '' }),
    ),
  );
});

test('proiezione privata: nega un ruolo troppo lungo', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ plannedRole: 'x'.repeat(101) }),
    ),
  );
});

test('proiezione privata: nega una sistemazione non tra i valori ammessi', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ berthType: 'ponte_esterno' }),
    ),
  );
});

test('proiezione privata: nega uno status iniziale diverso da projected', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ status: 'invited' }),
    ),
  );
});

test('proiezione privata: nega inviteId non nullo alla creazione', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ inviteId: INVITE_A_ID }),
    ),
  );
});

test('proiezione privata: nega la creazione se updatedAt non e un timestamp server', async () => {
  await seedOpenEventAndBoat();
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ updatedAt: Timestamp.now() }),
    ),
  );
});

test('proiezione privata: SKIPPER_A puo leggere la propria proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const skipper = skipperContext(testEnv);
  const snap = await assertSucceeds(getDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
  assert.equal(snap.data().status, 'projected');
});

test('proiezione privata: ORGANIZER_A puo leggere la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const organizer = organizerContext(testEnv);
  await assertSucceeds(getDoc(doc(organizer.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione privata: OUTSIDER_A non puo leggere la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione privata: CREW_A senza invito attivo non puo leggere la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const crew = crewAContext(testEnv);
  await assertFails(getDoc(doc(crew.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione privata: ANON_A non puo leggere la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const anon = anonContext(testEnv);
  await assertFails(getDoc(doc(anon.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione privata: SKIPPER_A puo aggiornare la propria bozza mentre e projected', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const skipper = skipperContext(testEnv);
  await assertSucceeds(
    updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
      lastName: 'Verdi',
      displayName: 'Carla Verdi',
      updatedAt: serverTimestamp(),
      updatedBy: SKIPPER_A,
    }),
  );
});

test('proiezione privata: OUTSIDER_A non puo aggiornare la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const outsider = outsiderContext(testEnv);
  await assertFails(
    updateDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
      lastName: 'Verdi',
    }),
  );
});

test('proiezione privata: CREW_A non puo aggiornare la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const crew = crewAContext(testEnv);
  await assertFails(
    updateDoc(doc(crew.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
      lastName: 'Verdi',
    }),
  );
});

test('proiezione privata: ANON_A non puo aggiornare la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const anon = anonContext(testEnv);
  await assertFails(
    updateDoc(doc(anon.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
      lastName: 'Verdi',
    }),
  );
});

test('proiezione privata: SKIPPER_A puo liberare (cancellare) una bozza projected', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const skipper = skipperContext(testEnv);
  await assertSucceeds(deleteDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione privata: OUTSIDER_A non puo cancellare la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const outsider = outsiderContext(testEnv);
  await assertFails(deleteDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione privata: CREW_A non puo cancellare la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const crew = crewAContext(testEnv);
  await assertFails(deleteDoc(doc(crew.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione privata: ANON_A non puo cancellare la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const anon = anonContext(testEnv);
  await assertFails(deleteDoc(doc(anon.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione privata: un altro skipper non puo fare list su crewProjections di una barca non sua', async () => {
  await seedOpenEventAndBoat();
  await seedOtherSkipperBoat();
  await seedProjection();
  const otherSkipper = skipperContext(testEnv, OTHER_SKIPPER);
  await assertFails(getDocs(collection(otherSkipper.firestore(), `boats/${SKIPPER_A}/crewProjections`)));
});

test('proiezione privata: CREW_A non puo fare list su crewProjections', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const crew = crewAContext(testEnv);
  await assertFails(getDocs(collection(crew.firestore(), `boats/${SKIPPER_A}/crewProjections`)));
});

test('proiezione privata: ANON_A non puo fare list su crewProjections', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const anon = anonContext(testEnv);
  await assertFails(getDocs(collection(anon.firestore(), `boats/${SKIPPER_A}/crewProjections`)));
});

test('proiezione privata: OUTSIDER_A non puo fare list su crewProjections', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const outsider = outsiderContext(testEnv);
  await assertFails(getDocs(collection(outsider.firestore(), `boats/${SKIPPER_A}/crewProjections`)));
});

test('proiezione privata: SKIPPER_A puo fare list su crewProjections della propria barca', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const skipper = skipperContext(testEnv);
  const snap = await assertSucceeds(getDocs(collection(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections`)));
  assert.equal(snap.size, 1);
});

// ---------------------------------------------------------------------------
// Caso: Cabina doppia nel Piano (solo il vincolo di formato/layout verificato
// dalle Rules; il limite "massimo 2 persone per cabina" e la terza card
// bloccata sono verifiche di interfaccia, vedi deferredCases sotto).
// ---------------------------------------------------------------------------

test('cabina doppia: consenti cabinGroupId "double-2" su una barca con 2 cabine doppie configurate', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 2 } });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ berthType: 'double_cabin', cabinGroupId: 'double-2' }),
    ),
  );
});

test('cabina doppia: nega cabinGroupId "double-3" su una barca con solo 2 cabine doppie configurate', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 2 } });
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ berthType: 'double_cabin', cabinGroupId: 'double-3' }),
    ),
  );
});

test('cabina doppia: nega un cabinGroupId di cabina doppia su una sistemazione non double_cabin', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 2 } });
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ berthType: 'single_cabin', cabinGroupId: 'double-1' }),
    ),
  );
});

test('cabina doppia: consenti cabinGroupId vuoto anche con berthType double_cabin non ancora assegnato', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 2 } });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({ berthType: 'double_cabin', cabinGroupId: '' }),
    ),
  );
});

// ---------------------------------------------------------------------------
// Caso: Proiezione -> invito (transizione in un unico batch)
// ---------------------------------------------------------------------------

test('proiezione -> invito: il batch valido (invito + transizione a invited) e consentito', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection();
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields());
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
    status: 'invited',
    inviteId: PROJECTION_A_ID,
    invitedAt: serverTimestamp(),
    pricingSnapshotAt: serverTimestamp(),
    starterPackItemsSnapshot: ['bed_linen', 'tender'],
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  });
  await assertSucceeds(batch.commit());
});

test('proiezione -> invito: nega il batch se linvito viene creato con un ID diverso dalla proiezione', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection();
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${INVITE_B_ID}`), inviteFields({ id: INVITE_B_ID }));
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
    status: 'invited',
    inviteId: PROJECTION_A_ID,
    invitedAt: serverTimestamp(),
    pricingSnapshotAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  });
  await assertFails(batch.commit());
});

test('proiezione -> invito: nega laggiornamento della proiezione se linvito non viene creato', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection();
  const skipper = skipperContext(testEnv);
  await assertFails(
    updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
      status: 'invited',
      inviteId: PROJECTION_A_ID,
      invitedAt: serverTimestamp(),
      pricingSnapshotAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: SKIPPER_A,
    }),
  );
});

test('proiezione -> invito: nega il batch se linvito ha un boatId diverso', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedOtherSkipperBoat();
  await seedProjection();
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields({ boatId: OTHER_BOAT_ID }));
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
    status: 'invited',
    inviteId: PROJECTION_A_ID,
    invitedAt: serverTimestamp(),
    pricingSnapshotAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  });
  await assertFails(batch.commit());
});

test('proiezione -> invito: nega il batch se il displayName dellinvito non combacia con la proiezione', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection();
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields({ displayName: 'Nome Diverso' }));
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
    status: 'invited',
    inviteId: PROJECTION_A_ID,
    invitedAt: serverTimestamp(),
    pricingSnapshotAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  });
  await assertFails(batch.commit());
});

test('proiezione -> invito: nega il batch se il whatsappNumber dellinvito non combacia con la proiezione', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection();
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields({ whatsappNumber: '+390000009999' }));
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
    status: 'invited',
    inviteId: PROJECTION_A_ID,
    invitedAt: serverTimestamp(),
    pricingSnapshotAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  });
  await assertFails(batch.commit());
});

test('proiezione -> invito: nega la stessa transizione se fatta con due scritture separate invece di un batch', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection();
  const skipper = skipperContext(testEnv);
  await assertSucceeds(
    setDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields()),
  );
  await assertFails(
    updateDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
      status: 'invited',
      inviteId: PROJECTION_A_ID,
      invitedAt: serverTimestamp(),
      pricingSnapshotAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: SKIPPER_A,
    }),
  );
});

test('proiezione -> invito: nega uno starterPackItemsSnapshot con un ID non ammesso', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection();
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields());
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
    status: 'invited',
    inviteId: PROJECTION_A_ID,
    invitedAt: serverTimestamp(),
    pricingSnapshotAt: serverTimestamp(),
    starterPackItemsSnapshot: ['jacuzzi'],
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  });
  await assertFails(batch.commit());
});

test('proiezione -> invito: nega uno starterPackItemsSnapshot con elementi duplicati', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection();
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields());
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
    status: 'invited',
    inviteId: PROJECTION_A_ID,
    invitedAt: serverTimestamp(),
    pricingSnapshotAt: serverTimestamp(),
    starterPackItemsSnapshot: ['tender', 'tender'],
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  });
  await assertFails(batch.commit());
});

test('proiezione -> invito: nega una modifica non dichiarata di contributesToCosts durante la transizione', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection({ contributesToCosts: true });
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields());
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
    status: 'invited',
    inviteId: PROJECTION_A_ID,
    invitedAt: serverTimestamp(),
    pricingSnapshotAt: serverTimestamp(),
    contributesToCosts: false,
    berthCents: 0,
    starterPackCents: 0,
    protectionInsuranceCents: 0,
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  });
  await assertFails(batch.commit());
});

test('proiezione -> invito: consenti la transizione con cabinGroupId "double-4" gia impostato e invariato (non regressione)', async () => {
  // Vedi AGENTS.md e la nota nel prompt: questa esatta transizione con
  // cabinGroupId "double-4" falliva in produzione il 23/09/2026 per il
  // limite di 1000 espressioni valutabili per richiesta, non per una
  // condizione falsa. Se questo test fallisce con un errore che nomina
  // "maximum"/"expressions to evaluate" invece di un normale permission
  // denied, e' una possibile regressione di quel limite, non un bug del test.
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection({ berthType: 'double_cabin', cabinGroupId: 'double-4' });
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields());
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
    status: 'invited',
    inviteId: PROJECTION_A_ID,
    invitedAt: serverTimestamp(),
    pricingSnapshotAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  });
  try {
    await assertSucceeds(batch.commit());
  } catch (err) {
    const message = String(err && err.message || err);
    if (/maximum|expressions to evaluate/i.test(message)) {
      throw new Error(
        'POSSIBILE REGRESSIONE DEL LIMITE DI COMPLESSITA DELLE RULES (vedi AGENTS.md, incidente 23/09/2026), ' +
        'non un bug del test: ' + message,
      );
    }
    throw err;
  }
});

test('proiezione -> invito: nega un cambio di cabinGroupId nello stesso batch della transizione a invited', async () => {
  await seedOpenEventAndBoat({ berthLayout: { doubleCabins: 4 } });
  await seedProjection({ berthType: 'double_cabin', cabinGroupId: 'double-4' });
  const skipper = skipperContext(testEnv);
  const batch = writeBatch(skipper.firestore());
  batch.set(doc(skipper.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields());
  batch.update(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`), {
    status: 'invited',
    inviteId: PROJECTION_A_ID,
    invitedAt: serverTimestamp(),
    pricingSnapshotAt: serverTimestamp(),
    cabinGroupId: 'double-1',
    updatedAt: serverTimestamp(),
    updatedBy: SKIPPER_A,
  });
  await assertFails(batch.commit());
});

// ---------------------------------------------------------------------------
// Caso: Invito storico -> Piano
// ---------------------------------------------------------------------------

test('invito storico -> piano: consenti la creazione della proiezione quando nome e whatsapp combaciano con linvito originario', async () => {
  await seedOpenEventAndBoat();
  const historicCreatedAt = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), {
      id: PROJECTION_A_ID,
      boatId: SKIPPER_A,
      displayName: 'Carla',
      whatsappNumber: '+390000000001',
      phoneFingerprint: PHONE_FINGERPRINT_A,
      loginEmail: CREW_A_EMAIL,
      accessKey: ACCESS_KEY_A,
      participantUid: CREW_A,
      status: 'active',
      accessVersion: 1,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
      createdAt: historicCreatedAt,
      createdBy: SKIPPER_A,
    });
  });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({
        firstName: 'Carla',
        lastName: 'DaAssegnare',
        displayName: 'Carla DaAssegnare',
        whatsappNumber: '+390000000001',
        status: 'invited',
        inviteId: PROJECTION_A_ID,
        invitedAt: historicCreatedAt,
        createdAt: serverTimestamp(),
      }),
    ),
  );
});

test('invito storico -> piano: nega la creazione della proiezione con un nome diverso da quello originario', async () => {
  await seedOpenEventAndBoat();
  const historicCreatedAt = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), {
      id: PROJECTION_A_ID,
      boatId: SKIPPER_A,
      displayName: 'Carla',
      whatsappNumber: '+390000000001',
      phoneFingerprint: PHONE_FINGERPRINT_A,
      loginEmail: CREW_A_EMAIL,
      accessKey: ACCESS_KEY_A,
      participantUid: CREW_A,
      status: 'active',
      accessVersion: 1,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
      createdAt: historicCreatedAt,
      createdBy: SKIPPER_A,
    });
  });
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({
        firstName: 'Marta',
        lastName: 'DaAssegnare',
        displayName: 'Marta DaAssegnare',
        whatsappNumber: '+390000000001',
        status: 'invited',
        inviteId: PROJECTION_A_ID,
        invitedAt: historicCreatedAt,
        createdAt: serverTimestamp(),
      }),
    ),
  );
});

test('invito storico -> piano: nega la creazione della proiezione con un whatsapp diverso da quello originario', async () => {
  await seedOpenEventAndBoat();
  const historicCreatedAt = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), {
      id: PROJECTION_A_ID,
      boatId: SKIPPER_A,
      displayName: 'Carla',
      whatsappNumber: '+390000000001',
      phoneFingerprint: PHONE_FINGERPRINT_A,
      loginEmail: CREW_A_EMAIL,
      accessKey: ACCESS_KEY_A,
      participantUid: CREW_A,
      status: 'active',
      accessVersion: 1,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
      createdAt: historicCreatedAt,
      createdBy: SKIPPER_A,
    });
  });
  const skipper = skipperContext(testEnv);
  await assertFails(
    setDoc(
      doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`),
      baseProjectionFields({
        firstName: 'Carla',
        lastName: 'DaAssegnare',
        displayName: 'Carla DaAssegnare',
        whatsappNumber: '+390000005555',
        status: 'invited',
        inviteId: PROJECTION_A_ID,
        invitedAt: historicCreatedAt,
        createdAt: serverTimestamp(),
      }),
    ),
  );
});

// ---------------------------------------------------------------------------
// Caso: Proiezione della propria area
// ---------------------------------------------------------------------------

test('proiezione della propria area: prima dellattivazione dellinvito, CREW_A non puo leggere la propria proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const crew = crewAContext(testEnv);
  await assertFails(getDoc(doc(crew.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione della propria area: prima dellattivazione dellinvito, ANON_A non puo leggere la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const anon = anonContext(testEnv);
  await assertFails(getDoc(doc(anon.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione della propria area: prima dellattivazione dellinvito, OUTSIDER_A non puo leggere la proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection();
  const outsider = outsiderContext(testEnv);
  await assertFails(getDoc(doc(outsider.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('proiezione della propria area: dopo lattivazione CREW_A puo leggere il get puntuale della propria proiezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection({ status: 'invited', inviteId: PROJECTION_A_ID, invitedAt: serverTimestamp() });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields({
      participantUid: CREW_A,
      status: 'active',
    }));
  });
  const crew = crewAContext(testEnv);
  const snap = await assertSucceeds(getDoc(doc(crew.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
  assert.equal(snap.data().id, PROJECTION_A_ID);
});

test('proiezione della propria area: dopo lattivazione CREW_A non puo fare list sulla collezione', async () => {
  await seedOpenEventAndBoat();
  await seedProjection({ status: 'invited', inviteId: PROJECTION_A_ID, invitedAt: serverTimestamp() });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields({
      participantUid: CREW_A,
      status: 'active',
    }));
  });
  const crew = crewAContext(testEnv);
  await assertFails(getDocs(collection(crew.firestore(), `boats/${SKIPPER_A}/crewProjections`)));
});

test('proiezione della propria area: dopo lattivazione CREW_A non puo leggere la proiezione di un altro (PROJECTION_B)', async () => {
  await seedOpenEventAndBoat();
  await seedProjection({ status: 'invited', inviteId: PROJECTION_A_ID, invitedAt: serverTimestamp() });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}/invites/${PROJECTION_A_ID}`), inviteFields({
      participantUid: CREW_A,
      status: 'active',
    }));
    await setDoc(
      doc(ctx.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_B_ID}`),
      baseProjectionFields({ id: PROJECTION_B_ID, firstName: 'Altra', lastName: 'Persona', displayName: 'Altra Persona' }),
    );
  });
  const crew = crewAContext(testEnv);
  await assertFails(getDoc(doc(crew.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_B_ID}`)));
});

// ---------------------------------------------------------------------------
// Caso: Liberazione e capienza (solo la parte Rules)
// ---------------------------------------------------------------------------

test('liberazione: SKIPPER_A puo cancellare una proiezione ancora status projected', async () => {
  await seedOpenEventAndBoat();
  await seedProjection({ status: 'projected', inviteId: null, invitedAt: null });
  const skipper = skipperContext(testEnv);
  await assertSucceeds(deleteDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

test('liberazione: SKIPPER_A non puo cancellare una proiezione gia in status invited', async () => {
  await seedOpenEventAndBoat();
  await seedProjection({ status: 'invited', inviteId: PROJECTION_A_ID, invitedAt: serverTimestamp() });
  const skipper = skipperContext(testEnv);
  await assertFails(deleteDoc(doc(skipper.firestore(), `boats/${SKIPPER_A}/crewProjections/${PROJECTION_A_ID}`)));
});

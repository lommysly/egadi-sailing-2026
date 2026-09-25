// Test delle Storage Security Rules (storage.rules) per le copie private
// dei documenti dello skipper (boats/{boatId}/skipper-documents/...).
// storage.rules usa firestore.get(...) per leggere
// events/egadi-2026.privateAreaEnabled e boats/{boatId}.skipperId, quindi
// questo file usa DUE RulesTestEnvironment con lo STESSO projectId:
// uno Firestore (solo per seedare via withSecurityRulesDisabled) e uno
// Storage (per le vere assertSucceeds/assertFails).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getMetadata, deleteObject, listAll } from 'firebase/storage';
import {
  SKIPPER_A,
  ORGANIZER_A,
  CREW_A,
  ANON_A,
  OUTSIDER_A,
  googleContext,
  skipperContext,
  organizerContext,
  outsiderContext,
  crewAContext,
  anonContext,
  boatDocData,
  eventDocData,
} from './identities.mjs';

// Le Storage Rules leggono Firestore in modo incrociato con firestore.get():
// nell'emulatore questo ponte risolve sempre contro il progetto "attivo"
// dell'istanza emulata (quello passato con --project a emulators:exec), non
// contro un projectId isolato scelto da un singolo initializeTestEnvironment.
// Per questo qui, a differenza degli altri file, usiamo lo stesso projectId
// del comando "test:rules" (egadi-sailing-2026) invece di uno dedicato:
// nessun altro file di test usa Storage, quindi non c'e' rischio di
// interferenza con gli altri gruppi che girano in parallelo sullo stesso
// emulatore Firestore.
const PROJECT_ID = 'egadi-sailing-2026';
const SKIPPER_OTHER = 'SKIPPER_OTHER_STORAGE_TEST';

let firestoreTestEnv;
let storageTestEnv;

test.before(async () => {
  firestoreTestEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: 'localhost', port: 8080 },
  });
  storageTestEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: 'localhost', port: 9199 },
  });
});

test.after(async () => {
  await firestoreTestEnv?.cleanup();
  await storageTestEnv?.cleanup();
});

async function seedAreaAndBoat({ open = true } = {}) {
  await firestoreTestEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData({ open }));
    await setDoc(doc(ctx.firestore(), `boats/${SKIPPER_A}`), boatDocData());
  });
}

async function setAreaOpen(open) {
  await firestoreTestEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events/egadi-2026'), eventDocData({ open }));
  });
}

test.beforeEach(async () => {
  await firestoreTestEnv.clearFirestore();
  await storageTestEnv.clearStorage();
  await seedAreaAndBoat({ open: true });
});

// --- Helper per la parte Storage --------------------------------------

const VALID_BYTES = new Uint8Array([1, 2, 3]);

function docPath(documentType, fileName = 'current') {
  return `boats/${SKIPPER_A}/skipper-documents/${documentType}/${fileName}`;
}

function validMetadata(documentType) {
  return {
    contentType: 'application/pdf',
    customMetadata: { documentType, schema: '1' },
  };
}

function skipperStorage() {
  return skipperContext(storageTestEnv, SKIPPER_A).storage();
}
function otherSkipperStorage() {
  return googleContext(storageTestEnv, SKIPPER_OTHER).storage();
}
function organizerStorage() {
  return organizerContext(storageTestEnv).storage();
}
function crewStorage() {
  return crewAContext(storageTestEnv).storage();
}
function anonStorage() {
  return anonContext(storageTestEnv).storage();
}
function outsiderStorage() {
  return outsiderContext(storageTestEnv).storage();
}
function unauthStorage() {
  return storageTestEnv.unauthenticatedContext().storage();
}

// Seeda direttamente (bypassando le Rules) un documento sailing-license
// valido, per i test che devono verificare una LETTURA negata su un file
// che esiste davvero.
async function seedValidDocument(documentType = 'sailing-license') {
  await storageTestEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), docPath(documentType)), VALID_BYTES, validMetadata(documentType));
  });
}

// --- Gruppo 1: flusso valido dello skipper assegnato -------------------

test('storage: SKIPPER_A carica sailing-license/current con metadata validi', async () => {
  await assertSucceeds(
    uploadBytes(ref(skipperStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'))
  );
});

test('storage: SKIPPER_A rilegge sailing-license/current appena caricato', async () => {
  await uploadBytes(ref(skipperStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'));
  const meta = await assertSucceeds(getMetadata(ref(skipperStorage(), docPath('sailing-license'))));
  assert.equal(meta.customMetadata.documentType, 'sailing-license');
  assert.equal(meta.customMetadata.schema, '1');
});

test('storage: SKIPPER_A sostituisce sailing-license/current con un nuovo upload', async () => {
  await uploadBytes(ref(skipperStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'));
  await assertSucceeds(
    uploadBytes(ref(skipperStorage(), docPath('sailing-license')), new Uint8Array([9, 9]), validMetadata('sailing-license'))
  );
});

test('storage: SKIPPER_A carica radio-certificate/current con metadata validi', async () => {
  await assertSucceeds(
    uploadBytes(ref(skipperStorage(), docPath('radio-certificate')), VALID_BYTES, validMetadata('radio-certificate'))
  );
});

test('storage: SKIPPER_A rilegge radio-certificate/current appena caricato', async () => {
  await uploadBytes(ref(skipperStorage(), docPath('radio-certificate')), VALID_BYTES, validMetadata('radio-certificate'));
  const meta = await assertSucceeds(getMetadata(ref(skipperStorage(), docPath('radio-certificate'))));
  assert.equal(meta.customMetadata.documentType, 'radio-certificate');
});

test('storage: SKIPPER_A sostituisce radio-certificate/current con un nuovo upload', async () => {
  await uploadBytes(ref(skipperStorage(), docPath('radio-certificate')), VALID_BYTES, validMetadata('radio-certificate'));
  await assertSucceeds(
    uploadBytes(ref(skipperStorage(), docPath('radio-certificate')), new Uint8Array([9, 9]), validMetadata('radio-certificate'))
  );
});

// --- Gruppo 2: list e delete sempre negati, anche allo skipper ---------

test('storage: listAll sulla cartella sailing-license fallisce sempre, anche per SKIPPER_A', async () => {
  await uploadBytes(ref(skipperStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'));
  await assertFails(listAll(ref(skipperStorage(), `boats/${SKIPPER_A}/skipper-documents/sailing-license`)));
});

test('storage: deleteObject su sailing-license/current fallisce sempre, anche per SKIPPER_A', async () => {
  await seedValidDocument('sailing-license');
  await assertFails(deleteObject(ref(skipperStorage(), docPath('sailing-license'))));
  // Il documento deve essere ancora presente dopo il tentativo fallito.
  await assertSucceeds(getMetadata(ref(skipperStorage(), docPath('sailing-license'))));
});

// --- Gruppo 3: ogni altro ruolo e sempre negato -------------------------

test('storage: un altro skipper (uid diverso) non puo caricare su boats/SKIPPER_A', async () => {
  await assertFails(
    uploadBytes(ref(otherSkipperStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'))
  );
});

test('storage: un altro skipper (uid diverso) non puo leggere boats/SKIPPER_A', async () => {
  await seedValidDocument('sailing-license');
  await assertFails(getMetadata(ref(otherSkipperStorage(), docPath('sailing-license'))));
});

test('storage: un organizzatore non puo caricare su boats/SKIPPER_A', async () => {
  await assertFails(
    uploadBytes(ref(organizerStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'))
  );
});

test('storage: un organizzatore non puo leggere boats/SKIPPER_A', async () => {
  await seedValidDocument('sailing-license');
  await assertFails(getMetadata(ref(organizerStorage(), docPath('sailing-license'))));
});

test('storage: una crew non puo caricare su boats/SKIPPER_A', async () => {
  await assertFails(
    uploadBytes(ref(crewStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'))
  );
});

test('storage: una crew non puo leggere boats/SKIPPER_A', async () => {
  await seedValidDocument('sailing-license');
  await assertFails(getMetadata(ref(crewStorage(), docPath('sailing-license'))));
});

test('storage: un utente anonimo non puo caricare su boats/SKIPPER_A', async () => {
  await assertFails(
    uploadBytes(ref(anonStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'))
  );
});

test('storage: un utente anonimo non puo leggere boats/SKIPPER_A', async () => {
  await seedValidDocument('sailing-license');
  await assertFails(getMetadata(ref(anonStorage(), docPath('sailing-license'))));
});

test('storage: un outsider non puo caricare su boats/SKIPPER_A', async () => {
  await assertFails(
    uploadBytes(ref(outsiderStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'))
  );
});

test('storage: un outsider non puo leggere boats/SKIPPER_A', async () => {
  await seedValidDocument('sailing-license');
  await assertFails(getMetadata(ref(outsiderStorage(), docPath('sailing-license'))));
});

test('storage: un utente non autenticato non puo caricare su boats/SKIPPER_A', async () => {
  await assertFails(
    uploadBytes(ref(unauthStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'))
  );
});

test('storage: un utente non autenticato non puo leggere boats/SKIPPER_A', async () => {
  await seedValidDocument('sailing-license');
  await assertFails(getMetadata(ref(unauthStorage(), docPath('sailing-license'))));
});

// --- Gruppo 4: percorso/documentType/contentType/dimensione/metadata non validi ---

test('storage: un fileName diverso da "current" viene rifiutato anche per SKIPPER_A', async () => {
  await assertFails(
    uploadBytes(ref(skipperStorage(), docPath('sailing-license', 'old')), VALID_BYTES, validMetadata('sailing-license'))
  );
});

test('storage: un documentType non tra i due ammessi viene rifiutato', async () => {
  await assertFails(
    uploadBytes(ref(skipperStorage(), docPath('passport')), VALID_BYTES, validMetadata('passport'))
  );
});

test('storage: un contentType non ammesso (text/plain) viene rifiutato', async () => {
  await assertFails(
    uploadBytes(ref(skipperStorage(), docPath('sailing-license')), VALID_BYTES, {
      contentType: 'text/plain',
      customMetadata: { documentType: 'sailing-license', schema: '1' },
    })
  );
});

test('storage: un file oltre 8 MB viene rifiutato', async () => {
  const tooBig = new Uint8Array(8 * 1024 * 1024 + 1);
  await assertFails(
    uploadBytes(ref(skipperStorage(), docPath('sailing-license')), tooBig, validMetadata('sailing-license'))
  );
});

test('storage: customMetadata senza documentType viene rifiutato', async () => {
  await assertFails(
    uploadBytes(ref(skipperStorage(), docPath('sailing-license')), VALID_BYTES, {
      contentType: 'application/pdf',
      customMetadata: { schema: '1' },
    })
  );
});

test('storage: customMetadata senza schema viene rifiutato', async () => {
  await assertFails(
    uploadBytes(ref(skipperStorage(), docPath('sailing-license')), VALID_BYTES, {
      contentType: 'application/pdf',
      customMetadata: { documentType: 'sailing-license' },
    })
  );
});

test('storage: customMetadata con una chiave extra viene rifiutato', async () => {
  await assertFails(
    uploadBytes(ref(skipperStorage(), docPath('sailing-license')), VALID_BYTES, {
      contentType: 'application/pdf',
      customMetadata: { documentType: 'sailing-license', schema: '1', extra: 'nope' },
    })
  );
});

// --- Gruppo 5: area privata chiusa nega tutto anche allo skipper -------

test('storage: con area privata chiusa, SKIPPER_A non puo caricare un file valido', async () => {
  await setAreaOpen(false);
  await assertFails(
    uploadBytes(ref(skipperStorage(), docPath('sailing-license')), VALID_BYTES, validMetadata('sailing-license'))
  );
});

test('storage: con area privata chiusa, SKIPPER_A non puo rileggere un documento gia esistente', async () => {
  await seedValidDocument('sailing-license');
  await setAreaOpen(false);
  await assertFails(getMetadata(ref(skipperStorage(), docPath('sailing-license'))));
});

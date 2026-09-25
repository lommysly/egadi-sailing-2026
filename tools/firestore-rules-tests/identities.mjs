// Identità e helper condivisi per tutti i file di test delle Security Rules
// (vedi "Fixture fittizia" in FIRESTORE_RULES_TEST_MATRIX.md). Ogni file di
// test crea il proprio testEnv (initializeTestEnvironment) e usa questi UID
// ed email per restare coerente con la fixture descritta nella matrice, ma
// scrive da sé i documenti specifici di cui ha bisogno.

export const ORGANIZER_A = 'ORGANIZER_A';
export const SKIPPER_A = 'SKIPPER_A';
export const OUTSIDER_A = 'OUTSIDER_A';
export const CREW_A = 'CREW_A';
export const CREW_B = 'CREW_B';
export const CREW_A_EMAIL = 'crew-a@crew.egadi.thatsablast.it';
export const CREW_B_EMAIL = 'crew-b@crew.egadi.thatsablast.it';
export const ANON_A = 'ANON_A';

// ID esadecimali di 48 caratteri fittizi (formato richiesto da isInviteCode
// e dagli ID di crewProjections/invites, vedi crew-identity.js).
export const INVITE_A_ID = 'a'.repeat(48);
export const INVITE_B_ID = 'b'.repeat(48);
export const PROJECTION_A_ID = INVITE_A_ID; // la proiezione diventa l'invito con lo stesso ID
export const ACCESS_KEY_A = 'c'.repeat(48);
export const PHONE_FINGERPRINT_A = 'd'.repeat(64);

export function googleContext(testEnv, uid) {
  return testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } });
}

export function organizerContext(testEnv) {
  return googleContext(testEnv, ORGANIZER_A);
}

export function skipperContext(testEnv, uid = SKIPPER_A) {
  return googleContext(testEnv, uid);
}

export function outsiderContext(testEnv, uid = OUTSIDER_A) {
  return googleContext(testEnv, uid);
}

export function crewContext(testEnv, uid, email) {
  return testEnv.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' }, email });
}

export function crewAContext(testEnv) {
  return crewContext(testEnv, CREW_A, CREW_A_EMAIL);
}

export function crewBContext(testEnv) {
  return crewContext(testEnv, CREW_B, CREW_B_EMAIL);
}

export function anonContext(testEnv) {
  return testEnv.authenticatedContext(ANON_A, { firebase: { sign_in_provider: 'anonymous' } });
}

// Documento evento minimo: privateAreaEnabled true per default, perché ogni
// gruppo di test (tranne quello dedicato ad "Area privata chiusa") parte già
// con l'area aperta, come fa la matrice per i casi successivi al primo.
export function eventDocData({ open = true, organizerIds = [ORGANIZER_A] } = {}) {
  return { privateAreaEnabled: open, publicFleetEnabled: false, organizerIds };
}

export function boatDocData(overrides = {}) {
  return {
    skipperId: SKIPPER_A,
    eventId: 'egadi-2026',
    name: 'Karibu di test',
    model: 'Isla 40 di test',
    boatType: 'Catamarano',
    totalBerths: 10,
    homePort: 'Marsala',
    flag: 'Italiana',
    skipperName: 'Skipper di test',
    ...overrides,
  };
}

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getDoc, initializeFirestore, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { createCrewInviteIdentity, isCrewPin, isInviteCode, phoneFingerprintFor } from './crew-identity.js';
import { canUsePrivateArea, privateAreaBlockMessage } from './private-area-access.js?v=20260919-live-privacy-v1';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Equipaggio: telefoni, browser e reti molto più varie di quelle di skipper e
// organizzatori (WiFi pubblico, browser integrati in altre app, reti
// aziendali con proxy). Su queste reti lo stream normale di Firestore può
// fallire in modo intermittente pur riuscendo poi in background: il rilevamento
// automatico del long-polling passa a un trasporto più compatibile invece di
// insistere con uno stream che quella rete non regge (causa vera, il 23/09/2026,
// di salvataggi segnalati come falliti ma in realtà riusciti pochi secondi dopo).
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
export const inviteId = new URLSearchParams(window.location.search).get('invite') || '';
export const boatId = new URLSearchParams(window.location.search).get('boat') || '';
export const accessKey = new URLSearchParams(window.location.search).get('key') || '';
export const hasValidInviteParameters = isInviteCode(inviteId)
  && /^[A-Za-z0-9_-]{1,128}$/.test(boatId)
  && isInviteCode(accessKey);
const translate = (key, fallback, params) => {
  const translated = window.EgadiI18n?.t?.(key, params);
  return translated && translated !== key ? translated : fallback;
};

class CrewAccessError extends Error {
  constructor(code, cause) {
    super(code);
    this.code = code;
    this.cause = cause;
  }
}

function inviteReference(currentBoatId = boatId, currentInviteId = inviteId) {
  return doc(db, 'boats', currentBoatId, 'invites', currentInviteId);
}

function crewAccessReference(userId) {
  return doc(db, 'crewAccess', userId);
}

function crewLoginIndexReference(phoneFingerprint) {
  return doc(db, 'crewLoginIndex', phoneFingerprint);
}

function linkFor(page) {
  const link = new URL(page, window.location.href).toString();
  return window.EgadiI18n?.preserveLocaleUrl?.(link) || link;
}

export function profileUrl({ edit = false } = {}) {
  const url = new URL(linkFor('participant.html'));
  if (edit) url.searchParams.set('edit', '1');
  return url.toString();
}

export function personalAreaUrl() {
  // Mantiene il rientro nell'area personale allineato alla versione che
  // contiene le coordinate di versamento protette, anche da un vecchio link.
  const url = new URL(linkFor('my-area.html'));
  url.searchParams.set('release', '20260920-payment-instructions-v1');
  return url.toString();
}

export function crewAccessUrl() {
  return linkFor('crew.html');
}

export function crewAccessErrorMessage(error, { activation = false } = {}) {
  if (!error) return translate('crew.errors.openAccess', 'Non riesco ad aprire l’accesso. Riprova tra poco.');
  if (error.code === 'private-area-disabled') return privateAreaBlockMessage();
  if (error.code === 'invalid-invite') return translate('crew.errors.invalidInvite', 'Questo link non è valido o non è più attivo. Chiedi allo skipper un nuovo invito.');
  if (error.code === 'invalid-pin') return translate('crew.errors.invalidPin', 'Il codice personale deve contenere esattamente 6 cifre.');
  if (error.code === 'invalid-phone') return translate('crew.errors.invalidPhoneExample', 'Inserisci il numero WhatsApp con prefisso internazionale, ad esempio +39 333 1234567.');
  if (error.code === 'phone-already-assigned') return activation
    ? translate('crew.errors.phoneAssignedActivation', 'Questo numero è già associato a un’altra barca dell’evento. Chiedi allo skipper o all’organizzatore di verificare l’invito corretto.')
    : translate('crew.errors.phoneAssignedLogin', 'Questo numero non è associato all’area personale che stai cercando.');
  if (error.code === 'auth/too-many-requests') return translate('crew.errors.tooManyRequests', 'Troppi tentativi. Attendi qualche minuto prima di riprovare.');
  if (error.code === 'auth/operation-not-allowed') return translate('crew.errors.loginUnavailable', 'L’accesso con numero e codice non è ancora abilitato. Avvisa lo skipper.');
  if (error.code === 'invalid-credentials') return activation
    ? translate('crew.errors.activationCredentials', 'Non riesco ad attivare questo invito. Verifica numero e codice oppure chiedi allo skipper un nuovo link.')
    : translate('crew.errors.invalidCredentials', 'Numero o codice personale non corretti.');
  if (error.code === 'access-not-active') return activation
    ? translate('crew.errors.activationUnavailable', 'Questo invito non è più disponibile. Chiedi allo skipper di generare un nuovo link.')
    : translate('crew.errors.accessInactive', 'Non risulta un accesso attivo con questo numero. Apri il link WhatsApp ricevuto dallo skipper.');
  return translate('crew.errors.completeAccess', 'Non riesco a completare l’accesso. Controlla la connessione e riprova.');
}

function ensurePrivateArea() {
  if (!canUsePrivateArea()) throw new CrewAccessError('private-area-disabled');
}

function ensureCrewPin(pin) {
  if (!isCrewPin(pin)) throw new CrewAccessError('invalid-pin');
}

async function readCrewAccess(user) {
  if (!user || user.isAnonymous || !user.email) throw new CrewAccessError('access-not-active');
  const accessSnapshot = await getDoc(crewAccessReference(user.uid));
  if (!accessSnapshot.exists()) throw new CrewAccessError('access-not-active');
  const access = accessSnapshot.data();
  if (access.userId !== user.uid || access.loginEmail !== user.email
    || !/^[A-Za-z0-9_-]{1,128}$/.test(access.boatId || '') || !isInviteCode(access.inviteId)) {
    throw new CrewAccessError('access-not-active');
  }
  const inviteSnapshot = await getDoc(inviteReference(access.boatId, access.inviteId));
  if (!inviteSnapshot.exists()) throw new CrewAccessError('access-not-active');
  const invite = inviteSnapshot.data();
  if (invite.status !== 'active' || invite.participantUid !== user.uid) {
    throw new CrewAccessError('access-not-active');
  }
  return {
    user,
    access: { ...access, id: user.uid },
    invite: { ...invite, id: access.inviteId, boatId: access.boatId },
  };
}

async function signInOrCreateCrewAccount(loginEmail, pin) {
  try {
    return { user: (await signInWithEmailAndPassword(auth, loginEmail, pin)).user, created: false };
  } catch (signInError) {
    if (!['auth/user-not-found', 'auth/invalid-credential'].includes(signInError.code)) {
      throw new CrewAccessError(signInError.code, signInError);
    }
    try {
      return { user: (await createUserWithEmailAndPassword(auth, loginEmail, pin)).user, created: true };
    } catch (creationError) {
      if (['auth/email-already-in-use', 'auth/invalid-credential', 'auth/wrong-password'].includes(creationError.code)) {
        throw new CrewAccessError('invalid-credentials', creationError);
      }
      throw new CrewAccessError(creationError.code, creationError);
    }
  }
}

async function signInCrewAccount(loginEmail, pin) {
  try {
    return (await signInWithEmailAndPassword(auth, loginEmail, pin)).user;
  } catch (error) {
    if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) {
      throw new CrewAccessError('invalid-credentials', error);
    }
    throw new CrewAccessError(error.code, error);
  }
}

async function ensureCrewAccessRecords({ user, identity, onClaimed }) {
  const accessPayload = {
    boatId,
    inviteId,
    userId: user.uid,
    loginEmail: user.email,
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(crewAccessReference(user.uid), accessPayload, { merge: true });
  } catch (existingAccessError) {
    if (existingAccessError.code !== 'permission-denied') {
      throw new CrewAccessError('access-not-active', existingAccessError);
    }
    try {
      await updateDoc(inviteReference(), {
        participantUid: user.uid,
        status: 'active',
        activatedAt: serverTimestamp(),
      });
      onClaimed();
    } catch (claimError) {
      throw new CrewAccessError('access-not-active', claimError);
    }
    try {
      await setDoc(crewAccessReference(user.uid), accessPayload, { merge: true });
    } catch (accessError) {
      throw new CrewAccessError('access-not-active', accessError);
    }
  }

  try {
    await setDoc(crewLoginIndexReference(identity.phoneFingerprint), {
      loginEmail: user.email,
      boatId,
      inviteId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (indexError) {
    throw new CrewAccessError('access-not-active', indexError);
  }
  return readCrewAccess(user);
}

async function ensurePhoneIsNotAssignedElsewhere(identity) {
  let indexSnapshot;
  try {
    indexSnapshot = await getDoc(crewLoginIndexReference(identity.phoneFingerprint));
  } catch (error) {
    throw new CrewAccessError('access-not-active', error);
  }
  if (!indexSnapshot.exists()) return;
  const existingIndex = indexSnapshot.data();
  if (existingIndex.boatId !== boatId || existingIndex.inviteId !== inviteId) {
    throw new CrewAccessError('phone-already-assigned');
  }
}

export async function activateCrewInvite({ phone, pin }) {
  ensurePrivateArea();
  if (!hasValidInviteParameters) throw new CrewAccessError('invalid-invite');
  ensureCrewPin(pin);
  let identity;
  try {
    identity = await createCrewInviteIdentity({ phone, accessKey });
  } catch (error) {
    throw new CrewAccessError(error.message.includes('numero') ? 'invalid-phone' : 'invalid-invite', error);
  }
  await ensurePhoneIsNotAssignedElsewhere(identity);
  let user;
  let createdAccount = false;
  let claimedInvite = false;
  try {
    const account = await signInOrCreateCrewAccount(identity.loginEmail, pin);
    user = account.user;
    createdAccount = account.created;
    if (user.email !== identity.loginEmail) throw new CrewAccessError('invalid-credentials');
    return await ensureCrewAccessRecords({
      user,
      identity,
      onClaimed: () => { claimedInvite = true; },
    });
  } catch (error) {
    if (createdAccount && !claimedInvite && user && auth.currentUser?.uid === user.uid) {
      await deleteUser(user).catch(() => {});
    }
    if (user && auth.currentUser?.uid === user.uid) await signOut(auth).catch(() => {});
    throw error;
  }
}

export async function signInCrew({ phone, pin }) {
  ensurePrivateArea();
  ensureCrewPin(pin);
  let phoneFingerprint;
  try {
    phoneFingerprint = await phoneFingerprintFor(phone);
  } catch (error) {
    throw new CrewAccessError('invalid-phone', error);
  }
  let indexSnapshot;
  try {
    indexSnapshot = await getDoc(crewLoginIndexReference(phoneFingerprint));
  } catch (error) {
    throw new CrewAccessError('access-not-active', error);
  }
  const index = indexSnapshot.exists() ? indexSnapshot.data() : null;
  const loginEmail = index?.loginEmail || '';
  if (typeof loginEmail !== 'string' || !loginEmail.endsWith('@crew.egadi.thatsablast.it')
    || !/^[A-Za-z0-9_-]{1,128}$/.test(index?.boatId || '') || !isInviteCode(index?.inviteId)) {
    throw new CrewAccessError('access-not-active');
  }
  const user = await signInCrewAccount(loginEmail, pin);
  try {
    return await readCrewAccess(user);
  } catch (error) {
    await signOut(auth).catch(() => {});
    throw error;
  }
}

export function startInviteActivation({ onOpening, onReady, onInvalid }) {
  if (!canUsePrivateArea()) {
    onOpening(privateAreaBlockMessage(), true);
    return;
  }
  if (!hasValidInviteParameters) {
    onInvalid();
    return;
  }
  onReady();
}

export function startCrewAreaSession({ onOpening, onReady, onInvalid }) {
  let lastUserId = null;
  if (!canUsePrivateArea()) {
    onOpening(privateAreaBlockMessage(), true);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous || !user.email) {
      lastUserId = null;
      onInvalid();
      return;
    }
    if (lastUserId === user.uid) return;
    lastUserId = user.uid;
    onOpening('Apro la tua area personale…');
    try {
      await onReady(await readCrewAccess(user));
    } catch (error) {
      lastUserId = null;
      onInvalid(error);
    }
  });
}

export function signOutCrew() {
  return signOut(auth);
}

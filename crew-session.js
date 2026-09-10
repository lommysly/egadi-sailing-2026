import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getFirestore, getDoc, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const inviteId = new URLSearchParams(window.location.search).get('invite') || '';
export const boatId = new URLSearchParams(window.location.search).get('boat') || '';
export const hasValidInviteParameters = /^[a-f0-9]{48}$/.test(inviteId) && /^[A-Za-z0-9_-]{1,128}$/.test(boatId);

function linkFor(page) {
  const url = new URL(page, window.location.href);
  url.searchParams.set('invite', inviteId);
  url.searchParams.set('boat', boatId);
  return url.toString();
}

export function profileUrl({ edit = false } = {}) {
  const url = new URL(linkFor('participant.html'));
  if (edit) url.searchParams.set('edit', '1');
  return url.toString();
}
export function personalAreaUrl() { return linkFor('my-area.html'); }

export function startCrewSession({ onOpening, onReady, onInvalid }) {
  let isStarting = false;
  if (!hasValidInviteParameters) {
    onInvalid();
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (isStarting) return;
      isStarting = true;
      onOpening('Apro il tuo invito personale…');
      try {
        await signInAnonymously(auth);
      } catch (error) {
        isStarting = false;
        onOpening(error.code === 'auth/operation-not-allowed'
          ? 'L’accesso diretto dell’equipaggio non è ancora abilitato. Avvisa lo skipper.'
          : 'Non riesco ad aprire il tuo invito. Riprova dal link WhatsApp.', true);
      }
      return;
    }
    try {
      const inviteReference = doc(db, 'boats', boatId, 'invites', inviteId);
      const inviteSnapshot = await getDoc(inviteReference);
      if (!inviteSnapshot.exists() || inviteSnapshot.data().boatId !== boatId) throw new Error('Invito non disponibile.');
      let invite = { ...inviteSnapshot.data(), id: inviteId, boatId };
      if (invite.participantUid !== user.uid) {
        await updateDoc(inviteReference, { participantUid: user.uid, status: 'opened', acceptedAt: serverTimestamp() });
        invite = { ...invite, participantUid: user.uid, status: 'opened' };
      }
      await setDoc(doc(db, 'boats', boatId, 'participantAccess', user.uid), {
        inviteId, boatId, userId: user.uid, updatedAt: serverTimestamp(),
      }, { merge: true });
      isStarting = false;
      await onReady({ user, invite });
    } catch (error) {
      isStarting = false;
      onInvalid();
    }
  });
}

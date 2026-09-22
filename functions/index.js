const crypto = require('crypto');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { google } = require('googleapis');

initializeApp();

const db = getFirestore();
const auth = getAuth();
const REGION = 'europe-west8';
const RUNTIME_SERVICE_ACCOUNT = 'egadi-transfer-sheet-writer@egadi-sailing-2026.iam.gserviceaccount.com';
const EVENT_ID = 'egadi-2026';
const TRANSFER_AIRPORTS = new Set(['TPS', 'PMO']);
const TRANSFER_RECORD_STATUSES = new Set(['new', 'planned', 'confirmed', 'completed', 'cancelled', 'revoked']);

function asText(value, maxLength = 180) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function asAirport(value) {
  const code = asText(value, 3).toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : '';
}

function asInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : 0;
}

function asUid(value) {
  const uid = asText(value, 128);
  return /^[A-Za-z0-9_-]{1,128}$/.test(uid) ? uid : '';
}

function normalizedEmail(value) {
  const email = asText(value, 160).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function asTemporaryPassword(value) {
  if (typeof value !== 'string') return '';
  const password = value.trim();
  return password.length >= 12 && password.length <= 128 ? password : '';
}

function isManagedPasswordTransferOperator(operator) {
  return operator
    && operator.role === 'transfer_operator'
    && operator.accessMode === 'managed_password';
}

function hasPasswordOnlyProvider(user) {
  const providerIds = Array.isArray(user?.providerData)
    ? user.providerData.map((provider) => provider.providerId).filter(Boolean)
    : [];
  return providerIds.length > 0 && providerIds.every((providerId) => providerId === 'password');
}

async function authenticatedOrganizerUid(request) {
  const uid = asUid(request?.auth?.uid);
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Accedi con l’account organizzatore per gestire gli accessi transfer.');
  }
  const eventSnapshot = await db.doc(`events/${EVENT_ID}`).get();
  const organizerIds = eventSnapshot.exists ? eventSnapshot.data()?.organizerIds : null;
  if (!Array.isArray(organizerIds) || !organizerIds.includes(uid)) {
    throw new HttpsError('permission-denied', 'Solo un organizzatore del viaggio può gestire gli account transfer.');
  }
  return uid;
}

async function authUserByEmailOrNull(email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

async function authUserByUidOrNull(uid) {
  try {
    return await auth.getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

function activeManagedRolePayload({ name, email, organizerUid, reactivated = false }) {
  const payload = {
    schemaVersion: 1,
    role: 'transfer_operator',
    name,
    email,
    active: true,
    accessMode: 'managed_password',
    authProvider: 'password',
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: organizerUid,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (reactivated) {
    return {
      ...payload,
      reactivatedAt: FieldValue.serverTimestamp(),
      reactivatedBy: organizerUid,
      revokedAt: FieldValue.delete(),
      revokedBy: FieldValue.delete(),
    };
  }
  return {
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: organizerUid,
  };
}

function addActiveManagedTransferAccess(batch, { uid, name, email, organizerUid, reactivated = false }) {
  const operatorRef = db.doc(`events/${EVENT_ID}/transferOperators/${uid}`);
  const requestRef = db.doc(`events/${EVENT_ID}/transferAccessRequests/${uid}`);
  batch.set(operatorRef, activeManagedRolePayload({ name, email, organizerUid, reactivated }), { merge: reactivated });
  // Un account creato dalla regia ha già il ruolo: non gli serve una richiesta
  // utente. Eliminiamo comunque una vecchia richiesta dello stesso UID.
  batch.delete(requestRef);
}

function asProvisioningData(data) {
  const email = normalizedEmail(data?.email);
  const name = asText(data?.name, 120);
  const temporaryPassword = asTemporaryPassword(data?.temporaryPassword);
  if (!email) {
    throw new HttpsError('invalid-argument', 'Inserisci un indirizzo email operativo valido.');
  }
  if (!name) {
    throw new HttpsError('invalid-argument', 'Inserisci il nome del referente transfer.');
  }
  if (!temporaryPassword) {
    throw new HttpsError('invalid-argument', 'La password temporanea deve contenere da 12 a 128 caratteri.');
  }
  return { email, name, temporaryPassword };
}

exports.provisionTransferOperator = onCall({
  region: REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  timeoutSeconds: 60,
  memory: '256MiB',
}, async (request) => {
  const organizerUid = await authenticatedOrganizerUid(request);
  const { email, name, temporaryPassword } = asProvisioningData(request.data);
  const existingUser = await authUserByEmailOrNull(email);

  if (existingUser) {
    const operatorRef = db.doc(`events/${EVENT_ID}/transferOperators/${existingUser.uid}`);
    const operatorSnapshot = await operatorRef.get();
    const operator = operatorSnapshot.exists ? operatorSnapshot.data() : null;
    if (!isManagedPasswordTransferOperator(operator) || !hasPasswordOnlyProvider(existingUser)) {
      throw new HttpsError('already-exists', 'Esiste già un account non gestito con questa email. Usa un’altra email operativa.');
    }

    try {
      await auth.updateUser(existingUser.uid, {
        displayName: name,
        password: temporaryPassword,
        disabled: false,
      });
      const batch = db.batch();
      addActiveManagedTransferAccess(batch, {
        uid: existingUser.uid,
        name,
        email,
        organizerUid,
        reactivated: true,
      });
      await batch.commit();
    } catch (error) {
      // Se la scrittura Firestore non riesce, l'account resta bloccato: non
      // esiste quindi una finestra in cui possa vedere dati di viaggio.
      try {
        await auth.updateUser(existingUser.uid, { disabled: true });
        await auth.revokeRefreshTokens(existingUser.uid);
      } catch (rollbackError) {
        logger.error('Rollback account transfer non riuscito.', { uid: existingUser.uid, code: rollbackError?.code || 'unknown' });
      }
      throw new HttpsError('internal', 'Non è stato possibile riattivare l’account transfer. Riprova tra poco.');
    }

    return {
      uid: existingUser.uid,
      email,
      active: true,
      created: false,
      reactivated: existingUser.disabled === true,
      passwordReset: true,
    };
  }

  let createdUser = null;
  try {
    createdUser = await auth.createUser({
      email,
      displayName: name,
      password: temporaryPassword,
      disabled: false,
      emailVerified: false,
    });
    const batch = db.batch();
    addActiveManagedTransferAccess(batch, {
      uid: createdUser.uid,
      name,
      email,
      organizerUid,
    });
    await batch.commit();
  } catch (error) {
    if (createdUser?.uid) {
      try {
        await auth.deleteUser(createdUser.uid);
      } catch (rollbackError) {
        logger.error('Cleanup account transfer non riuscito.', { uid: createdUser.uid, code: rollbackError?.code || 'unknown' });
      }
    }
    if (error?.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Esiste già un account con questa email. Usa un’altra email operativa.');
    }
    throw new HttpsError('internal', 'Non è stato possibile creare l’account transfer. Riprova tra poco.');
  }

  return {
    uid: createdUser.uid,
    email,
    active: true,
    created: true,
    reactivated: false,
  };
});

exports.revokeTransferOperator = onCall({
  region: REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  timeoutSeconds: 60,
  memory: '256MiB',
}, async (request) => {
  const organizerUid = await authenticatedOrganizerUid(request);
  const uid = asUid(request.data?.uid);
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Identificativo account transfer non valido.');
  }
  const operatorRef = db.doc(`events/${EVENT_ID}/transferOperators/${uid}`);
  const requestRef = db.doc(`events/${EVENT_ID}/transferAccessRequests/${uid}`);
  const operatorSnapshot = await operatorRef.get();
  const operator = operatorSnapshot.exists ? operatorSnapshot.data() : null;
  if (!isManagedPasswordTransferOperator(operator)) {
    throw new HttpsError('failed-precondition', 'Questo non è un account transfer gestito dalla regia.');
  }

  const targetUser = await authUserByUidOrNull(uid);
  if (targetUser && !hasPasswordOnlyProvider(targetUser)) {
    throw new HttpsError('failed-precondition', 'L’account transfer non usa più le credenziali dedicate e non può essere revocato qui.');
  }
  try {
    // Prima viene revocato il ruolo: anche un token eventualmente già aperto
    // non può più leggere la coda mentre Firebase Auth completa il blocco.
    const batch = db.batch();
    batch.set(operatorRef, {
      active: false,
      revokedAt: FieldValue.serverTimestamp(),
      revokedBy: organizerUid,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.delete(requestRef);
    await batch.commit();
    if (targetUser) {
      await auth.updateUser(uid, { disabled: true });
      await auth.revokeRefreshTokens(uid);
    }
  } catch (error) {
    throw new HttpsError('internal', 'Non è stato possibile revocare l’account transfer. Riprova tra poco.');
  }

  return { uid, active: false, authDisabled: Boolean(targetUser) };
});

exports.deleteTransferOperator = onCall({
  region: REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  timeoutSeconds: 60,
  memory: '256MiB',
}, async (request) => {
  await authenticatedOrganizerUid(request);
  const uid = asUid(request.data?.uid);
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Identificativo account transfer non valido.');
  }
  const operatorRef = db.doc(`events/${EVENT_ID}/transferOperators/${uid}`);
  const requestRef = db.doc(`events/${EVENT_ID}/transferAccessRequests/${uid}`);
  const operatorSnapshot = await operatorRef.get();
  const operator = operatorSnapshot.exists ? operatorSnapshot.data() : null;
  if (!isManagedPasswordTransferOperator(operator)) {
    throw new HttpsError('failed-precondition', 'Questo non è un account transfer gestito dalla regia.');
  }

  const targetUser = await authUserByUidOrNull(uid);
  if (targetUser && !hasPasswordOnlyProvider(targetUser)) {
    throw new HttpsError('failed-precondition', 'L’account transfer non usa più le credenziali dedicate e non può essere eliminato qui.');
  }
  try {
    // Prima si elimina Firebase Auth: anche in caso di errore successivo nella
    // pulizia dei documenti, nessun token può più accedere ai movimenti.
    if (targetUser) await auth.deleteUser(uid);
    const batch = db.batch();
    batch.delete(operatorRef);
    batch.delete(requestRef);
    await batch.commit();
  } catch (error) {
    throw new HttpsError('internal', 'Non è stato possibile eliminare l’account transfer. Riprova tra poco.');
  }

  return { uid, deleted: true, authDeleted: Boolean(targetUser) };
});

function sourceRevision(snapshot, eventTime) {
  const timestamp = snapshot?.updateTime;
  if (timestamp?.toMillis) return timestamp.toMillis();
  const parsed = Date.parse(eventTime || '');
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function recordIdFor(boatId, inviteId, direction) {
  return `${boatId}_${inviteId}_${direction}`;
}

function transportLabel(leg) {
  const labels = {
    flight: 'Aereo',
    train: 'Treno',
    car: 'Auto',
    ferry: 'Nave',
    other: 'Altro',
  };
  const mode = asText(leg.transportMode, 20);
  const service = asText(leg.serviceNumber, 24);
  const carrier = asText(leg.carrier, 100);
  return [carrier, service].filter(Boolean).join(' ') || labels[mode] || 'Da definire';
}

function directionLabel(direction) {
  return direction === 'return' ? 'Rientro · Marsala → aeroporto' : 'Andata · aeroporto → Marsala';
}

function airportForTransfer(direction, leg) {
  return direction === 'return' ? asAirport(leg.originAirport) : asAirport(leg.destinationAirport);
}

function timeForTransfer(direction, leg) {
  return direction === 'return'
    ? { date: asText(leg.departureDate, 10), time: asText(leg.departureTime, 5) }
    : { date: asText(leg.arrivalDate, 10), time: asText(leg.arrivalTime, 5) };
}

function validSourceLeg(leg, direction, invite) {
  if (!leg || !invite || invite.status !== 'active') return false;
  if (leg.ownerUid !== invite.participantUid || leg.direction !== direction) return false;
  if (leg.state !== 'ready') return false;
  if (leg.airportMarsalaChoice !== 'transfer' || leg.transferOperatorConsent !== true) return false;
  return TRANSFER_AIRPORTS.has(airportForTransfer(direction, leg));
}

function skipperDisplayName(profile, boat) {
  const name = [asText(profile?.firstName, 80), asText(profile?.lastName, 80)].filter(Boolean).join(' ');
  return name || asText(boat?.skipperName, 160) || 'Skipper';
}

function validSkipperSourceLeg(leg, direction, profile) {
  if (!leg || !profile) return false;
  if (asText(leg.transportMode, 20) !== 'flight') return false;
  if (asText(leg.airportMarsalaPlan, 20) !== 'transfer' || leg.transferOperatorConsent !== true) return false;
  const name = [asText(profile.firstName, 80), asText(profile.lastName, 80)].filter(Boolean).join(' ');
  if (!name || !asText(profile.phone, 40)) return false;
  return TRANSFER_AIRPORTS.has(airportForTransfer(direction, leg));
}

function safeStatus(value) {
  return TRANSFER_RECORD_STATUSES.has(value) && value !== 'revoked' ? value : 'new';
}

function safeOperationalFields(source = {}) {
  const record = source && typeof source === 'object' ? source : {};
  return {
    status: safeStatus(record.status),
    assignedOperatorUid: asText(record.assignedOperatorUid, 128),
    groupName: asText(record.groupName, 120),
    vehicleName: asText(record.vehicleName, 120),
    meetingPoint: asText(record.meetingPoint, 180),
    meetingDate: asText(record.meetingDate, 10),
    meetingTime: asText(record.meetingTime, 5),
    operatorNotes: asText(record.operatorNotes, 500),
  };
}

// Nome e cognome separati: il foglio di riferimento del titolare (Arrivi/
// Partenze EGADI 2025) li vuole in due colonne distinte, non un nome
// completo unico.
function splitDisplayName(fullName, explicitFirst, explicitLast) {
  const first = asText(explicitFirst, 80);
  const last = asText(explicitLast, 80);
  if (first || last) return { firstName: first, lastName: last };
  const parts = asText(fullName, 161).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function backupPayload({ recordId, boatId, boat, inviteId, invite, member, direction, leg, existing }) {
  const transferConsent = leg.transferOperatorConsent === true;
  const airport = airportForTransfer(direction, leg);
  const timing = timeForTransfer(direction, leg);
  const { firstName, lastName } = splitDisplayName(member?.displayName || invite?.displayName, member?.firstName, member?.lastName);
  const phone = transferConsent ? asText(member?.phone || invite?.phone, 40) : '';
  const email = transferConsent ? asText(member?.email, 160) : '';
  const operator = safeOperationalFields(existing);
  return {
    schemaVersion: 1,
    recordId,
    boatId,
    inviteId,
    direction,
    recordState: 'active',
    // La persona può ancora non aver confermato: il foglio umano deve dirlo
    // chiaramente invece di mostrare lo stesso "Da pianificare" di una
    // richiesta già confermata (fonte della confusione del 22/09/2026).
    legState: leg.state === 'ready' ? 'ready' : 'draft',
    boatName: asText(boat?.name, 70),
    firstName: transferConsent ? firstName : '',
    lastName: transferConsent ? lastName : 'Dati non condivisi',
    participantName: transferConsent ? asText(member?.displayName || invite?.displayName, 161) : 'Dati non condivisi',
    contactConsent: transferConsent,
    phone,
    email,
    originCity: asText(leg.originCity, 100),
    originAirport: asText(leg.originAirport, 3),
    destinationCity: asText(leg.destinationCity, 100),
    destinationAirport: asText(leg.destinationAirport, 3),
    airport,
    date: timing.date,
    time: timing.time,
    transport: transportLabel(leg),
    carrier: asText(leg.carrier, 100),
    serviceNumber: asText(leg.serviceNumber, 40),
    luggageCount: asInteger(leg.luggageCount, 0, 12),
    bulkyLuggage: leg.bulkyLuggage === true,
    airportMarsalaChoice: asText(leg.airportMarsalaChoice, 20),
    transferRequested: leg.airportMarsalaChoice === 'transfer',
    carpoolRole: asText(leg.carpoolRole, 20),
    carpoolSeats: asInteger(leg.carpoolSeats, 0, 8),
    ...operator,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function skipperBackupPayload({ recordId, boatId, boat, direction, leg, profile, existing }) {
  const transferConsent = leg.transferOperatorConsent === true;
  const airport = airportForTransfer(direction, leg);
  const timing = timeForTransfer(direction, leg);
  const { firstName, lastName } = splitDisplayName(skipperDisplayName(profile, boat), profile?.firstName, profile?.lastName);
  const operator = safeOperationalFields(existing);
  return {
    schemaVersion: 1,
    recordId,
    boatId,
    inviteId: 'skipper',
    direction,
    recordState: 'active',
    legState: 'ready', // skipperTravel non ha bozze: è salvata già definitiva
    boatName: asText(boat?.name, 70),
    firstName: transferConsent ? firstName : '',
    lastName: transferConsent ? lastName : 'Dati non condivisi',
    participantName: transferConsent ? skipperDisplayName(profile, boat) : 'Dati non condivisi',
    participantRole: 'skipper',
    contactConsent: transferConsent,
    phone: transferConsent ? asText(profile?.phone, 40) : '',
    email: transferConsent ? asText(profile?.email, 160) : '',
    originCity: asText(leg.originCity, 100),
    originAirport: asText(leg.originAirport, 3),
    destinationCity: asText(leg.destinationCity, 100),
    destinationAirport: asText(leg.destinationAirport, 3),
    airport,
    date: timing.date,
    time: timing.time,
    transport: transportLabel(leg),
    carrier: asText(leg.carrier, 100),
    serviceNumber: asText(leg.serviceNumber, 40),
    luggageCount: asInteger(leg.luggageCount, 0, 12),
    bulkyLuggage: leg.bulkyLuggage === true,
    airportMarsalaChoice: asText(leg.airportMarsalaPlan, 20),
    transferRequested: leg.airportMarsalaPlan === 'transfer',
    carpoolRole: asText(leg.airportMarsalaPlan, 20) === 'ride_offer' ? 'offer_ride' : '',
    carpoolSeats: asInteger(leg.rideOfferSeats, 0, 8),
    ...operator,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function markBackupRevoked(ref, revision) {
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists && Number(existing.data().sourceRevision || 0) > revision) return;
    transaction.set(ref, {
      schemaVersion: 1,
      recordId: ref.id,
      recordState: 'revoked',
      firstName: '',
      lastName: '',
      participantName: '',
      phone: '',
      email: '',
      contactConsent: false,
      originCity: '',
      originAirport: '',
      destinationCity: '',
      destinationAirport: '',
      airport: '',
      date: '',
      time: '',
      transport: '',
      carrier: '',
      serviceNumber: '',
      luggageCount: 0,
      bulkyLuggage: false,
      airportMarsalaChoice: '',
      transferRequested: false,
      carpoolRole: '',
      carpoolSeats: 0,
      sourceRevision: revision,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function markTransferRequestRevoked(ref, revision) {
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists && Number(existing.data().sourceRevision || 0) > revision) return;
    transaction.set(ref, {
      schemaVersion: 1,
      recordId: ref.id,
      recordState: 'revoked',
      status: 'revoked',
      participantName: '',
      phone: '',
      email: '',
      contactConsent: false,
      airport: '',
      date: '',
      time: '',
      transport: '',
      luggageCount: 0,
      bulkyLuggage: false,
      assignedOperatorUid: '',
      groupName: '',
      vehicleName: '',
      meetingPoint: '',
      meetingDate: '',
      meetingTime: '',
      operatorNotes: '',
      sourceRevision: revision,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

exports.materializeCrewTravel = onDocumentWritten({
  document: 'boats/{boatId}/crewTravel/{inviteId}/legs/{direction}',
  region: REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  timeoutSeconds: 60,
  memory: '256MiB',
}, async (event) => {
  const { boatId, inviteId, direction } = event.params;
  if (!['outbound', 'return'].includes(direction)) return;
  const recordId = recordIdFor(boatId, inviteId, direction);
  const backupRef = db.doc(`events/${EVENT_ID}/travelBackupRecords/${recordId}`);
  const transferRef = db.doc(`events/${EVENT_ID}/transferOpsRecords/${recordId}`);
  const after = event.data?.after;
  const revision = sourceRevision(after?.exists ? after : event.data?.before, event.time);
  if (!after?.exists) {
    await Promise.all([markBackupRevoked(backupRef, revision), markTransferRequestRevoked(transferRef, revision)]);
    return;
  }

  const leg = after.data();
  const boatRef = db.doc(`boats/${boatId}`);
  const inviteRef = db.doc(`boats/${boatId}/invites/${inviteId}`);
  const memberRef = db.doc(`boats/${boatId}/members/${inviteId}`);
  const [boatSnapshot, inviteSnapshot, memberSnapshot, transferSnapshot] = await db.getAll(boatRef, inviteRef, memberRef, transferRef);
  const boat = boatSnapshot.exists ? boatSnapshot.data() : null;
  const invite = inviteSnapshot.exists ? inviteSnapshot.data() : null;
  const member = memberSnapshot.exists ? memberSnapshot.data() : null;
  const existingTransfer = transferSnapshot.exists ? transferSnapshot.data() : null;

  await db.runTransaction(async (transaction) => {
    const existingBackup = await transaction.get(backupRef);
    if (existingBackup.exists && Number(existingBackup.data().sourceRevision || 0) > revision) return;
    const payload = backupPayload({ recordId, boatId, boat, inviteId, invite, member, direction, leg, existing: existingTransfer });
    transaction.set(backupRef, {
      ...payload,
      sourceRevision: revision,
      ...(existingBackup.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
  });

  if (!validSourceLeg(leg, direction, invite)) {
    await markTransferRequestRevoked(transferRef, revision);
    return;
  }

  const timing = timeForTransfer(direction, leg);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(transferRef);
    if (existing.exists && Number(existing.data().sourceRevision || 0) > revision) return;
    const payload = {
      schemaVersion: 1,
      recordId,
      boatId,
      inviteId,
      direction,
      recordState: 'active',
      boatName: asText(boat?.name, 70),
      participantName: asText(member?.displayName || invite?.displayName, 161),
      contactConsent: true,
      phone: asText(member?.phone || invite?.phone, 40),
      email: asText(member?.email, 160),
      airport: airportForTransfer(direction, leg),
      date: timing.date,
      time: timing.time,
      transport: transportLabel(leg),
      luggageCount: asInteger(leg.luggageCount, 0, 12),
      bulkyLuggage: leg.bulkyLuggage === true,
      ...safeOperationalFields(existing.exists ? existing.data() : {}),
      sourceRevision: revision,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    };
    transaction.set(transferRef, payload, { merge: true });
  });
});

// Le tratte dello skipper seguono lo stesso flusso dell'equipaggio soltanto
// dopo un consenso esplicito. Prima restano nel suo spazio privato.
exports.materializeSkipperTravel = onDocumentWritten({
  document: 'boats/{boatId}/skipperTravel/{direction}',
  region: REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  timeoutSeconds: 60,
  memory: '256MiB',
}, async (event) => {
  const { boatId, direction } = event.params;
  if (!['outbound', 'return'].includes(direction)) return;
  const recordId = recordIdFor(boatId, 'skipper', direction);
  const backupRef = db.doc(`events/${EVENT_ID}/travelBackupRecords/${recordId}`);
  const transferRef = db.doc(`events/${EVENT_ID}/transferOpsRecords/${recordId}`);
  const after = event.data?.after;
  const revision = sourceRevision(after?.exists ? after : event.data?.before, event.time);
  if (!after?.exists) {
    await Promise.all([markBackupRevoked(backupRef, revision), markTransferRequestRevoked(transferRef, revision)]);
    return;
  }

  const leg = after.data();
  const boatRef = db.doc(`boats/${boatId}`);
  const profileRef = db.doc(`boats/${boatId}/skipperProfile/default`);
  const profileDraftRef = db.doc(`boats/${boatId}/skipperProfileDraft/default`);
  const [boatSnapshot, profileSnapshot, profileDraftSnapshot, transferSnapshot] = await db.getAll(boatRef, profileRef, profileDraftRef, transferRef);
  const boat = boatSnapshot.exists ? boatSnapshot.data() : null;
  const profile = profileSnapshot.exists
    ? profileSnapshot.data()
    : profileDraftSnapshot.exists ? profileDraftSnapshot.data() : null;
  const existingTransfer = transferSnapshot.exists ? transferSnapshot.data() : null;

  await db.runTransaction(async (transaction) => {
    const existingBackup = await transaction.get(backupRef);
    if (existingBackup.exists && Number(existingBackup.data().sourceRevision || 0) > revision) return;
    const payload = skipperBackupPayload({ recordId, boatId, boat, direction, leg, profile, existing: existingTransfer });
    transaction.set(backupRef, {
      ...payload,
      sourceRevision: revision,
      ...(existingBackup.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
  });

  if (!validSkipperSourceLeg(leg, direction, profile)) {
    await markTransferRequestRevoked(transferRef, revision);
    return;
  }

  const timing = timeForTransfer(direction, leg);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(transferRef);
    if (existing.exists && Number(existing.data().sourceRevision || 0) > revision) return;
    const payload = {
      schemaVersion: 1,
      recordId,
      boatId,
      inviteId: 'skipper',
      direction,
      recordState: 'active',
      boatName: asText(boat?.name, 70),
      participantName: skipperDisplayName(profile, boat),
      participantRole: 'skipper',
      contactConsent: true,
      phone: asText(profile?.phone, 40),
      email: asText(profile?.email, 160),
      airport: airportForTransfer(direction, leg),
      date: timing.date,
      time: timing.time,
      transport: transportLabel(leg),
      luggageCount: asInteger(leg.luggageCount, 0, 12),
      bulkyLuggage: leg.bulkyLuggage === true,
      ...safeOperationalFields(existing.exists ? existing.data() : {}),
      sourceRevision: revision,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    };
    transaction.set(transferRef, payload, { merge: true });
  });
});

exports.copyTransferOperationsToBackup = onDocumentWritten({
  document: `events/${EVENT_ID}/transferOpsRecords/{recordId}`,
  region: REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  timeoutSeconds: 60,
  memory: '256MiB',
}, async (event) => {
  const { recordId } = event.params;
  const after = event.data?.after;
  const backupRef = db.doc(`events/${EVENT_ID}/travelBackupRecords/${recordId}`);
  const backup = await backupRef.get();
  if (!backup.exists) return;
  const source = after?.exists ? after.data() : null;
  const revision = sourceRevision(after?.exists ? after : event.data?.before, event.time);
  const changes = source && source.recordState === 'active'
    ? { ...safeOperationalFields(source), operatorRevision: revision, updatedAt: FieldValue.serverTimestamp() }
    : {
        status: 'revoked',
        assignedOperatorUid: '',
        groupName: '',
        vehicleName: '',
        meetingPoint: '',
        meetingDate: '',
        meetingTime: '',
        operatorNotes: '',
        operatorRevision: revision,
        updatedAt: FieldValue.serverTimestamp(),
      };
  await backupRef.set(changes, { merge: true });
});

// Tre fogli separati invece di uno solo "ingegneristico": Arrivi e Partenze
// mostrano solo dati leggibili (mai un ID tecnico), Tecnico raccoglie i soli
// riferimenti per chi deve davvero incrociare un dato con Firestore.
const HUMAN_SHEET_NAMES = { outbound: 'Arrivi', return: 'Partenze' };
const TECHNICAL_SHEET_NAME = 'Tecnico';
const TRANSFER_STATUS_LABELS = {
  new: 'Da pianificare',
  planned: 'Pianificato',
  confirmed: 'Confermato',
  completed: 'Completato',
  cancelled: 'Annullato',
  revoked: 'Revocato',
};
// Struttura e colonne ricalcano deliberatamente il foglio "Arrivi/Partenze
// EGADI 2025" già collaudato dal titolare l'anno scorso (chiaro, essenziale,
// niente colonne che non servono a organizzare i transfer): nome/cognome
// separati, un Sì/No colorato per la richiesta transfer, colore per barca.
const HUMAN_SHEET_HEADER = ['Nome', 'Cognome', 'Telefono', 'Barca', 'Compagnia aerea', 'Volo', 'Aeroporto di partenza', 'Aeroporto di arrivo', 'Data', 'Ora', 'Richiesta transfer', 'Navetta da Marsala', 'Stato'];
const TECHNICAL_SHEET_HEADER = ['ID record', 'Nome', 'Barca', 'Direzione', 'Stato interno', 'Traccia', 'Bozza o confermata', 'Aggiornato il'];

function humanSheetRow(record) {
  if (record?.recordState !== 'active') {
    return ['— Revocata —', '', '', '', '', '', '', '', '', '', '', '', ''];
  }
  return [
    record.firstName || '',
    record.lastName || '',
    record.contactConsent === true ? record.phone || '' : '',
    record.boatName || '',
    record.carrier || '',
    record.serviceNumber || '',
    [record.originCity, record.originAirport].filter(Boolean).join(' · '),
    [record.destinationCity, record.destinationAirport].filter(Boolean).join(' · ') || record.airport || '',
    record.date || '',
    record.time || '',
    record.transferRequested === true ? 'Sì' : 'No',
    [record.meetingPoint, record.meetingDate, record.meetingTime].filter(Boolean).join(' · '),
    record.legState === 'draft' ? 'Bozza, non confermata' : (TRANSFER_STATUS_LABELS[record.status] || record.status || ''),
  ];
}

function technicalSheetRow(record) {
  return [
    record.recordId || '',
    record.participantName || '',
    record.boatName || '',
    directionLabel(record.direction),
    record.status || 'new',
    record.recordState === 'active' ? 'Attiva' : 'Revocata',
    record.legState || '',
    new Date().toISOString(),
  ];
}

let sheetTabsEnsuredFor = '';

// Crea i tre fogli (con intestazione) se non esistono ancora: evita di dover
// preparare a mano lo spreadsheet prima del primo utilizzo. Verificato una
// sola volta per istanza calda della funzione, non a ogni scrittura.
// Indice (da 0) della colonna "Richiesta transfer" nel foglio umano, per la
// formattazione condizionale Sì/No in verde/rosso come nel foglio modello.
const TRANSFER_COLUMN_INDEX = HUMAN_SHEET_HEADER.indexOf('Richiesta transfer');
let sheetGidsEnsuredFor = null;

async function ensureSheetTabs(sheets, sheetId) {
  if (sheetTabsEnsuredFor === sheetId) return sheetGidsEnsuredFor;
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'sheets.properties' });
  const existingSheets = spreadsheet.data.sheets || [];
  const existingTitles = new Set(existingSheets.map((sheet) => sheet.properties?.title));
  const wanted = [
    { title: 'Arrivi', header: HUMAN_SHEET_HEADER, human: true },
    { title: 'Partenze', header: HUMAN_SHEET_HEADER, human: true },
    { title: TECHNICAL_SHEET_NAME, header: TECHNICAL_SHEET_HEADER, human: false },
  ];
  const missing = wanted.filter((sheet) => !existingTitles.has(sheet.title));
  if (missing.length) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: missing.map((sheet) => ({ addSheet: { properties: { title: sheet.title } } })) },
      });
    } catch (error) {
      // Più scritture quasi simultanee possono far controllare a due
      // istanze la stessa lista di fogli prima che una delle due li crei:
      // se il foglio esiste già quando arriviamo qui, non è un errore reale.
      if (!/already exists/i.test(error?.message || '')) throw error;
    }
  }
  // Riscrive sempre la riga di intestazione (anche per i fogli già
  // esistenti): se l'elenco delle colonne cambia in futuro, il foglio si
  // corregge da solo invece di restare con un'intestazione superata.
  await Promise.all(wanted.map((sheet) => sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheet.title}!A1:${String.fromCharCode(64 + sheet.header.length)}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [sheet.header] },
  })));

  const refreshed = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'sheets.properties' });
  const gidByTitle = {};
  (refreshed.data.sheets || []).forEach((sheet) => { gidByTitle[sheet.properties.title] = sheet.properties.sheetId; });

  // Sì in verde, No in rosso, come "Richiesta Transfer" nel foglio modello
  // (Arrivi/Partenze EGADI 2025) — una sola volta, non ad ogni riga.
  const humanGids = wanted.filter((sheet) => sheet.human).map((sheet) => gidByTitle[sheet.title]).filter((gid) => gid !== undefined);
  if (humanGids.length && TRANSFER_COLUMN_INDEX >= 0) {
    const rangeFor = (gid) => ({ sheetId: gid, startRowIndex: 1, startColumnIndex: TRANSFER_COLUMN_INDEX, endColumnIndex: TRANSFER_COLUMN_INDEX + 1 });
    const rule = (gid, text, color) => ({
      addConditionalFormatRule: {
        rule: {
          ranges: [rangeFor(gid)],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: text }] },
            format: { backgroundColor: color, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } },
          },
        },
        index: 0,
      },
    });
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: humanGids.flatMap((gid) => [
            rule(gid, 'Sì', { red: 0.2, green: 0.58, blue: 0.3 }),
            rule(gid, 'No', { red: 0.7, green: 0.19, blue: 0.15 }),
          ]),
        },
      });
    } catch (error) {
      logger.warn('Formattazione condizionale Richiesta transfer non applicata.', { message: error?.message });
    }
  }

  sheetTabsEnsuredFor = sheetId;
  sheetGidsEnsuredFor = gidByTitle;
  return gidByTitle;
}

// Palette fissa e deterministica: la stessa barca ha sempre lo stesso
// colore, senza dover tenere uno stato di assegnazione da qualche parte.
const BOAT_COLOR_PALETTE = [
  { red: 0.80, green: 0.88, blue: 0.97 }, // blu
  { red: 0.99, green: 0.90, blue: 0.73 }, // arancio
  { red: 0.82, green: 0.93, blue: 0.81 }, // verde
  { red: 0.95, green: 0.82, blue: 0.87 }, // rosa
  { red: 0.89, green: 0.85, blue: 0.97 }, // viola
  { red: 0.99, green: 0.95, blue: 0.70 }, // giallo
];

function colorForBoat(boatId) {
  const key = asText(boatId, 200) || 'sconosciuta';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return BOAT_COLOR_PALETTE[hash % BOAT_COLOR_PALETTE.length];
}

async function colorBoatCell(sheets, sheetId, gid, rowNumber, boatId) {
  if (gid === undefined || !boatId) return;
  const boatColumnIndex = HUMAN_SHEET_HEADER.indexOf('Barca');
  if (boatColumnIndex < 0) return;
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: { sheetId: gid, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: boatColumnIndex, endColumnIndex: boatColumnIndex + 1 },
            cell: { userEnteredFormat: { backgroundColor: colorForBoat(boatId) } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        }],
      },
    });
  } catch (error) {
    logger.warn('Colore barca non applicato alla riga del foglio.', { message: error?.message, rowNumber });
  }
}

// Ogni record scrive in due fogli distinti (quello umano + Tecnico): il
// numero di riga di ciascuno è indipendente, per questo la mappa vive in una
// sottocollezione per foglio invece di un solo campo condiviso.
async function allocateSheetRow(recordId, revision, sheetName) {
  const configRef = db.doc(`events/${EVENT_ID}/integrations/transferSheet`);
  const mapRef = db.doc(`events/${EVENT_ID}/transferSheetRows/${recordId}/sheets/${sheetName}`);
  return db.runTransaction(async (transaction) => {
    const [configSnapshot, mapSnapshot] = await Promise.all([transaction.get(configRef), transaction.get(mapRef)]);
    const config = configSnapshot.exists ? configSnapshot.data() : null;
    if (!config?.active || !asText(config.sheetId, 160)) return null;
    const previousRevision = Number(mapSnapshot.exists ? mapSnapshot.data().sourceRevision : 0);
    if (previousRevision > revision) return { ignored: true };
    let rowNumber = Number(mapSnapshot.exists ? mapSnapshot.data().rowNumber : 0);
    const counterField = `nextRow_${sheetName}`;
    if (!Number.isInteger(rowNumber) || rowNumber < 2) {
      rowNumber = Math.max(2, Number(config[counterField] || 2));
      transaction.set(configRef, { [counterField]: rowNumber + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    transaction.set(mapRef, {
      recordId,
      sheetName,
      rowNumber,
      sourceRevision: revision,
      updatedAt: FieldValue.serverTimestamp(),
      ...(mapSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    return { sheetId: asText(config.sheetId, 160), sheetName, rowNumber };
  });
}

exports.syncTravelBackupToGoogleSheet = onDocumentWritten({
  document: `events/${EVENT_ID}/travelBackupRecords/{recordId}`,
  region: REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  timeoutSeconds: 90,
  memory: '256MiB',
}, async (event) => {
  const { recordId } = event.params;
  const after = event.data?.after;
  const record = after?.exists ? after.data() : { recordId, recordState: 'revoked' };
  const revision = sourceRevision(after?.exists ? after : event.data?.before, event.time);
  const humanSheetName = HUMAN_SHEET_NAMES[record.direction] || HUMAN_SHEET_NAMES.outbound;

  const [humanTarget, technicalTarget] = await Promise.all([
    allocateSheetRow(recordId, revision, humanSheetName),
    allocateSheetRow(recordId, revision, TECHNICAL_SHEET_NAME),
  ]);
  if ((!humanTarget || humanTarget.ignored) && (!technicalTarget || technicalTarget.ignored)) return;
  const sheetId = humanTarget?.sheetId || technicalTarget?.sheetId;
  if (!sheetId) return;

  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const gidByTitle = await ensureSheetTabs(sheets, sheetId);

  const writes = [];
  if (humanTarget && !humanTarget.ignored) {
    const lastColumn = String.fromCharCode(64 + HUMAN_SHEET_HEADER.length);
    writes.push(sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${humanTarget.sheetName}!A${humanTarget.rowNumber}:${lastColumn}${humanTarget.rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [humanSheetRow({ ...record, recordId })] },
    }));
    if (record.recordState === 'active') {
      writes.push(colorBoatCell(sheets, sheetId, gidByTitle?.[humanTarget.sheetName], humanTarget.rowNumber, record.boatId));
    }
  }
  if (technicalTarget && !technicalTarget.ignored) {
    const lastColumn = String.fromCharCode(64 + TECHNICAL_SHEET_HEADER.length);
    writes.push(sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${TECHNICAL_SHEET_NAME}!A${technicalTarget.rowNumber}:${lastColumn}${technicalTarget.rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [technicalSheetRow({ ...record, recordId })] },
    }));
  }
  await Promise.all(writes);
  logger.info('Riga arrivi e partenze aggiornata.', { recordId, humanSheetName, humanRow: humanTarget?.rowNumber, technicalRow: technicalTarget?.rowNumber });
});

// ── Abbinamento anonimo per passaggi tra partecipanti ───────────────────────
// Il numero di telefono non entra mai nei segnali di abbinamento (vedi
// ARRIVI_PARTENZE_SPEC.md): la ricerca dei compatibili gira solo qui, lato
// server con privilegi Admin, e la scheda che il client legge
// (matchCandidates) resta anonima finché entrambe le persone non accettano
// lo stesso abbinamento tramite respondToTravelMatch.
const MATCH_WINDOW_MINUTES = 120;

function participantKey(side, direction) {
  return `${side.boatId}/${side.inviteId}/${direction}`;
}

function computeMatchId(keyA, keyB) {
  const sorted = [keyA, keyB].sort();
  return crypto.createHash('sha256').update(sorted.join('|')).digest('hex').slice(0, 32);
}

function asMatchId(value) {
  const id = asText(value, 64);
  return /^[a-f0-9]{32}$/.test(id) ? id : '';
}

function minutesSinceEpoch(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  // Entrambi i lati leggono l'orario locale scritto dalla persona senza
  // conversione: basta un riferimento comune coerente per calcolare la
  // differenza relativa, non un istante assoluto reale.
  const parsed = Date.parse(`${date}T${time}:00Z`);
  return Number.isFinite(parsed) ? parsed / 60000 : null;
}

function isOptedInReadyLeg(leg) {
  return Boolean(leg)
    && leg.state === 'ready'
    && (leg.carpoolRole === 'need_ride' || leg.carpoolRole === 'offer_ride')
    && leg.carpoolMatchConsent === true;
}

function crewTravelLegRef(boatId, inviteId, direction) {
  return db.doc(`boats/${boatId}/crewTravel/${inviteId}/legs/${direction}`);
}

function matchCandidateRef(side, direction, matchId) {
  return crewTravelLegRef(side.boatId, side.inviteId, direction).collection('matchCandidates').doc(matchId);
}

async function setOrDeleteCandidate(side, direction, matchId, data) {
  const ref = matchCandidateRef(side, direction, matchId);
  if (data === null) {
    await ref.delete();
    return;
  }
  await ref.set(data, { merge: true });
}

async function deleteMatchPair(matchId, pair) {
  const batch = db.batch();
  batch.delete(db.doc(`events/${EVENT_ID}/travelMatchPairs/${matchId}`));
  batch.delete(matchCandidateRef(pair.sideA, pair.direction, matchId));
  batch.delete(matchCandidateRef(pair.sideB, pair.direction, matchId));
  await batch.commit();
}

async function createMatchPair({ selfSide, otherSide, direction, airport, date, windowMinutes }) {
  const selfKey = participantKey(selfSide, direction);
  const otherKey = participantKey(otherSide, direction);
  const matchId = computeMatchId(selfKey, otherKey);
  const pairRef = db.doc(`events/${EVENT_ID}/travelMatchPairs/${matchId}`);
  const asPlainSide = (side) => ({ boatId: side.boatId, inviteId: side.inviteId });
  const [sideA, sideB] = [selfKey, otherKey].sort().map((key) => asPlainSide(key === selfKey ? selfSide : otherSide));
  const batch = db.batch();
  batch.set(pairRef, {
    schemaVersion: 1,
    direction,
    airport,
    date,
    windowMinutes,
    participantKeys: [selfKey, otherKey],
    sideA,
    sideB,
    responseA: 'pending',
    responseB: 'pending',
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const candidatePayload = {
    schemaVersion: 1,
    matchId,
    direction,
    airport,
    date,
    windowMinutes,
    status: 'proposed',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  batch.set(matchCandidateRef(selfSide, direction, matchId), candidatePayload);
  batch.set(matchCandidateRef(otherSide, direction, matchId), candidatePayload);
  await batch.commit();
}

async function reconcileMatchesForLeg({ selfSide, direction, airport, date, compatibleSides }) {
  const selfKey = participantKey(selfSide, direction);
  const existingSnapshot = await db.collection(`events/${EVENT_ID}/travelMatchPairs`)
    .where('participantKeys', 'array-contains', selfKey)
    .get();
  const existingByOtherKey = new Map();
  existingSnapshot.forEach((docSnap) => {
    const pair = docSnap.data();
    const otherKey = (pair.participantKeys || []).find((key) => key !== selfKey);
    if (otherKey) existingByOtherKey.set(otherKey, { id: docSnap.id, pair });
  });

  const newOtherKeys = new Set(compatibleSides.map((side) => participantKey(side, direction)));

  await Promise.all([...existingByOtherKey.entries()].map(async ([otherKey, { id, pair }]) => {
    // Un abbinamento già rivelato non si tocca più: il contatto è già stato
    // condiviso fuori dal sito e una revoca successiva non può cancellarlo.
    if (pair.status === 'revealed') return;
    if (!newOtherKeys.has(otherKey)) await deleteMatchPair(id, pair);
  }));

  await Promise.all(compatibleSides.map(async (side) => {
    const otherKey = participantKey(side, direction);
    if (existingByOtherKey.has(otherKey)) return;
    await createMatchPair({ selfSide, otherSide: side, direction, airport, date, windowMinutes: side.windowMinutes });
  }));
}

async function closeMatchesForLeg(selfSide, direction) {
  await reconcileMatchesForLeg({ selfSide, direction, airport: '', date: '', compatibleSides: [] });
}

exports.matchCarpoolLegs = onDocumentWritten({
  document: 'boats/{boatId}/crewTravel/{inviteId}/legs/{direction}',
  region: REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  timeoutSeconds: 60,
  memory: '256MiB',
}, async (event) => {
  const { boatId, inviteId, direction } = event.params;
  if (!['outbound', 'return'].includes(direction)) return;
  const selfSide = { boatId, inviteId };
  const after = event.data?.after;
  const leg = after?.exists ? after.data() : null;

  if (!isOptedInReadyLeg(leg)) {
    await closeMatchesForLeg(selfSide, direction);
    return;
  }
  const airport = airportForTransfer(direction, leg);
  const timing = timeForTransfer(direction, leg);
  const selfMinutes = minutesSinceEpoch(timing.date, timing.time);
  if (!airport || selfMinutes == null) {
    await closeMatchesForLeg(selfSide, direction);
    return;
  }

  // Dataset minuscolo (evento privato): un filtro in memoria dopo un'unica
  // query sul solo consenso evita indici composti aggiuntivi.
  const snapshot = await db.collectionGroup('legs').where('carpoolMatchConsent', '==', true).get();
  const compatibleSides = [];
  snapshot.forEach((docSnap) => {
    const candidate = docSnap.data();
    if (candidate.direction !== direction || !isOptedInReadyLeg(candidate)) return;
    const inviteRef = docSnap.ref.parent.parent;
    const candidateInviteId = inviteRef.id;
    const candidateBoatId = inviteRef.parent.parent.id;
    if (candidateBoatId === boatId && candidateInviteId === inviteId) return;
    if (airportForTransfer(direction, candidate) !== airport) return;
    const candidateTiming = timeForTransfer(direction, candidate);
    const candidateMinutes = minutesSinceEpoch(candidateTiming.date, candidateTiming.time);
    if (candidateMinutes == null || Math.abs(candidateMinutes - selfMinutes) > MATCH_WINDOW_MINUTES) return;
    compatibleSides.push({
      boatId: candidateBoatId,
      inviteId: candidateInviteId,
      windowMinutes: Math.round(Math.abs(candidateMinutes - selfMinutes)),
    });
  });

  await reconcileMatchesForLeg({ selfSide, direction, airport, date: timing.date, compatibleSides });
});

async function authenticatedCrewInvite(request) {
  const uid = asUid(request?.auth?.uid);
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Accedi alla tua area personale per rispondere a un abbinamento.');
  }
  const accessSnapshot = await db.doc(`crewAccess/${uid}`).get();
  const access = accessSnapshot.exists ? accessSnapshot.data() : null;
  if (!access || access.userId !== uid) {
    throw new HttpsError('permission-denied', 'Questo accesso personale non è più valido.');
  }
  const boatId = asText(access.boatId, 80);
  const inviteId = asText(access.inviteId, 128);
  if (!boatId || !inviteId) {
    throw new HttpsError('permission-denied', 'Questo accesso personale non è più valido.');
  }
  const inviteSnapshot = await db.doc(`boats/${boatId}/invites/${inviteId}`).get();
  const invite = inviteSnapshot.exists ? inviteSnapshot.data() : null;
  if (!invite || invite.status !== 'active' || invite.participantUid !== uid) {
    throw new HttpsError('permission-denied', 'Questo accesso personale non è più attivo.');
  }
  return { boatId, inviteId };
}

async function participantContact(side) {
  const [memberSnapshot, inviteSnapshot] = await db.getAll(
    db.doc(`boats/${side.boatId}/members/${side.inviteId}`),
    db.doc(`boats/${side.boatId}/invites/${side.inviteId}`),
  );
  const member = memberSnapshot.exists ? memberSnapshot.data() : null;
  const invite = inviteSnapshot.exists ? inviteSnapshot.data() : null;
  return {
    name: asText(member?.displayName || invite?.displayName, 161) || 'Partecipante',
    phone: asText(member?.phone || invite?.phone, 40),
  };
}

exports.respondToTravelMatch = onCall({
  region: REGION,
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  timeoutSeconds: 30,
  memory: '256MiB',
}, async (request) => {
  const { boatId, inviteId } = await authenticatedCrewInvite(request);
  const matchId = asMatchId(request.data?.matchId);
  const wantsDecline = request.data?.response === 'decline';
  const wantsAccept = request.data?.response === 'accept';
  if (!matchId || (!wantsDecline && !wantsAccept)) {
    throw new HttpsError('invalid-argument', 'Richiesta non valida.');
  }
  const pairRef = db.doc(`events/${EVENT_ID}/travelMatchPairs/${matchId}`);

  const outcome = await db.runTransaction(async (transaction) => {
    const pairSnapshot = await transaction.get(pairRef);
    if (!pairSnapshot.exists) {
      throw new HttpsError('not-found', 'Questo abbinamento non è più disponibile.');
    }
    const pair = pairSnapshot.data();
    const isSideA = pair.sideA?.boatId === boatId && pair.sideA?.inviteId === inviteId;
    const isSideB = pair.sideB?.boatId === boatId && pair.sideB?.inviteId === inviteId;
    if (!isSideA && !isSideB) {
      throw new HttpsError('permission-denied', 'Questo abbinamento non ti riguarda.');
    }
    if (pair.status === 'revealed') {
      throw new HttpsError('failed-precondition', 'Questo abbinamento è già stato confermato in precedenza.');
    }
    if (wantsDecline) {
      transaction.delete(pairRef);
      return { action: 'closed', pair };
    }
    const selfField = isSideA ? 'responseA' : 'responseB';
    const otherResponse = isSideA ? pair.responseB : pair.responseA;
    const reveal = otherResponse === 'accepted';
    transaction.update(pairRef, {
      [selfField]: 'accepted',
      ...(reveal ? { status: 'revealed', revealedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { action: reveal ? 'revealed' : 'accepted', pair, isSideA };
  });

  if (outcome.action === 'closed') {
    await Promise.all([
      setOrDeleteCandidate(outcome.pair.sideA, outcome.pair.direction, matchId, null),
      setOrDeleteCandidate(outcome.pair.sideB, outcome.pair.direction, matchId, null),
    ]);
    return { status: 'closed' };
  }

  const selfSide = outcome.isSideA ? outcome.pair.sideA : outcome.pair.sideB;
  const otherSide = outcome.isSideA ? outcome.pair.sideB : outcome.pair.sideA;

  if (outcome.action === 'accepted') {
    await setOrDeleteCandidate(selfSide, outcome.pair.direction, matchId, { status: 'accepted', updatedAt: FieldValue.serverTimestamp() });
    return { status: 'accepted' };
  }

  const [selfContact, otherContact] = await Promise.all([participantContact(selfSide), participantContact(otherSide)]);
  await Promise.all([
    setOrDeleteCandidate(selfSide, outcome.pair.direction, matchId, {
      status: 'revealed',
      counterpartName: otherContact.name,
      counterpartWhatsapp: otherContact.phone,
      revealedAt: FieldValue.serverTimestamp(),
    }),
    setOrDeleteCandidate(otherSide, outcome.pair.direction, matchId, {
      status: 'revealed',
      counterpartName: selfContact.name,
      counterpartWhatsapp: selfContact.phone,
      revealedAt: FieldValue.serverTimestamp(),
    }),
  ]);
  return { status: 'revealed' };
});

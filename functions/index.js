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

function backupPayload({ recordId, boatId, boat, inviteId, invite, member, direction, leg, existing }) {
  const transferConsent = leg.transferOperatorConsent === true;
  const airport = airportForTransfer(direction, leg);
  const timing = timeForTransfer(direction, leg);
  const name = asText(member?.displayName || invite?.displayName, 161);
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
    boatName: asText(boat?.name, 70),
    participantName: transferConsent ? name : 'Dati non condivisi',
    contactConsent: transferConsent,
    phone,
    email,
    airport,
    date: timing.date,
    time: timing.time,
    transport: transportLabel(leg),
    luggageCount: asInteger(leg.luggageCount, 0, 12),
    bulkyLuggage: leg.bulkyLuggage === true,
    airportMarsalaChoice: asText(leg.airportMarsalaChoice, 20),
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
  const operator = safeOperationalFields(existing);
  return {
    schemaVersion: 1,
    recordId,
    boatId,
    inviteId: 'skipper',
    direction,
    recordState: 'active',
    boatName: asText(boat?.name, 70),
    participantName: transferConsent ? skipperDisplayName(profile, boat) : 'Dati non condivisi',
    participantRole: 'skipper',
    contactConsent: transferConsent,
    phone: transferConsent ? asText(profile?.phone, 40) : '',
    email: transferConsent ? asText(profile?.email, 160) : '',
    airport,
    date: timing.date,
    time: timing.time,
    transport: transportLabel(leg),
    luggageCount: asInteger(leg.luggageCount, 0, 12),
    bulkyLuggage: leg.bulkyLuggage === true,
    airportMarsalaChoice: asText(leg.airportMarsalaPlan, 20),
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
      airportMarsalaChoice: '',
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

function sheetRow(record) {
  if (record?.recordState !== 'active') {
    return [record?.recordId || '', 'Revocata', new Date().toISOString(), '', '', '', '', '', '', '', '', '', '', '', 'No', '', '', 'Richiesta revocata: dati personali rimossi.'];
  }
  const request = record.airportMarsalaChoice === 'transfer' ? 'Transfer richiesto' : record.carpoolRole === 'offer_ride' ? 'Passaggio auto offerto' : record.carpoolRole === 'need_ride' ? 'Passaggio auto cercato' : 'Solo pianificazione';
  const bagagli = `${asInteger(record.luggageCount, 0, 12)}${record.bulkyLuggage ? ' + ingombrante' : ''}`;
  const contact = record.contactConsent === true ? 'Sì' : 'No';
  return [
    record.recordId || '',
    record.status || 'new',
    new Date().toISOString(),
    record.boatName || '',
    record.participantName || '',
    directionLabel(record.direction),
    record.date || '',
    record.time || '',
    record.airport || '',
    record.transport || '',
    bagagli,
    request,
    record.groupName || '',
    [record.meetingPoint, record.meetingDate, record.meetingTime].filter(Boolean).join(' · '),
    contact,
    record.contactConsent === true ? record.phone || '' : '',
    record.contactConsent === true ? record.email || '' : '',
    record.operatorNotes || '',
  ];
}

async function allocateSheetRow(recordId, revision) {
  const configRef = db.doc(`events/${EVENT_ID}/integrations/transferSheet`);
  const mapRef = db.doc(`events/${EVENT_ID}/transferSheetRows/${recordId}`);
  return db.runTransaction(async (transaction) => {
    const [configSnapshot, mapSnapshot] = await Promise.all([transaction.get(configRef), transaction.get(mapRef)]);
    const config = configSnapshot.exists ? configSnapshot.data() : null;
    if (!config?.active || !asText(config.sheetId, 160)) return null;
    const previousRevision = Number(mapSnapshot.exists ? mapSnapshot.data().sourceRevision : 0);
    if (previousRevision > revision) return { ignored: true };
    let rowNumber = Number(mapSnapshot.exists ? mapSnapshot.data().rowNumber : 0);
    if (!Number.isInteger(rowNumber) || rowNumber < 5) {
      rowNumber = Math.max(5, Number(config.nextRow || 5));
      transaction.set(configRef, { nextRow: rowNumber + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    transaction.set(mapRef, {
      recordId,
      rowNumber,
      sourceRevision: revision,
      updatedAt: FieldValue.serverTimestamp(),
      ...(mapSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    return { sheetId: asText(config.sheetId, 160), rowNumber };
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
  const target = await allocateSheetRow(recordId, revision);
  if (!target || target.ignored) return;
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId: target.sheetId,
    range: `Movimenti!A${target.rowNumber}:R${target.rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [sheetRow({ ...record, recordId })] },
  });
  logger.info('Riga arrivi e partenze aggiornata.', { recordId, rowNumber: target.rowNumber });
});

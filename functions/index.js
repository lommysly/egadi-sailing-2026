const { initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { google } = require('googleapis');

initializeApp();

const db = getFirestore();
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

function safeStatus(value) {
  return TRANSFER_RECORD_STATUSES.has(value) && value !== 'revoked' ? value : 'new';
}

function safeOperationalFields(source = {}) {
  return {
    status: safeStatus(source.status),
    assignedOperatorUid: asText(source.assignedOperatorUid, 128),
    groupName: asText(source.groupName, 120),
    vehicleName: asText(source.vehicleName, 120),
    meetingPoint: asText(source.meetingPoint, 180),
    meetingDate: asText(source.meetingDate, 10),
    meetingTime: asText(source.meetingTime, 5),
    operatorNotes: asText(source.operatorNotes, 500),
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

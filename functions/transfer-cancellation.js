const { transferSeatCount } = require('./transfer-party');

// Lo skipper non ottiene lettura della coda globale: può solo annullare
// una tratta precisa della propria barca. Nessun volo o pagamento cambia.
function createTransferCancellationHandler({ db, FieldValue, HttpsError }) {
  return async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Accedi alla tua area skipper.');
    const data = request.data || {};
    const { boatId, inviteId, direction } = data;
    const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
    if (Object.keys(data).some((key) => !['boatId', 'inviteId', 'direction'].includes(key))
      || !validId(boatId) || !validId(inviteId) || !['outbound', 'return'].includes(direction)) {
      throw new HttpsError('invalid-argument', 'Scegli una singola tratta da annullare.');
    }
    const recordRef = db.doc(`events/egadi-2026/transferOpsRecords/${boatId}_${inviteId}_${direction}`);
    return db.runTransaction(async (transaction) => {
      const [event, boat, snapshot] = await Promise.all([
        transaction.get(db.doc('events/egadi-2026')),
        transaction.get(db.doc(`boats/${boatId}`)),
        transaction.get(recordRef),
      ]);
      if (event.data()?.privateAreaEnabled !== true) {
        throw new HttpsError('failed-precondition', 'L’area privata non è attiva.');
      }
      const organizerIds = event.data()?.organizerIds;
      const isOrganizer = Array.isArray(organizerIds) && organizerIds.includes(uid);
      const isSkipper = boat.exists && boat.data()?.eventId === 'egadi-2026' && boat.data()?.skipperId === uid;
      if (!isOrganizer && !isSkipper) {
        throw new HttpsError('permission-denied', 'Puoi annullare soltanto i transfer della tua barca.');
      }
      const record = snapshot.data();
      if (!snapshot.exists || record?.recordState !== 'active' || record.boatId !== boatId
        || record.inviteId !== inviteId || record.direction !== direction) {
        throw new HttpsError('failed-precondition', 'Questa richiesta non è più attiva.');
      }
      if (record.status === 'cancelled') return { status: 'cancelled', alreadyCancelled: true, releasedSeats: 0 };
      if (!['new', 'planned', 'confirmed'].includes(record.status)) {
        throw new HttpsError('failed-precondition', 'Il transfer risulta già concluso: contatta il gestore.');
      }
      transaction.update(recordRef, { status: 'cancelled', updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
      return { status: 'cancelled', alreadyCancelled: false, releasedSeats: transferSeatCount(record) };
    });
  };
}

module.exports = { createTransferCancellationHandler };

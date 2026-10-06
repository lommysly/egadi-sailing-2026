// Compatibilità con i record precedenti: una scheda senza accompagnatori
// rappresenta una persona. I conteggi non creano identità aggiuntive.
function additionalPassengerCount(record) {
  const value = record?.additionalPassengers;
  return Number.isInteger(value) && value >= 0 && value <= 8 ? value : 0;
}

function transferPassengerCount(record) {
  return 1 + additionalPassengerCount(record);
}

function transferSeatCount(record) {
  return !record || (record.recordState && record.recordState !== 'active') || ['cancelled', 'revoked'].includes(record.status)
    ? 0 : transferPassengerCount(record);
}

module.exports = { additionalPassengerCount, transferPassengerCount, transferSeatCount };

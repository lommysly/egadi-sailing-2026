const TRANSFER_STATUS_LABELS = {
  new: 'Da pianificare',
  planned: 'Pianificato',
  confirmed: 'Confermato',
  completed: 'Completato',
  cancelled: 'Annullato',
};

function sheetTransferRequestLabel(record) {
  if (record.airportMarsalaChoice === 'transfer') {
    return record.contactConsent === true ? 'Sì' : 'Consenso mancante';
  }
  if (record.airportMarsalaChoice === 'independent' || record.airportMarsalaChoice === 'ride_offer') return 'No';
  return 'Da scegliere';
}

function sheetTravelStatusLabel(record) {
  const choice = sheetTransferRequestLabel(record);
  if (choice === 'Da scegliere') return 'Transfer da scegliere';
  if (choice === 'Consenso mancante') return 'Consenso transfer da confermare';
  if (choice === 'No') return 'Transfer non richiesto';
  if (record.legState === 'draft') return 'Bozza, non confermata';
  return TRANSFER_STATUS_LABELS[record.status] || 'Da pianificare';
}

module.exports = { sheetTransferRequestLabel, sheetTravelStatusLabel };

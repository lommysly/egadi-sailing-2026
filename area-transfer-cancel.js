import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';

export function cancellationActions(status, inviteId, escapeHtml, english = false) {
  return ['outbound', 'return'].filter((direction) => ['new', 'planned', 'confirmed'].includes(status?.[`${direction}OperationStatus`]))
    .map((direction) => `<button class="button button-ghost" type="button" data-cancel-crew-transfer="${escapeHtml(inviteId)}" data-direction="${direction}">${english ? (direction === 'return' ? 'Cancel return transfer' : 'Cancel outbound transfer') : (direction === 'return' ? 'Annulla transfer ritorno' : 'Annulla transfer andata')}</button>`).join('');
}

export function bindTransferCancellation(section, { app, boatId, english = false }) {
  section.querySelectorAll('[data-cancel-crew-transfer]').forEach((button) => {
    button.addEventListener('click', async () => {
      const direction = button.dataset.direction;
      const confirmText = english
        ? `Cancel this ${direction === 'return' ? 'return' : 'outbound'} transfer, including all additional passengers? Notify the operator too, especially if the vehicle was already confirmed. This does not cancel participation or record refunds.`
        : `Annullare il transfer ${direction === 'return' ? 'di ritorno' : 'di andata'}, compresi tutti gli accompagnatori? Avvisa anche il gestore, soprattutto se il mezzo era già confermato. Non annulla la partecipazione e non registra rimborsi.`;
      if (!window.confirm(confirmText)) return;
      button.disabled = true;
      try {
        await httpsCallable(getFunctions(app, 'europe-west8'), 'cancelBoatTransfer')({ boatId, inviteId: button.dataset.cancelCrewTransfer, direction });
        button.textContent = english ? 'Transfer cancelled ✓' : 'Transfer annullato ✓';
      } catch (error) {
        console.error('Impossibile annullare il transfer.', error?.code || error);
        button.disabled = false;
        window.alert(english ? 'Cancellation could not be confirmed. Reload the page and check the status, or contact the operator.' : 'Non riesco a confermare l’annullamento. Ricarica e controlla lo stato, oppure contatta il gestore.');
      }
    });
  });
}

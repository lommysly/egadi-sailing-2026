// Il regolamento di bordo è un testo lungo che va letto fino in fondo prima
// di poter accettare la dichiarazione: lo stesso identico meccanismo (fine
// raggiunta con lo scroll, oppure testo già interamente visibile senza
// scroll) serviva duplicato in participant.js (prima registrazione) e
// my-area.js (rientro). Qui vive una sola volta, dentro un <dialog> nativo
// invece che incorporato tra tre contenitori annidati nella pagina: su
// telefono stretto restava pochissima larghezza per il testo e un'icona
// fissa a sinistra lo stringeva ancora di più (segnalato da Silvio,
// 25/09/2026). Il dialog apre a schermo pieno con tipografia da lettura,
// senza uscire dalla pagina.
export function bindRulesDialog({ dialog, openButton, scrollRegion }) {
  function hasReachedEnd() {
    return scrollRegion.clientHeight > 0
      && scrollRegion.scrollHeight - scrollRegion.scrollTop - scrollRegion.clientHeight <= 8;
  }
  function isEntirelyVisible() {
    return scrollRegion.clientHeight > 0 && scrollRegion.scrollHeight <= scrollRegion.clientHeight + 8;
  }
  let onFullyRead = () => {};
  function checkComplete() {
    if (hasReachedEnd() || isEntirelyVisible()) onFullyRead();
  }
  openButton.addEventListener('click', () => {
    dialog.showModal();
    requestAnimationFrame(checkComplete);
  });
  scrollRegion.addEventListener('scroll', checkComplete);
  if ('ResizeObserver' in window) new ResizeObserver(checkComplete).observe(scrollRegion);
  return {
    // resetBoardingRulesRead-equivalente: il chiamante registra qui cosa
    // succede quando il testo risulta letto per intero.
    setOnFullyRead(handler) { onFullyRead = handler; },
    checkComplete,
    close() { if (dialog.open) dialog.close(); },
  };
}

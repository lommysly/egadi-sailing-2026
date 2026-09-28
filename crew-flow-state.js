// Stato puro condiviso tra primo accesso e area personale dell'equipaggio.
// Le richieste transfer già inviate attendono il gestore: non sono un errore
// o un'azione ancora richiesta alla persona.
export function crewTravelNeedsAttention(...progresses) {
  return progresses.some((progress) => progress?.tone === 'attention');
}

// Quando lo skipper richiede la lettura completa, la dichiarazione si abilita
// soltanto dopo che la finestra del regolamento ha raggiunto la fine.
export function canConfirmCrewBriefing({ requiresFullRulesRead, fullRulesRead }) {
  return !requiresFullRulesRead || fullRulesRead === true;
}

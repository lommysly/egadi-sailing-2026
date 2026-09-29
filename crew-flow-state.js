// Stato puro condiviso tra primo accesso e area personale dell'equipaggio.
// Le richieste transfer già inviate attendono il gestore: non sono un errore
// o un'azione ancora richiesta alla persona.
export function crewTravelNeedsAttention(...progresses) {
  return progresses.some((progress) => progress?.tone === 'attention');
}

// Presentazione sintetica usata dallo skipper per leggere due tratte dentro
// una sola card. Il colore segnala l'azione più importante senza nascondere
// gli stati puntuali di andata e ritorno, che restano visibili nei badge.
export function crewTravelCardPresentation(legStates = {}) {
  const states = [legStates.outbound, legStates.return].filter(Boolean);
  const includes = (...values) => states.some((state) => values.includes(state));

  if (includes('transfer_cancelled')) {
    return { tone: 'cancelled', label: 'Transfer da verificare' };
  }
  if (includes('missing', 'draft', 'transfer_pending')) {
    return { tone: 'attention', label: 'Da completare' };
  }
  if (includes('transfer_ready', 'transfer_planning')) {
    return { tone: 'planning', label: 'Transfer in gestione' };
  }
  if (includes('transfer_confirmed', 'transfer_completed')) {
    return { tone: 'confirmed', label: 'Transfer gestito' };
  }
  return { tone: 'neutral', label: 'Nessun transfer richiesto' };
}

export function crewTravelCardPriority(tone) {
  return {
    cancelled: 0,
    attention: 1,
    planning: 2,
    confirmed: 3,
    neutral: 4,
  }[tone] ?? 5;
}

// Quando lo skipper richiede la lettura completa, la dichiarazione si abilita
// soltanto dopo che la finestra del regolamento ha raggiunto la fine.
export function canConfirmCrewBriefing({ requiresFullRulesRead, fullRulesRead }) {
  return !requiresFullRulesRead || fullRulesRead === true;
}

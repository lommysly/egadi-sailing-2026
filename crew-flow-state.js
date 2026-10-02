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
  // Dal 2/10/2026 non chiediamo più a nessuno di dichiarare che NON gli serve
  // il pulmino: chi non chiede niente ci arriva per conto suo, ed è una scelta
  // legittima, non una pratica aperta. Resta un solo caso da seguire: chi ha
  // scelto il transfer e non ha dato il consenso, perché vuole il pulmino e
  // senza quella spunta non lo avrà.
  if (includes('transfer_pending')) {
    return { tone: 'attention', label: 'Transfer da completare' };
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

// Nell'area skipper le persone restano divise in due elenchi semplici: chi ha
// una richiesta transfer rimasta a metà e tutti gli altri. "Tutti gli altri"
// comprende sia chi ha chiesto il pulmino sia chi ci arriva per conto suo:
// per lo skipper sono entrambi a posto, non c'è niente da fare.
export function crewTravelOverviewGroup(legStates = {}) {
  return legStates.outbound === 'transfer_pending' || legStates.return === 'transfer_pending'
    ? 'waiting'
    : 'submitted';
}

// Quando lo skipper richiede la lettura completa, la dichiarazione si abilita
// soltanto dopo che la finestra del regolamento ha raggiunto la fine.
export function canConfirmCrewBriefing({ requiresFullRulesRead, fullRulesRead }) {
  return !requiresFullRulesRead || fullRulesRead === true;
}

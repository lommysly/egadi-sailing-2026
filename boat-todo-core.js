// Che cosa conta come "barca da sollecitare": una definizione sola, usata da
// due pagine diverse.
//
// La console organizzatore (transfer.js) ne costruisce l'elenco "Cose da
// fare", con i messaggi di sollecito già scritti; l'area skipper (area.js) ne
// mostra soltanto il numero sulla card che porta alla console. Se la regola
// vivesse in due posti, il giorno in cui aggiungiamo un controllo nuovo uno
// dei due direbbe "tutto a posto" mentre l'altro no, e un numero che non
// corrisponde all'elenco è peggio di nessun numero (richiesta di Silvio,
// 2/10/2026).
//
// Qui dentro non entrano né Firestore né testi da leggere: solo la regola.
// Ogni pagina legge i dati come preferisce e traduce le chiavi restituite
// nelle proprie etichette.

// Ordine in cui le cose aperte vanno presentate: prima la barca in sé, poi
// quello che l'equipaggio deve poter leggere, infine i viaggi.
export const TODO_KEYS = Object.freeze(['boat', 'rules', 'dossier', 'quotes', 'extras', 'transfer']);

const OUTBOUND_VALUES = ['outbound', 'andata', 'arrival', 'arrivo', 'to_marsala', 'airport_to_marsala'];
const RETURN_VALUES = ['return', 'ritorno', 'departure', 'partenza', 'from_marsala', 'marsala_to_airport'];

// I record transfer arrivano da fonti diverse (modulo viaggio, foglio di
// backup, Cloud Function dello skipper) e nominano la tratta in più modi.
export function normalizeTransferDirection(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (OUTBOUND_VALUES.includes(normalized)) return 'outbound';
  if (RETURN_VALUES.includes(normalized)) return 'return';
  return '';
}

// I campi della barca che contano per i controlli qui sotto, letti sempre
// dagli stessi posti: il numero di bagni per esempio non è in cima al
// documento, sta dentro `berthLayout`. Tenere la mappatura qui evita che una
// delle due pagine legga il campo sbagliato e concluda "non impostata".
export function boatFromData(id, data) {
  const fields = data || {};
  return {
    id,
    name: fields.name || id,
    skipperName: fields.skipperName || '',
    capacity: Number.isInteger(fields.capacity) ? fields.capacity : null,
    totalBerths: Number.isInteger(fields.totalBerths) ? fields.totalBerths : null,
    bathroomCount: Number.isInteger(fields.berthLayout?.bathroomCount) ? fields.berthLayout.bathroomCount : 0,
  };
}

// Regole di bordo attive (briefing/board) e dossier skipper confermato
// (skipperContact/default). `briefing` e `contact` sono i dati del documento,
// oppure null se il documento non esiste.
export function setupSignals({ briefing, contact } = {}) {
  return {
    rulesActive: Boolean(briefing && briefing.rulesText),
    dossierConfirmed: Boolean(contact),
  };
}

// Due segnali leggibili dall'organizzatore senza entrare nel preventivo
// privato dello skipper: le voci extra dichiarate (contributionPlan) e le
// quote già assegnate alle persone (crewProjections). Bastano a distinguere
// "ha impostato i costi" da "non ha mai aperto la parte economica".
export function economySignals({ planExists, items, projectionBerthCents } = {}) {
  const values = Object.values(items || {});
  const berths = projectionBerthCents || [];
  return {
    planExists: Boolean(planExists),
    decidedItems: values.filter((item) => item?.state && item.state !== 'to_define').length,
    projectionsTotal: berths.length,
    pricedProjections: berths.filter((cents) => Number(cents) > 0).length,
  };
}

// "Barca impostata": posti/bagni configurati, regole di bordo attive, dossier
// skipper confermato, quote assegnate, voci extra definite.
export function boatSetupReadiness({ boat, setup, economy } = {}) {
  const status = setup || {};
  const berths = boat?.totalBerths;
  return {
    boatConfigured: Number.isInteger(berths) && berths >= 2 && Number(boat?.bathroomCount) > 0,
    rulesActive: status.rulesActive === true,
    dossierConfirmed: status.dossierConfirmed === true,
    // `null` quando il dato non è ancora stato letto: diverso da "non fatto",
    // altrimenti il sollecito partirebbe verso chi ha già impostato tutto.
    quotesSet: economy ? economy.pricedProjections > 0 : null,
    extrasSet: economy ? economy.decidedItems > 0 : null,
  };
}

// Il transfer dello skipper viaggia nei record transfer con inviteId
// "skipper" (functions/index.js, materializeSkipperTravel). Non distingue "si
// arrangia da solo" da "non ha ancora deciso": senza un record attivo resta
// da verificare, non necessariamente un problema.
export function skipperTransferStatus(records, boatId) {
  const hasActiveLeg = (direction) => (records || []).some((record) => record
    && record.boatId === boatId
    && record.inviteId === 'skipper'
    && (!record.recordState || record.recordState === 'active')
    && normalizeTransferDirection(record.direction || record.legDirection || record.travelDirection) === direction);
  return { outbound: hasActiveLeg('outbound'), return: hasActiveLeg('return') };
}

// Per ogni tratta: quante persone hanno chiesto il transfer, quante hanno una
// richiesta rimasta a metà, quante ci arrivano per conto loro.
//
// Fino al 2/10/2026 era il contrario: "in autonomia" si contava solo su
// dichiarazione esplicita e tutti gli altri finivano fra i "da sollecitare"
// per sottrazione. Risultato: nove persone di Carpe Diem che non avevano mai
// aperto il modulo risultavano una coda di lavoro per lo skipper, quando
// semplicemente a Marsala ci arrivavano da sole. Ora la sottrazione sta
// dall'altra parte: si conta chi ha chiesto il pulmino, e tutto il resto è
// gente che ci arriva per conto suo — operativamente è la verità, nessuno
// passa a prenderla. Resta contato a parte solo chi ha chiesto il transfer
// senza dare il consenso: quello sì è un lavoro vero, perché crede di avere
// il pulmino e non ce l'ha.
export function travelBreakdown({ travelStatuses, memberCount, skipperStatus } = {}) {
  const statuses = travelStatuses || [];
  const skipper = skipperStatus || {};
  const total = Number.isInteger(memberCount) ? memberCount + 1 : null;
  const countFor = (key) => ({
    requested: statuses.filter((entry) => entry?.[key] === 'requested').length,
    pending: statuses.filter((entry) => entry?.[key] === 'undecided').length,
  });
  const withSkipper = (counted, skipperRequested) => {
    const requested = counted.requested + (skipperRequested ? 1 : 0);
    return {
      requested,
      pending: counted.pending,
      independent: Number.isInteger(total) ? Math.max(0, total - requested - counted.pending) : null,
    };
  };
  return {
    total,
    outbound: withSkipper(countFor('outboundTransfer'), skipper.outbound === true),
    return: withSkipper(countFor('returnTransfer'), skipper.return === true),
  };
}

// L'elenco delle cose aperte per una barca. Vuoto = niente da sollecitare.
//
// Lo skipper senza transfer non compare più: come per chiunque altro, non
// averlo chiesto significa che ci arriva per conto suo, non che manca un
// dato. `transferPending` conta ormai solo le richieste rimaste a metà.
export function openTodoKeys({ readiness, transferPending } = {}) {
  const state = readiness || {};
  const open = [];
  if (!state.boatConfigured) open.push('boat');
  if (!state.rulesActive) open.push('rules');
  if (!state.dossierConfirmed) open.push('dossier');
  if (state.quotesSet === false) open.push('quotes');
  if (state.extrasSet === false) open.push('extras');
  if (Number(transferPending) > 0) open.push('transfer');
  return open;
}

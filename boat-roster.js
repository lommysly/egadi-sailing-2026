// "Arrivi e partenze della tua barca": chi arriva quando, chi riparte quando,
// con che mezzo e se è sul pulmino.
//
// È la stessa sezione per lo skipper e per l'equipaggio — stesso nome, stesso
// ordine, stesse righe — perché rispondono alla stessa domanda: chi c'è già
// quando arrivo io, chi apre la barca, chi può fare la cambusa, con chi posso
// dividere un passaggio. Due elenchi diversi per le due parti avrebbero
// significato due modi di leggere la stessa barca (richiesta di Silvio,
// 4/10/2026: "che ci sia un ordine cognitivo").
//
// Qui non c'è Firestore: ogni pagina legge crewTravelStatus come preferisce e
// passa le righe. Così l'elenco non può essere diverso fra le due aree.

const MEZZI = {
  it: { flight: 'volo', train: 'treno', car: 'auto', ferry: 'nave', other: 'altro mezzo' },
  en: { flight: 'flight', train: 'train', car: 'car', ferry: 'ferry', other: 'other' },
};

const TESTI = {
  it: {
    arriva: 'Arriva', riparte: 'Riparte', nonComunicato: 'non comunicato',
    colTransfer: 'col transfer', skipper: 'skipper', seiTu: 'sei tu',
    // Le stesse parole che legge chi organizza i transfer, così lo stato si
    // chiama allo stesso modo per tutti.
    transfer: {
      richiesto: 'transfer richiesto', planned: 'in pianificazione',
      confirmed: 'transfer confermato', completed: 'transfer concluso',
      cancelled: 'transfer annullato', undecided: 'transfer da completare',
      nessuno: 'per conto suo',
    },
    ritrovo: 'ritrovo', lingua: { it: 'IT', en: 'EN' },
    vuoto: 'Nessuno ha ancora comunicato il proprio viaggio.',
    sintesi: {
      annullato: 'Transfer annullato', daCompletare: 'Transfer da completare',
      sulTransfer: 'Sul transfer', perContoSuo: 'Arriva per conto suo',
      nonComunicato: 'Viaggio non comunicato',
    },
  },
  en: {
    arriva: 'Arrives', riparte: 'Leaves', nonComunicato: 'not shared',
    colTransfer: 'on the shuttle', skipper: 'skipper', seiTu: 'that is you',
    transfer: {
      richiesto: 'transfer requested', planned: 'planning',
      confirmed: 'transfer confirmed', completed: 'transfer completed',
      cancelled: 'transfer cancelled', undecided: 'transfer to complete',
      nessuno: 'on their own',
    },
    ritrovo: 'meet at', lingua: { it: 'IT', en: 'EN' },
    vuoto: 'Nobody has shared their journey yet.',
    sintesi: {
      annullato: 'Transfer cancelled', daCompletare: 'Transfer to complete',
      sulTransfer: 'On the shuttle', perContoSuo: 'Getting there on their own',
      nonComunicato: 'Journey not shared',
    },
  },
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function momento(voce, direzione, lingua) {
  const data = voce[`${direzione}Date`];
  const ora = voce[`${direzione}Time`];
  if (!data && !ora) return null;
  let giorno = '';
  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [anno, mese, numero] = data.split('-').map(Number);
    giorno = new Date(Date.UTC(anno, mese - 1, numero)).toLocaleDateString(lingua === 'en' ? 'en-GB' : 'it-IT', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    });
  }
  return {
    quando: [giorno, typeof ora === 'string' ? ora : ''].filter(Boolean).join(' · '),
    mezzo: MEZZI[lingua][voce[`${direzione}Transport`]] || '',
  };
}

// A che punto è il transfer di una tratta. Prima l'elenco diceva soltanto
// "col transfer" e lo stato vero stava in una seconda lista di card, con le
// stesse persone ripetute sotto: un doppione (segnalato da Silvio,
// 4/10/2026). Ora lo stato sta qui, sulla riga.
export function rosterTransferState(voce, direzione) {
  const richiesta = voce?.[`${direzione}Transfer`];
  if (richiesta === 'undecided') return { chiave: 'undecided', tono: 'attenzione' };
  if (richiesta !== 'requested') return null;
  const gestore = voce[`${direzione}OperationStatus`];
  if (gestore === 'cancelled') return { chiave: 'cancelled', tono: 'attenzione' };
  if (gestore === 'planned' || gestore === 'confirmed' || gestore === 'completed') return { chiave: gestore, tono: 'ok' };
  return { chiave: 'richiesto', tono: 'ok' };
}

// Le righe da mostrare, in ordine di arrivo: in cima chi atterra prima,
// perché è quello che apre la barca. Chi non ha ancora comunicato un orario
// finisce in fondo, ma resta visibile: sapere che manca è già un'informazione.
export function rosterEntries(statuses) {
  return (statuses || [])
    .filter((voce) => voce && voce.displayName)
    .slice()
    .sort((a, b) => String(a.outboundDate || '9999').localeCompare(String(b.outboundDate || '9999'))
      || String(a.outboundTime || '99:99').localeCompare(String(b.outboundTime || '99:99'))
      || String(a.displayName).localeCompare(String(b.displayName), 'it'));
}

// Il colore della card e la riga sotto il nome: la stessa sintesi che lo
// skipper usa per capire se c'è da sollecitare, e che l'equipaggio legge solo
// come informazione. Un transfer annullato o rimasto a metà viene prima di
// tutto il resto, perché è l'unico caso in cui qualcuno rischia di restare
// a piedi.
export function rosterCardSummary(voce, lingua = 'it') {
  const t = TESTI[lingua].sintesi;
  const stati = ['outbound', 'return'].map((direzione) => rosterTransferState(voce, direzione)).filter(Boolean);
  if (stati.some((stato) => stato.chiave === 'cancelled')) return { tono: 'cancelled', testo: t.annullato };
  if (stati.some((stato) => stato.chiave === 'undecided')) return { tono: 'attention', testo: t.daCompletare };
  if (stati.length) {
    const tuttoConfermato = stati.every((stato) => stato.chiave === 'confirmed' || stato.chiave === 'completed');
    return { tono: tuttoConfermato ? 'confirmed' : 'planning', testo: t.sulTransfer };
  }
  const haViaggio = Boolean(voce.outboundDate || voce.returnDate || voce.outbound || voce.return);
  return { tono: 'neutral', testo: haViaggio ? t.perContoSuo : t.nonComunicato };
}

// Le card dell'elenco come HTML: una per persona, nella stessa griglia e con
// gli stessi colori delle card che lo skipper usava già. `currentId` marca
// "sei tu": l'id dell'invito per l'equipaggio, 'skipper' per lo skipper.
//
// `azione(voce)` è facoltativa e restituisce HTML già pronto per quella card:
// lo skipper ci mette il tasto WhatsApp (sollecita o scrivi), l'equipaggio
// niente — non deve sollecitare nessuno e i contatti dei compagni non li vede.
export function rosterMarkup(statuses, { currentId = '', english = false, azione = null } = {}) {
  const lingua = english ? 'en' : 'it';
  const t = TESTI[lingua];
  const voci = rosterEntries(statuses);
  if (!voci.length) return `<p class="boat-roster-empty">${escapeHtml(t.vuoto)}</p>`;
  // Le etichette sono quelle delle card del gestore transfer (transfer-badge),
  // con gli stessi colori per gli stessi stati: chi passa da una pagina
  // all'altra ritrova lo stesso linguaggio (richiesta di Silvio, 4/10/2026).
  const CLASSE_STATO = { richiesto: 'new', planned: 'planned', confirmed: 'confirmed', completed: 'completed', cancelled: 'cancelled', undecided: 'draft' };
  const tratta = (voce, direzione, etichetta) => {
    const dati = momento(voce, direzione, lingua);
    const stato = rosterTransferState(voce, direzione);
    const badgeStato = stato
      ? `<span class="transfer-badge transfer-badge--${CLASSE_STATO[stato.chiave]}">${escapeHtml(t.transfer[stato.chiave])}</span>`
      : `<span class="transfer-badge transfer-badge--unknown">${escapeHtml(t.transfer.nessuno)}</span>`;
    // Lo stato in diretta comprende il ritrovo, appena il gestore lo imposta.
    const ora = voce[`${direzione}MeetingTime`];
    const punto = voce[`${direzione}MeetingPoint`];
    const ritrovo = stato && (ora || punto)
      ? `<span class="boat-card-meeting">${escapeHtml(t.ritrovo)} ${escapeHtml([ora, punto].filter(Boolean).join(' · '))}</span>`
      : '';
    const quando = dati
      ? `<span class="boat-card-when">${escapeHtml(dati.quando)}${dati.mezzo ? ` <small>${escapeHtml(dati.mezzo)}</small>` : ''}</span>`
      : `<span class="boat-card-when boat-card-when--unknown">${escapeHtml(t.nonComunicato)}</span>`;
    return `<div class="boat-card-leg">
        <span class="transfer-badge transfer-badge--${direzione === 'return' ? 'return' : 'outbound'}">${escapeHtml(etichetta)}</span>
        ${quando}
        <span class="boat-card-status">${badgeStato}${ritrovo}</span>
      </div>`;
  };
  return voci.map((voce) => {
    const skipper = voce.isSkipper === true;
    const io = Boolean(currentId) && (voce.id === currentId || voce.inviteId === currentId);
    const sintesi = rosterCardSummary(voce, lingua);
    const sotto = [skipper ? t.skipper : '', io ? t.seiTu : '', sintesi.testo].filter(Boolean).join(' · ');
    const iniziale = String(voce.displayName).trim().charAt(0).toUpperCase() || '?';
    const extra = typeof azione === 'function' ? azione(voce) || '' : '';
    // La lingua parlata, come sulle card del gestore: serve a sapere come
    // rivolgersi a quella persona prima ancora di incontrarla.
    const parlata = voce.preferredLocale === 'en' ? 'en' : voce.preferredLocale === 'it' ? 'it' : '';
    const badgeLingua = parlata
      ? `<span class="transfer-badge transfer-badge--language transfer-badge--language-${parlata}">${escapeHtml(t.lingua[parlata])}</span>`
      : '';
    return `<article class="crew-travel-card crew-travel-card--${sintesi.tono}${skipper ? ' boat-card--skipper' : ''}${io ? ' boat-card--io' : ''}">
      <header class="crew-travel-card-heading">
        <span class="crew-travel-card-avatar" aria-hidden="true">${escapeHtml(iniziale)}</span>
        <span class="crew-travel-card-person"><strong>${escapeHtml(voce.displayName)}</strong><small>${escapeHtml(sotto)}</small></span>
        ${badgeLingua}
      </header>
      <div class="boat-card-legs">
        ${tratta(voce, 'outbound', t.arriva)}
        ${tratta(voce, 'return', t.riparte)}
      </div>
      ${extra ? `<div class="crew-travel-card-action">${extra}</div>` : ''}
    </article>`;
  }).join('');
}

// Titolo e spiegazione, identici dalle due parti.
export function rosterHeading(english = false) {
  return english
    ? {
      eyebrow: 'Who is on board',
      title: 'Arrivals and departures on your boat',
      hint: 'To sort things out between you: who boards straight away, who stops for provisions, who shares a ride. Only name, time and means are shown.',
    }
    : {
      eyebrow: 'Chi è a bordo',
      title: 'Arrivi e partenze della tua barca',
      hint: 'Per mettervi d’accordo: chi si imbarca subito, chi passa dalla cambusa, chi divide un passaggio. Compaiono solo nome, orario e mezzo.',
    };
}

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
    vuoto: 'Nessuno ha ancora comunicato il proprio viaggio.',
  },
  en: {
    arriva: 'Arrives', riparte: 'Leaves', nonComunicato: 'not shared',
    colTransfer: 'on the shuttle', skipper: 'skipper', seiTu: 'that is you',
    vuoto: 'Nobody has shared their journey yet.',
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

// Le righe dell'elenco come HTML. `currentId` marca "sei tu": l'id dell'invito
// per l'equipaggio, 'skipper' per lo skipper.
export function rosterMarkup(statuses, { currentId = '', english = false } = {}) {
  const lingua = english ? 'en' : 'it';
  const t = TESTI[lingua];
  const voci = rosterEntries(statuses);
  if (!voci.length) return `<li class="boat-roster-empty">${escapeHtml(t.vuoto)}</li>`;
  const riga = (etichetta, dati, transfer) => {
    if (!dati) return `<span class="boat-roster-leg boat-roster-leg--unknown">${escapeHtml(etichetta)}: ${escapeHtml(t.nonComunicato)}</span>`;
    const pulmino = transfer === 'requested' ? ` <em>${escapeHtml(t.colTransfer)}</em>` : '';
    // Etichetta e valore sono due colonne: su un telefono il valore va a capo
    // sotto sé stesso, non sotto l'etichetta.
    return `<span class="boat-roster-leg"><strong>${escapeHtml(etichetta)}</strong><span class="boat-roster-value">${escapeHtml(dati.quando)}${dati.mezzo ? ` <small>${escapeHtml(dati.mezzo)}</small>` : ''}${pulmino}</span></span>`;
  };
  return voci.map((voce) => {
    const skipper = voce.isSkipper === true;
    const io = Boolean(currentId) && (voce.id === currentId || voce.inviteId === currentId);
    return `<li class="boat-roster-row${skipper ? ' boat-roster-row--skipper' : ''}${io ? ' boat-roster-row--io' : ''}">
      <div class="boat-roster-person">
        <strong>${escapeHtml(voce.displayName)}</strong>
        ${skipper ? `<small>${escapeHtml(t.skipper)}</small>` : ''}
        ${io ? `<small>${escapeHtml(t.seiTu)}</small>` : ''}
      </div>
      <div class="boat-roster-legs">
        ${riga(t.arriva, momento(voce, 'outbound', lingua), voce.outboundTransfer)}
        ${riga(t.riparte, momento(voce, 'return', lingua), voce.returnTransfer)}
      </div>
    </li>`;
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

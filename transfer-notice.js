// Il transfer, detto a chi lo aspetta, appena entra.
//
// L'orario e il punto di ritrovo decisi dal gestore c'erano già nell'area
// personale, ma in mezzo alla pagina: bisognava andarseli a cercare. Alla
// vigilia degli arrivi (7/10/2026) Silvio ha chiesto che chi entra li trovi
// davanti, come finestra: è l'informazione che serve per non restare in
// aeroporto ad aspettare una navetta che passa a un'altra ora.
//
// La finestra compare una volta per ingresso, e di nuovo ogni volta che il
// gestore cambia qualcosa (stato, orario, punto): non a ogni aggiornamento
// della pagina, altrimenti diventa rumore e si chiude senza leggerla.
// Mostra solo quello che il gestore ha deciso per quella persona; le note
// interne del gestore non arrivano mai fin qui.
import { formatIsoDay } from './date-format.js?v=20261007-date-italiane-v1';
import { operationalNow, transferTimingCheck } from './transfer-ordering.js?v=20261010-andate-ritorni-v1';

const OPERATIONS = new Set(['planned', 'confirmed', 'cancelled']);
const HIDDEN_OPERATIONS = new Set(['completed', 'revoked']);
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function text(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

// Le tratte per cui la persona ha chiesto il transfer e c'è ancora qualcosa
// da sapere. Una tratta conclusa o una richiesta non più attiva non compare.
export function transferNoticeLegs(status, today = '') {
  if (!status || typeof status !== 'object') return [];
  return ['outbound', 'return'].map((direction) => {
    if (status[`${direction}Transfer`] !== 'requested') return null;
    // Una tratta di un giorno già trascorso non serve più a nessuno: il
    // 10/10/2026 chi entrava vedeva ancora, sopra il rientro, il transfer di
    // andata dell'8 ottobre, perché il gestore non l'aveva segnato concluso.
    const day = text(status[`${direction}Date`], 10);
    if (today && /^\d{4}-\d{2}-\d{2}$/.test(day) && day < today) return null;
    const raw = status[`${direction}OperationStatus`];
    if (HIDDEN_OPERATIONS.has(raw)) return null;
    const operation = OPERATIONS.has(raw) ? raw : 'new';
    const time = TIME.test(status[`${direction}Time`] || '') ? status[`${direction}Time`] : '';
    const meetingTime = TIME.test(status[`${direction}MeetingTime`] || '') ? status[`${direction}MeetingTime`] : '';
    const date = text(status[`${direction}Date`], 10);
    return {
      direction,
      operation,
      date,
      time,
      transport: text(status[`${direction}Transport`], 20),
      meetingTime,
      meetingPoint: text(status[`${direction}MeetingPoint`], 160),
      // Un ritrovo fissato prima dell'atterraggio è un errore di chi organizza:
      // l'unico che può accorgersene in tempo è chi ha il biglietto in mano.
      beforeLanding: direction === 'outbound'
        && transferTimingCheck({ date, time, meetingTime, status: operation }, 'outbound').code === 'pickup_before_landing',
    };
  }).filter(Boolean);
}

// Il numero del gestore dei transfer, se il server lo ha messo nello stato di
// viaggio. Si mostra solo a chi ha almeno una tratta già presa in carico:
// chi ha appena chiesto il transfer non ha ancora niente da domandare, e il
// gestore alla vigilia non deve ricevere cinquanta telefonate.
export function transferNoticeContact(status, legs) {
  const phone = text(status?.transferContactPhone, 20);
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  if (!legs.some((leg) => leg.operation === 'planned' || leg.operation === 'confirmed')) return null;
  return { name: text(status?.transferContactName, 60), phone };
}

function phoneLabel(phone) {
  const italian = /^\+39(\d{3})(\d{3})(\d{3,4})$/.exec(phone);
  return italian ? `+39 ${italian[1]} ${italian[2]} ${italian[3]}` : phone;
}

// Cambia quando cambia qualcosa che la persona deve sapere: serve a decidere
// se la finestra è già stata vista.
export function transferNoticeSignature(legs) {
  return JSON.stringify(legs.map((leg) => [leg.direction, leg.operation, leg.meetingTime, leg.meetingPoint, leg.date, leg.time]));
}

function copy(english) {
  return english
    ? {
      title: 'Your transfer',
      lead: 'This is where it stands, as set by the transfer organiser.',
      outbound: 'Outbound',
      return: 'Return',
      status: { new: 'Request received', planned: 'Being arranged', confirmed: 'Confirmed', cancelled: 'Cancelled' },
      pickup: 'Pick-up at',
      pickupPending: 'The pick-up time will appear here as soon as the organiser sets it.',
      requestPending: 'Your request is in. The pick-up time will appear here as soon as the organiser confirms it.',
      cancelled: 'This transfer has been cancelled. Contact your skipper before travelling.',
      lands: 'Your flight lands at',
      arrives: 'You arrive at',
      departs: 'Your flight departs at',
      leaves: 'You leave at',
      beforeLanding: 'Careful: the pick-up is set before your landing time. Tell your skipper now.',
      contact: 'For transfer information:',
      call: 'Call',
      footer: 'You can always find this under “Arrivals and departures on your boat”. If something looks wrong, message your skipper.',
      close: 'Got it',
    }
    : {
      title: 'Il tuo transfer',
      lead: 'Ecco a che punto è, come lo ha impostato il gestore dei transfer.',
      outbound: 'Andata',
      return: 'Rientro',
      status: { new: 'Richiesta ricevuta', planned: 'In organizzazione', confirmed: 'Confermato', cancelled: 'Annullato' },
      pickup: 'Ritrovo alle',
      pickupPending: 'L’orario di ritrovo comparirà qui appena il gestore lo imposta.',
      requestPending: 'La tua richiesta è arrivata. L’orario di ritrovo comparirà qui appena il gestore la conferma.',
      cancelled: 'Questo transfer è stato annullato. Contatta il tuo skipper prima di partire.',
      lands: 'Il tuo volo atterra alle',
      arrives: 'Arrivi alle',
      departs: 'Il tuo volo parte alle',
      leaves: 'Parti alle',
      beforeLanding: 'Attenzione: il ritrovo risulta prima del tuo atterraggio. Avvisa subito il tuo skipper.',
      contact: 'Per informazioni sul transfer:',
      call: 'Chiama',
      footer: 'Lo ritrovi sempre in «Arrivi e partenze della barca». Se qualcosa non torna, scrivi al tuo skipper.',
      close: 'Ho capito',
    };
}

function legMarkup(leg, labels, english) {
  const day = formatIsoDay(leg.date, { english, weekday: 'long' });
  const heading = [labels[leg.direction], day].filter(Boolean).join(' · ');
  const flight = leg.transport === 'flight' || !leg.transport;
  const ownTimeLabel = leg.direction === 'return'
    ? (flight ? labels.departs : labels.leaves)
    : (flight ? labels.lands : labels.arrives);
  const ownTime = leg.time ? `<p class="transfer-notice-own">${escapeHtml(ownTimeLabel)} ${escapeHtml(leg.time)}.</p>` : '';
  let body;
  if (leg.operation === 'cancelled') {
    body = `<p class="transfer-notice-text">${escapeHtml(labels.cancelled)}</p>`;
  } else if (leg.meetingTime) {
    body = `<p class="transfer-notice-pickup"><small>${escapeHtml(labels.pickup)}</small><b>${escapeHtml(leg.meetingTime)}</b></p>`
      + (leg.meetingPoint ? `<p class="transfer-notice-point">${escapeHtml(leg.meetingPoint)}</p>` : '')
      + ownTime
      + (leg.beforeLanding ? `<p class="transfer-notice-warning">${escapeHtml(labels.beforeLanding)}</p>` : '');
  } else {
    body = `<p class="transfer-notice-text">${escapeHtml(leg.operation === 'new' ? labels.requestPending : labels.pickupPending)}</p>`
      + (leg.meetingPoint ? `<p class="transfer-notice-point">${escapeHtml(leg.meetingPoint)}</p>` : '')
      + ownTime;
  }
  return `<section class="transfer-notice-leg transfer-notice-leg--${escapeHtml(leg.operation)}">
    <header><strong>${escapeHtml(heading)}</strong><span class="transfer-notice-status">${escapeHtml(labels.status[leg.operation])}</span></header>
    ${body}
  </section>`;
}

function contactMarkup(contact, labels) {
  if (!contact) return '';
  const digits = contact.phone.replace(/[^0-9]/g, '');
  const who = contact.name ? `<strong>${escapeHtml(contact.name)}</strong> · ` : '';
  return `<p class="transfer-notice-contact">${escapeHtml(labels.contact)} ${who}<span>${escapeHtml(phoneLabel(contact.phone))}</span><span class="transfer-notice-contact-actions"><a href="tel:+${escapeHtml(digits)}">${escapeHtml(labels.call)}</a><a href="https://wa.me/${escapeHtml(digits)}" target="_blank" rel="noopener noreferrer">WhatsApp</a></span></p>`;
}

export function transferNoticeMarkup(legs, english = false, contact = null) {
  const labels = copy(english);
  return `<div class="transfer-notice">
    <p class="eyebrow">Transfer</p>
    <h2 id="transferNoticeTitle">${escapeHtml(labels.title)}</h2>
    <p class="transfer-notice-lead">${escapeHtml(labels.lead)}</p>
    ${legs.map((leg) => legMarkup(leg, labels, english)).join('')}
    ${contactMarkup(contact, labels)}
    <p class="transfer-notice-footer">${escapeHtml(labels.footer)}</p>
    <div class="transfer-notice-actions"><button class="button button-primary" type="button" data-transfer-notice-close>${escapeHtml(labels.close)}</button></div>
  </div>`;
}

function sessionStore() {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

let dialog = null;

function ensureDialog(doc) {
  if (dialog && dialog.isConnected !== false) return dialog;
  dialog = doc.createElement('dialog');
  dialog.className = 'transfer-notice-dialog';
  dialog.setAttribute('aria-labelledby', 'transferNoticeTitle');
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest?.('[data-transfer-notice-close]')) dialog.close();
  });
  doc.body.append(dialog);
  return dialog;
}

// Restituisce true se la finestra è stata aperta (o aggiornata mentre era
// aperta). `scope` distingue persona e barca: sullo stesso telefono possono
// entrare due persone diverse.
export function showTransferNotice({ status, english = false, scope = '', storage, doc = globalThis.document, today } = {}) {
  const legs = transferNoticeLegs(status, today === undefined ? operationalNow().today : today);
  if (!legs.length || !doc?.body) return false;
  const signature = transferNoticeSignature(legs);
  const store = storage === undefined ? sessionStore() : storage;
  const key = `egadi-transfer-notice:${scope}`;
  let seen = '';
  try { seen = store?.getItem(key) || ''; } catch { seen = ''; }
  if (seen === signature) return false;
  const element = ensureDialog(doc);
  if (typeof element.showModal !== 'function') return false;
  // Se è aperta un'altra finestra (il regolamento da accettare) si aspetta
  // che venga chiusa: due finestre una sopra l'altra non le legge nessuno.
  const other = doc.querySelector?.('dialog[open]:not(.transfer-notice-dialog)');
  if (other) {
    other.addEventListener('close', () => showTransferNotice({ status, english, scope, storage, doc, today }), { once: true });
    return false;
  }
  element.innerHTML = transferNoticeMarkup(legs, english, transferNoticeContact(status, legs));
  element.onclose = () => {
    try { store?.setItem(key, signature); } catch { /* senza memoria la finestra ricompare: va bene lo stesso */ }
  };
  if (!element.open) element.showModal();
  return true;
}

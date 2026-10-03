// Link unico di barca: una persona arriva qui con il link pubblicato nel
// gruppo, sceglie il proprio nome fra quelli che lo skipper ha già inserito,
// conferma la propria data di nascita e si crea da sola l'accesso personale.
//
// Qui dentro non c'è nessuna verifica: il controllo sta tutto nella Cloud
// Function claimBoatLinkSlot, che è l'unica a vedere le date di nascita e a
// contare i tentativi sbagliati. Questa pagina mostra dei nomi e raccoglie
// due campi — se qualcuno la manomette dal browser non ottiene niente, perché
// non è lei a decidere.
//
// Finito il passo, si consegna alla pagina di sempre (participant.html) con
// l'invito appena creato: da lì in poi corre il flusso già collaudato.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'europe-west8');
const listSlots = httpsCallable(functions, 'listBoatLinkSlots');
const claimSlot = httpsCallable(functions, 'claimBoatLinkSlot');

const params = new URLSearchParams(window.location.search);
const boatId = params.get('barca') || params.get('boat') || '';
const linkKey = params.get('codice') || params.get('key') || '';

const message = document.querySelector('#joinMessage');
const stepName = document.querySelector('#joinStepName');
const stepConfirm = document.querySelector('#joinStepConfirm');
const confirmMessage = document.querySelector('#joinConfirmMessage');
const slotsBox = document.querySelector('#joinSlots');
let chosen = null;

function setMessage(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('is-error', isError);
  element.hidden = !text;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

// Un errore della funzione arriva già scritto per una persona, non per un
// programmatore: si mostra quello, senza aggiungerci sopra codici di stato.
function readableError(error) {
  // L'SDK Firebase appende il codice HTTP al messaggio ("… [403]"). È gergo
  // tecnico davanti a una persona che sta solo cercando di entrare: via.
  const text = String(error?.message || '').replace(/\s*\[\d{3}\]\s*$/, '').trim();
  if (text && !/^internal$/i.test(text)) return text;
  return 'Non riesco a completare l’attivazione in questo momento. Riprova fra poco.';
}

// Il prefisso è un campo a parte, non una cosa da indovinare.
//
// Quasi nessuno scrive il proprio numero in forma internazionale: si scrive
// "348 565 7591". Finché il campo era uno solo, mettere davanti il "+"
// trasformava un numero italiano in uno spagnolo (+34 85657591) — accettato
// come valido, e con cui poi la persona non riesce più a entrare, perché
// l'identità di accesso si calcola proprio dal numero. È successo il
// 3/10/2026 a Cristina Della Moretta e Stefano Arpini, rimasti bloccati a
// metà strada con un numero che non era il loro.
//
// Ora il prefisso si sceglie da un elenco e il numero si scrive senza. Se
// qualcuno lo riscrive lo stesso dentro il campo numero, quello che ha
// scritto lui vince: è più probabile che sappia il proprio prefisso di
// quanto sia probabile che abbia cambiato la tendina per sbaglio.
function numeroInternazionale(prefisso, numero) {
  const pulisci = (v) => String(v || '').trim().replace(/[ .()\-\/]/g, '');
  const parte = pulisci(numero);
  if (/^\+[1-9]\d{7,14}$/.test(parte)) return parte;
  if (/^00[1-9]\d{7,14}$/.test(parte)) return `+${parte.slice(2)}`;
  const pre = pulisci(prefisso).replace(/^00/, '+');
  if (!/^\+[1-9]\d{0,3}$/.test(pre)) return '';
  // Un numero nazionale può cominciare con uno zero da togliere (fissi
  // italiani, mobili di altri Paesi): il prefisso internazionale lo sostituisce.
  const nazionale = parte.replace(/^0+/, '');
  if (!/^[1-9]\d{5,13}$/.test(nazionale)) return '';
  const completo = `${pre}${nazionale}`;
  return /^\+[1-9]\d{7,14}$/.test(completo) ? completo : '';
}

// Il numero che il sito ha capito, mostrato mentre si scrive: se è sbagliato
// lo si vede prima di premere, non dopo essere rimasti fuori.
function aggiornaAnteprimaNumero() {
  const anteprima = stepConfirm.querySelector('[data-phone-preview]');
  if (!anteprima) return;
  const campi = new FormData(stepConfirm);
  const numero = numeroInternazionale(prefissoScelto(campi), campi.get('phone'));
  anteprima.textContent = numero
    ? `Entrerai con questo numero: ${numero}`
    : 'Scrivi il numero senza il prefisso: quello lo scegli qui accanto.';
}

function prefissoScelto(campi) {
  const scelto = String(campi.get('phonePrefix') || '');
  return scelto === 'altro' ? String(campi.get('phonePrefixCustom') || '') : scelto;
}

async function start() {
  if (!boatId || !linkKey) {
    setMessage(message, 'Questo indirizzo non è completo. Apri il link esattamente come lo hai ricevuto nel gruppo.', true);
    return;
  }
  try {
    const { data } = await listSlots({ boatId, linkKey });
    if (!data.slots?.length) {
      setMessage(message, 'Tutte le persone di questo equipaggio hanno già attivato il proprio accesso. Se sei tu una di loro, entra con numero e codice personale dall’area riservata.');
      return;
    }
    document.querySelector('#joinBoatTitle').textContent = data.boatName
      ? `Scegli il tuo nome · ${data.boatName}`
      : 'Scegli il tuo nome';
    if (data.skipperName) {
      document.querySelector('#joinLead').textContent = `${data.skipperName} ha già preparato l’elenco dell’equipaggio. Scegli il tuo nome, conferma la tua data di nascita e crei il tuo accesso personale.`;
    }
    slotsBox.innerHTML = data.slots.map((slot) => `<button class="button button-ghost join-slot" type="button" data-slot="${escapeHtml(slot.slotId)}" data-name="${escapeHtml(slot.displayName)}">${escapeHtml(slot.displayName)}</button>`).join('');
    setMessage(message, '');
    stepName.hidden = false;
  } catch (error) {
    setMessage(message, readableError(error), true);
  }
}

slotsBox.addEventListener('click', (event) => {
  const button = event.target.closest('[data-slot]');
  if (!button) return;
  chosen = { slotId: button.dataset.slot, displayName: button.dataset.name };
  document.querySelector('#joinChosenName').textContent = `Sei ${chosen.displayName}?`;
  stepName.hidden = true;
  stepConfirm.hidden = false;
  setMessage(confirmMessage, '');
  stepConfirm.querySelector('[name="birthDate"]').focus();
});

stepConfirm.addEventListener('input', aggiornaAnteprimaNumero);
stepConfirm.addEventListener('change', () => {
  const scelto = String(new FormData(stepConfirm).get('phonePrefix') || '');
  const altro = stepConfirm.querySelector('[data-phone-custom]');
  if (altro) {
    altro.hidden = scelto !== 'altro';
    if (scelto === 'altro') altro.querySelector('input')?.focus();
  }
  aggiornaAnteprimaNumero();
});

document.querySelector('#joinBack').addEventListener('click', () => {
  chosen = null;
  stepConfirm.hidden = true;
  stepName.hidden = false;
  setMessage(confirmMessage, '');
});

stepConfirm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!chosen) return;
  const fields = new FormData(stepConfirm);
  const birthDate = String(fields.get('birthDate') || '');
  const phone = String(fields.get('phone') || '').trim();
  if (!birthDate) {
    setMessage(confirmMessage, 'Inserisci la tua data di nascita.', true);
    return;
  }
  const numero = numeroInternazionale(prefissoScelto(fields), phone);
  if (!numero) {
    setMessage(confirmMessage, 'Questo numero non mi torna. Controlla il prefisso e scrivi il numero senza, per esempio 333 1234567.', true);
    return;
  }
  const submit = document.querySelector('#joinSubmit');
  submit.disabled = true;
  setMessage(confirmMessage, 'Controllo i dati…');
  try {
    const { data } = await claimSlot({
      boatId,
      linkKey,
      slotId: chosen.slotId,
      birthDate,
      phone: numero,
      preferredLocale: document.documentElement.lang === 'en' ? 'en' : 'it',
    });
    setMessage(confirmMessage, 'Sei tu. Apro la tua area personale…');
    const url = new URL('participant.html', window.location.href);
    url.searchParams.set('invite', data.inviteId);
    url.searchParams.set('boat', boatId);
    url.searchParams.set('key', data.accessKey);
    url.searchParams.set('lang', document.documentElement.lang === 'en' ? 'en' : 'it');
    window.location.replace(url.toString());
  } catch (error) {
    submit.disabled = false;
    setMessage(confirmMessage, readableError(error), true);
  }
});

start();

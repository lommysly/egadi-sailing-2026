// Il prefisso internazionale è un campo a parte, non una cosa da indovinare.
//
// Il numero di telefono non è un dato come gli altri: da lì si calcola
// l'identità con cui una persona entra nella propria area. Scriverlo in due
// modi diversi in due schermate diverse significa non entrare più, e il sito
// rispondeva «questo invito è scaduto, è stato sostituito oppure è già stato
// attivato» — tre ipotesi in una frase, nessuna delle quali vera.
//
// È successo davvero il 3-4 ottobre 2026 su Carpe Diem: Cristina Della
// Moretta e Stefano Arpini hanno scritto "348 565 7591" come lo scrive
// chiunque, e sono rimasti fuori. Poi hanno riferito in chat che l'invito era
// scaduto, mentre era valido per altre due settimane.
//
// Questo modulo tiene insieme le tre schermate che chiedono un numero
// (attivazione dell'invito, accesso con numero e codice, link unico di barca)
// così la stessa persona scrive il proprio numero sempre allo stesso modo.

export const PREFISSI = Object.freeze([
  ['+39', 'Italia'],
  ['+41', 'Svizzera'],
  ['+33', 'Francia'],
  ['+34', 'Spagna'],
  ['+49', 'Germania'],
  ['+44', 'Regno Unito'],
  ['+43', 'Austria'],
  ['+32', 'Belgio'],
  ['+31', 'Paesi Bassi'],
  ['+1', 'USA / Canada'],
]);

const pulisci = (valore) => String(valore || '').trim().replace(/[ .()\-\/]/g, '');

// Il numero completo, oppure stringa vuota se non si riesce a comporre.
// Quello che la persona scrive nel campo numero vince sempre: se ha scritto
// anche il prefisso, è più probabile che sappia il proprio di quanto sia
// probabile che abbia cambiato la tendina per sbaglio.
export function numeroInternazionale(prefisso, numero) {
  const parte = pulisci(numero);
  if (/^\+[1-9]\d{7,14}$/.test(parte)) return parte;
  if (/^00[1-9]\d{7,14}$/.test(parte)) return `+${parte.slice(2)}`;
  const pre = pulisci(prefisso).replace(/^00/, '+');
  if (!/^\+[1-9]\d{0,3}$/.test(pre)) return '';
  // Uno zero iniziale del numero nazionale va tolto: il prefisso lo sostituisce.
  const nazionale = parte.replace(/^0+/, '');
  if (!/^[1-9]\d{5,13}$/.test(nazionale)) return '';
  const completo = `${pre}${nazionale}`;
  return /^\+[1-9]\d{7,14}$/.test(completo) ? completo : '';
}

// Divide un numero già completo nei due campi, per riproporlo a chi torna
// indietro senza fargli riscrivere tutto.
export function dividiNumero(completo) {
  const pulito = pulisci(completo);
  if (!/^\+[1-9]\d{7,14}$/.test(pulito)) return { prefisso: '+39', numero: '' };
  const trovato = PREFISSI.map(([p]) => p)
    .filter((p) => pulito.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return trovato
    ? { prefisso: trovato, numero: pulito.slice(trovato.length) }
    : { prefisso: 'altro', numero: pulito };
}

export function markupPrefisso({ etichetta = 'Prefisso', nome = 'phonePrefix', scelto = '+39' } = {}) {
  const opzioni = PREFISSI
    .map(([codice, paese]) => `<option value="${codice}"${codice === scelto ? ' selected' : ''}>${codice} ${paese}</option>`)
    .join('');
  return `<label class="phone-prefix-field">${etichetta}
    <select name="${nome}" required>${opzioni}<option value="altro"${scelto === 'altro' ? ' selected' : ''}>Altro prefisso…</option></select>
  </label>`;
}

// Collega i due campi: mostra "Altro prefisso" solo quando serve e tiene
// aggiornata l'anteprima del numero che il sito ha capito. L'anteprima esiste
// perché un numero sbagliato si deve vedere PRIMA di premere, non dopo essere
// rimasti fuori.
export function collegaCampiNumero(form, { anteprima = '[data-phone-preview]' } = {}) {
  if (!form || form.dataset.phonePrefixBound === 'true') return;
  form.dataset.phonePrefixBound = 'true';
  const riquadro = form.querySelector(anteprima);
  const leggi = () => {
    const campi = new FormData(form);
    const scelto = String(campi.get('phonePrefix') || '');
    const prefisso = scelto === 'altro' ? String(campi.get('phonePrefixCustom') || '') : scelto;
    return numeroInternazionale(prefisso, campi.get('phone'));
  };
  const aggiorna = () => {
    const scelto = String(new FormData(form).get('phonePrefix') || '');
    const altro = form.querySelector('[data-phone-custom]');
    if (altro) altro.hidden = scelto !== 'altro';
    if (!riquadro) return;
    const numero = leggi();
    riquadro.textContent = numero
      ? `Entrerai con questo numero: ${numero}`
      : 'Scrivi il numero senza il prefisso: quello lo scegli qui accanto.';
  };
  form.addEventListener('input', aggiorna);
  form.addEventListener('change', aggiorna);
  aggiorna();
  return leggi;
}

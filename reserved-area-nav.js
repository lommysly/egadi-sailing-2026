// L'intestazione del sito (Il viaggio, Flottiglia, Passage Plan, Il film...)
// e i menu dedicati di ciascuna area riservata (skipper, equipaggio, gestore
// transfer) sono due esperienze diverse: la prima serve a chi sfoglia il
// sito pubblico, la seconda a chi sta lavorando dentro uno strumento. Tenerle
// insieme mescola le due cose (richiesta esplicita del titolare, 25/09/2026).
// Questa funzione va richiamata SOLO quando l'accesso alla specifica area
// riservata è già confermato (non al semplice tentativo di login), da
// crew-session.js (equipaggio: crew-login/participant/travel/my-area),
// area.js (skipper) e transfer.js (gestore transfer).
export function simplifyReservedAreaNavigation() {
  const nav = document.querySelector('#primary-menu');
  if (nav && nav.dataset.reservedAreaSimplified !== 'true') {
    nav.dataset.reservedAreaSimplified = 'true';
    const isEnglish = document.documentElement.lang === 'en';
    const label = isEnglish ? 'Public website' : 'Sito pubblico';
    const href = isEnglish ? 'index.html?lang=en' : 'index.html';
    nav.innerHTML = `<a href="${href}">${label}</a>`;
  }
  // Il piede di pagina del sito pubblico (Flottiglia, Passage Plan, Il film,
  // il logo che riporta a index.html...) restava identico anche dentro
  // l'area riservata: proprio i link "Arrivi & partenze" lì in fondo, con lo
  // stesso nome della sezione privata ma diversi, facevano uscire dall'area
  // per sbaglio (richiesta esplicita del titolare, 27/09/2026). L'unica via
  // di uscita resta il link "Sito pubblico" nel menu sopra.
  document.querySelector('.site-footer')?.setAttribute('hidden', '');
  insertBlastBrandNote();
}

// Egadi Sailing Experience è di fatto un "Blast" gestito qui in anteprima,
// in attesa che l'app That's A Blast possa coprirlo del tutto (richiesta del
// titolare, 28/09/2026): un piccolo richiamo al brand, senza link cliccabile
// (l'area riservata non deve invitare a uscire mentre si sta compilando
// qualcosa — quello resta solo sul sito pubblico).
function insertBlastBrandNote() {
  if (document.querySelector('.blast-brand-note')) return;
  const isEnglish = document.documentElement.lang === 'en';
  const text = isEnglish
    ? 'Egadi Sailing Experience is a Blast. You are managing it here as a preview — the <strong>That’s A Blast</strong> app already does this and much more: group chat, shared provisions, expenses and rides, all in one place.'
    : 'Egadi Sailing Experience è un Blast. Lo stai gestendo qui in anteprima — l’app <strong>That’s A Blast</strong> fa già questo e molto di più: chat di gruppo, cambusa condivisa, spese e passaggi, tutto in un unico posto.';
  const note = document.createElement('aside');
  note.className = 'blast-brand-note';
  note.innerHTML = `
    <svg viewBox="0 0 200 200" width="26" height="26" aria-hidden="true">
      <defs>
        <linearGradient id="blastA" x1="175" y1="15" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#20C9BA" stop-opacity="0"/><stop offset="30%" stop-color="#20C9BA" stop-opacity=".55"/><stop offset="100%" stop-color="#20C9BA"/></linearGradient>
        <linearGradient id="blastB" x1="20" y1="170" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#7B61FF" stop-opacity="0"/><stop offset="38%" stop-color="#7B61FF" stop-opacity=".5"/><stop offset="100%" stop-color="#20C9BA" stop-opacity=".92"/></linearGradient>
        <linearGradient id="blastC" x1="15" y1="68" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#20C9BA" stop-opacity="0"/><stop offset="44%" stop-color="#20C9BA" stop-opacity=".36"/><stop offset="100%" stop-color="#20C9BA" stop-opacity=".8"/></linearGradient>
      </defs>
      <path d="M 175 15 C 192 68,148 88,100 100" stroke="url(#blastA)" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M 22 172 C 28 126,62 110,100 100" stroke="url(#blastB)" stroke-width="5.5" fill="none" stroke-linecap="round"/>
      <path d="M 15 68 C 38 46,72 66,100 100" stroke="url(#blastC)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="100" cy="100" r="8" fill="#20C9BA"/>
      <circle cx="100" cy="100" r="3" fill="#FFFFFF"/>
    </svg>
    <p>${text}</p>
  `;
  document.body.append(note);
}

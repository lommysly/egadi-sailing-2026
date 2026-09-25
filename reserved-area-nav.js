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
  if (!nav || nav.dataset.reservedAreaSimplified === 'true') return;
  nav.dataset.reservedAreaSimplified = 'true';
  const isEnglish = document.documentElement.lang === 'en';
  const label = isEnglish ? 'Public website' : 'Sito pubblico';
  const href = isEnglish ? 'index.html?lang=en' : 'index.html';
  nav.innerHTML = `<a href="${href}">${label}</a>`;
}

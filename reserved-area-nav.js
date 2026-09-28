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
  insertBlastExperience();
}

// Egadi non deve apparire come un sito isolato: il modulo racconta in modo
// esplicito che è un Blast e invita a conoscere la Beta. I link aprono in una
// nuova scheda, così nessuno perde una compilazione o il proprio accesso.
export function blastExperienceMarkup(locale = 'it') {
  const isEnglish = locale === 'en';
  const copy = isEnglish
    ? {
      eyebrow: 'BEHIND THIS EXPERIENCE: THAT’S A BLAST',
      title: 'Egadi is a Blast.<br /><em>The trip starts before you set sail.</em>',
      lead: 'This private area is the trip’s control room. That’s A Blast is the app built on the same idea: keeping people, plans, shared provisions, expenses and rides together — without leaving everything in an endless group chat.',
      featureOneTitle: 'The group',
      featureOneText: 'People, updates and decisions in one shared space.',
      featureTwoTitle: 'The provisions',
      featureTwoText: 'What to bring, buy and split before getting on board.',
      featureThreeTitle: 'The journey',
      featureThreeText: 'Shared expenses, rides and useful details that do not get lost.',
      betaAction: 'Become a Beta tester',
      siteAction: 'Discover That’s A Blast',
      closing: 'Egadi is one of the crews helping us test the app in the real world.',
    }
    : {
      eyebrow: 'DIETRO QUESTA ESPERIENZA: THAT’S A BLAST',
      title: 'Egadi è un Blast.<br /><em>Il viaggio inizia prima di salpare.</em>',
      lead: 'Questa area è la regia del viaggio. That’s A Blast è l’app costruita sulla stessa idea: tenere insieme persone, piani, cambusa, spese e passaggi — senza lasciare tutto in una chat infinita.',
      featureOneTitle: 'Il gruppo',
      featureOneText: 'Persone, avvisi e decisioni nello stesso spazio.',
      featureTwoTitle: 'La cambusa',
      featureTwoText: 'Cose da portare, da comprare e da dividere prima dell’imbarco.',
      featureThreeTitle: 'Il viaggio',
      featureThreeText: 'Spese condivise, passaggi e dettagli utili che non vanno persi.',
      betaAction: 'Diventa Beta tester',
      siteAction: 'Scopri That’s A Blast',
      closing: 'Egadi è uno degli equipaggi che ci aiuta a provare l’app sul campo.',
    };

  return `
    <div class="blast-experience-inner">
      <div class="blast-experience-orbit" aria-hidden="true">
        <svg viewBox="0 0 200 200" focusable="false">
          <defs>
            <linearGradient id="blastExperienceA" x1="175" y1="15" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#20C9BA" stop-opacity="0"/><stop offset="30%" stop-color="#20C9BA" stop-opacity=".55"/><stop offset="100%" stop-color="#20C9BA"/></linearGradient>
            <linearGradient id="blastExperienceB" x1="20" y1="170" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#7B61FF" stop-opacity="0"/><stop offset="38%" stop-color="#7B61FF" stop-opacity=".5"/><stop offset="100%" stop-color="#20C9BA" stop-opacity=".92"/></linearGradient>
            <linearGradient id="blastExperienceC" x1="15" y1="68" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#20C9BA" stop-opacity="0"/><stop offset="44%" stop-color="#20C9BA" stop-opacity=".36"/><stop offset="100%" stop-color="#20C9BA" stop-opacity=".8"/></linearGradient>
          </defs>
          <path d="M 175 15 C 192 68,148 88,100 100" stroke="url(#blastExperienceA)" stroke-width="11" fill="none" stroke-linecap="round"/>
          <path d="M 22 172 C 28 126,62 110,100 100" stroke="url(#blastExperienceB)" stroke-width="8" fill="none" stroke-linecap="round"/>
          <path d="M 15 68 C 38 46,72 66,100 100" stroke="url(#blastExperienceC)" stroke-width="6" fill="none" stroke-linecap="round"/>
          <circle cx="100" cy="100" r="11" fill="#20C9BA"/>
          <circle cx="100" cy="100" r="5" fill="#FFFFFF"/>
        </svg>
        <span>That’s<br />A Blast</span>
      </div>
      <div class="blast-experience-copy">
        <p class="eyebrow">${copy.eyebrow}</p>
        <h2 id="blastExperienceTitle">${copy.title}</h2>
        <p class="blast-experience-lead">${copy.lead}</p>
        <ul class="blast-experience-features">
          <li><span class="blast-experience-number">01</span><span><strong>${copy.featureOneTitle}</strong><small>${copy.featureOneText}</small></span></li>
          <li><span class="blast-experience-number">02</span><span><strong>${copy.featureTwoTitle}</strong><small>${copy.featureTwoText}</small></span></li>
          <li><span class="blast-experience-number">03</span><span><strong>${copy.featureThreeTitle}</strong><small>${copy.featureThreeText}</small></span></li>
        </ul>
        <div class="blast-experience-actions">
          <a class="button blast-experience-primary" href="https://thatsablast.it/beta#form" target="_blank" rel="noopener noreferrer">${copy.betaAction}<span aria-hidden="true">↗</span></a>
          <a class="blast-experience-secondary" href="https://thatsablast.it/" target="_blank" rel="noopener noreferrer">${copy.siteAction}<span aria-hidden="true">→</span></a>
        </div>
        <p class="blast-experience-closing">${copy.closing}</p>
      </div>
    </div>
  `;
}

function insertBlastExperience() {
  if (document.querySelector('.blast-experience')) return;
  const isEnglish = document.documentElement.lang === 'en';
  const card = document.createElement('section');
  card.className = 'blast-experience';
  card.dataset.locale = isEnglish ? 'en' : 'it';
  card.setAttribute('aria-labelledby', 'blastExperienceTitle');
  card.innerHTML = blastExperienceMarkup(isEnglish ? 'en' : 'it');
  (document.querySelector('main') || document.body).append(card);
}

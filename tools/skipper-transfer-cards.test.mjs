import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { assertLoadsVersionedAsset, assertOneVersionPerAsset } from './asset-version-utils.mjs';

const html = await readFile(new URL('../area.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../area.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const rosterSource = await readFile(new URL('../boat-roster.js', import.meta.url), 'utf8');

test('i viaggi equipaggio usano card compatte coerenti su desktop e mobile', () => {
  assert.match(styles, /\.crew-travel-list \{[^}]*grid-template-columns:repeat\(auto-fill,minmax\(280px,320px\)\)/);
  assert.match(styles, /@media \(max-width:560px\)[\s\S]*\.crew-travel-list \{ grid-template-columns:minmax\(0,320px\); \}/);
  assert.match(styles, /@media \(max-width:560px\)[\s\S]*\.crew-travel-overview \{ padding:0; border:0; background:transparent; \}/);
  // Le card non si disegnano più dentro area.js: vivono in boat-roster.js,
  // così skipper ed equipaggio vedono le stesse.
  const roster = rosterSource;
  assert.match(roster, /class="crew-travel-card crew-travel-card--\$\{sintesi\.tono\}/);
  assert.match(source, /<div class="crew-travel-list">\$\{rosterMarkup\(rosterRows/);
});

test('le card mantengono stati leggibili anche attraverso il colore di sfondo', () => {
  for (const tone of ['attention', 'planning', 'confirmed', 'cancelled']) {
    assert.match(styles, new RegExp(`\\.crew-travel-card--${tone} \\{ --crew-travel-card-bg:#[0-9a-f]{6}; --crew-travel-card-border:#[0-9a-f]{6}; \\}`));
  }
  assert.match(styles, /\.crew-travel-card \{ --crew-travel-card-bg:#[0-9a-f]{6}; --crew-travel-card-border:#[0-9a-f]{6};/);
});

test('ogni contatto valido dispone di WhatsApp diretto con testo contestuale', () => {
  assert.match(source, /function crewTravelContactMessage\(member\)/);
  assert.match(source, /function crewTravelContactUrl\(member\)/);
  assert.equal(
    (source.match(/const number = paymentRecipientWhatsappNumber\(member\.id\);/g) || []).length,
    2,
  );
  assert.match(source, /Sollecita su WhatsApp/);
  assert.match(source, /Scrivi su WhatsApp/);
  assert.match(source, /Contatta su WhatsApp/);
  assert.match(source, /Numero WhatsApp non disponibile/);
  assert.match(source, /rel="noopener noreferrer"/);
});

test('solo chi dispone di un invito personale entra nelle card viaggio', () => {
  assert.match(source, /function crewTravelMembers\(\)/);
  assert.match(source, /return invite && invite\.status !== 'revoked'/);
  assert.equal((source.match(/crewTravelOverviewCards\(\)/g) || []).length >= 3, true);
  assert.match(source, /renderInvites\(\)[\s\S]*renderCrewTravelOverview\(\)/);
});

// Fino al 4/10/2026 qui c'erano due gruppi di card: chi va sollecitato e
// "Tutti gli altri". Il secondo ripeteva una per una le persone già elencate
// sopra con i loro orari — sette persone, quattordici righe — e Silvio l'ha
// segnalato come un doppione. Ora l'elenco della barca porta da sé lo stato del
// transfer e il tasto per scrivere, e le card restano solo per chi va davvero
// sollecitato.
test('una sola griglia di card: tutto l’equipaggio, una volta', () => {
  // Le card vivono in un posto solo: Viaggio e comunicazioni. Fino al
  // 5/10/2026 la pagina ne aveva una seconda copia in cima alla vista
  // Equipaggio, sopra l'elenco dei posti: le stesse persone due volte nella
  // stessa schermata, card e righe lunghe. Lì resta soltanto il rimando.
  assert.doesNotMatch(html, /data-crew-travel-overview/);
  assert.doesNotMatch(html, /id="crewTravelOverview"/);
  assert.equal((source.match(/dataset\.crewTravelOverview = ''/g) || []).length, 1);
  assert.match(html, /class="crew-roster-pointer"[^>]*>[^<]*<button[^>]*data-skipper-view="operations"[^>]*data-operations-view="crew"/);
  assert.match(source, /operationsCrewTravelOverview\.id = 'crewTravelOverviewOperations'/);
  assert.match(source, /querySelectorAll\('\[data-crew-travel-overview\]'\)/);
  // Nessun secondo elenco con le stesse persone, né sopra né sotto: "è
  // assurdo metterlo due volte" (Silvio, 4/10/2026).
  assert.doesNotMatch(source, /title: 'Tutti gli altri'/);
  assert.doesNotMatch(source, /submittedCards/);
  assert.doesNotMatch(source, /const solleciti = /);
  assert.doesNotMatch(source, /data-crew-travel-group=/);
  assert.equal((source.match(/rosterMarkup\(/g) || []).length, 1);
});

test('nessuno sparisce dalla vista dello skipper togliendo le card', () => {
  // Chi non ha mai aperto il modulo viaggio non ha una riga di stato: se
  // l'elenco nascesse solo dalle righe di stato, quella persona non la
  // vedrebbe più nessuno. Nasce invece dall'elenco dell'equipaggio.
  assert.match(source, /\.\.\.members\.map\(\(member\) => \(\{\s*\.\.\.\(crewTravelStatusFor\(member\.id\) \|\| \{\}\),\s*id: member\.id,\s*displayName: memberName\(member\),/);
});

test('ogni card dice da sé se c’è da sollecitare', () => {
  assert.match(source, /rosterMarkup\(rosterRows, \{ currentId: 'skipper', azione: cardAction \}\)/);
  // Il tasto cambia con lo stato: sollecita se la richiesta è rimasta a
  // metà, scrivi altrimenti.
  const azione = source.slice(source.indexOf('const cardAction = (voce) => {'), source.indexOf('const daSollecitare'));
  assert.match(azione, /card\.needsReminder && card\.presentation\.tone !== 'cancelled'/);
  assert.match(azione, /crewTravelReminderUrl\(card\.member, card\.legStates\)/);
  // Lo skipper non ha un tasto per scriversi da solo.
  // Lo skipper non scrive WhatsApp a se stesso; può annullare la propria tratta.
  assert.match(azione, /if \(voce\.isSkipper === true\) return cancellations \? groupedActions\(cancellations\) : '';/);
});

// Il test precedente confrontava `styles.css`/`area.js` con una stringa di
// versione fissa: diceva "la versione è quella di ieri", non "la versione è
// aggiornata", e nessun test può sapere quale sia quella giusta oggi. Resta
// però vero che le card viaggio di questa pagina sono inutili se l'utente le
// riceve dalla cache vecchia: quello che si può verificare davvero è che
// area.html non carichi mai quei due file senza `?v=`, e che la stringa che usa
// sia la stessa delle altre pagine (un `?v=` aggiornato solo qui o solo altrove
// è l'errore del 22/9/2026 descritto in AGENTS.md).
test('area skipper carica CSS e JS versionati, allineati alle altre pagine', () => {
  assertLoadsVersionedAsset(assert, html, 'styles.css', 'area.html');
  assertLoadsVersionedAsset(assert, html, 'area.js', 'area.html');
  assertOneVersionPerAsset(assert);
});

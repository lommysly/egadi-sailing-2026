import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Il 2/10/2026 il transfer ha cambiato natura: non è più previsto d'ufficio,
// si chiede. Chi non lo chiede ci arriva per conto suo e non è un lavoro per
// nessuno. Questi test esistono perché il modello vecchio era sparso su
// cinque file: basta che uno torni indietro perché il sito ricominci a
// chiamare "incompleto" chi ha semplicemente deciso di prendersi un taxi.

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const travel = read('travel.js');
const area = read('area.js');
const myArea = read('my-area.js');
const transfer = read('transfer.js');

test('il modulo parte da "ci arrivo per conto mio", non da una scelta vuota', () => {
  assert.match(travel, /airportMarsalaChoice: 'independent'/);
  assert.doesNotMatch(travel, /airportMarsalaChoice: '',/);
});

test('nessuno sceglie il transfer al posto della persona', () => {
  // La vecchia pre-selezione automatica riempiva la scelta per chi volava su
  // Trapani o Palermo, e lasciava tutti in attesa del consenso.
  assert.doesNotMatch(travel, /autoSelectAirportTransferChoice/);
  // Il transfer si seleziona da solo in un punto soltanto: quando la persona
  // preme il pulsante dell'avviso.
  assert.equal((travel.match(/choiceField\.value = 'transfer'/g) || []).length, 1);
  const handler = travel.slice(travel.indexOf("form.querySelector('[data-transfer-request]')?.addEventListener"));
  assert.match(handler.slice(0, 400), /choiceField\.value = 'transfer'/);
});

test('il menu non offre più "non devo ancora indicarlo"', () => {
  assert.doesNotMatch(travel, /airportChoiceNone/);
  assert.doesNotMatch(travel, /<option value=""[^>]*>\$\{copy\.airportChoice/);
});

test('una tratta salvata senza scelta non lascia il menu in bianco', () => {
  assert.match(travel, /valueOr\(text\(source\.airportMarsalaChoice\), AIRPORT_MARSALA_CHOICES\) \|\| base\.airportMarsalaChoice/);
});

test('l’avviso dice che cosa succede adesso e porta il pulsante per chiedere il transfer', () => {
  assert.match(travel, /data-transfer-alert/);
  assert.match(travel, /data-transfer-request/);
  assert.match(travel, /A Marsala ci arrivi tu/);
  assert.match(travel, /All’aeroporto ci arrivi tu/);
  assert.match(travel, /You get to Marsala on your own/);
  // I tre stati dell'avviso: nessun transfer, chiesto a metà, richiesto.
  ['none', 'pending', 'ready'].forEach((tone) => {
    assert.match(read('styles.css'), new RegExp(`\\[data-transfer-alert-tone="${tone}"\\]`));
  });
});

test('nell’area skipper resta un solo stato da seguire', () => {
  assert.match(area, /const CREW_TRAVEL_NEEDS_REMINDER = new Set\(\['transfer_pending'\]\);/);
  // Chi non ha chiesto niente non è più un allarme da sollecitare.
  assert.doesNotMatch(area, /missing: \{ icon: '•', text: 'Da inserire' \}/);
  assert.match(area, /missing: \{ icon: '–', text: 'Ci arriva per conto suo' \}/);
});

test('lo stato della tratta si legge dal transfer, non dallo stato del viaggio', () => {
  const state = area.slice(area.indexOf('function crewTravelLegState'), area.indexOf('function crewTravelReminderMessage'));
  assert.match(state, /const transferState = status\?\.\[`\$\{direction\}Transfer`\]/);
  assert.match(state, /if \(transferState === 'undecided'\) return 'transfer_pending'/);
  // Lo stato del viaggio non decide più se il transfer è "da completare".
  assert.doesNotMatch(state, /tripState/);
});

test('il sollecito parla di una richiesta mai partita, non di dati da completare', () => {
  assert.match(area, /manca la spunta del consenso/);
  assert.doesNotMatch(area, /non hai ancora scelto il collegamento aeroporto/);
});

test('nella mia attività il transfer non chiesto è una scelta, non un allarme', () => {
  const progress = myArea.slice(myArea.indexOf('function crewTravelProgress'), myArea.indexOf('function crewTransferPaidNote'));
  assert.match(progress, /a Marsala ci arrivi tu/);
  assert.match(progress, /transfer da completare/);
  assert.doesNotMatch(progress, /collegamento da scegliere/);
  // Restano due soli allarmi, entrambi su richieste vere: quella rimasta a
  // metà e quella annullata dal gestore. Non aver chiesto niente non è più
  // uno di questi.
  assert.equal((progress.match(/item\(\s*'attention'/g) || []).length, 2);
  assert.match(progress, /transfer annullato/);
});

test('la console organizzatore non conta più lo skipper senza transfer come un buco', () => {
  assert.doesNotMatch(transfer, /boatChecklistSkipperTransfer/);
  assert.doesNotMatch(transfer, /skipperNeedsFollowUp/);
  assert.match(transfer, /ci arrivano per conto loro/);
});

test('il messaggio allo skipper spiega una volta come funziona, invece di rincorrere', () => {
  assert.match(transfer, /il transfer va chiesto, nessuno lo prenota d'ufficio/);
  assert.match(transfer, /the transfer has to be requested/);
  assert.doesNotMatch(transfer, /non hanno ancora deciso/);
});

test('l’avviso sta fuori dai pannelli a passi: si vede appena apri la tratta', () => {
  const card = travel.slice(travel.indexOf('<form id="${formId}" novalidate>'), travel.indexOf('data-travel-step-panel="trip"'));
  // Deve comparire prima del primo pannello a passi, altrimenti resta
  // nascosto dentro "Collegamento aeroporto" finché non lo si apre.
  assert.match(card, /data-transfer-alert/);
  assert.match(card, /data-travel-step-nav/);
  assert.equal(card.indexOf('data-transfer-alert') < card.indexOf('data-travel-step-nav'), true);
});

test('chiedere il transfer apre anche il passo dove sta il consenso', () => {
  const handler = travel.slice(travel.indexOf("form.querySelector('[data-transfer-request]')?.addEventListener"));
  assert.match(handler.slice(0, 600), /setTravelStep\(form\.closest\('details'\), 'connection'\)/);
});

// Gli orari di arrivo sono una domanda diversa dal transfer: servono a sapere
// quando la barca può salpare. Restano separati nella card e, soprattutto,
// restano minimi: lo skipper non deve poter leggere il resto del viaggio.
test('allo skipper arrivano data, ora e mezzo — e nient’altro del viaggio', () => {
  const functions = read('functions/index.js');
  const fields = functions.slice(functions.indexOf('function crewScheduleFields'), functions.indexOf('async function writeCrewTravelStatus'));
  assert.match(fields, /\$\{direction\}Date/);
  assert.match(fields, /\$\{direction\}Time/);
  assert.match(fields, /\$\{direction\}Transport/);
  ['carrier', 'serviceNumber', 'originAirport', 'destinationAirport', 'luggageCount', 'originCity', 'destinationCity'].forEach((campo) => {
    assert.doesNotMatch(fields, new RegExp(`leg\\.${campo}`), `lo skipper non deve vedere ${campo}`);
  });
});

test('in andata conta quando arriva, al rientro quando riparte', () => {
  const functions = read('functions/index.js');
  const fields = functions.slice(functions.indexOf('function crewScheduleFields'), functions.indexOf('async function writeCrewTravelStatus'));
  assert.match(fields, /direction === 'return' \? leg\.departureDate : leg\.arrivalDate/);
  assert.match(fields, /direction === 'return' \? leg\.departureTime : leg\.arrivalTime/);
});

test('la riga orari è separata dai badge del transfer e non è un allarme', () => {
  assert.match(area, /function crewTravelSchedule\(status, direction\)/);
  assert.match(area, /crew-travel-card-legs[\s\S]{0,120}\$\{scheduleLine\(schedule\)\}/);
  assert.match(area, /non comunicato/);
  // Nessun tono d'allarme: un orario mancante è informazione, non colpa.
  const styles = read('styles.css');
  assert.match(styles, /\.crew-travel-when-entry--unknown \{[^}]*font-style:italic/);
});

test('la persona sa esattamente che cosa vede il suo skipper', () => {
  assert.match(travel, /skipperSeesSchedule/);
  assert.match(travel, /lo skipper vede soltanto quando arrivi, quando riparti e con che mezzo/);
  assert.match(read('PRIVACY_DA_COMPLETARE.md'), /crewTravel\/\{inviteId\}\/legs` resta owner-only/);
});

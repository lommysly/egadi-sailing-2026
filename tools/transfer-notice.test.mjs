import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { showTransferNotice, transferNoticeContact, transferNoticeLegs, transferNoticeMarkup, transferNoticeSignature } from '../transfer-notice.js';

// Richiesta di Silvio alla vigilia degli arrivi (7/10/2026): chi entra
// nell'area riservata deve trovarsi davanti il proprio transfer — orario e
// punto di ritrovo decisi dal gestore — senza andarlo a cercare nella pagina.

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const confirmed = {
  outboundTransfer: 'requested', outboundOperationStatus: 'confirmed', outboundDate: '2026-10-08', outboundTime: '12:55',
  outboundTransport: 'flight', outboundMeetingTime: '14:30', outboundMeetingPoint: 'Hall Arrivi',
};

test('compare solo per le tratte con un transfer richiesto e ancora da fare', () => {
  assert.deepEqual(transferNoticeLegs(null), []);
  assert.deepEqual(transferNoticeLegs({ outboundTransfer: 'not_requested', returnTransfer: 'undecided' }), []);
  // Una tratta conclusa o una richiesta non più attiva non ha niente da dire.
  assert.deepEqual(transferNoticeLegs({ outboundTransfer: 'requested', outboundOperationStatus: 'completed' }), []);
  assert.deepEqual(transferNoticeLegs({ outboundTransfer: 'requested', outboundOperationStatus: 'revoked' }), []);
  const legs = transferNoticeLegs({ ...confirmed, returnTransfer: 'requested', returnDate: '2026-10-11', returnTime: '21:30' });
  assert.deepEqual(legs.map((leg) => [leg.direction, leg.operation]), [['outbound', 'confirmed'], ['return', 'new']]);
});

test('transfer confermato: orario e punto di ritrovo, più il proprio volo', () => {
  const html = transferNoticeMarkup(transferNoticeLegs(confirmed));
  assert.match(html, /Il tuo transfer/);
  assert.match(html, /Andata · giovedì 8 ottobre/);
  assert.match(html, /transfer-notice-status">Confermato/);
  assert.match(html, /<small>Ritrovo alle<\/small><b>14:30<\/b>/);
  assert.match(html, /transfer-notice-point">Hall Arrivi/);
  assert.match(html, /Il tuo volo atterra alle 12:55\./);
  assert.doesNotMatch(html, /transfer-notice-warning/);
  // La data è scritta all'italiana, mai come è salvata.
  assert.doesNotMatch(html, /2026-10-08/);
});

test('richiesta non ancora confermata: lo dice, senza inventare un orario', () => {
  const html = transferNoticeMarkup(transferNoticeLegs({ returnTransfer: 'requested', returnDate: '2026-10-11', returnTime: '21:30', returnTransport: 'flight' }));
  assert.match(html, /Rientro · domenica 11 ottobre/);
  assert.match(html, /Richiesta ricevuta/);
  assert.match(html, /comparirà qui appena il gestore la conferma/);
  assert.match(html, /Il tuo volo parte alle 21:30\./);
  assert.doesNotMatch(html, /transfer-notice-pickup/);
});

test('transfer annullato: lo dice chiaro e rimanda allo skipper', () => {
  const html = transferNoticeMarkup(transferNoticeLegs({ ...confirmed, outboundOperationStatus: 'cancelled' }));
  assert.match(html, /transfer-notice-leg--cancelled/);
  assert.match(html, /Contatta il tuo skipper prima di partire/);
  assert.doesNotMatch(html, /14:30/);
});

test('ritrovo prima dell’atterraggio: la persona viene avvisata', () => {
  const legs = transferNoticeLegs({ ...confirmed, outboundTime: '21:10', outboundMeetingTime: '18:00' });
  assert.equal(legs[0].beforeLanding, true);
  assert.match(transferNoticeMarkup(legs), /transfer-notice-warning">Attenzione: il ritrovo risulta prima del tuo atterraggio/);
});

test('in inglese per chi usa l’area in inglese', () => {
  const html = transferNoticeMarkup(transferNoticeLegs(confirmed), true);
  assert.match(html, /Your transfer/);
  assert.match(html, /Outbound · Thursday 8 October/);
  assert.match(html, /<small>Pick-up at<\/small><b>14:30<\/b>/);
  assert.match(html, /Your flight lands at 12:55\./);
});

test('il testo scritto dal gestore non può iniettare codice nella pagina', () => {
  const html = transferNoticeMarkup(transferNoticeLegs({ ...confirmed, outboundMeetingPoint: '<img src=x onerror=alert(1)>' }));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

// Un documento finto quanto basta: la finestra vera è un <dialog> del browser.
function fakeDocument({ otherDialog = null } = {}) {
  const created = [];
  const doc = {
    created,
    body: { append: (element) => { element.isConnected = true; } },
    querySelector: () => otherDialog,
    createElement: () => {
      const element = {
        open: false, shown: 0, innerHTML: '', className: '', isConnected: false, onclose: null,
        setAttribute() {}, addEventListener() {},
        showModal() { this.open = true; this.shown += 1; },
        close() { this.open = false; this.onclose?.(); },
      };
      created.push(element);
      return element;
    },
  };
  return doc;
}
function fakeStorage() {
  const map = new Map();
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, value), map };
}

test('una volta per ingresso, e di nuovo quando il gestore cambia qualcosa', () => {
  // Il modulo tiene una sola finestra: i passi qui sotto la riusano apposta.
  const doc = fakeDocument();
  const storage = fakeStorage();
  const open = (status) => showTransferNotice({ status, scope: 'barca:persona', storage, doc });

  assert.equal(open(confirmed), true);
  const dialog = doc.created[0];
  assert.equal(dialog.open, true);
  assert.match(dialog.innerHTML, /14:30/);
  dialog.close();

  // Stessa informazione, stesso ingresso: non ricompare.
  assert.equal(open(confirmed), false);
  assert.equal(dialog.shown, 1);

  // Il gestore sposta il ritrovo: ricompare con l'orario nuovo.
  assert.equal(open({ ...confirmed, outboundMeetingTime: '15:00' }), true);
  assert.match(dialog.innerHTML, /15:00/);
  assert.equal(dialog.shown, 2);
  dialog.close();

  // Un'altra persona sullo stesso telefono ha la sua memoria.
  assert.equal(showTransferNotice({ status: confirmed, scope: 'barca:altra', storage, doc }), true);
  dialog.close();

  // Senza transfer richiesto non si apre niente.
  assert.equal(showTransferNotice({ status: { outboundTransfer: 'not_requested' }, scope: 'barca:terza', storage, doc }), false);
});

test('se è aperto il regolamento, aspetta che venga chiuso', () => {
  const storage = fakeStorage();
  const listeners = [];
  const rules = { addEventListener: (type, handler) => listeners.push([type, handler]) };
  const doc = fakeDocument({ otherDialog: rules });
  assert.equal(showTransferNotice({ status: { ...confirmed, outboundMeetingTime: '16:45' }, scope: 'barca:attesa', storage, doc }), false);
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0][0], 'close');
});

test('le due aree la aprono quando arriva lo stato del transfer', () => {
  const myArea = read('my-area.js');
  assert.match(myArea, /import \{ showTransferNotice \} from '\.\/transfer-notice\.js\?v=/);
  assert.match(myArea, /showTransferNotice\(\{\s*status: activeCrewTravelStatus,\s*english: activeLocale\(\) === 'en',\s*scope: `\$\{activeInvite\.boatId\}:\$\{activeInvite\.id\}`/);
  const area = read('area.js');
  assert.match(area, /showTransferNotice\(\{\s*status: activeCrewTravelStatus\.find\(\(entry\) => entry\.isSkipper === true \|\| entry\.id === 'skipper'\)/);
});

test('le note interne del gestore non arrivano mai all’equipaggio', () => {
  const functions = read('functions/index.js');
  const writer = functions.slice(functions.indexOf('async function writeCrewTransferOperationStatus'), functions.indexOf('exports.materializeCrewTravel'));
  assert.doesNotMatch(writer, /operatorNotes|vehicleName|groupName/);
  assert.doesNotMatch(read('transfer-notice.js').replace(/\/\/.*$/gm, ''), /operatorNotes|Notes\b/);
});

// Silvio, 7/10/2026: nella finestra ci va il numero del gestore dei transfer.
// Non sta nel codice del sito (lo leggerebbe chiunque): arriva dal server
// dentro lo stato di viaggio della persona.
test('il numero del gestore compare a chi ha un transfer già preso in carico', () => {
  const status = { ...confirmed, transferContactName: 'Giovanni', transferContactPhone: '+393209012100' };
  const legs = transferNoticeLegs(status);
  const contact = transferNoticeContact(status, legs);
  assert.deepEqual(contact, { name: 'Giovanni', phone: '+393209012100' });
  const html = transferNoticeMarkup(legs, false, contact);
  assert.match(html, /Per informazioni sul transfer: <strong>Giovanni<\/strong> · <span>\+39 320 901 2100<\/span>/);
  assert.match(html, /href="tel:\+393209012100">Chiama<\/a>/);
  assert.match(html, /href="https:\/\/wa\.me\/393209012100"/);
  assert.match(transferNoticeMarkup(legs, true, contact), /For transfer information:/);
});

test('niente numero a chi ha solo una richiesta non ancora presa in carico, o un transfer annullato', () => {
  const pending = { returnTransfer: 'requested', returnDate: '2026-10-11', returnTime: '21:30', transferContactPhone: '+393209012100' };
  assert.equal(transferNoticeContact(pending, transferNoticeLegs(pending)), null);
  const cancelled = { ...confirmed, outboundOperationStatus: 'cancelled', transferContactPhone: '+393209012100' };
  assert.equal(transferNoticeContact(cancelled, transferNoticeLegs(cancelled)), null);
  assert.doesNotMatch(transferNoticeMarkup(transferNoticeLegs(pending)), /transfer-notice-contact/);
});

test('un numero mancante o scritto male non viene mostrato', () => {
  const legs = transferNoticeLegs(confirmed);
  assert.equal(transferNoticeContact(confirmed, legs), null);
  assert.equal(transferNoticeContact({ ...confirmed, transferContactPhone: '3209012100' }, legs), null);
  assert.equal(transferNoticeContact({ ...confirmed, transferContactPhone: 'javascript:alert(1)' }, legs), null);
});

test('il numero non è scritto nel codice del sito: lo porta il server', () => {
  for (const name of ['transfer-notice.js', 'my-area.js', 'area.js', 'transfer.js']) {
    assert.doesNotMatch(read(name), /3209012100|320 901 2100/, name);
  }
  const functions = read('functions/index.js');
  assert.doesNotMatch(functions, /3209012100/);
  assert.match(functions, /integrations\/transferContact/);
  const writer = functions.slice(functions.indexOf('async function writeCrewTransferOperationStatus'), functions.indexOf('exports.materializeCrewTravel'));
  assert.match(writer, /transferContactName: contact\.name, transferContactPhone: contact\.phone/);
  // Il documento con il numero resta fuori dalla portata del browser.
  const rules = read('firestore.rules');
  const block = rules.slice(rules.indexOf('match /events/egadi-2026/integrations/{integrationId}'));
  assert.match(block.slice(0, 160), /allow read, write: if false;/);
});

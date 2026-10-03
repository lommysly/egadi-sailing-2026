import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Il link unico di barca è una chiave che apre tutta la barca, e dentro le
// schede ci sono documenti d'identità. Questi test sorvegliano i tre punti in
// cui la cosa resta sicura: il controllo sta sul server, non mostra niente
// prima di aver verificato, e i tentativi a vuoto si contano.

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const functions = read('functions/index.js');
const page = read('boat-link.js');

test('il controllo della data di nascita vive sul server, non nella pagina', () => {
  assert.match(functions, /slot\.birthDate !== birthDate/);
  // La pagina non deve mai vedere una data di nascita altrui per confrontarla.
  assert.doesNotMatch(page, /birthDate ===|birthDate !==/);
});

test('l’elenco mostra i nomi e nient’altro', () => {
  const lista = functions.slice(functions.indexOf('exports.listBoatLinkSlots'));
  assert.match(lista, /slotId: entry\.id, displayName/);
  ['birthDate', 'documentNumber', 'birthPlace', 'phone'].forEach((campo) => {
    assert.doesNotMatch(lista.slice(0, 2000), new RegExp(`${campo}`), `l'elenco non deve esporre ${campo}`);
  });
});

test('il blocco anti-forzatura scatta nel futuro, altrimenti non blocca', () => {
  // Bug trovato in collaudo: con serverTimestamp() il confronto
  // lockedUntil > adesso è sempre falso e la difesa resta inerte.
  assert.match(functions, /patch\.lockedUntil = new Date\(Date\.now\(\) \+ BOAT_LINK_LOCK_MINUTES/);
  assert.match(functions, /link\.lockedUntil\.toMillis\(\) > now/);
});

test('chi sbaglia non capisce quale dei dati fosse sbagliato', () => {
  const claim = functions.slice(functions.indexOf('exports.claimBoatLinkSlot'), functions.indexOf('exports.listBoatLinkSlots'));
  const messaggi = claim.match(/I dati non coincidono con nessuna persona/g) || [];
  assert.equal(messaggi.length, 1);
  assert.match(claim, /if \(!slot \|\| slot\.birthDate !== birthDate \|\| \(slotPhone && slotPhone !== phone\)\)/);
});

test('un numero già noto allo skipper entra nella verifica', () => {
  const claim = functions.slice(functions.indexOf('exports.claimBoatLinkSlot'), functions.indexOf('exports.listBoatLinkSlots'));
  assert.match(claim, /const slotPhone = slot \? normalizeCrewPhoneNumber\(slot\.phone\) : ''/);
  // Un numero memorizzato male non deve lasciare fuori una persona vera:
  // il controllo si applica solo se il numero in scheda è leggibile.
  assert.match(claim, /slotPhone && slotPhone !== phone/);
});

test('uno slot già assegnato non ricompare nell’elenco', () => {
  assert.match(functions, /const conAccesso = new Set\(invitesSnapshot\.docs\.map/);
  assert.match(functions, /\.filter\(\(entry\) => !conAccesso\.has\(entry\.id\)\)/);
});

test('alla persona non arriva nessun codice tecnico', () => {
  assert.match(page, /replace\(\/\\s\*\\\[\\d\{3\}\\\]\\s\*\$\/, ''\)/);
});

test('finito il controllo si consegna al flusso personale di sempre', () => {
  assert.match(page, /new URL\('participant\.html'/);
  assert.match(page, /url\.searchParams\.set\('invite', data\.inviteId\)/);
  assert.match(page, /url\.searchParams\.set\('key', data\.accessKey\)/);
});

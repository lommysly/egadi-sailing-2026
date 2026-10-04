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

// Il prefisso è un campo a parte, non una cosa da indovinare. Finché il campo
// era uno solo, chi scriveva "348 565 7591" veniva registrato come +34
// 85657591 — un numero spagnolo valido, con cui poi non riusciva più a
// entrare, perché l'identità di accesso si calcola proprio dal numero.
// Cristina Della Moretta e Stefano Arpini ci sono rimasti dentro il 3/10/2026.
test('il prefisso si sceglie, non si indovina', () => {
  const html = read('unisciti.html');
  assert.match(html, /<select name="phonePrefix" required>/);
  assert.match(html, /<option value="\+39" selected>/);
  assert.match(html, /name="phone"[^>]*placeholder="333 1234567"/);
  // Il vecchio campo unico col prefisso dentro non c'è più.
  assert.doesNotMatch(html, /name="phone"[^>]*placeholder="Es\. \+39/);
});

test('il numero si compone dai due campi, senza inventare prefissi', () => {
  const modulo = read('phone-prefix.js');
  assert.match(modulo, /export function numeroInternazionale\(prefisso, numero\)/);
  // Un prefisso che non è un prefisso non diventa un numero: meglio fermarsi
  // che registrare qualcuno con un'identità che non è la sua.
  assert.match(modulo, /if \(!\/\^\\\+\[1-9\]\\d\{0,3\}\$\/\.test\(pre\)\) return '';/);
});

test('tutte le schermate che chiedono un numero usano la stessa regola', () => {
  // Il numero è l'identità con cui si entra: scriverlo in due modi diversi in
  // due schermate diverse significa non entrare più. Era il caso di Cristina
  // Della Moretta e Stefano Arpini, 3-4/10/2026.
  ['boat-link.js', 'participant.js', 'crew-login.js'].forEach((file) => {
    const source = read(file);
    assert.match(source, /from '\.\/phone-prefix\.js/, `${file} non usa il modulo condiviso`);
    assert.match(source, /numeroInternazionale\(/, `${file} non compone il numero dai due campi`);
  });
  ['unisciti.html', 'participant.html', 'crew.html'].forEach((pagina) => {
    const html = read(pagina);
    assert.match(html, /name="phonePrefix"/, `${pagina} non ha il campo prefisso`);
    assert.match(html, /data-phone-preview/, `${pagina} non mostra il numero capito`);
    assert.doesNotMatch(html, /placeholder="Es\. \+39 333 1234567"/, `${pagina} ha ancora il campo unico`);
  });
});

test('la persona vede il numero che il sito ha capito, prima di premere', () => {
  assert.match(read('phone-prefix.js'), /Entrerai con questo numero: \$\{numero\}/);
});

test('il messaggio di errore non parla più di invito scaduto quando non lo è', () => {
  const testi = read('i18n-crew.js');
  assert.match(testi, /Il numero non corrisponde a quello con cui è stato creato questo accesso/);
  assert.doesNotMatch(testi, /Questo invito è scaduto, è stato sostituito/);
});

// Una scheda equipaggio può contenere SOLO le chiavi che le Rules ammettono.
// hasValidMemberPayload valuta il documento risultante, non i campi toccati:
// una marcatura in più scritta dal server rende quella scheda non più
// salvabile dalla persona, e l'errore che vede parla di connessione. È
// successo il 4/10/2026 a tutte e sette le persone entrate dal link di barca
// su Carpe Diem — Giuseppina Miccolis non riusciva a confermare i dati per il
// charter e la connessione non c'entrava niente.
test('la funzione non scrive nella scheda campi che le Rules non ammettono', () => {
  const rules = read('firestore.rules');
  const elenco = rules.slice(rules.indexOf('function hasValidMemberPayload'));
  const ammesse = new Set(
    (elenco.slice(elenco.indexOf('hasOnly(['), elenco.indexOf('])', elenco.indexOf('hasOnly(['))).match(/'([^']+)'/g) || [])
      .map((v) => v.replaceAll("'", '')),
  );
  assert.ok(ammesse.has('displayName') && ammesse.size > 10, 'elenco delle chiavi ammesse non riconosciuto');

  const functions = read('functions/index.js');
  const inizio = functions.indexOf('transaction.set(db.doc(`boats/${boatId}/members/${inviteId}`)');
  assert.ok(inizio > 0, 'scrittura della scheda non trovata');
  const blocco = functions.slice(inizio, functions.indexOf('});', inizio));
  const scritte = (blocco.match(/^\s*([a-zA-Z][a-zA-Z0-9]*):/gm) || []).map((v) => v.trim().replace(':', ''));
  const fuori = scritte.filter((chiave) => !ammesse.has(chiave));
  assert.deepEqual(fuori, [], `campi non ammessi nella scheda: ${fuori.join(', ')}`);
});

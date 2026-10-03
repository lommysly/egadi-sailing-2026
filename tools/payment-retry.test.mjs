import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

// withSaveRetry esiste per le reti lente: ritenta la stessa scrittura dopo
// 800, 1600 e 3200 ms. È sicuro soltanto con scritture che ricadono sempre
// sullo stesso documento — setDoc, updateDoc, transazioni, batch.
//
// addDoc no: genera un identificativo nuovo a ogni chiamata. Se la prima
// scrittura arriva al server ma la risposta si perde, la riprova crea un
// SECONDO documento. Il 2/10/2026 è costato due bonifici da 300 € a nome di
// Fabio Marcomin, a otto secondi l'uno dall'altro, e un annullamento a mano.

const ROOT = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const moduliDelSito = () => readdirSync(ROOT).filter((n) => n.endsWith('.js'));
// Il corpo di una funzione, delimitato dalla successiva dichiarazione: più
// affidabile di cercare una graffa a inizio riga, che compare anche dentro.
// I commenti spiegano il bug e ne nominano le cause: confrontare le
// posizioni nel testo commentato darebbe risultati falsi.
const senzaCommenti = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const corpoDi = (source, nome) => {
  const inizio = source.indexOf(`async function ${nome}`);
  const dopo = source.indexOf('\nasync function ', inizio + 1);
  const altra = source.indexOf('\nfunction ', inizio + 1);
  const fini = [dopo, altra].filter((n) => n > 0);
  return senzaCommenti(source.slice(inizio, fini.length ? Math.min(...fini) : undefined));
};

test('nessuna scrittura non ripetibile viene mai ritentata', () => {
  const colpevoli = [];
  for (const file of moduliDelSito()) {
    const righe = read(file).split('\n');
    righe.forEach((riga, i) => {
      if (!/withSaveRetry\(/.test(riga)) return;
      // Il corpo della funzione ritentata: si guarda una finestra generosa,
      // fino alla chiusura della chiamata.
      const finestra = righe.slice(i, i + 40).join('\n');
      const corpo = finestra.slice(0, finestra.indexOf('\n    );') + 1 || undefined);
      if (/\baddDoc\s*\(/.test(corpo)) colpevoli.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(colpevoli, [], `addDoc dentro withSaveRetry: una riprova creerebbe un documento in più — ${colpevoli.join(', ')}`);
});

test('la segnalazione di pagamento decide l’identificativo una volta sola', () => {
  const source = read('my-area.js');
  const corpo = corpoDi(source, 'reportCrewPayment');
  // L'identificativo si crea PRIMA della riprova, non dentro.
  assert.match(corpo, /const paymentRef = doc\(collection\(db, 'boats', activeInvite\.boatId, 'paymentRequests'\)\)/);
  assert.ok(
    corpo.indexOf('const paymentRef') < corpo.indexOf('withSaveRetry'),
    'paymentRef deve nascere prima della riprova, altrimenti ogni tentativo ne crea uno nuovo',
  );
  assert.match(corpo, /await setDoc\(paymentRef, \{/);
});

test('una riprova dopo una scrittura riuscita non fa sembrare fallito un pagamento registrato', () => {
  const source = read('my-area.js');
  const corpo = corpoDi(source, 'reportCrewPayment');
  assert.match(corpo, /const esistente = await getDoc\(paymentRef\)/);
  assert.match(corpo, /if \(esistente\.exists\(\)\) return;/);
  assert.ok(
    corpo.indexOf('esistente.exists()') < corpo.indexOf('await setDoc(paymentRef'),
    'il controllo di esistenza deve precedere la riscrittura',
  );
});

// "Acconto" in italiano vuol dire pagamento parziale. Scriverlo su un
// versamento che chiude il dovuto fa sembrare che manchi ancora denaro su un
// conto chiuso: è successo con Barbara Poletti, i cui 300 € coprivano per
// intero i 300 € attesi (posto 270 + assicurazione 30, lo starter pack è
// contato a parte) e che il sistema aveva infatti già classificato "balance",
// mentre ogni scritta diceva acconto.
test('la causale di un versamento dice saldo quando chiude il dovuto', () => {
  const source = read('area.js');
  assert.match(source, /reason: amountCents >= balanceBeforeCents \? 'Saldo registrato' : 'Acconto registrato'/);
  assert.doesNotMatch(source, /reason: 'Acconto registrato'/);
});

test('il modulo non chiama acconto quello che potrebbe essere un saldo', () => {
  const html = read('area.html');
  assert.doesNotMatch(html, /Registra acconto verificato/);
  assert.doesNotMatch(html, /Riferimento dell'acconto/);
  assert.match(html, /Registra il versamento ricevuto/);
});

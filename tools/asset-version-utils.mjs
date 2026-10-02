// Utilità condivise dai test che sorvegliano la regola 10 di AGENTS.md
// (cache-busting `?v=` davanti a GitHub Pages + CDN Fastly).
//
// Perché esiste questo file: fino al 2/10/2026 diversi test ricopiavano a mano
// la stringa di versione attesa (es. `styles.css?v=20260929-skipper-transfer-lists-v2`).
// Quella stringa però *deve* cambiare a ogni modifica del file linkato, quindi
// il test falliva al primo aggiornamento corretto senza segnalare nessun
// problema reale, e l'unico modo di "ripararlo" era ricopiarci dentro la nuova
// versione — cioè un test che non protegge nulla e va rimesso a posto a ogni
// commit.
//
// Quello che la regola 10 protegge davvero non è *quale* sia la versione, ma la
// *forma* del riferimento:
//   a) ogni CSS/JS locale linkato da un HTML deve avere un `?v=` non vuoto;
//   b) tutti gli HTML che caricano lo stesso file devono usare la stessa identica
//      stringa `?v=`.
// Il punto (b) è esattamente l'incidente del 22/9/2026 descritto in AGENTS.md:
// la versione era stata aggiornata solo su una parte dei file, e il titolare
// vedeva la struttura nuova con i colori vecchi. Questi controlli falliscono in
// quel caso e restano verdi quando la versione viene aggiornata correttamente
// ovunque.

import { readdirSync, readFileSync } from 'node:fs';

export const ROOT_URL = new URL('../', import.meta.url);

// href/src locale verso un .css o .js, con la stringa ?v= se presente.
// Esclude le risorse esterne (https://…, //…), che non passano dalla nostra cache.
const LOCAL_ASSET_REFERENCE = /(?:href|src)="(?!(?:https?:)?\/\/)([^"?#]+\.(?:css|js))(?:\?v=([^"#]*))?"/g;

// import ESM relativo verso un modulo del progetto, con la stringa ?v= se presente.
const LOCAL_MODULE_IMPORT = /from '\.\/([^']+\.js)(?:\?v=([^']*))?'/g;

export function readRootFile(name) {
  return readFileSync(new URL(name, ROOT_URL), 'utf8');
}

export function htmlFileNames() {
  return readdirSync(ROOT_URL).filter((name) => name.endsWith('.html')).sort();
}

export function jsFileNames() {
  return readdirSync(ROOT_URL).filter((name) => name.endsWith('.js')).sort();
}

// [{ file: 'styles.css', version: '20261002-console-count-v1' }, …]
// `version` è null quando il riferimento è privo di `?v=`.
export function localAssetReferences(html) {
  return [...html.matchAll(LOCAL_ASSET_REFERENCE)].map(([, file, version]) => ({
    file,
    version: version ?? null,
  }));
}

// La versione con cui una singola pagina carica un file.
// Restituisce undefined se la pagina non lo carica affatto, null se lo carica senza `?v=`.
export function assetVersionIn(html, file) {
  return localAssetReferences(html).find((reference) => reference.file === file)?.version;
}

// file linkato -> Map(versione usata -> pagine che la usano)
export function assetVersionsByFile(fileNames = htmlFileNames()) {
  const index = new Map();
  for (const name of fileNames) {
    for (const { file, version } of localAssetReferences(readRootFile(name))) {
      if (!index.has(file)) index.set(file, new Map());
      const versions = index.get(file);
      if (!versions.has(version)) versions.set(version, []);
      versions.get(version).push(name);
    }
  }
  return index;
}

function describeVersions(versions) {
  return [...versions.entries()]
    .map(([version, pages]) => `"${version ?? 'nessun ?v='}" in ${pages.join(', ')}`)
    .join(' · ');
}

// (a) Nessun CSS/JS locale linkato senza stringa di versione.
export function assertEveryLocalAssetIsVersioned(assert, fileNames = htmlFileNames()) {
  for (const name of fileNames) {
    for (const { file, version } of localAssetReferences(readRootFile(name))) {
      assert.ok(version, `${name}: ${file} è linkato senza una stringa ?v= (regola 10 di AGENTS.md)`);
    }
  }
}

// (b) Lo stesso file non può essere caricato con due versioni diverse:
// significherebbe che l'aggiornamento `?v=` è stato applicato solo su una parte delle pagine.
export function assertOneVersionPerAsset(assert, fileNames = htmlFileNames()) {
  for (const [file, versions] of assetVersionsByFile(fileNames)) {
    assert.equal(
      versions.size,
      1,
      `${file}: versione ?v= disallineata fra le pagine — ${describeVersions(versions)}`,
    );
  }
}

// Controllo di forma su una singola pagina: carica quel file, e lo carica versionato.
export function assertLoadsVersionedAsset(assert, html, file, pageLabel) {
  const version = assetVersionIn(html, file);
  assert.notEqual(version, undefined, `${pageLabel}: manca del tutto il riferimento a ${file}`);
  assert.ok(version, `${pageLabel}: ${file} è linkato senza una stringa ?v= (regola 10 di AGENTS.md)`);
}

// Stessa logica del punto (b) sull'altro canale di caricamento: gli import ESM
// fra moduli. Due importatori che pinnano versioni diverse dello stesso modulo
// fanno scaricare il file due volte al browser, con due istanze separate dello
// stato interno. Qui si verifica solo la coerenza, non la presenza: alcuni
// moduli (crew-identity.js, firebase-config.js) sono importati senza `?v=` in
// modo consapevole e uniforme.
export function assertOneVersionPerModuleImport(assert, fileNames = jsFileNames()) {
  const index = new Map();
  for (const name of fileNames) {
    for (const [, file, version] of readRootFile(name).matchAll(LOCAL_MODULE_IMPORT)) {
      if (!index.has(file)) index.set(file, new Map());
      const versions = index.get(file);
      if (!versions.has(version ?? null)) versions.set(version ?? null, []);
      versions.get(version ?? null).push(name);
    }
  }
  for (const [file, versions] of index) {
    assert.equal(
      versions.size,
      1,
      `${file}: importato con versioni ?v= diverse — ${describeVersions(versions)}`,
    );
  }
}

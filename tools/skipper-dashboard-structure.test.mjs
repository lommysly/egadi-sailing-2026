import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const areaSource = readFileSync(new URL('../area.js', import.meta.url), 'utf8');
const areaHtml = readFileSync(new URL('../area.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const rootUrl = new URL('../', import.meta.url);

test('la dashboard skipper espone cinque categorie e mantiene gli hash storici', () => {
  for (const view of ['boat', 'crew', 'money', 'charter', 'operations']) {
    assert.match(areaSource, new RegExp(`data-skipper-view="${view}"`));
  }
  assert.doesNotMatch(areaSource, /data-skipper-view="(?:profile|travel|board)"/);
  assert.match(areaSource, /'skipper-profilo': 'charter'/);
  assert.match(areaSource, /'skipper-bacheca': 'operations'/);
});

test('Crew List e dossier vivono insieme senza duplicare form o lista', () => {
  assert.match(areaSource, /function setupCharterCrewWorkspace\(crewPanel, charterPanel\)/);
  assert.match(areaSource, /workspace\.append\(heading, charterExport, memberList, manualEntry\)/);
  assert.equal((areaHtml.match(/id="memberForm"/g) || []).length, 1);
  assert.equal((areaHtml.match(/id="memberList"/g) || []).length, 1);
  assert.match(styles, /#charterCrewWorkspace\.charter-crew-workspace/);
});

test('Conti riunisce preventivo, metodi, richieste e controllo', () => {
  for (const view of ['plan', 'setup', 'request', 'review']) {
    assert.match(areaSource, new RegExp(`${view}: '${view}'`));
  }
  assert.match(areaSource, /planPanel\.content\.append\([\s\S]*financeOverview,[\s\S]*costPlanPanel,[\s\S]*contributionCatalogPanel,[\s\S]*createCharterLedgerPanel\(\)/);
  assert.doesNotMatch(areaSource, /boatQuoteMount\.append\(/);
  assert.match(styles, /\.finance-dashboard-hub \{ grid-template-columns:repeat\(2/);
});

test('il registro charter resta separato dagli incassi equipaggio', () => {
  assert.match(areaSource, /collection\(db, 'boats', activeBoat\.id, 'charterPayments'\)/);
  assert.match(areaSource, /Già versato al charter/);
  assert.match(areaSource, /Resta da versare/);
  assert.match(areaSource, /stopCharterPaymentSubscription = onSnapshot/);
  assert.match(areaSource, /activePayments = \[\]/);
  assert.match(areaSource, /activeCharterPayments = \[\]/);
  assert.match(areaSource, /'paid', 'confirmed', 'cancelled'/);
  assert.match(areaSource, /resetCharterPaymentForm\(\)/);
});

test('viaggio, regole e stato transfer condividono una sola categoria operativa', () => {
  assert.match(areaSource, /travelPanel\.dataset\.skipperPanel = 'operations'/);
  assert.match(areaSource, /boardPanel\.dataset\.skipperPanel = 'operations'/);
  assert.match(areaSource, /travelPanel\.append\(crewTravelOverview\)/);
});

test('tutte le pagine caricano il nuovo CSS versionato e area usa il nuovo JS', () => {
  const htmlFiles = readdirSync(rootUrl).filter((name) => name.endsWith('.html'));
  assert.equal(htmlFiles.length, 13);
  for (const name of htmlFiles) {
    const source = readFileSync(new URL(name, rootUrl), 'utf8');
    assert.match(source, /styles\.css\?v=20260928-mobile-layout-v1/, `${name}: versione CSS non aggiornata`);
  }
  assert.match(areaHtml, /area\.js\?v=20260928-mobile-layout-v1/);
});

test('la pagina conserva ID statici univoci dopo il riordino dei pannelli', () => {
  const ids = [...areaHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('il layout mobile non comprime pagamenti e pannelli annidati', () => {
  assert.match(styles, /@media \(max-width:640px\) \{ \.payment-row \{ display:grid; grid-template-columns:minmax\(0,1fr\);/);
  assert.match(styles, /\.payment-status \{ text-align:left; white-space:normal; \}/);
  assert.match(styles, /@media \(max-width:430px\) \{ \.area-main \{ padding-right:14px; padding-left:14px; \}/);
  assert.match(styles, /\.dashboard-hub \{ grid-template-columns:minmax\(0,1fr\); \}/);
  assert.match(styles, /\.finance-dashboard-panel \{ min-width:0; padding:16px 12px;/);
  assert.match(styles, /\.visually-hidden\.visually-hidden \{ position:absolute; width:1px; min-width:1px;/);
  assert.match(areaSource, /navigation\.scrollTo\(\{ left: Math\.max\(0, targetLeft\), behavior: 'auto' \}\)/);
  assert.match(styles, /\.skipper-checklist-dialog \{ max-height:calc\(100dvh - 24px\);/);
});

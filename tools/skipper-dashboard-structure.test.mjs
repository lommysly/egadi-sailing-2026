import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  assertEveryLocalAssetIsVersioned,
  assertLoadsVersionedAsset,
  assertOneVersionPerAsset,
  assertOneVersionPerModuleImport,
  htmlFileNames,
} from './asset-version-utils.mjs';

const areaSource = readFileSync(new URL('../area.js', import.meta.url), 'utf8');
const areaHtml = readFileSync(new URL('../area.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const rootUrl = new URL('../', import.meta.url);

function sourceBetween(startMarker, endMarker) {
  const start = areaSource.indexOf(startMarker);
  assert.notEqual(start, -1, `Marcatore iniziale non trovato: ${startMarker}`);
  const end = areaSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Marcatore finale non trovato: ${endMarker}`);
  return areaSource.slice(start, end);
}

test('la dashboard skipper espone cinque categorie e risolve hash profondi e storici', () => {
  for (const view of ['boat', 'crew', 'money', 'charter', 'operations']) {
    assert.match(areaSource, new RegExp(`data-skipper-view="${view}"`));
  }
  assert.doesNotMatch(areaSource, /data-skipper-view="(?:profile|travel|board)"/);
  for (const [view, hash] of Object.entries({
    personal: 'skipper-viaggio-personale',
    crew: 'skipper-viaggi-equipaggio',
    rules: 'regolamento-di-bordo',
  })) {
    assert.match(areaSource, new RegExp(`${view}: '${hash}'`));
  }
  for (const [view, hash] of Object.entries({
    dossier: 'skipper-dossier',
    crew: 'skipper-crew-list',
    delivery: 'skipper-consegna-charter',
  })) {
    assert.match(areaSource, new RegExp(`${view}: '${hash}'`));
  }

  const hashRouter = sourceBetween(
    'function skipperDashboardDestinationFromHash()',
    'function skipperDashboardViewFromHash()',
  );
  assert.match(hashRouter, /if \(operationsView\) return \{ view: 'operations', operationsView \}/);
  assert.match(hashRouter, /if \(hash === 'skipper-profilo'\) return \{ view: 'charter', charterView: SKIPPER_CHARTER_VIEWS\.dossier \}/);
  assert.match(hashRouter, /if \(hash === 'skipper-bacheca'\) return \{ view: 'operations', operationsView: SKIPPER_OPERATIONS_VIEWS\.rules \}/);

  const hashApplicator = sourceBetween(
    'function applySkipperDashboardHash()',
    'function skipperDashboardIcon(kind)',
  );
  assert.match(hashApplicator, /setSkipperCharterDashboardView\(destination\.charterView \|\| SKIPPER_CHARTER_VIEWS\.overview\)/);
  assert.match(hashApplicator, /setSkipperOperationsDashboardView\(destination\.operationsView \|\| SKIPPER_OPERATIONS_VIEWS\.overview\)/);
  assert.match(areaHtml, /href="#regolamento-di-bordo">Leggi la regola sulla cauzione<\/a>/);
  assert.match(areaSource, /href="#regolamento-di-bordo">Leggi la regola sulla cauzione<\/a>/);
});

test('Charter e documenti separa dossier, Crew List e consegna senza duplicare dati', () => {
  const crewWorkspace = sourceBetween(
    'function setupCharterCrewWorkspace(crewPanel, charterPanel)',
    'function setupSkipperCharterDashboard(charterPanel)',
  );
  assert.match(crewWorkspace, /charterExport\.hidden = true/);
  assert.match(crewWorkspace, /workspace\.append\(heading, memberList, manualEntry, charterExport\)/);
  assert.match(crewWorkspace, /canonicalPdfButton\.dataset\.charterDeliveryPdf = ''/);
  assert.match(crewWorkspace, /duplicatePdfButton\.replaceWith\(canonicalPdfButton\)/);

  const charterSetup = sourceBetween(
    'function setupSkipperCharterDashboard(charterPanel)',
    'function setSkipperCharterDashboardView(nextView',
  );
  for (const { view, panel } of [
    { view: 'dossier', panel: 'dossierPanel' },
    { view: 'crew', panel: 'crewPanel' },
    { view: 'delivery', panel: 'deliveryView' },
  ]) {
    assert.match(charterSetup, new RegExp(`\\{ view: '${view}', title:`));
    assert.match(charterSetup, new RegExp(`${panel}\\.dataset\\.charterPanel = SKIPPER_CHARTER_VIEWS\\.${view}`));
  }
  assert.match(charterSetup, /dossierPanel\.append\(skipperSubdashboardBackButton\('charter', 'Charter e documenti'\), \.\.\.dossierNodes\)/);
  assert.match(charterSetup, /crewPanel\.append\(skipperSubdashboardBackButton\('charter', 'Charter e documenti'\), workspace\)/);
  assert.match(charterSetup, /deliveryView\.append\(skipperSubdashboardBackButton\('charter', 'Charter e documenti'\), deliveryPanel\)/);
  assert.match(charterSetup, /shell\.append\(overview, dossierPanel, crewPanel, deliveryView\)/);
  assert.match(charterSetup, /history\.pushState\(null, '', `#\$\{hash\}`\)/);

  const charterView = sourceBetween(
    'function setSkipperCharterDashboardView(nextView',
    'function setupSkipperOperationsDashboard(',
  );
  assert.match(charterView, /panel\.hidden = panel\.dataset\.charterPanel !== view/);
  assert.match(charterView, /button\.toggleAttribute\('aria-current', button\.dataset\.charterView === view/);
  assert.equal((areaHtml.match(/id="memberForm"/g) || []).length, 1);
  assert.equal((areaHtml.match(/id="memberList"/g) || []).length, 1);
  assert.equal((areaHtml.match(/id="charterDeliveryPanel"/g) || []).length, 1);
  assert.equal((areaHtml.match(/id="generatePdfButton"/g) || []).length, 1);
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

test('Viaggio e comunicazioni separa i tre flussi dentro una sola categoria operativa', () => {
  const operationsSetup = sourceBetween(
    'function setupSkipperOperationsDashboard(travelPanel, boardPanel, crewTravelOverview, grid)',
    'function setSkipperOperationsDashboardView(nextView',
  );
  assert.match(operationsSetup, /shell\.dataset\.skipperPanel = 'operations'/);
  assert.match(operationsSetup, /delete travelPanel\.dataset\.skipperPanel/);
  assert.match(operationsSetup, /delete boardPanel\.dataset\.skipperPanel/);
  for (const { view, panel } of [
    { view: 'personal', panel: 'travelPanel' },
    { view: 'crew', panel: 'crewPanel' },
    { view: 'rules', panel: 'boardPanel' },
  ]) {
    assert.match(operationsSetup, new RegExp(`\\{ view: '${view}', title:`));
    assert.match(operationsSetup, new RegExp(`${panel}\\.dataset\\.operationsPanel = SKIPPER_OPERATIONS_VIEWS\\.${view}`));
  }
  assert.match(operationsSetup, /operationsCrewTravelOverview\.id = 'crewTravelOverviewOperations'/);
  assert.match(operationsSetup, /operationsCrewTravelOverview\.dataset\.crewTravelOverview = ''/);
  assert.match(operationsSetup, /if \(crewTravelOverview\) crewTravelOverview\.dataset\.crewTravelOverview = ''/);
  assert.match(operationsSetup, /shell\.append\(overview, travelPanel, crewPanel, boardPanel\)/);
  assert.match(operationsSetup, /history\.pushState\(null, '', `#\$\{hash\}`\)/);

  const operationsView = sourceBetween(
    'function setSkipperOperationsDashboardView(nextView',
    'const SKIPPER_DESTINATION_DATA_KEYS',
  );
  assert.match(operationsView, /panel\.hidden = panel\.dataset\.operationsPanel !== view/);
  assert.match(operationsView, /button\.toggleAttribute\('aria-current', button\.dataset\.operationsView === view/);
});

test('la barca usa un solo modulo e lo apre dentro la propria categoria', () => {
  const dashboardSetup = sourceBetween(
    'function setupSkipperDashboard()',
    'function setSkipperDashboardView(nextView)',
  );
  assert.match(dashboardSetup, /setupBoatWorkspace\(boatPanel\)/);

  const boatWorkspace = sourceBetween(
    'function setupBoatWorkspace(boatPanel)',
    'function resetBoatForm(user)',
  );
  assert.match(boatWorkspace, /ensureBoatRegistrationMount\(\)/);
  assert.match(boatWorkspace, /editor\.id = 'boatFormEditPanel'/);
  assert.match(boatWorkspace, /editMount\.id = 'boatFormEditMount'/);
  assert.match(boatWorkspace, /editMount\.append\(form\)/);
  assert.match(boatWorkspace, /intro\.append\(editButton, copy, message\)/);
  assert.match(boatWorkspace, /boatPanel\.insertBefore\(editor, fleetForm\)/);

  const restoreBoatForm = sourceBetween(
    'function restoreBoatFormForRegistration()',
    'function setupBoatWorkspace(boatPanel)',
  );
  assert.match(restoreBoatForm, /if \(form && mount && form\.parentElement !== mount\) mount\.append\(form\)/);
  assert.match(restoreBoatForm, /if \(editor\) editor\.hidden = true/);

  const openBoatEditor = sourceBetween(
    'function openBoatEdit({ updateHash = true } = {})',
    'function renderSkipperProfile(profile)',
  );
  assert.match(openBoatEditor, /history\.pushState\(null, '', `#\$\{SKIPPER_DASHBOARD_HASHES\.boat\}`\)/);
  assert.match(openBoatEditor, /setSkipperDashboardView\('boat'\)/);
  assert.match(openBoatEditor, /if \(form\.parentElement !== editMount\) editMount\.append\(form\)/);
  assert.match(openBoatEditor, /editor\.hidden = false/);
  assert.match(openBoatEditor, /editor\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(openBoatEditor, /editor\.querySelector\('h4'\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(openBoatEditor, /dashboard\.hidden|registerSection\.hidden/);

  const cancelBoatEditor = sourceBetween(
    "document.querySelector('#cancelBoatEdit').addEventListener",
    "const boatForm = document.querySelector('#boatForm')",
  );
  assert.match(cancelBoatEditor, /if \(editor\) editor\.hidden = true/);
  assert.match(cancelBoatEditor, /Modifica annullata: i dati pubblicati non sono cambiati/);

  const saveBoat = sourceBetween(
    "boatForm.addEventListener('submit'",
    "document.querySelector('#fleetProfileForm').addEventListener",
  );
  assert.match(saveBoat, /if \(editingBoatId\)[\s\S]*?if \(editor\) editor\.hidden = true/);
  assert.match(saveBoat, /Dati della barca aggiornati e partecipazione alla flotta pubblicata/);

  assert.equal((areaHtml.match(/id="boatForm"/g) || []).length, 1);
  assert.match(styles, /#boatFormEditMount \.private-form \{ max-width:none; margin:0; padding:0; background:transparent; \}/);
});

test('le azioni della panoramica aprono direttamente il pannello utile', () => {
  const destinationWriter = sourceBetween(
    'const SKIPPER_DESTINATION_DATA_KEYS',
    'function skipperDestinationHash(button)',
  );
  for (const key of ['financeView', 'charterView', 'operationsView', 'skipperTarget', 'skipperAction']) {
    assert.match(destinationWriter, new RegExp(`'${key}'`));
  }
  assert.match(destinationWriter, /SKIPPER_DESTINATION_DATA_KEYS\.forEach\(\(key\) => \{ delete button\.dataset\[key\]; \}\)/);
  assert.match(destinationWriter, /button\.dataset\.skipperView = destination\.view/);
  assert.match(destinationWriter, /if \(destination\.targetId\) button\.dataset\.skipperTarget = destination\.targetId/);
  assert.match(destinationWriter, /if \(destination\.action\) button\.dataset\.skipperAction = destination\.action/);

  const destinationHash = sourceBetween(
    'function skipperDestinationHash(button)',
    'function focusSkipperDestination(targetId)',
  );
  assert.match(destinationHash, /if \(view === 'operations' && SKIPPER_OPERATIONS_HASHES\[button\.dataset\.operationsView\]\)/);
  assert.match(destinationHash, /if \(view === 'charter' && SKIPPER_CHARTER_HASHES\[button\.dataset\.charterView\]\)/);
  assert.match(destinationHash, /return SKIPPER_OPERATIONS_HASHES\[button\.dataset\.operationsView\]/);

  const destinationOpener = sourceBetween(
    'function openSkipperDestination(button)',
    'function setupSkipperDashboard()',
  );
  assert.match(destinationOpener, /if \(view === 'money'\) setSkipperFinanceDashboardView\(button\.dataset\.financeView \|\| SKIPPER_FINANCE_VIEWS\.overview\)/);
  assert.match(destinationOpener, /if \(view === 'charter'\) setSkipperCharterDashboardView\(button\.dataset\.charterView \|\| SKIPPER_CHARTER_VIEWS\.overview\)/);
  assert.match(destinationOpener, /if \(view === 'operations'\) setSkipperOperationsDashboardView\(button\.dataset\.operationsView \|\| SKIPPER_OPERATIONS_VIEWS\.overview\)/);
  assert.match(destinationOpener, /if \(button\.dataset\.skipperAction === 'open-boat-editor'\) openBoatEdit\(\{ updateHash: false \}\)/);
  assert.match(destinationOpener, /if \(button\.dataset\.skipperAction === 'new-participant'\) startNewProjection\(\)/);
  assert.match(destinationOpener, /window\.requestAnimationFrame\(\(\) => focusSkipperDestination\(button\.dataset\.skipperTarget\)\)/);

  const destinationFocus = sourceBetween(
    'function focusSkipperDestination(targetId)',
    'function openSkipperDestination(button)',
  );
  assert.match(destinationFocus, /if \(details\) details\.open = true/);
  assert.match(destinationFocus, /target\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(destinationFocus, /focusTarget\.focus\(\{ preventScroll: true \}\)/);

  const metricWriter = sourceBetween(
    'function setSkipperDashboardMetric(name, value, detail, needsAttention = false, destination = {})',
    'function setSkipperNextAction(textTarget, button',
  );
  assert.match(metricWriter, /pendingChecklistIssues\.push\(\{[\s\S]*?\.\.\.destination,[\s\S]*?\}\)/);

  const nextActionWriter = sourceBetween(
    'function setSkipperNextAction(textTarget, button',
    'function currentBriefingAcceptanceCount()',
  );
  assert.match(nextActionWriter, /setSkipperButtonDestination\(button, destination\)/);

  const overviewRenderer = sourceBetween(
    'function renderSkipperDashboardOverview()',
    'function scheduleSkipperChecklistDialogCheck()',
  );
  for (const destination of [
    /\{ view: 'boat', action: 'open-boat-editor', targetId: 'boatFormEditPanel' \}/,
    /\{ view: 'charter', charterView: 'dossier', targetId: 'skipperProfileStatus' \}/,
    /\{ view: 'charter', charterView: 'crew', targetId: 'charterCrewWorkspace' \}/,
    /\{ view: 'operations', operationsView: 'personal', targetId: 'skipperTravelPanel' \}/,
    /\{ view: 'operations', operationsView: 'rules', targetId: 'regolamento-di-bordo' \}/,
    /\{ view: 'operations', operationsView: 'crew', targetId: 'crewTravelOverviewOperations' \}/,
    /\{ view: 'money', financeView: 'plan', targetId: 'costPlanPanel' \}/,
    /\{ view: 'money', financeView: 'setup', targetId: 'paymentProfileForm' \}/,
  ]) {
    assert.match(overviewRenderer, destination);
  }
  assert.match(overviewRenderer, /view: 'crew',[\s\S]*?action: 'new-participant',[\s\S]*?targetId: 'projectionEditor'/);

  const checklistWriter = sourceBetween(
    'function maybeShowSkipperChecklistDialog()',
    "document.querySelector('#skipperChecklistDialog')?.addEventListener",
  );
  assert.match(checklistWriter, /setSkipperButtonDestination\(button, issue\)/);
});

// Questo test sostituisce quello che confrontava le pagine con una stringa di
// versione scritta a mano (`styles.css?v=20260929-skipper-transfer-lists-v2`).
// Quel confronto falliva ogni volta che la regola 10 di AGENTS.md veniva
// applicata correttamente, perché la versione giusta è proprio quella nuova:
// l'unico modo di farlo ripassare era ricopiarci dentro la versione del giorno.
// Qui si verifica invece la proprietà che la regola 10 vuole davvero garantire —
// ogni file locale è linkato con un `?v=`, e tutte le pagine che caricano lo
// stesso file usano la stessa identica stringa — che è esattamente ciò che era
// stato violato il 22/9/2026 (CSS aggiornato solo in parte delle pagine).
test('ogni pagina carica CSS e JS versionati, con la stessa versione ovunque', () => {
  const htmlFiles = htmlFileNames();
  // 14 dal 3/10/2026: si aggiunge unisciti.html, il link unico di barca.
  assert.equal(htmlFiles.length, 14);
  assertEveryLocalAssetIsVersioned(assert, htmlFiles);
  assertOneVersionPerAsset(assert, htmlFiles);
  assertOneVersionPerModuleImport(assert);
  for (const name of htmlFiles) {
    assertLoadsVersionedAsset(assert, readFileSync(new URL(name, rootUrl), 'utf8'), 'styles.css', name);
  }
  assertLoadsVersionedAsset(assert, areaHtml, 'area.js', 'area.html');
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
  assert.match(styles, /\.contribution-note \{ margin-right:-14px; margin-left:-14px; padding-right:14px; padding-left:14px; \}/);
  assert.match(styles, /\.dashboard-hub \{ grid-template-columns:minmax\(0,1fr\); \}/);
  assert.match(styles, /\.finance-dashboard-panel \{ min-width:0; padding:16px 12px;/);
  assert.match(styles, /\.visually-hidden\.visually-hidden \{ position:absolute; width:1px; min-width:1px;/);
  assert.match(styles, /\.projection-card-summary-person \{ display:grid; gap:3px; \}/);
  assert.match(styles, /\.site-header \.brand > span:not\(\.brand-mark\) \{ display:none; \}/);
  assert.doesNotMatch(styles, /\.site-header \.brand span \{ display:none; \}/);
  assert.match(styles, /\.skipper-subdashboard-hub \{ grid-template-columns:minmax\(0,1fr\); \}/);
  assert.match(styles, /\.boat-workspace-actions \{ grid-template-columns:minmax\(0,1fr\); align-items:start; \}/);
  assert.match(areaSource, /navigation\.scrollTo\(\{ left: Math\.max\(0, targetLeft\), behavior: 'auto' \}\)/);
  assert.match(styles, /\.skipper-checklist-dialog \{ max-height:calc\(100dvh - 24px\);/);
});

// Aprire una casella cambiava il contenuto della pagina ma non la spostava:
// si restava in fondo, davanti a un contenuto appena cambiato (segnalato da
// Silvio, 4/10/2026: "ogni volta che si entra in un container ti manda in
// fondo alla pagina"). La regola vive in app.js, una volta, per tutte le aree.
test('aprire una sezione porta in cima a quella sezione, in tutte le aree', () => {
  const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
  const app = read('app.js');
  assert.match(app, /window\.EgadiOrientation = \{/);
  assert.match(app, /showTopOf\(element\)/);
  // Immediato, non animato: aprire una sezione deve sembrare aprire una pagina.
  assert.match(app, /behavior: 'auto'/);

  const skipper = read('area.js');
  assert.match(skipper, /window\.requestAnimationFrame\(showSkipperDashboardTop\)/);
  assert.match(skipper, /window\.addEventListener\('popstate', applyHashAndShowTop\)/);

  const equipaggio = read('my-area.js');
  assert.match(equipaggio, /function showCrewDashboardTop\(\)/);
  assert.match(equipaggio, /setCrewDashboardView\(crewDashboardViewFromHash\(\)\);\s*showCrewDashboardTop\(\);/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../area.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../area.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

test('i viaggi equipaggio usano card compatte coerenti su desktop e mobile', () => {
  assert.match(styles, /\.crew-travel-list \{[^}]*grid-template-columns:repeat\(auto-fill,minmax\(280px,320px\)\)/);
  assert.match(styles, /@media \(max-width:560px\)[\s\S]*\.crew-travel-list \{ grid-template-columns:minmax\(0,320px\); \}/);
  assert.match(styles, /@media \(max-width:560px\)[\s\S]*\.crew-travel-overview \{ padding:0; border:0; background:transparent; \}/);
  assert.match(source, /class="crew-travel-card crew-travel-card--\$\{escapeHtml\(presentation\.tone\)\}"/);
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
  assert.match(source, /const travelMembers = activeMembers\.filter/);
  assert.match(source, /return invite && invite\.status !== 'revoked'/);
  assert.match(source, /renderInvites\(\)[\s\S]*renderCrewTravelOverview\(\)/);
});

test('area skipper forza il caricamento della versione aggiornata', () => {
  assert.match(html, /styles\.css\?v=20260929-skipper-transfer-cards-v1/);
  assert.match(html, /area\.js\?v=20260929-skipper-transfer-cards-v1/);
});

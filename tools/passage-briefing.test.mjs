import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(read('passage-plan-data.js'), context);
vm.runInContext(read('passage-plan-data-en.js'), context);
const it = context.window.PASSAGE_PLAN_DATA;
const en = context.window.PASSAGE_PLAN_DATA_EN;
const phases = ['departure', 'passage', 'arrival'];

test('Briefing: entrambe le lingue hanno due partenze da Marsala e tre controlli di ormeggio', () => {
  for (const data of [it, en]) {
    assert.equal(data.callBriefing.options.length, 2);
    assert.equal(data.harbourChecks.items.length, 3);
    assert.equal(data.days.length, 4);
    for (const option of data.callBriefing.options) {
      assert.match(option.route, /Marsala/);
      for (const key of ['title', 'route', 'course', 'duration', 'window', 'wind', 'sea', 'decision', 'alternative']) {
        assert.ok(option[key]?.trim(), key);
      }
      for (const phase of phases) {
        assert.ok(option.ratings[phase].text);
        assert.ok(['caution', 'adverse', 'unknown', 'favorable'].includes(option.ratings[phase].tone));
      }
    }
    for (const item of data.harbourChecks.items) {
      for (const key of ['title', 'exposure', 'forecast', 'check', 'alternative', 'sourceLabel']) assert.ok(item[key]);
      assert.equal(new URL(item.sourceUrl).protocol, 'https:');
    }
  }
});

test('Briefing: valutazioni, numero di fonti e ora di consultazione coerenti in IT/EN', () => {
  assert.equal(it.updatedAt.match(/\d{2}:\d{2}/)[0], en.updatedAt.match(/\d{2}:\d{2}/)[0]);
  assert.equal(it.sources.length, en.sources.length);
  it.sources.forEach((source, index) => assert.equal(source.url, en.sources[index].url));
  it.days.forEach((day, index) => phases.forEach((phase) => {
    assert.equal(day.ratings[phase].tone, en.days[index].ratings[phase].tone);
  }));
  it.callBriefing.options.forEach((option, index) => phases.forEach((phase) => {
    assert.equal(option.ratings[phase].tone, en.callBriefing.options[index].ratings[phase].tone);
  }));
  it.harbourChecks.items.forEach((item, index) => assert.equal(item.rating.tone, en.harbourChecks.items[index].rating.tone));
});

test('Pagina: ora di aggiornamento unica nell’hero e sezioni distinte per partenze e porti', () => {
  const html = read('passage-plan.html');
  assert.equal((html.match(/id="planUpdatedAt"/g) || []).length, 1);
  assert.match(html, /<section class="area-hero">[\s\S]*?id="planUpdatedAt"[\s\S]*?<\/section>/);
  for (const id of ['planDepartureBriefing', 'planDepartureOptions', 'planHarbourChecks', 'planHarbourItems']) {
    assert.ok(html.includes(`id="${id}"`));
    assert.ok(read('passage-plan.js').includes(`#${id}`));
  }
  const versions = [...html.matchAll(/(?:passage-plan(?:-data(?:-en)?)?\.js|passage-visual\.css)\?v=([^"\s]+)/g)];
  assert.equal(versions.length, 4);
  assert.equal(new Set(versions.map((match) => match[1])).size, 1);
});

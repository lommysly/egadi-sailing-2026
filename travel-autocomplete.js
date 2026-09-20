const CATALOG_URL = new URL('./data/italy-travel-catalog.v2026-02.json', import.meta.url);
const MAX_RESULTS = 8;
const MIN_QUERY_LENGTH = 2;
const LOCALE = 'it-IT';

let catalogPromise = null;
let travelCatalog = null;
let outsideListenerInstalled = false;
let autocompleteInstanceId = 0;
const instances = new WeakMap();
const activeInstances = new Set();

function folded(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase(LOCALE)
    .trim();
}

function asText(value) {
  return String(value || '').trim();
}

function airportLabel(airport) {
  return airport ? airport.name + ' · ' + airport.code : '';
}

function airportDescription(airport) {
  return [airport.city, airport.region].filter(Boolean).join(' · ');
}

function makeSearchText(...parts) {
  return folded(parts.flat().filter(Boolean).join(' '));
}

function buildCatalog(rawCatalog) {
  const cities = Array.isArray(rawCatalog?.cities)
    ? rawCatalog.cities.map(([name, province, region]) => ({
      value: asText(name),
      label: [asText(name), asText(province), asText(region)].filter(Boolean).join(' · '),
      description: [asText(province), asText(region)].filter(Boolean).join(' · '),
      search: makeSearchText(name, province, region),
    })).filter((item) => item.value)
    : [];
  const airports = Array.isArray(rawCatalog?.airports)
    ? rawCatalog.airports.map(([code, name, city, region, icao, aliases]) => {
      const airport = {
        code: asText(code).toUpperCase(),
        name: asText(name),
        city: asText(city),
        region: asText(region),
        icao: asText(icao).toUpperCase(),
        aliases: Array.isArray(aliases) ? aliases.map(asText).filter(Boolean) : [],
      };
      return {
        ...airport,
        value: airport.code,
        label: airportLabel(airport),
        description: airportDescription(airport),
        search: makeSearchText(airport.code, airport.name, airport.city, airport.region, airport.icao, airport.aliases),
      };
    }).filter((item) => item.code && item.name)
    : [];
  const carriers = Array.isArray(rawCatalog?.airlines)
    ? rawCatalog.airlines.map(([name, aliases]) => ({
      value: asText(name),
      label: asText(name),
      description: '',
      search: makeSearchText(name, Array.isArray(aliases) ? aliases : []),
    })).filter((item) => item.value)
    : [];
  return { cities, airports, carriers };
}

async function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(CATALOG_URL, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error('Catalogo viaggio non disponibile');
        return response.json();
      })
      .then((rawCatalog) => {
        travelCatalog = buildCatalog(rawCatalog);
        activeInstances.forEach((instance) => instance.refreshAfterCatalogLoad());
        return travelCatalog;
      })
      .catch((error) => {
        activeInstances.forEach((instance) => instance.markCatalogUnavailable());
        throw error;
      });
  }
  return catalogPromise;
}

function scoreEntry(entry, query) {
  if (!query) return entry.code === 'TPS' ? 120 : entry.code === 'PMO' ? 110 : 0;
  const value = folded(entry.value);
  const label = folded(entry.label);
  if (value === query) return 1200;
  if (value.startsWith(query)) return 1000;
  if (label.startsWith(query)) return 900;
  if (entry.search.startsWith(query)) return 820;
  const wordScore = entry.search.split(' ').some((word) => word.startsWith(query)) ? 700 : 0;
  return wordScore || (entry.search.includes(query) ? 500 : -1);
}

function listForKind(kind) {
  if (!travelCatalog) return [];
  if (kind === 'airport') return travelCatalog.airports;
  if (kind === 'carrier') return travelCatalog.carriers;
  return travelCatalog.cities;
}

function exactEntry(kind, value) {
  const normalized = folded(value);
  if (!normalized || !travelCatalog) return null;
  return listForKind(kind).find((entry) => (
    folded(entry.value) === normalized
    || folded(entry.label) === normalized
    || (kind === 'airport' && entry.code === normalized.toUpperCase())
  )) || null;
}

function matchingEntries(kind, value) {
  const query = folded(value);
  if (!query && kind !== 'airport') return [];
  if (query.length < MIN_QUERY_LENGTH && kind !== 'airport') return [];
  return listForKind(kind)
    .map((entry) => ({ entry, score: scoreEntry(entry, query) }))
    .filter((item) => item.score >= 0)
    .sort((first, second) => second.score - first.score || first.entry.label.localeCompare(second.entry.label, LOCALE))
    .slice(0, MAX_RESULTS)
    .map((item) => item.entry);
}

function getNamedField(form, name) {
  const input = form?.elements?.namedItem(name);
  return input instanceof HTMLInputElement || input instanceof HTMLSelectElement ? input : null;
}

class TravelAutocomplete {
  constructor(input) {
    this.input = input;
    if (!input.id) input.id = `travel-autocomplete-${++autocompleteInstanceId}`;
    this.kind = input.dataset.travelAutocomplete || 'city';
    this.wrapper = input.closest('[data-travel-combobox]') || input.parentElement;
    this.options = [];
    this.activeIndex = -1;
    this.menu = document.createElement('div');
    this.menu.className = 'travel-autocomplete-menu';
    this.menu.id = input.id + 'Options';
    this.menu.hidden = true;
    this.menu.setAttribute('role', 'listbox');
    this.menu.setAttribute('aria-label', input.getAttribute('aria-label') || 'Suggerimenti');
    this.selectionCard = document.createElement('div');
    this.selectionCard.className = 'travel-airport-selection';
    this.selectionCard.hidden = true;
    this.selectionCard.setAttribute('aria-live', 'polite');
    this.wrapper?.append(this.selectionCard, this.menu);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', this.menu.id);
    input.addEventListener('input', () => this.handleInput());
    input.addEventListener('focus', () => this.handleFocus());
    input.addEventListener('blur', () => {
      window.setTimeout(() => this.close(), 140);
      this.resolveExactValue();
    });
    input.addEventListener('keydown', (event) => this.handleKeydown(event));
    this.menu.addEventListener('mousedown', (event) => event.preventDefault());
    this.menu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-travel-option-index]');
      if (!button) return;
      const index = Number.parseInt(button.dataset.travelOptionIndex || '', 10);
      if (Number.isInteger(index) && this.options[index]) this.choose(this.options[index]);
    });
    this.refreshSavedAirportLabel();
  }

  markCatalogUnavailable() {
    this.input.dataset.travelAutocompleteUnavailable = 'true';
    this.close();
  }

  refreshAfterCatalogLoad() {
    delete this.input.dataset.travelAutocompleteUnavailable;
    this.refreshSavedAirportLabel();
  }

  refreshSavedAirportLabel() {
    if (this.kind !== 'airport') return;
    const code = asText(this.input.dataset.travelAirportCode).toUpperCase();
    const city = asText(this.input.dataset.travelAirportCity);
    if (!code || this.input.dataset.travelEditing === 'true') {
      this.renderAirportSelection(null);
      return;
    }
    const entry = exactEntry('airport', code);
    this.input.value = entry ? entry.label : [city, code].filter(Boolean).join(' · ');
    this.input.dataset.travelSelectedValue = code;
    this.renderAirportSelection(entry);
  }

  renderAirportSelection(entry) {
    if (this.kind !== 'airport' || !this.selectionCard) return;
    const code = asText(entry?.code || this.input.dataset.travelAirportCode).toUpperCase();
    const city = asText(entry?.city || this.input.dataset.travelAirportCity);
    if (!code || this.input.dataset.travelEditing === 'true') {
      this.selectionCard.hidden = true;
      this.selectionCard.replaceChildren();
      return;
    }
    const title = entry ? airportLabel(entry) : [city, code].filter(Boolean).join(' · ');
    const description = entry ? airportDescription(entry) : city;
    const kicker = document.createElement('span');
    kicker.className = 'travel-airport-selection-kicker';
    kicker.textContent = document.documentElement.lang === 'en' ? 'Airport selected' : 'Aeroporto selezionato';
    const name = document.createElement('strong');
    name.textContent = title;
    this.selectionCard.replaceChildren(kicker, name);
    if (description) {
      const detail = document.createElement('small');
      detail.textContent = description;
      this.selectionCard.append(detail);
    }
    this.selectionCard.hidden = false;
  }

  handleFocus() {
    if (this.input.disabled) return;
    this.showMatches();
  }

  handleInput() {
    this.input.dataset.travelEditing = 'true';
    delete this.input.dataset.travelSelectedValue;
    if (this.kind === 'airport') this.clearAirportTargets();
    this.showMatches();
  }

  resolveExactValue() {
    if (this.input.dataset.travelSelectedValue || !travelCatalog) return;
    const entry = exactEntry(this.kind, this.input.value);
    if (entry) this.choose(entry, { silent: true });
  }

  clearAirportTargets() {
    const form = this.input.closest('form');
    const airportField = getNamedField(form, this.input.dataset.travelAirportTarget);
    if (airportField) airportField.value = '';
    this.input.dataset.travelAirportCode = '';
    this.input.dataset.travelAirportCity = '';
    this.renderAirportSelection(null);
  }

  showMatches() {
    if (!travelCatalog || this.input.disabled) {
      this.close();
      return;
    }
    this.options = matchingEntries(this.kind, this.input.value);
    this.activeIndex = this.options.length ? 0 : -1;
    if (!this.options.length) {
      this.close();
      return;
    }
    this.renderOptions();
    this.menu.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  renderOptions() {
    this.menu.replaceChildren();
    this.options.forEach((entry, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'travel-autocomplete-option';
      option.dataset.travelOptionIndex = String(index);
      option.id = this.menu.id + '-' + index;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === this.activeIndex));
      const label = document.createElement('strong');
      label.textContent = entry.label;
      option.append(label);
      if (entry.description) {
        const description = document.createElement('small');
        description.textContent = entry.description;
        option.append(description);
      }
      this.menu.append(option);
    });
    this.input.setAttribute('aria-activedescendant', this.activeIndex >= 0 ? this.menu.id + '-' + this.activeIndex : '');
  }

  setActive(index) {
    if (!this.options.length) return;
    this.activeIndex = (index + this.options.length) % this.options.length;
    this.renderOptions();
    this.menu.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  handleKeydown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.menu.hidden) this.showMatches();
      else this.setActive(this.activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.menu.hidden) this.showMatches();
      else this.setActive(this.activeIndex - 1);
    } else if (event.key === 'Enter' && !this.menu.hidden && this.options[this.activeIndex]) {
      event.preventDefault();
      this.choose(this.options[this.activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  choose(entry, { silent = false } = {}) {
    this.input.dataset.travelEditing = '';
    if (this.kind === 'airport') {
      const form = this.input.closest('form');
      const cityField = getNamedField(form, this.input.dataset.travelCityTarget);
      const airportField = getNamedField(form, this.input.dataset.travelAirportTarget);
      this.input.value = entry.label;
      this.input.dataset.travelAirportCode = entry.code;
      this.input.dataset.travelAirportCity = entry.city;
      this.input.dataset.travelSelectedValue = entry.code;
      if (cityField && !asText(cityField.value)) cityField.value = entry.city;
      if (airportField) airportField.value = entry.code;
      this.renderAirportSelection(entry);
    } else {
      this.input.value = entry.value;
      this.input.dataset.travelSelectedValue = entry.value;
    }
    this.close();
    if (!silent) this.input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  close() {
    this.options = [];
    this.activeIndex = -1;
    this.menu.hidden = true;
    this.menu.replaceChildren();
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }
}

export function installTravelAutocomplete(root = document) {
  const inputs = [...root.querySelectorAll('[data-travel-autocomplete]')];
  inputs.forEach((input) => {
    if (instances.has(input)) return;
    const instance = new TravelAutocomplete(input);
    instances.set(input, instance);
    activeInstances.add(instance);
  });
  if (!outsideListenerInstalled) {
    outsideListenerInstalled = true;
    document.addEventListener('pointerdown', (event) => {
      activeInstances.forEach((instance) => {
        if (!instance.wrapper?.contains(event.target)) instance.close();
      });
    });
  }
  void loadCatalog();
}

export function setTravelAirportLookup(input, { city = '', code = '' } = {}) {
  if (!(input instanceof HTMLInputElement)) return;
  input.dataset.travelAirportCity = asText(city);
  input.dataset.travelAirportCode = asText(code).toUpperCase();
  input.dataset.travelEditing = '';
  const instance = instances.get(input);
  if (instance) instance.refreshSavedAirportLabel();
}

export function clearTravelAirportLookup(input) {
  if (!(input instanceof HTMLInputElement)) return;
  input.value = '';
  input.dataset.travelAirportCity = '';
  input.dataset.travelAirportCode = '';
  input.dataset.travelSelectedValue = '';
  input.dataset.travelEditing = '';
  instances.get(input)?.refreshSavedAirportLabel();
}

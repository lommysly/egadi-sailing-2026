import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { collection, getDocs, getFirestore } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const EVENT_ID = 'egadi-2026';
const MAX_PUBLIC_TEXT_LENGTH = 100;
const locale = window.EgadiI18n?.getLocale?.() === 'en' ? 'en' : 'it';
const COPY = {
  it: {
    berthPreferences: {
      not_specified: 'Nessuna indicazione',
      cabin_female: 'Posto in cabina femminile',
      cabin_male: 'Posto in cabina maschile',
      cabin_mixed: 'Posto in cabina mista',
      dinette: 'Posto in dinette',
      other: 'Altra sistemazione',
    },
    boats: 'Barche',
    participantBerths: 'Posti partecipanti',
    declaredAvailableBerths: 'Posti liberi dichiarati',
    publishedAvailability: 'Disponibilità pubblicate',
    boat: 'barca',
    boatsPublished: 'barche pubblicate',
    berth: 'posto',
    berths: 'posti',
    availableBerths: 'Posti liberi dichiarati',
    noAvailableBerths: 'Nessun posto libero dichiarato',
    berthPreference: 'Preferenza posto',
    updated: 'Aggiornata',
    boatInFlotilla: 'Barca della flottiglia',
    skipper: 'Skipper',
    updating: 'In aggiornamento',
    forming: 'La flottiglia si sta formando. Le barche compariranno qui appena gli skipper registreranno la propria barca.',
    nonePublished: 'Nessuna barca pubblicata per ora.',
    unavailable: 'La flottiglia non è disponibile in questo momento. Riprova più tardi.',
    updateUnavailable: 'Impossibile aggiornare la flottiglia al momento.',
  },
  en: {
    berthPreferences: {
      not_specified: 'No preference stated',
      cabin_female: 'Berth in a women’s cabin',
      cabin_male: 'Berth in a men’s cabin',
      cabin_mixed: 'Berth in a mixed cabin',
      dinette: 'Dinette berth',
      other: 'Other accommodation',
    },
    boats: 'Boats',
    participantBerths: 'Participant berths',
    declaredAvailableBerths: 'Available berths declared',
    publishedAvailability: 'Availability published',
    boat: 'boat',
    boatsPublished: 'boats published',
    berth: 'berth',
    berths: 'berths',
    availableBerths: 'Available berths declared',
    noAvailableBerths: 'No available berths declared',
    berthPreference: 'Berth preference',
    updated: 'Updated',
    boatInFlotilla: 'Flotilla boat',
    skipper: 'Skipper',
    updating: 'Being updated',
    forming: 'The flotilla is taking shape. Boats will appear here as soon as their skippers register them.',
    nonePublished: 'No boats have been published yet.',
    unavailable: 'The flotilla is unavailable at the moment. Please try again later.',
    updateUnavailable: 'The flotilla cannot be refreshed at the moment.',
  },
};
const copy = COPY[locale];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const fleetStatus = document.querySelector('#fleetStatus');
const fleetSummary = document.querySelector('#fleetSummary');
const fleetList = document.querySelector('#fleetList');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function publicText(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_PUBLIC_TEXT_LENGTH) : '';
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function publicRecord(data) {
  const name = publicText(data?.name);
  if (!name) return null;

  const showAvailability = data?.showAvailability === true;
  const availableSeats = showAvailability ? nonNegativeInteger(data?.availableSeats) : null;
  const berthPreference = publicText(data?.berthPreference).toLowerCase();

  return {
    name,
    model: publicText(data?.model),
    boatType: publicText(data?.boatType),
    skipperName: publicText(data?.skipperName),
    capacity: nonNegativeInteger(data?.capacity),
    showAvailability,
    availableSeats,
    berthPreference: copy.berthPreferences[berthPreference] || '',
    updatedAt: data?.updatedAt,
  };
}

function updatedAtTime(value) {
  const date = value?.toDate ? value.toDate() : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function formatUpdatedAt(value) {
  const date = value?.toDate ? value.toDate() : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'it-IT', { dateStyle: 'medium' }).format(date);
}

function setStatus(message, isError = false) {
  fleetStatus.textContent = message;
  fleetStatus.classList.toggle('is-error', isError);
}

function plural(value, singular, pluralForm) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function renderSummary(fleet) {
  const declaredCapacity = fleet.reduce((total, boat) => total + (boat.capacity ?? 0), 0);
  const boatsWithAvailability = fleet.filter((boat) => boat.showAvailability && boat.availableSeats !== null);
  const declaredAvailability = boatsWithAvailability.reduce((total, boat) => total + boat.availableSeats, 0);

  fleetSummary.innerHTML = [
    `<div><span>${escapeHtml(copy.boats)}</span><strong>${escapeHtml(String(fleet.length))}</strong></div>`,
    `<div><span>${escapeHtml(copy.participantBerths)}</span><strong>${declaredCapacity ? escapeHtml(String(declaredCapacity)) : '—'}</strong></div>`,
    `<div><span>${escapeHtml(copy.declaredAvailableBerths)}</span><strong>${boatsWithAvailability.length ? escapeHtml(String(declaredAvailability)) : '—'}</strong></div>`,
    `<div><span>${escapeHtml(copy.publishedAvailability)}</span><strong>${escapeHtml(plural(boatsWithAvailability.length, copy.boat, locale === 'en' ? 'boats' : 'barche'))}</strong></div>`,
  ].join('');
  fleetSummary.hidden = false;
}

function detailsRow(label, value) {
  if (!value) return '';
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function renderCard(boat) {
  const boatDetails = [boat.boatType, boat.model].filter(Boolean).join(' · ');
  const availabilityDetails = boat.showAvailability && boat.availableSeats !== null
    ? detailsRow(copy.availableBerths, boat.availableSeats === 0 ? copy.noAvailableBerths : plural(boat.availableSeats, copy.berth, copy.berths))
    : '';
  const preferenceDetails = boat.showAvailability && boat.berthPreference
    ? detailsRow(copy.berthPreference, boat.berthPreference)
    : '';
  const updatedAt = formatUpdatedAt(boat.updatedAt);

  return `<article class="dashboard-panel">
    <p class="eyebrow">${escapeHtml(boat.boatType || copy.boatInFlotilla)}</p>
    <h3>${escapeHtml(boat.name)}</h3>
    ${boatDetails ? `<p class="panel-lead">${escapeHtml(boatDetails)}</p>` : ''}
    <dl class="profile-summary">
      ${detailsRow(copy.skipper, boat.skipperName || copy.updating)}
      ${boat.capacity !== null ? detailsRow(copy.participantBerths, plural(boat.capacity, copy.berth, copy.berths)) : ''}
      ${availabilityDetails}
      ${preferenceDetails}
      ${updatedAt ? detailsRow(copy.updated, updatedAt) : ''}
    </dl>
  </article>`;
}

function renderFleet(fleet) {
  if (!fleet.length) {
    fleetSummary.hidden = true;
    fleetList.innerHTML = `<p class="empty-state">${escapeHtml(copy.forming)}</p>`;
    setStatus(copy.nonePublished);
    return;
  }

  renderSummary(fleet);
  fleetList.innerHTML = fleet.map(renderCard).join('');
  setStatus(locale === 'en'
    ? `${plural(fleet.length, 'boat published', copy.boatsPublished)} in the flotilla.`
    : `${plural(fleet.length, 'barca pubblicata', copy.boatsPublished)} nella flottiglia.`);
}

async function loadFleet() {
  try {
    const snapshot = await getDocs(collection(db, 'events', EVENT_ID, 'publicFleet'));
    const fleet = snapshot.docs
      .map((item) => publicRecord(item.data()))
      .filter(Boolean)
      .sort((first, second) => updatedAtTime(second.updatedAt) - updatedAtTime(first.updatedAt) || first.name.localeCompare(second.name, locale));
    renderFleet(fleet);
  } catch {
    fleetSummary.hidden = true;
    fleetList.innerHTML = `<p class="empty-state">${escapeHtml(copy.unavailable)}</p>`;
    setStatus(copy.updateUnavailable, true);
  }
}

loadFleet();

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { collection, getDocs, getFirestore } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const EVENT_ID = 'egadi-2026';
const MAX_PUBLIC_TEXT_LENGTH = 100;
const BERTH_PREFERENCE_LABELS = {
  not_specified: 'Nessuna indicazione',
  cabin_female: 'Posto in cabina femminile',
  cabin_male: 'Posto in cabina maschile',
  cabin_mixed: 'Posto in cabina mista',
  dinette: 'Posto in dinette',
  crew_cabin: 'Posto in cabina marinaio',
  other: 'Altra sistemazione',
};

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
    berthPreference: BERTH_PREFERENCE_LABELS[berthPreference] || '',
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
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(date);
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
    `<div><span>Barche</span><strong>${escapeHtml(String(fleet.length))}</strong></div>`,
    `<div><span>Posti equipaggio</span><strong>${declaredCapacity ? escapeHtml(String(declaredCapacity)) : '—'}</strong></div>`,
    `<div><span>Posti liberi dichiarati</span><strong>${boatsWithAvailability.length ? escapeHtml(String(declaredAvailability)) : '—'}</strong></div>`,
    `<div><span>Disponibilità pubblicate</span><strong>${escapeHtml(plural(boatsWithAvailability.length, 'barca', 'barche'))}</strong></div>`,
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
    ? detailsRow('Posti liberi dichiarati', boat.availableSeats === 0 ? 'Nessun posto libero dichiarato' : plural(boat.availableSeats, 'posto', 'posti'))
    : '';
  const preferenceDetails = boat.showAvailability && boat.berthPreference
    ? detailsRow('Preferenza posto', boat.berthPreference)
    : '';
  const updatedAt = formatUpdatedAt(boat.updatedAt);

  return `<article class="dashboard-panel">
    <p class="eyebrow">${escapeHtml(boat.boatType || 'Barca della flotta')}</p>
    <h3>${escapeHtml(boat.name)}</h3>
    ${boatDetails ? `<p class="panel-lead">${escapeHtml(boatDetails)}</p>` : ''}
    <dl class="profile-summary">
      ${detailsRow('Skipper', boat.skipperName || 'In aggiornamento')}
      ${boat.capacity !== null ? detailsRow('Posti equipaggio', plural(boat.capacity, 'posto', 'posti')) : ''}
      ${availabilityDetails}
      ${preferenceDetails}
      ${updatedAt ? detailsRow('Aggiornata', updatedAt) : ''}
    </dl>
  </article>`;
}

function renderFleet(fleet) {
  if (!fleet.length) {
    fleetSummary.hidden = true;
    fleetList.innerHTML = '<p class="empty-state">La flotta si sta formando. Le barche compariranno qui appena gli skipper registreranno la propria barca.</p>';
    setStatus('Nessuna barca pubblicata per ora.');
    return;
  }

  renderSummary(fleet);
  fleetList.innerHTML = fleet.map(renderCard).join('');
  setStatus(`${plural(fleet.length, 'barca pubblicata', 'barche pubblicate')} nella flotta.`);
}

async function loadFleet() {
  try {
    const snapshot = await getDocs(collection(db, 'events', EVENT_ID, 'publicFleet'));
    const fleet = snapshot.docs
      .map((item) => publicRecord(item.data()))
      .filter(Boolean)
      .sort((first, second) => updatedAtTime(second.updatedAt) - updatedAtTime(first.updatedAt) || first.name.localeCompare(second.name, 'it'));
    renderFleet(fleet);
  } catch {
    fleetSummary.hidden = true;
    fleetList.innerHTML = '<p class="empty-state">La flotta non è disponibile in questo momento. Riprova più tardi.</p>';
    setStatus('Impossibile aggiornare la flotta al momento.', true);
  }
}

loadFleet();

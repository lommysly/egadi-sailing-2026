import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { crewAccessErrorMessage, crewAccessUrl, db, personalAreaUrl, profileUrl, startCrewAreaSession } from './crew-session.js?v=20260919-live-privacy-v1';
import { installTravelAutocomplete, setTravelAirportLookup } from './travel-autocomplete.js?v=20260920-travel-private-v1';

const DIRECTIONS = Object.freeze(['outbound', 'return']);
const TRANSPORT_MODES = new Set(['', 'flight', 'train', 'car', 'ferry', 'other']);
const AIRPORT_MARSALA_CHOICES = new Set(['', 'transfer', 'independent', 'ride_offer']);
const CARPOOL_ROLES = new Set(['', 'need_ride', 'offer_ride']);
const TERMINAL_AIRPORTS = new Set(['TPS', 'PMO']);

let activeSession = null;
let currentLocale = 'it';

function isEnglish() {
  return window.EgadiI18n?.getLocale?.() === 'en';
}

function copyForLocale() {
  if (isEnglish()) {
    return {
      pageTitle: 'Arrivals & departures · Egadi Sailing Experience',
      metaDescription: 'Personal arrivals and departures for Egadi Sailing Experience.',
      heroEyebrow: 'Your travel plan',
      heroTitle: 'Arrivals and departures,<br /><em>without chasing messages.</em>',
      heroDescription: 'Save what you already know, even before every ticket is confirmed. The transfer company sees your details only after your consent.',
      openingEyebrow: 'Personal area',
      openingTitle: 'Opening your travel details.',
      openingMessage: 'Checking your personal access…',
      blockedEyebrow: 'Boarding step required',
      blockedTitle: 'Complete your boarding access first.',
      backToArea: 'Back to my area',
      workspaceEyebrow: 'Arrivals & departures',
      workspaceTitle: 'Your journey to Marsala',
      workspaceLead: 'The two cards are independent: save a draft now and add final timings when you have them.',
      flowEyebrow: 'How it works',
      flowTitle: 'Only the details that matter.',
      flow: [
        ['1', 'Save a draft', 'A partial itinerary is useful too: add the rest later.'],
        ['2', 'Choose your transfer', 'For airport ↔ Marsala, select the option that fits you.'],
        ['3', 'Share only by consent', 'Your contact details go to the transfer operator only when you agree.'],
        ['4', 'Confirm when ready', 'Confirmed timings make the matching window of ±120 minutes usable.'],
      ],
      direction: {
        outbound: { eyebrow: 'Outbound', title: 'Towards Marsala', lead: 'Describe the trip from where you leave to Marsala or your arrival airport.' },
        return: { eyebrow: 'Return', title: 'From Marsala', lead: 'Describe the trip from Marsala or your departure airport to where you are going.' },
      },
      statusDraft: 'Personal draft',
      statusReady: 'Travel details confirmed',
      details: 'Journey details',
      transport: 'Main transport',
      choose: 'Choose',
      flight: 'Flight',
      train: 'Train',
      car: 'Car',
      ferry: 'Ferry',
      other: 'Other',
      origin: 'Departure',
      destination: 'Arrival',
      city: 'City',
      cityPlaceholder: 'Start typing a city',
      airport: 'Airport',
      airportPlaceholder: 'Search airport or IATA code',
      departureDate: 'Departure date',
      departureTime: 'Departure time',
      arrivalDate: 'Arrival date',
      arrivalTime: 'Arrival time',
      carrier: 'Airline / carrier',
      carrierPlaceholder: 'For example ITA Airways',
      serviceNumber: 'Flight / service number',
      luggage: 'Checked bags',
      bulkyLuggage: 'I am travelling with bulky luggage.',
      airportTransfer: 'Airport ↔ Marsala connection',
      airportTransferHint: 'The organised connection works only through Trapani (TPS) or Palermo (PMO).',
      airportChoiceNone: 'I do not need to indicate it yet',
      airportChoiceTransfer: 'I would like the organised transfer',
      airportChoiceIndependent: 'I will arrange it independently',
      airportChoiceRideOffer: 'I can offer a car ride',
      operatorConsent: 'I agree that the organiser and the appointed transfer company may use these travel details and my contact information only to arrange the airport ↔ Marsala connection. The operational record is also backed up in the organisers’ private Google Sheet.',
      carpool: 'Carpool with other participants',
      carpoolHint: 'Optional. It can be used for any journey where a car ride is useful.',
      carpoolNone: 'No carpool request',
      carpoolNeed: 'I am looking for a ride',
      carpoolOffer: 'I can offer a ride',
      carpoolSeats: 'Available seats',
      carpoolConsent: 'I agree that my contact information may be shared only with a matched participant who has given the same consent.',
      saveDraft: 'Save draft',
      confirm: 'Confirm travel details',
      draftSaved: 'Draft saved. You can come back and complete it whenever you like.',
      readySaved: 'Travel details confirmed. The transfer coordinator can use them according to your consent.',
      saving: 'Saving…',
      blockedNoProfile: 'Complete your personal charter details in your area before adding travel information.',
      blockedNoBriefing: 'The skipper has not published the boarding briefing yet. Your travel details will open after it is available and accepted.',
      blockedBriefing: 'Read and accept the boarding rules in your personal area before entering travel information.',
      invalidAccess: 'This personal access is no longer active. Sign in again with your phone number and personal code.',
      loadError: 'I cannot load your travel details right now. Check your connection and try again.',
      saveError: 'The travel details were not saved. Check your connection and try again.',
      validationTransport: 'Choose the main transport before confirming.',
      validationRoute: 'Add both the departure city and the arrival city before confirming.',
      validationTimes: 'Add departure and arrival date and time before confirming.',
      validationFlightAirports: 'For a flight, select both airports from the suggestions.',
      validationTransferAirport: 'For an airport ↔ Marsala connection, select Trapani (TPS) or Palermo (PMO) as one of the airports.',
      validationTransferConsent: 'Confirm the consent for the transfer operator before confirming this connection.',
      validationCarpoolConsent: 'Confirm the consent for the carpool match before confirming this request.',
      validationCarpoolSeats: 'Indicate at least one available seat for a ride offer.',
      validationRideOfferTransport: 'Select Car as the main transport to offer a ride.',
      validationRideOffer: 'A ride offer must include the carpool consent and the number of available seats.',
      validationChronology: 'Arrival cannot be before departure.',
      airportSelected: 'Airport selected',
    };
  }
  return {
    pageTitle: 'Arrivi e partenze · Egadi Sailing Experience',
    metaDescription: 'Arrivi e partenze personali per Egadi Sailing Experience.',
    heroEyebrow: 'La tua logistica',
    heroTitle: 'Arrivi e partenze,<br /><em>senza rincorrere messaggi.</em>',
    heroDescription: 'Salva quello che sai già, anche se non hai ancora tutti i biglietti. La società transfer vedrà i dati solo dopo il tuo consenso.',
    openingEyebrow: 'Area personale',
    openingTitle: 'Apro i tuoi spostamenti.',
    openingMessage: 'Controllo il tuo accesso…',
    blockedEyebrow: 'Prima il briefing',
    blockedTitle: 'Completa l’ingresso a bordo.',
    backToArea: 'Torna alla mia area',
    workspaceEyebrow: 'Arrivi & partenze',
    workspaceTitle: 'Il tuo viaggio verso Marsala',
    workspaceLead: 'Le due card sono indipendenti: puoi salvare una bozza e completarla quando hai gli orari definitivi.',
    flowEyebrow: 'Come funziona',
    flowTitle: 'Pochi dati, nel posto giusto.',
    flow: [
      ['1', 'Salva una bozza', 'Anche un itinerario parziale è utile: lo completi quando vuoi.'],
      ['2', 'Scegli il transfer', 'Per aeroporto ↔ Marsala indichi l’opzione che fa per te.'],
      ['3', 'Condividi solo con consenso', 'I dati di contatto arrivano alla società transfer solo se acconsenti.'],
      ['4', 'Conferma quando è definitivo', 'Con gli orari confermati funziona la finestra di compatibilità di ±120 minuti.'],
    ],
    direction: {
      outbound: { eyebrow: 'Andata', title: 'Verso Marsala', lead: 'Racconta il tragitto da dove parti fino a Marsala o al tuo aeroporto di arrivo.' },
      return: { eyebrow: 'Rientro', title: 'Da Marsala', lead: 'Racconta il tragitto da Marsala o dal tuo aeroporto di partenza fino a dove arrivi.' },
    },
    statusDraft: 'Bozza personale',
    statusReady: 'Informazioni confermate',
    details: 'Dettagli del viaggio',
    transport: 'Mezzo principale',
    choose: 'Seleziona',
    flight: 'Aereo',
    train: 'Treno',
    car: 'Auto',
    ferry: 'Nave / traghetto',
    other: 'Altro',
    origin: 'Partenza',
    destination: 'Arrivo',
    city: 'Città',
    cityPlaceholder: 'Inizia a scrivere una città',
    airport: 'Aeroporto',
    airportPlaceholder: 'Cerca aeroporto o codice IATA',
    departureDate: 'Data di partenza',
    departureTime: 'Ora di partenza',
    arrivalDate: 'Data di arrivo',
    arrivalTime: 'Ora di arrivo',
    carrier: 'Compagnia / vettore',
    carrierPlaceholder: 'Per esempio ITA Airways',
    serviceNumber: 'Numero volo / corsa',
    luggage: 'Bagagli in stiva',
    bulkyLuggage: 'Viaggio con un bagaglio ingombrante.',
    airportTransfer: 'Collegamento aeroporto ↔ Marsala',
    airportTransferHint: 'Il collegamento organizzato è disponibile soltanto da/per Trapani (TPS) o Palermo (PMO).',
    airportChoiceNone: 'Non devo ancora indicarlo',
    airportChoiceTransfer: 'Vorrei il transfer organizzato',
    airportChoiceIndependent: 'Mi organizzo in autonomia',
    airportChoiceRideOffer: 'Posso offrire un passaggio in auto',
    operatorConsent: 'Acconsento che organizzazione e società transfer incaricata usino questi dati di viaggio e il mio contatto solo per organizzare il collegamento aeroporto ↔ Marsala. La registrazione operativa viene inoltre riportata nel foglio Google privato dell’organizzazione.',
    carpool: 'Passaggi auto con altri partecipanti',
    carpoolHint: 'È facoltativo: serve per qualsiasi tratto in cui un passaggio in auto può essere utile.',
    carpoolNone: 'Nessuna richiesta di passaggio',
    carpoolNeed: 'Cerco un passaggio',
    carpoolOffer: 'Posso offrire un passaggio',
    carpoolSeats: 'Posti disponibili',
    carpoolConsent: 'Acconsento a condividere il mio contatto solo con una persona abbinata che abbia dato lo stesso consenso.',
    saveDraft: 'Salva bozza',
    confirm: 'Conferma il viaggio',
    draftSaved: 'Bozza salvata. Puoi tornare qui e completarla quando vuoi.',
    readySaved: 'Viaggio confermato. Il coordinatore transfer potrà usarlo nei limiti del consenso che hai dato.',
    saving: 'Salvataggio…',
    blockedNoProfile: 'Completa prima i tuoi dati personali richiesti dal charter nella tua area.',
    blockedNoBriefing: 'Lo skipper non ha ancora pubblicato il briefing di bordo. I tuoi spostamenti si apriranno dopo la sua pubblicazione e accettazione.',
    blockedBriefing: 'Leggi e accetta le regole di bordo nella tua area personale prima di inserire gli spostamenti.',
    invalidAccess: 'Questo accesso personale non è più attivo. Accedi di nuovo con numero di telefono e codice personale.',
    loadError: 'Non riesco a caricare i tuoi spostamenti adesso. Controlla la connessione e riprova.',
    saveError: 'I dati di viaggio non sono stati salvati. Controlla la connessione e riprova.',
    validationTransport: 'Prima di confermare, seleziona il mezzo principale.',
    validationRoute: 'Prima di confermare, inserisci sia la città di partenza sia quella di arrivo.',
    validationTimes: 'Prima di confermare, inserisci data e ora di partenza e arrivo.',
    validationFlightAirports: 'Per un volo, seleziona entrambi gli aeroporti dai suggerimenti.',
    validationTransferAirport: 'Per il collegamento aeroporto ↔ Marsala seleziona Trapani (TPS) o Palermo (PMO) in uno dei due aeroporti.',
    validationTransferConsent: 'Prima di confermare questo collegamento, dai il consenso alla società transfer.',
    validationCarpoolConsent: 'Prima di confermare la richiesta di passaggio, dai il consenso al matching.',
    validationCarpoolSeats: 'Per offrire un passaggio indica almeno un posto disponibile.',
    validationRideOfferTransport: 'Per offrire un passaggio seleziona Auto come mezzo principale.',
    validationRideOffer: 'Per offrire un passaggio servono il consenso al matching e il numero di posti disponibili.',
    validationChronology: 'L’arrivo non può essere precedente alla partenza.',
    airportSelected: 'Aeroporto selezionato',
  };
}

function text(value) {
  return String(value || '').trim();
}

function number(value, fallback = 0, maximum = 99) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) ? Math.max(0, Math.min(maximum, parsed)) : fallback;
}

function valueOr(value, allowed, fallback = '') {
  return allowed.has(value) ? value : fallback;
}

function defaultLeg(direction) {
  return {
    schemaVersion: 1,
    ownerUid: '',
    inviteId: '',
    direction,
    state: 'draft',
    transportMode: '',
    originCity: direction === 'return' ? 'Marsala' : '',
    originAirport: '',
    destinationCity: direction === 'outbound' ? 'Marsala' : '',
    destinationAirport: '',
    departureDate: '',
    departureTime: '',
    arrivalDate: '',
    arrivalTime: '',
    carrier: '',
    serviceNumber: '',
    luggageCount: 0,
    bulkyLuggage: false,
    airportMarsalaChoice: '',
    transferOperatorConsent: false,
    carpoolRole: '',
    carpoolSeats: 0,
    carpoolMatchConsent: false,
  };
}

function normalizeLeg(raw, direction) {
  const base = defaultLeg(direction);
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    ...base,
    state: source.state === 'ready' ? 'ready' : 'draft',
    transportMode: valueOr(text(source.transportMode), TRANSPORT_MODES),
    originCity: text(source.originCity) || base.originCity,
    originAirport: text(source.originAirport).toUpperCase(),
    destinationCity: text(source.destinationCity) || base.destinationCity,
    destinationAirport: text(source.destinationAirport).toUpperCase(),
    departureDate: text(source.departureDate),
    departureTime: text(source.departureTime),
    arrivalDate: text(source.arrivalDate),
    arrivalTime: text(source.arrivalTime),
    carrier: text(source.carrier),
    serviceNumber: text(source.serviceNumber).toUpperCase(),
    luggageCount: number(source.luggageCount, 0, 12),
    bulkyLuggage: source.bulkyLuggage === true,
    airportMarsalaChoice: valueOr(text(source.airportMarsalaChoice), AIRPORT_MARSALA_CHOICES),
    transferOperatorConsent: source.transferOperatorConsent === true,
    carpoolRole: valueOr(text(source.carpoolRole), CARPOOL_ROLES),
    carpoolSeats: number(source.carpoolSeats, 0, 8),
    carpoolMatchConsent: source.carpoolMatchConsent === true,
  };
}

function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function localizedUrl(path) {
  const url = new URL(path, window.location.href).toString();
  return window.EgadiI18n?.preserveLocaleUrl?.(url) || url;
}

function applyPageCopy(copy) {
  document.documentElement.lang = isEnglish() ? 'en' : 'it';
  document.title = copy.pageTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', copy.metaDescription);
  document.querySelector('#travelHeroEyebrow').textContent = copy.heroEyebrow;
  document.querySelector('#travelHeroTitle').innerHTML = copy.heroTitle;
  document.querySelector('#travelHeroDescription').textContent = copy.heroDescription;
  document.querySelector('#travelOpeningEyebrow').textContent = copy.openingEyebrow;
  document.querySelector('#travelOpeningTitle').textContent = copy.openingTitle;
  document.querySelector('#travelOpeningMessage').textContent = copy.openingMessage;
  document.querySelector('#travelBlockedEyebrow').textContent = copy.blockedEyebrow;
  document.querySelector('#travelBlockedTitle').textContent = copy.blockedTitle;
  document.querySelector('#travelBlockedLink').textContent = copy.backToArea;
  document.querySelector('#travelWorkspaceEyebrow').textContent = copy.workspaceEyebrow;
  document.querySelector('#travelWorkspaceTitle').textContent = copy.workspaceTitle;
  document.querySelector('#travelWorkspaceLead').textContent = copy.workspaceLead;
  document.querySelector('#travelFlowEyebrow').textContent = copy.flowEyebrow;
  document.querySelector('#travelFlowTitle').textContent = copy.flowTitle;
  document.querySelector('#backToMyArea').textContent = copy.backToArea;
  document.querySelector('#backToMyArea').href = personalAreaUrl();
  document.querySelector('#travelBlockedLink').href = personalAreaUrl();
  document.querySelector('#travelFlowSteps').replaceChildren(...copy.flow.map(([step, title, description]) => {
    const item = document.createElement('div');
    const label = document.createElement('span');
    const heading = document.createElement('strong');
    const detail = document.createElement('small');
    label.textContent = step;
    heading.textContent = title;
    detail.textContent = description;
    item.append(label, heading, detail);
    return item;
  }));
}

function showOpening(message, isError = false) {
  document.querySelector('#travelWorkspace').hidden = true;
  document.querySelector('#travelBlocked').hidden = true;
  document.querySelector('#travelOpening').hidden = false;
  setMessage(document.querySelector('#travelOpeningMessage'), message, isError);
}

function showBlocked(message) {
  document.querySelector('#travelWorkspace').hidden = true;
  document.querySelector('#travelOpening').hidden = true;
  document.querySelector('#travelBlocked').hidden = false;
  setMessage(document.querySelector('#travelBlockedMessage'), message, true);
}

function isAcceptedBriefing(briefing, acceptance, userId) {
  const version = Number.isInteger(briefing?.rulesVersion) ? briefing.rulesVersion : 1;
  return acceptance?.acceptedBy === userId
    && acceptance?.rulesVersion === version
    && (briefing?.fullRulesRequired !== true || acceptance?.fullRulesRead === true);
}

function legReference(direction) {
  return doc(db, 'boats', activeSession.invite.boatId, 'crewTravel', activeSession.invite.id, 'legs', direction);
}

function field(form, name) {
  return form.elements.namedItem(name);
}

function inputValue(form, name) {
  return text(field(form, name)?.value);
}

function inputChecked(form, name) {
  return field(form, name)?.checked === true;
}

function selectValue(form, name, allowed) {
  return valueOr(inputValue(form, name), allowed);
}

function renderLegForm(direction, rawLeg) {
  const copy = copyForLocale();
  const labels = copy.direction[direction];
  const leg = normalizeLeg(rawLeg, direction);
  const formId = `travel-${direction}`;
  const card = document.createElement('details');
  card.className = 'skipper-travel-form skipper-cost-panel';
  card.open = direction === 'outbound';
  card.dataset.travelDirection = direction;
  card.dataset.travelState = leg.state;
  card.innerHTML = `
    <summary>
      <span>${labels.title}</span>
      <small data-travel-state>${leg.state === 'ready' ? copy.statusReady : copy.statusDraft}</small>
    </summary>
    <form id="${formId}" novalidate>
      <div class="skipper-travel-form-heading">
        <span class="skipper-travel-direction${direction === 'return' ? ' is-return' : ''}" aria-hidden="true">${direction === 'outbound' ? '→' : '←'}</span>
        <div><p class="eyebrow">${labels.eyebrow}</p><h4>${labels.title}</h4><p>${labels.lead}</p></div>
      </div>
      <fieldset class="skipper-travel-main-fieldset">
        <legend>${copy.details}</legend>
        <label class="travel-mode-control">${copy.transport}<select name="transportMode"><option value="">${copy.choose}</option><option value="flight">${copy.flight}</option><option value="train">${copy.train}</option><option value="car">${copy.car}</option><option value="ferry">${copy.ferry}</option><option value="other">${copy.other}</option></select></label>
        <div class="travel-route">
          <section class="travel-location-card"><p class="travel-location-kicker">${copy.origin}</p><div class="travel-autocomplete" data-travel-combobox><label>${copy.city}<input name="originCity" autocomplete="address-level2" data-travel-autocomplete="city" placeholder="${copy.cityPlaceholder}" /></label></div><div class="travel-autocomplete" data-travel-combobox><label>${copy.airport}<input id="${formId}-origin-airport" name="originAirportLookup" autocomplete="off" data-travel-autocomplete="airport" data-travel-city-target="originCity" data-travel-airport-target="originAirport" placeholder="${copy.airportPlaceholder}" /></label><input name="originAirport" type="hidden" /></div></section>
          <span class="travel-route-arrow" aria-hidden="true">→</span>
          <section class="travel-location-card"><p class="travel-location-kicker">${copy.destination}</p><div class="travel-autocomplete" data-travel-combobox><label>${copy.city}<input name="destinationCity" autocomplete="address-level2" data-travel-autocomplete="city" placeholder="${copy.cityPlaceholder}" /></label></div><div class="travel-autocomplete" data-travel-combobox><label>${copy.airport}<input id="${formId}-destination-airport" name="destinationAirportLookup" autocomplete="off" data-travel-autocomplete="airport" data-travel-city-target="destinationCity" data-travel-airport-target="destinationAirport" placeholder="${copy.airportPlaceholder}" /></label><input name="destinationAirport" type="hidden" /></div></section>
        </div>
        <div class="travel-timing-grid"><label>${copy.departureDate}<input name="departureDate" type="date" /></label><label>${copy.departureTime}<input name="departureTime" type="time" /></label><label>${copy.arrivalDate}<input name="arrivalDate" type="date" /></label><label>${copy.arrivalTime}<input name="arrivalTime" type="time" /></label></div>
        <div class="form-grid"><div class="travel-autocomplete" data-travel-combobox><label>${copy.carrier}<input name="carrier" autocomplete="organization" data-travel-autocomplete="carrier" placeholder="${copy.carrierPlaceholder}" /></label></div><label>${copy.serviceNumber}<input name="serviceNumber" autocomplete="off" autocapitalize="characters" /></label><label>${copy.luggage}<input name="luggageCount" type="number" min="0" max="12" inputmode="numeric" /></label><label class="consent-field"><input name="bulkyLuggage" type="checkbox" /><span>${copy.bulkyLuggage}</span></label></div>
      </fieldset>
      <fieldset class="skipper-transfer-fieldset">
        <legend>${copy.airportTransfer}</legend>
        <p class="field-hint">${copy.airportTransferHint}</p>
        <label><select name="airportMarsalaChoice"><option value="">${copy.airportChoiceNone}</option><option value="transfer">${copy.airportChoiceTransfer}</option><option value="independent">${copy.airportChoiceIndependent}</option><option value="ride_offer">${copy.airportChoiceRideOffer}</option></select></label>
        <label class="consent-field" data-transfer-consent hidden><input name="transferOperatorConsent" type="checkbox" /><span>${copy.operatorConsent}</span></label>
      </fieldset>
      <fieldset class="skipper-transfer-fieldset">
        <legend>${copy.carpool}</legend>
        <p class="field-hint">${copy.carpoolHint}</p>
        <label><select name="carpoolRole"><option value="">${copy.carpoolNone}</option><option value="need_ride">${copy.carpoolNeed}</option><option value="offer_ride">${copy.carpoolOffer}</option></select></label>
        <label data-carpool-seats hidden>${copy.carpoolSeats}<input name="carpoolSeats" type="number" min="0" max="8" inputmode="numeric" /></label>
        <label class="consent-field" data-carpool-consent hidden><input name="carpoolMatchConsent" type="checkbox" /><span>${copy.carpoolConsent}</span></label>
      </fieldset>
      <div class="form-actions"><button class="button button-ghost" type="submit" data-save-state="draft">${copy.saveDraft}</button><button class="button button-primary" type="submit" data-save-state="ready">${copy.confirm}</button><p class="form-message" data-travel-message role="status" aria-live="polite"></p></div>
    </form>`;
  const form = card.querySelector('form');
  form.dataset.saveState = 'draft';
  populateLegForm(form, leg);
  bindLegForm(form, direction);
  return card;
}

function populateLegForm(form, leg) {
  const names = ['transportMode', 'originCity', 'originAirport', 'destinationCity', 'destinationAirport', 'departureDate', 'departureTime', 'arrivalDate', 'arrivalTime', 'carrier', 'serviceNumber', 'luggageCount', 'airportMarsalaChoice', 'carpoolRole', 'carpoolSeats'];
  names.forEach((name) => {
    const element = field(form, name);
    if (element) element.value = leg[name] ?? '';
  });
  field(form, 'bulkyLuggage').checked = leg.bulkyLuggage === true;
  field(form, 'transferOperatorConsent').checked = leg.transferOperatorConsent === true;
  field(form, 'carpoolMatchConsent').checked = leg.carpoolMatchConsent === true;
  setTravelAirportLookup(field(form, 'originAirportLookup'), { city: leg.originCity, code: leg.originAirport });
  setTravelAirportLookup(field(form, 'destinationAirportLookup'), { city: leg.destinationCity, code: leg.destinationAirport });
  updateConditionalFields(form);
}

function updateConditionalFields(form) {
  const airportChoice = inputValue(form, 'airportMarsalaChoice');
  const carpoolRole = inputValue(form, 'carpoolRole');
  const transferConsent = form.querySelector('[data-transfer-consent]');
  const carpoolConsent = form.querySelector('[data-carpool-consent]');
  const carpoolSeats = form.querySelector('[data-carpool-seats]');
  if (airportChoice === 'ride_offer' && carpoolRole !== 'offer_ride') field(form, 'carpoolRole').value = 'offer_ride';
  const resolvedCarpoolRole = inputValue(form, 'carpoolRole');
  const needsTransferConsent = airportChoice === 'transfer';
  transferConsent.hidden = !needsTransferConsent;
  if (!needsTransferConsent) field(form, 'transferOperatorConsent').checked = false;
  carpoolConsent.hidden = !resolvedCarpoolRole;
  carpoolSeats.hidden = resolvedCarpoolRole !== 'offer_ride';
  if (!resolvedCarpoolRole) field(form, 'carpoolMatchConsent').checked = false;
  if (resolvedCarpoolRole !== 'offer_ride') field(form, 'carpoolSeats').value = '0';
}

function formData(form, direction, state) {
  return {
    ...defaultLeg(direction),
    state,
    transportMode: selectValue(form, 'transportMode', TRANSPORT_MODES),
    originCity: inputValue(form, 'originCity'),
    originAirport: inputValue(form, 'originAirport').toUpperCase(),
    destinationCity: inputValue(form, 'destinationCity'),
    destinationAirport: inputValue(form, 'destinationAirport').toUpperCase(),
    departureDate: inputValue(form, 'departureDate'),
    departureTime: inputValue(form, 'departureTime'),
    arrivalDate: inputValue(form, 'arrivalDate'),
    arrivalTime: inputValue(form, 'arrivalTime'),
    carrier: inputValue(form, 'carrier'),
    serviceNumber: inputValue(form, 'serviceNumber').toUpperCase(),
    luggageCount: number(inputValue(form, 'luggageCount'), 0, 12),
    bulkyLuggage: inputChecked(form, 'bulkyLuggage'),
    airportMarsalaChoice: selectValue(form, 'airportMarsalaChoice', AIRPORT_MARSALA_CHOICES),
    transferOperatorConsent: inputChecked(form, 'transferOperatorConsent'),
    carpoolRole: selectValue(form, 'carpoolRole', CARPOOL_ROLES),
    carpoolSeats: number(inputValue(form, 'carpoolSeats'), 0, 8),
    carpoolMatchConsent: inputChecked(form, 'carpoolMatchConsent'),
  };
}

function validationMessage(leg, copy) {
  if (leg.state !== 'ready') return '';
  if (!leg.transportMode) return copy.validationTransport;
  if (leg.airportMarsalaChoice === 'ride_offer' && leg.transportMode !== 'car') return copy.validationRideOfferTransport;
  if (!leg.originCity || !leg.destinationCity) return copy.validationRoute;
  if (!leg.departureDate || !leg.departureTime || !leg.arrivalDate || !leg.arrivalTime) return copy.validationTimes;
  if (leg.transportMode === 'flight' && (!leg.originAirport || !leg.destinationAirport)) return copy.validationFlightAirports;
  if (leg.airportMarsalaChoice === 'transfer' || leg.airportMarsalaChoice === 'ride_offer') {
    const terminalAirport = leg.direction === 'return' ? leg.originAirport : leg.destinationAirport;
    const hasTerminalAirport = TERMINAL_AIRPORTS.has(terminalAirport);
    if (!hasTerminalAirport) return copy.validationTransferAirport;
    if (leg.airportMarsalaChoice === 'transfer' && !leg.transferOperatorConsent) return copy.validationTransferConsent;
  }
  if (leg.carpoolRole && !leg.carpoolMatchConsent) return copy.validationCarpoolConsent;
  if (leg.carpoolRole === 'offer_ride' && leg.carpoolSeats < 1) return copy.validationCarpoolSeats;
  if (leg.airportMarsalaChoice === 'ride_offer' && (leg.carpoolRole !== 'offer_ride' || !leg.carpoolMatchConsent || leg.carpoolSeats < 1)) return copy.validationRideOffer;
  if (`${leg.arrivalDate}T${leg.arrivalTime}` < `${leg.departureDate}T${leg.departureTime}`) return copy.validationChronology;
  return '';
}

function setSaving(form, saving) {
  form.querySelectorAll('[data-save-state]').forEach((button) => { button.disabled = saving; });
}

function bindLegForm(form, direction) {
  installTravelAutocomplete(form);
  form.addEventListener('change', () => updateConditionalFields(form));
  form.querySelectorAll('[data-save-state]').forEach((button) => {
    button.addEventListener('click', () => { form.dataset.saveState = button.dataset.saveState || 'draft'; });
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const requestedState = event.submitter?.dataset.saveState || form.dataset.saveState || 'draft';
    const state = requestedState === 'ready' ? 'ready' : 'draft';
    const copy = copyForLocale();
    const leg = formData(form, direction, state);
    const validation = validationMessage(leg, copy);
    const message = form.querySelector('[data-travel-message]');
    if (validation) {
      setMessage(message, validation, true);
      return;
    }
    setSaving(form, true);
    setMessage(message, copy.saving);
    try {
      const payload = {
        schemaVersion: 1,
        ownerUid: activeSession.user.uid,
        inviteId: activeSession.invite.id,
        direction,
        state: leg.state,
        transportMode: leg.transportMode,
        originCity: leg.originCity,
        originAirport: leg.originAirport,
        destinationCity: leg.destinationCity,
        destinationAirport: leg.destinationAirport,
        departureDate: leg.departureDate,
        departureTime: leg.departureTime,
        arrivalDate: leg.arrivalDate,
        arrivalTime: leg.arrivalTime,
        carrier: leg.carrier,
        serviceNumber: leg.serviceNumber,
        luggageCount: leg.luggageCount,
        bulkyLuggage: leg.bulkyLuggage,
        airportMarsalaChoice: leg.airportMarsalaChoice,
        transferOperatorConsent: leg.transferOperatorConsent,
        carpoolRole: leg.carpoolRole,
        carpoolSeats: leg.carpoolSeats,
        carpoolMatchConsent: leg.carpoolMatchConsent,
        updatedAt: serverTimestamp(),
        updatedBy: activeSession.user.uid,
      };
      await setDoc(legReference(direction), payload);
      const card = form.closest('details');
      card.dataset.travelState = leg.state;
      card.querySelector('[data-travel-state]').textContent = leg.state === 'ready' ? copy.statusReady : copy.statusDraft;
      setMessage(message, leg.state === 'ready' ? copy.readySaved : copy.draftSaved);
    } catch (error) {
      console.error('Impossibile salvare gli spostamenti dell’equipaggio.', error);
      setMessage(message, copy.saveError, true);
    } finally {
      setSaving(form, false);
    }
  });
}

async function loadLegs() {
  const snapshots = await Promise.all(DIRECTIONS.map((direction) => getDoc(legReference(direction))));
  const target = document.querySelector('#travelForms');
  target.replaceChildren(...DIRECTIONS.map((direction, index) => renderLegForm(direction, snapshots[index].exists() ? snapshots[index].data() : null)));
}

async function openTravelWorkspace(session) {
  activeSession = session;
  const { invite, user } = session;
  const [memberSnapshot, briefingSnapshot, acceptanceSnapshot] = await Promise.all([
    getDoc(doc(db, 'boats', invite.boatId, 'members', invite.id)),
    getDoc(doc(db, 'boats', invite.boatId, 'briefing', 'board')),
    getDoc(doc(db, 'boats', invite.boatId, 'ruleAcceptances', invite.id)),
  ]);
  const copy = copyForLocale();
  if (!memberSnapshot.exists()) {
    showBlocked(copy.blockedNoProfile);
    document.querySelector('#travelBlockedLink').href = profileUrl({ edit: true });
    return;
  }
  const briefing = briefingSnapshot.exists() ? briefingSnapshot.data() : null;
  if (!briefing || !text(briefing.rulesText)) {
    showBlocked(copy.blockedNoBriefing);
    return;
  }
  const acceptance = acceptanceSnapshot.exists() ? acceptanceSnapshot.data() : null;
  if (!isAcceptedBriefing(briefing, acceptance, user.uid)) {
    showBlocked(copy.blockedBriefing);
    return;
  }
  try {
    await loadLegs();
  } catch (error) {
    console.error('Impossibile leggere gli spostamenti dell’equipaggio.', error);
    showBlocked(copy.loadError);
    return;
  }
  document.querySelector('#travelOpening').hidden = true;
  document.querySelector('#travelBlocked').hidden = true;
  document.querySelector('#travelWorkspace').hidden = false;
}

currentLocale = isEnglish() ? 'en' : 'it';
applyPageCopy(copyForLocale());

startCrewAreaSession({
  onOpening: (message, isError) => showOpening(message || copyForLocale().openingMessage, isError),
  onInvalid: (error) => {
    const copy = copyForLocale();
    showBlocked(error ? crewAccessErrorMessage(error) : copy.invalidAccess);
    document.querySelector('#travelBlockedLink').href = crewAccessUrl();
  },
  onReady: async (session) => {
    try {
      await openTravelWorkspace(session);
    } catch (error) {
      console.error('Impossibile aprire l’area arrivi e partenze.', error);
      showBlocked(copyForLocale().loadError);
    }
  },
});

window.addEventListener('egadi:localechange', () => {
  const nextLocale = isEnglish() ? 'en' : 'it';
  if (nextLocale === currentLocale) return;
  currentLocale = nextLocale;
  applyPageCopy(copyForLocale());
  const workspace = document.querySelector('#travelWorkspace');
  if (workspace.hidden) return;
  const pendingLegs = new Map([...document.querySelectorAll('[data-travel-direction]')].map((card) => {
    const direction = card.dataset.travelDirection;
    const state = card.dataset.travelState === 'ready' ? 'ready' : 'draft';
    return [direction, formData(card.querySelector('form'), direction, state)];
  }));
  const target = document.querySelector('#travelForms');
  target.replaceChildren(...DIRECTIONS.map((direction) => renderLegForm(direction, pendingLegs.get(direction))));
});

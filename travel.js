import { getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';
import { collection, doc, getDoc, getDocFromServer, getDocs, onSnapshot, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { crewAccessErrorMessage, crewAccessUrl, db, isScriptStale, personalAreaUrl, profileUrl, signOutCrew, startCrewAreaSession, watchForStaleScript, withSaveRetry } from './crew-session.js?v=20260928-blast-experience-v1';
import { installTravelAutocomplete, setTravelAirportLookup } from './travel-autocomplete.js?v=20260925-foreign-airport-fallback-v1';

watchForStaleScript(import.meta.url);

const functions = getFunctions(getApp(), 'europe-west8');

const DIRECTIONS = Object.freeze(['outbound', 'return']);
const TRANSPORT_MODES = new Set(['', 'flight', 'train', 'car', 'ferry', 'other']);
const AIRPORT_MARSALA_CHOICES = new Set(['', 'transfer', 'independent', 'ride_offer']);
const CARPOOL_ROLES = new Set(['', 'need_ride', 'offer_ride']);
const TERMINAL_AIRPORTS = new Set(['TPS', 'PMO']);

let activeSession = null;
let currentLocale = 'it';
let stopLegStatusSubscriptions = [];
let stopTransferProgressSubscription = null;
let currentTransferOperationStatus = {};
let currentPersistedLegs = {};
let transferProgressLoaded = false;
let transferProgressReadError = false;
let activeTransferPricing = null;
let currentBlockedKind = 'default';

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
      workspaceLead: 'You do not need every ticket yet. Start with the outbound trip, save only what you know, then add the return journey when the times are confirmed.',
      flowEyebrow: 'How it works',
      flowTitle: 'Start with what you know.',
      flow: [
        ['1', 'Open outbound', 'Choose the main transport and enter even just the city or airport you already know.'],
        ['2', 'Save a draft', 'Use “Save draft” whenever the ticket or timing is still missing.'],
        ['3', 'Add the return later', 'Outbound and return are separate: if you need a transfer both ways, select it in each trip.'],
      ],
      direction: {
        outbound: { eyebrow: 'Outbound', title: 'Towards Marsala', lead: 'Start with your main transport. If you do not have the ticket yet, a city or airport is enough for now.' },
        return: { eyebrow: 'Return', title: 'From Marsala', lead: 'Add the return journey independently when you know the timing; it does not block the outbound trip.' },
      },
      statusDraft: 'Personal draft',
      statusDraftTransfer: 'Draft · paid transfer selected',
      statusReady: 'Travel details confirmed',
      statusReadyTransfer: 'Travel confirmed · paid transfer requested',
      statusReadyNoTransfer: 'Travel confirmed · no transfer requested',
      statusReadyPending: 'Travel confirmed · transfer not specified',
      stepNavLabel: 'Sections of this journey',
      stepTrip: 'Your trip',
      stepConnection: 'Airport connection',
      stepCarpool: 'Carpool',
      details: 'Journey details',
      skipperSeesSchedule: 'Of your journey your skipper only sees when you arrive, when you leave and by which means: they need it to know when the boat can sail. Flight, carrier, airports and luggage stay visible only to you and, if you request the transfer, to the company arranging it.',
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
      airportTransferDirection: { outbound: 'From the airport to Marsala', return: 'From Marsala to the airport' },
      airportTransferHint: 'The organised transfer is a paid service, available only through Trapani (TPS) or Palermo (PMO). You can change your mind at any time, even after confirming: come back here, change the choice and save again.',
      airportChoiceLabel: 'How will you make this connection?',
      airportChoiceTransfer: 'I want the organised transfer · paid service',
      airportChoiceIndependent: 'I will get there on my own',
      airportChoiceRideOffer: 'I am driving and can offer a ride',
      airportChoiceSummary: { '': 'Getting there on your own', transfer: 'Paid organised transfer selected', independent: 'Getting there on your own', ride_offer: 'Offering a car ride' },
      airportChoiceNeedsConsent: 'Paid organised transfer selected · consent still needed',
      transferAlert: {
        none: {
          outbound: ['You get to Marsala on your own', 'No transfer is arranged for your arrival: nobody is coming to pick you up. If you are sorting it out yourself — taxi, car, train, a ride with others — that is perfectly fine and there is nothing else to do.'],
          return: ['You get to the airport on your own', 'No transfer is arranged for your return: nobody is coming to pick you up. If you are sorting it out yourself — taxi, car, train, a ride with others — that is perfectly fine and there is nothing else to do.'],
        },
        action: 'I want the organised transfer',
        pending: ['Your request has not been sent yet', 'You selected the organised transfer, but without the tick below the request never reaches the company and nobody will come to pick you up.'],
        ready: ['Organised transfer requested', 'The transfer company arranges the connection and confirms time, meeting point and cost. You can still change your mind: come back here and pick another option.'],
      },
      operatorConsent: 'I agree that the organiser and the appointed transfer company may use these travel details and my contact information only to arrange the airport ↔ Marsala connection. The operational record is also backed up in the organisers’ private Google Sheet.',
      carpool: 'Carpool with other participants',
      carpoolHint: 'Optional. It can be used for any journey where a car ride is useful.',
      carpoolNone: 'No carpool request',
      carpoolNeed: 'I am looking for a ride',
      carpoolOffer: 'I can offer a ride',
      carpoolSeats: 'Available seats',
      carpoolConsentNote: 'Choosing a carpool option means you agree that your name and WhatsApp number may be shared, but only with a matched participant who has made the same choice — never before that, never with anyone else.',
      matchesTitle: 'People in your time window',
      matchesHint: 'Only shown once you save this journey with the carpool consent above. Nobody sees your contact until you both accept the same match.',
      matchesLoading: 'Checking for compatible people…',
      matchesError: 'I could not check for compatible people right now.',
      matchesNone: 'No compatible person yet. This updates automatically as others add their journey.',
      matchesNotOptedIn: 'Choose "I am looking for a ride" or "I can offer a ride" above to see compatible people here.',
      matchesFoundOne: 'You have 1 compatible person for this journey.',
      matchesFoundMany: (count) => `You have ${count} compatible people for this journey.`,
      matchProposed: 'Someone else is travelling around the same time.',
      matchAccepted: 'You accepted. Waiting for the other person to accept too.',
      matchRevealed: 'Both accepted — here is the contact.',
      matchAcceptButton: 'I am interested',
      matchDeclineButton: 'Not interested',
      matchWhatsappButton: 'Open WhatsApp',
      matchActing: 'Saving…',
      matchActionError: 'I could not save your answer. Try again shortly.',
      matchClosed: 'This match is no longer available.',
      saveDraft: 'Save draft',
      confirm: { outbound: 'Confirm outbound trip', return: 'Confirm return trip' },
      update: { outbound: 'Save outbound changes', return: 'Save return changes' },
      savedStateLabel: 'Last saved state · you can still change it any time, even after confirming.',
      transferProgress: {
        eyebrow: 'Organised transfer · live status',
        loading: ['Updating status', 'Your request is saved. I am checking the latest update from the transfer organiser.'],
        unavailable: ['Status unavailable', 'Your request is saved, but I cannot check the organiser’s latest update right now. Try again shortly.'],
        draft: ['Trip still in draft', 'The organiser can see this transfer choice, but your trip details are not confirmed yet.'],
        requested: ['Request saved', 'The transfer organiser has not confirmed your connection yet.'],
        planning: ['Being arranged', 'The transfer organiser is working on your connection.'],
        confirmed: ['Transfer confirmed', 'The organiser has confirmed this connection.'],
        completed: ['Transfer completed', 'This connection has been marked as completed.'],
        cancelled: ['Transfer cancelled', 'The organiser has cancelled this request. Contact your skipper before travelling.'],
      },
      draftSaved: 'Draft saved. You can come back and complete it whenever you like.',
      draftSavedTransfer: 'Draft saved with your transfer choice. The coordinator can see it as a trip still to complete.',
      draftSavedTransferNeedsAirport: 'Draft saved with transfer selected. Add Trapani (TPS) or Palermo (PMO) so the coordinator can use this request.',
      readySavedTransfer: 'Trip saved and paid organised transfer requested. The coordinator may now arrange this connection and will confirm the exact fare.',
      readySavedNoTransfer: 'Trip saved. No organised transfer was requested for this journey.',
      readySavedJourneyOnly: 'Trip saved.',
      saving: 'Saving…',
      verifying: 'Slow connection — checking whether it actually saved…',
      staleReload: 'This page was not up to date. Reloading it now, so your confirmation is checked with the latest rules — please try again after it reloads.',
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
      validationAirportChoice: 'Before confirming this flight, choose the airport connection: organised transfer or travelling independently. If you do not know yet, save a draft.',
      validationTransferAirport: 'For an airport ↔ Marsala connection, select Trapani (TPS) or Palermo (PMO) as one of the airports.',
      validationTransferConsent: 'Confirm the consent for the transfer operator before confirming this connection.',
      validationCarpoolSeats: 'Indicate at least one available seat for a ride offer.',
      validationRideOfferTransport: 'Select Car as the main transport to offer a ride.',
      validationRideOffer: 'A ride offer must include the number of available seats.',
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
    workspaceLead: 'Non devi avere già tutti i biglietti. Parti dall’andata, salva solo ciò che sai e aggiungi il rientro quando gli orari sono definitivi.',
    flowEyebrow: 'Come funziona',
    flowTitle: 'Inizia da quello che sai già.',
    flow: [
      ['1', 'Apri l’andata', 'Scegli il mezzo e inserisci anche solo la città o l’aeroporto che già conosci.'],
      ['2', 'Salva una bozza', 'Usa “Salva bozza” se mancano ancora biglietto o orari.'],
      ['3', 'Aggiungi il rientro dopo', 'Andata e rientro sono separati: se vuoi il transfer in entrambi i sensi, selezionalo in tutte e due le schede.'],
    ],
    direction: {
      outbound: { eyebrow: 'Andata', title: 'Verso Marsala', lead: 'Inizia dal mezzo principale. Se non hai ancora il biglietto, per ora bastano città o aeroporto.' },
      return: { eyebrow: 'Rientro', title: 'Da Marsala', lead: 'Aggiungi il ritorno quando conosci gli orari: non blocca mai l’andata.' },
    },
    stepNavLabel: 'Sezioni di questo viaggio',
    stepTrip: 'Il tuo viaggio',
    stepConnection: 'Collegamento aeroporto',
    stepCarpool: 'Passaggio auto',
    statusDraft: 'Bozza personale',
    statusDraftTransfer: 'Bozza · transfer a pagamento selezionato',
    statusReady: 'Informazioni confermate',
    statusReadyTransfer: 'Viaggio confermato · transfer a pagamento richiesto',
    statusReadyNoTransfer: 'Viaggio confermato · nessun transfer richiesto',
    statusReadyPending: 'Viaggio confermato · transfer non indicato',
    details: 'Dettagli del viaggio',
    skipperSeesSchedule: 'Del tuo viaggio lo skipper vede soltanto quando arrivi, quando riparti e con che mezzo: gli serve per sapere a che ora può salpare. Volo, vettore, aeroporti e bagagli restano visibili solo a te e, se chiedi il transfer, alla società che lo organizza.',
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
    airportTransferDirection: { outbound: 'Dall’aeroporto a Marsala', return: 'Da Marsala all’aeroporto' },
    airportTransferHint: 'Il transfer organizzato è un servizio a pagamento, disponibile soltanto da/per Trapani (TPS) o Palermo (PMO). Puoi cambiare idea anche dopo la conferma: torna qui, modifica la scelta e salva di nuovo.',
    airportChoiceLabel: 'Come farai questo collegamento?',
    airportChoiceTransfer: 'Voglio il transfer organizzato · servizio a pagamento',
    airportChoiceIndependent: 'Ci arrivo per conto mio',
    airportChoiceRideOffer: 'Guido io e posso offrire un passaggio',
    airportChoiceSummary: { '': 'Ci arrivi per conto tuo', transfer: 'Transfer organizzato a pagamento selezionato', independent: 'Ci arrivi per conto tuo', ride_offer: 'Offri un passaggio in auto' },
    airportChoiceNeedsConsent: 'Transfer a pagamento selezionato · manca il consenso',
    transferAlert: {
      none: {
        outbound: ['A Marsala ci arrivi tu', 'Nessun transfer è previsto per il tuo arrivo: non c’è nessuno che passa a prenderti. Se ti organizzi per conto tuo — taxi, auto, treno, un passaggio con altri — va benissimo così e non devi fare altro.'],
        return: ['All’aeroporto ci arrivi tu', 'Nessun transfer è previsto per il tuo rientro: non c’è nessuno che passa a prenderti. Se ti organizzi per conto tuo — taxi, auto, treno, un passaggio con altri — va benissimo così e non devi fare altro.'],
      },
      action: 'Voglio il transfer organizzato',
      pending: ['Richiesta non ancora partita', 'Hai scelto il transfer organizzato, ma senza la spunta qui sotto la richiesta non arriva alla società e nessuno verrà a prenderti.'],
      ready: ['Transfer organizzato richiesto', 'La società transfer organizza il collegamento e conferma orario, punto di ritrovo e costo. Puoi cambiare idea anche dopo: torna qui e scegli un’altra opzione.'],
    },
    operatorConsent: 'Acconsento che organizzazione e società transfer incaricata usino questi dati di viaggio e il mio contatto solo per organizzare il collegamento aeroporto ↔ Marsala. La registrazione operativa viene inoltre riportata nel foglio Google privato dell’organizzazione.',
    carpool: 'Passaggi auto con altri partecipanti',
    carpoolHint: 'È facoltativo: serve per qualsiasi tratto in cui un passaggio in auto può essere utile.',
    carpoolNone: 'Nessuna richiesta di passaggio',
    carpoolNeed: 'Cerco un passaggio',
    carpoolOffer: 'Posso offrire un passaggio',
    carpoolSeats: 'Posti disponibili',
    carpoolConsentNote: 'Scegliendo un\'opzione di passaggio acconsenti a condividere nome e numero WhatsApp, ma solo con una persona abbinata che abbia fatto la stessa scelta — mai prima, mai con nessun altro.',
    matchesTitle: 'Persone nella tua fascia oraria',
    matchesHint: 'Compare solo dopo aver salvato questo viaggio con il consenso al matching sopra. Nessuno vede il tuo contatto finché non accettate entrambi lo stesso abbinamento.',
    matchesLoading: 'Controllo le persone compatibili…',
    matchesError: 'Non riesco a controllare le persone compatibili in questo momento.',
    matchesNone: 'Nessuna persona compatibile per ora. Si aggiorna da sola quando altri inseriscono il loro viaggio.',
    matchesNotOptedIn: 'Scegli "Cerco un passaggio" o "Posso offrire un passaggio" qui sopra per vedere qui le persone compatibili.',
    matchesFoundOne: 'C’è 1 persona compatibile per questo viaggio.',
    matchesFoundMany: (count) => `Ci sono ${count} persone compatibili per questo viaggio.`,
    matchProposed: 'Un’altra persona viaggia in una fascia oraria simile alla tua.',
    matchAccepted: 'Hai accettato. In attesa che accetti anche l’altra persona.',
    matchRevealed: 'Avete accettato entrambi — ecco il contatto.',
    matchAcceptButton: 'Mi interessa',
    matchDeclineButton: 'Non mi interessa',
    matchWhatsappButton: 'Apri WhatsApp',
    matchActing: 'Salvataggio…',
    matchActionError: 'Non riesco a salvare la tua risposta. Riprova tra poco.',
    matchClosed: 'Questo abbinamento non è più disponibile.',
    saveDraft: 'Salva bozza',
    confirm: { outbound: 'Conferma andata', return: 'Conferma rientro' },
    update: { outbound: 'Salva modifiche andata', return: 'Salva modifiche rientro' },
    savedStateLabel: 'Ultimo stato salvato · puoi ancora modificarlo quando vuoi, anche dopo aver confermato.',
    transferProgress: {
      eyebrow: 'Transfer organizzato · stato aggiornato',
      loading: ['Stato in aggiornamento', 'La richiesta è salvata. Controllo l’ultimo aggiornamento del gestore.'],
      unavailable: ['Stato non disponibile', 'La richiesta è salvata, ma ora non riesco a leggere l’ultimo aggiornamento del gestore. Riprova tra poco.'],
      draft: ['Viaggio ancora in bozza', 'Il gestore può vedere la scelta del transfer, ma i dati del viaggio non sono ancora confermati.'],
      requested: ['Richiesta salvata', 'Il gestore non ha ancora confermato il collegamento.'],
      planning: ['In organizzazione', 'Il gestore sta organizzando questo collegamento.'],
      confirmed: ['Transfer confermato', 'Il gestore ha confermato il collegamento.'],
      completed: ['Transfer concluso', 'Questo collegamento risulta completato.'],
      cancelled: ['Transfer annullato', 'Il gestore ha annullato la richiesta. Contatta lo skipper prima di partire.'],
    },
    draftSaved: 'Bozza salvata. Puoi tornare qui e completarla quando vuoi.',
    draftSavedTransfer: 'Bozza salvata con transfer selezionato. Il coordinatore potrà vederla come viaggio ancora da completare.',
    draftSavedTransferNeedsAirport: 'Bozza salvata con transfer selezionato. Indica Trapani (TPS) o Palermo (PMO) perché il coordinatore possa usare la richiesta.',
    readySavedTransfer: 'Viaggio salvato e transfer organizzato a pagamento richiesto. Il coordinatore potrà organizzare il collegamento e confermerà il costo esatto.',
    readySavedNoTransfer: 'Viaggio salvato. Per questa tratta non hai richiesto un transfer organizzato.',
    readySavedJourneyOnly: 'Viaggio salvato.',
    saving: 'Salvataggio…',
    verifying: 'Connessione lenta — verifico se è stato comunque salvato…',
    staleReload: 'Questa pagina non era aggiornata. La ricarico per controllare la conferma con le regole più recenti — riprova dopo il ricaricamento.',
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
    validationAirportChoice: 'Prima di confermare il volo, scegli il collegamento aeroporto: transfer organizzato oppure autonomia. Se non lo sai ancora, salva una bozza.',
    validationTransferAirport: 'Per il collegamento aeroporto ↔ Marsala seleziona Trapani (TPS) o Palermo (PMO) in uno dei due aeroporti.',
    validationTransferConsent: 'Prima di confermare questo collegamento, dai il consenso alla società transfer.',
    validationCarpoolSeats: 'Per offrire un passaggio indica almeno un posto disponibile.',
    validationRideOfferTransport: 'Per offrire un passaggio seleziona Auto come mezzo principale.',
    validationRideOffer: 'Per offrire un passaggio indica il numero di posti disponibili.',
    validationChronology: 'L’arrivo non può essere precedente alla partenza.',
    airportSelected: 'Aeroporto selezionato',
  };
}

function text(value) {
  return String(value || '').trim();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
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
    // Nessun transfer finché non lo chiedi. È il default sicuro: il sistema
    // non può prenotare un posto sul pulmino per chi non l'ha chiesto, e chi
    // non apre mai questa pagina non risulta "incompleto" ma semplicemente
    // uno che a Marsala ci arriva per conto suo (richiesta di Silvio,
    // 2/10/2026, dopo il caso Carpe Diem: nove iscritti, nessuno aveva mai
    // aperto il modulo, e il sito li segnalava tutti come da sollecitare).
    airportMarsalaChoice: 'independent',
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
    // Una tratta salvata prima del 2/10/2026 può avere la scelta vuota: ora
    // quel vuoto vale "ci arrivo per conto mio", così il menu non resta in
    // bianco e l'avviso qui sopra dice subito come stanno le cose.
    airportMarsalaChoice: valueOr(text(source.airportMarsalaChoice), AIRPORT_MARSALA_CHOICES) || base.airportMarsalaChoice,
    transferOperatorConsent: source.transferOperatorConsent === true,
    carpoolRole: valueOr(text(source.carpoolRole), CARPOOL_ROLES),
    carpoolSeats: number(source.carpoolSeats, 0, 8),
    carpoolMatchConsent: source.carpoolMatchConsent === true,
  };
}

function legStatusText(leg, copy) {
  if (leg.state !== 'ready') {
    if (leg.airportMarsalaChoice === 'transfer' && leg.transferOperatorConsent) return copy.statusDraftTransfer;
    return copy.statusDraft;
  }
  if (leg.airportMarsalaChoice === 'transfer' && leg.transferOperatorConsent) return copy.statusReadyTransfer;
  if (leg.airportMarsalaChoice === 'independent' || leg.airportMarsalaChoice === 'ride_offer') return copy.statusReadyNoTransfer;
  if (leg.transportMode !== 'flight') return copy.statusReady;
  return copy.statusReadyPending;
}

function savedLegMessage(leg, copy) {
  if (leg.state !== 'ready') {
    if (leg.airportMarsalaChoice === 'transfer' && leg.transferOperatorConsent) {
      const airport = leg.direction === 'return' ? leg.originAirport : leg.destinationAirport;
      return TERMINAL_AIRPORTS.has(airport) ? copy.draftSavedTransfer : copy.draftSavedTransferNeedsAirport;
    }
    return copy.draftSaved;
  }
  if (leg.airportMarsalaChoice === 'transfer' && leg.transferOperatorConsent) return copy.readySavedTransfer;
  if (leg.airportMarsalaChoice) return copy.readySavedNoTransfer;
  return copy.readySavedJourneyOnly;
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
  renderBlockedPresentation(copy);
  document.querySelector('#travelWorkspaceEyebrow').textContent = copy.workspaceEyebrow;
  document.querySelector('#travelWorkspaceTitle').textContent = copy.workspaceTitle;
  document.querySelector('#travelWorkspaceLead').textContent = copy.workspaceLead;
  document.querySelector('#travelFlowEyebrow').textContent = copy.flowEyebrow;
  document.querySelector('#travelFlowTitle').textContent = copy.flowTitle;
  document.querySelector('#backToMyArea').textContent = copy.backToArea;
  document.querySelector('#backToMyArea').href = personalAreaUrl();
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

function blockedPresentation(copy) {
  if (currentBlockedKind === 'login') {
    return {
      eyebrow: isEnglish() ? 'Personal access' : 'Accesso personale',
      title: isEnglish() ? 'Sign back into your area.' : 'Rientra nella tua area.',
      action: isEnglish() ? 'Sign in with phone and code' : 'Accedi con numero e codice',
      href: crewAccessUrl(),
    };
  }
  if (currentBlockedKind === 'profile') {
    return {
      eyebrow: isEnglish() ? 'One step first' : 'Prima un ultimo passo',
      title: isEnglish() ? 'Complete your charter details.' : 'Completa i dati per il charter.',
      action: isEnglish() ? 'Complete my details' : 'Completa i miei dati',
      href: profileUrl({ edit: true }),
    };
  }
  if (currentBlockedKind === 'briefing') {
    return {
      eyebrow: copy.blockedEyebrow,
      title: isEnglish() ? 'Read the briefing before continuing.' : 'Leggi il briefing prima di proseguire.',
      action: isEnglish() ? 'Open my area' : 'Apri la mia area',
      href: personalAreaUrl(),
    };
  }
  return {
    eyebrow: copy.blockedEyebrow,
    title: copy.blockedTitle,
    action: copy.backToArea,
    href: personalAreaUrl(),
  };
}

function renderBlockedPresentation(copy) {
  const presentation = blockedPresentation(copy);
  document.querySelector('#travelBlockedEyebrow').textContent = presentation.eyebrow;
  document.querySelector('#travelBlockedTitle').textContent = presentation.title;
  const link = document.querySelector('#travelBlockedLink');
  link.textContent = presentation.action;
  link.href = presentation.href;
}

function showOpening(message, isError = false) {
  currentBlockedKind = 'default';
  document.querySelector('#travelWorkspace').hidden = true;
  document.querySelector('#travelBlocked').hidden = true;
  document.querySelector('#travelOpening').hidden = false;
  setMessage(document.querySelector('#travelOpeningMessage'), message, isError);
}

function showBlocked(message, { kind = 'default', isError = true } = {}) {
  currentBlockedKind = kind;
  document.querySelector('#travelWorkspace').hidden = true;
  document.querySelector('#travelOpening').hidden = true;
  document.querySelector('#travelBlocked').hidden = false;
  renderBlockedPresentation(copyForLocale());
  setMessage(document.querySelector('#travelBlockedMessage'), message, isError);
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

const TRAVEL_STEPS = ['trip', 'connection', 'carpool'];

// Icone minime per riconoscere le tre sezioni a colpo d'occhio, non solo dal
// testo del pulsante: valigia (viaggio), aereo (collegamento), auto (passaggio).
const TRAVEL_STEP_ICONS = {
  trip: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4" y="7" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 7V5.5A1.5 1.5 0 0 1 9 4h2a1.5 1.5 0 0 1 1.5 1.5V7" stroke="currentColor" stroke-width="1.6"/><path d="M4 10.5h12" stroke="currentColor" stroke-width="1.6"/></svg>',
  connection: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M17 3 3 9.5l5.5 1.6L11 17l2-5.6L17 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  carpool: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 12.5 5.6 8a1.5 1.5 0 0 1 1.4-1h6a1.5 1.5 0 0 1 1.4 1l1.1 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="12.5" width="14" height="3.2" rx="1.2" stroke="currentColor" stroke-width="1.6"/><circle cx="6.2" cy="15.7" r="1.1" fill="currentColor"/><circle cx="13.8" cy="15.7" r="1.1" fill="currentColor"/></svg>',
};

// Una sezione alla volta invece di un unico form lungo: lo stesso principio
// già collaudato nella dashboard economica (Imposta/Richiedi/Controlla).
function setTravelStep(card, step) {
  const validStep = TRAVEL_STEPS.includes(step) ? step : 'trip';
  card.querySelectorAll('[data-travel-step-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.travelStepPanel !== validStep;
  });
  card.querySelectorAll('[data-travel-step]').forEach((button) => {
    if (button.dataset.travelStep === validStep) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}

function bindTravelStepNav(card) {
  card.querySelector('[data-travel-step-nav]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-travel-step]');
    if (!button) return;
    setTravelStep(card, button.dataset.travelStep);
  });
}

function renderLegForm(direction, rawLeg) {
  const copy = copyForLocale();
  const labels = copy.direction[direction];
  const leg = normalizeLeg(rawLeg, direction);
  const formId = `travel-${direction}`;
  const card = document.createElement('details');
  card.className = 'skipper-travel-form skipper-cost-panel';
  // Entrambe le tratte aperte da subito: una persona vede andata e ritorno
  // insieme invece di dover scoprire che la seconda va cliccata (segnalato
  // in test come poco intuitivo).
  card.open = true;
  card.dataset.travelDirection = direction;
  card.dataset.travelState = leg.state;
  card.innerHTML = `
    <summary>
      <span>${labels.title}</span>
      <small data-travel-state>${legStatusText(leg, copy)}</small>
    </summary>
    <form id="${formId}" novalidate>
      <div class="skipper-travel-form-heading">
        <span class="skipper-travel-direction${direction === 'return' ? ' is-return' : ''}" aria-hidden="true">${direction === 'outbound' ? '→' : '←'}</span>
        <div><p class="eyebrow">${labels.eyebrow}</p><h4>${labels.title}</h4><p>${labels.lead}</p></div>
      </div>
      <div class="skipper-travel-status" data-travel-persisted-status role="status" aria-live="polite"><span class="skipper-travel-status-icon" data-travel-persisted-icon aria-hidden="true"></span><div><strong data-travel-persisted-title></strong><span data-travel-persisted-detail></span></div></div>
      <section class="crew-transfer-progress" data-transfer-progress aria-live="polite" hidden></section>
      <div class="transfer-alert" data-transfer-alert role="status" aria-live="polite">
        <p class="transfer-alert-title" data-transfer-alert-title></p>
        <p class="transfer-alert-text" data-transfer-alert-text></p>
        <button class="button button-primary transfer-alert-action" type="button" data-transfer-request hidden>${copy.transferAlert.action}</button>
      </div>
      <nav class="dashboard-view-navigation" data-travel-step-nav aria-label="${copy.stepNavLabel}">
        <button type="button" data-travel-step="trip">${TRAVEL_STEP_ICONS.trip}${copy.stepTrip}</button>
        <button type="button" data-travel-step="connection">${TRAVEL_STEP_ICONS.connection}${copy.stepConnection}</button>
        <button type="button" data-travel-step="carpool">${TRAVEL_STEP_ICONS.carpool}${copy.stepCarpool}</button>
      </nav>
      <fieldset class="skipper-travel-main-fieldset" data-travel-step-panel="trip">
        <legend>${copy.details}</legend>
        <p class="field-hint">${copy.skipperSeesSchedule}</p>
        <label class="travel-mode-control">${copy.transport}<select name="transportMode"><option value="">${copy.choose}</option><option value="flight">${copy.flight}</option><option value="train">${copy.train}</option><option value="car">${copy.car}</option><option value="ferry">${copy.ferry}</option><option value="other">${copy.other}</option></select></label>
        <div class="travel-route">
          <section class="travel-location-card"><p class="travel-location-kicker">${copy.origin}</p><div class="travel-autocomplete" data-travel-combobox><label>${copy.city}<input name="originCity" autocomplete="address-level2" data-travel-autocomplete="city" placeholder="${copy.cityPlaceholder}" /></label></div><div class="travel-autocomplete" data-travel-combobox><label>${copy.airport}<input id="${formId}-origin-airport" name="originAirportLookup" autocomplete="off" data-travel-autocomplete="airport" data-travel-city-target="originCity" data-travel-airport-target="originAirport" placeholder="${copy.airportPlaceholder}" /></label><input name="originAirport" type="hidden" /></div></section>
          <span class="travel-route-arrow" aria-hidden="true">→</span>
          <section class="travel-location-card"><p class="travel-location-kicker">${copy.destination}</p><div class="travel-autocomplete" data-travel-combobox><label>${copy.city}<input name="destinationCity" autocomplete="address-level2" data-travel-autocomplete="city" placeholder="${copy.cityPlaceholder}" /></label></div><div class="travel-autocomplete" data-travel-combobox><label>${copy.airport}<input id="${formId}-destination-airport" name="destinationAirportLookup" autocomplete="off" data-travel-autocomplete="airport" data-travel-city-target="destinationCity" data-travel-airport-target="destinationAirport" placeholder="${copy.airportPlaceholder}" /></label><input name="destinationAirport" type="hidden" /></div></section>
        </div>
        <div class="travel-timing-grid"><label>${copy.departureDate}<input name="departureDate" type="date" /></label><label>${copy.departureTime}<input name="departureTime" type="time" /></label><label>${copy.arrivalDate}<input name="arrivalDate" type="date" /></label><label>${copy.arrivalTime}<input name="arrivalTime" type="time" /></label></div>
        <div class="form-grid"><div class="travel-autocomplete" data-travel-combobox><label>${copy.carrier}<input name="carrier" autocomplete="organization" data-travel-autocomplete="carrier" placeholder="${copy.carrierPlaceholder}" /></label></div><label>${copy.serviceNumber}<input name="serviceNumber" autocomplete="off" autocapitalize="characters" /></label><label>${copy.luggage}<input name="luggageCount" type="number" min="0" max="12" inputmode="numeric" /></label><label class="consent-field"><input name="bulkyLuggage" type="checkbox" /><span>${copy.bulkyLuggage}</span></label></div>
      </fieldset>
      <fieldset class="skipper-transfer-fieldset" data-travel-step-panel="connection">
        <legend>${copy.airportTransferDirection[direction]}</legend>
        <p class="field-hint">${copy.airportTransferHint}</p>
        <label>${copy.airportChoiceLabel}<select name="airportMarsalaChoice"><option value="independent">${copy.airportChoiceIndependent}</option><option value="transfer">${copy.airportChoiceTransfer}</option><option value="ride_offer">${copy.airportChoiceRideOffer}</option></select></label>
        <p class="field-hint transfer-price-note" data-transfer-price-note hidden></p>
        <label class="consent-field" data-transfer-consent hidden><input name="transferOperatorConsent" type="checkbox" /><span>${copy.operatorConsent}</span></label>
      </fieldset>
      <fieldset class="skipper-transfer-fieldset" data-travel-step-panel="carpool">
        <legend>${copy.carpool}</legend>
        <p class="field-hint">${copy.carpoolHint}</p>
        <label><select name="carpoolRole"><option value="">${copy.carpoolNone}</option><option value="need_ride">${copy.carpoolNeed}</option><option value="offer_ride">${copy.carpoolOffer}</option></select></label>
        <label data-carpool-seats hidden>${copy.carpoolSeats}<input name="carpoolSeats" type="number" min="0" max="8" inputmode="numeric" /></label>
        <p class="field-hint" data-carpool-consent-note hidden>${copy.carpoolConsentNote}</p>
      </fieldset>
      <fieldset class="skipper-transfer-fieldset travel-matches" data-travel-matches data-travel-step-panel="carpool">
        <legend>${copy.matchesTitle}</legend>
        <p class="field-hint">${copy.matchesHint}</p>
        <div data-travel-matches-list></div>
      </fieldset>
      <p class="field-hint" data-travel-connection-summary aria-live="polite"></p>
      <div class="form-actions"><button class="button button-ghost" type="submit" data-save-state="draft">${copy.saveDraft}</button><button class="button button-primary" type="submit" data-save-state="ready">${copy.confirm[direction]}</button><p class="form-message" data-travel-message role="status" aria-live="polite"></p></div>
    </form>`;
  const form = card.querySelector('form');
  form.dataset.saveState = 'draft';
  populateLegForm(form, leg);
  updatePersistedLegState(card, direction, leg, copy);
  bindLegForm(form, direction);
  bindTravelStepNav(card);
  setTravelStep(card, 'trip');
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
  setTravelAirportLookup(field(form, 'originAirportLookup'), { city: leg.originCity, code: leg.originAirport });
  setTravelAirportLookup(field(form, 'destinationAirportLookup'), { city: leg.destinationCity, code: leg.destinationAirport });
  updateConditionalFields(form);
}

// L'avviso grosso sopra la scelta. Dice sempre che cosa succede DAVVERO
// adesso, non che cosa manca da compilare: finché non chiedi il transfer, a
// Marsala ci arrivi tu. Sostituisce la vecchia pre-selezione automatica di
// "Transfer organizzato", che riempiva la scelta al posto della persona e
// lasciava tutti in attesa del consenso (richiesta di Silvio, 2/10/2026).
function updateTransferAlert(form, direction, airportChoice, hasConsent) {
  const alert = form.querySelector('[data-transfer-alert]');
  if (!alert || !direction) return;
  const copy = copyForLocale();
  const action = alert.querySelector('[data-transfer-request]');
  const requested = airportChoice === 'transfer';
  const tone = !requested ? 'none' : hasConsent ? 'ready' : 'pending';
  const [title, body] = tone === 'none' ? copy.transferAlert.none[direction] : copy.transferAlert[tone];
  alert.dataset.transferAlertTone = tone;
  alert.querySelector('[data-transfer-alert-title]').textContent = title;
  alert.querySelector('[data-transfer-alert-text]').textContent = body;
  if (action) {
    action.textContent = copy.transferAlert.action;
    action.hidden = requested;
  }
}

function formatEuro(cents) {
  return new Intl.NumberFormat(isEnglish() ? 'en-GB' : 'it-IT', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}

// Il transfer non è gratuito: senza questo avviso la scelta "Transfer
// organizzato" sembrava senza costi (segnalato dal titolare, 28/09/2026). Il
// minimo fatturabile si applica anche viaggiando da soli: lo diciamo esplicito
// per non far scoprire il costo pieno solo a richiesta confermata.
//
// "Sei da solo" non resta un'ipotesi: appena la richiesta è salvata,
// currentTransferOperationStatus[`${direction}TransferCompanions`] (scritto
// da materializeCrewTravel/refreshTransferCompanionCounts) dice quante altre
// persone attive risultano sulla stessa tratta/data/aeroporto in questo
// momento — così chi ne ha bisogno può decidere di arrangiarsi diversamente
// (richiesta di Silvio, 30/09/2026: "deve essere consapevole che a lui non
// ha alternative... quindi lui è da solo").
function transferPriceNote(terminalAirport, direction) {
  const fallback = isEnglish()
    ? 'The organised transfer is a paid service. The transfer company will confirm the exact fare before final arrangements.'
    : 'Il transfer organizzato è un servizio a pagamento. La società transfer confermerà il costo esatto prima dell’organizzazione definitiva.';
  if (!TERMINAL_AIRPORTS.has(terminalAirport) || !activeTransferPricing) return fallback;
  const perPersonCents = terminalAirport === 'PMO'
    ? activeTransferPricing.pmoPricePerPersonCents
    : activeTransferPricing.tpsPricePerPersonCents;
  if (!Number.isFinite(perPersonCents) || perPersonCents <= 0) return fallback;
  if (!Number.isInteger(activeTransferPricing.minimumBillablePersons) || activeTransferPricing.minimumBillablePersons <= 0) return fallback;
  const minimum = activeTransferPricing.minimumBillablePersons;
  const minimumTotalCents = perPersonCents * minimum;
  const base = isEnglish()
    ? `The transfer is not free: ${formatEuro(perPersonCents)} per person, minimum ${minimum} people billed (${formatEuro(minimumTotalCents)} even if you travel alone). The transfer company will confirm the exact cost once your group is organised.`
    : `Il transfer non è gratuito: ${formatEuro(perPersonCents)} a persona, minimo ${minimum} persone fatturate (${formatEuro(minimumTotalCents)} anche se viaggi da solo). Il costo esatto te lo conferma la società transfer quando organizza il gruppo.`;
  const companions = direction ? currentTransferOperationStatus?.[`${direction}TransferCompanions`] : null;
  if (!Number.isInteger(companions)) return base;
  if (companions === 0) {
    return `${base}${isEnglish()
      ? ' Right now you are the only person on this route and date: the minimum fare would fall entirely on you.'
      : ' Al momento risulti l’unica persona su questa tratta e data: il minimo fatturato ricadrebbe interamente su di te.'}`;
  }
  return `${base}${isEnglish()
    ? ` Right now ${companions} other ${companions === 1 ? 'person shares' : 'people share'} this route and date, so the cost can be split.`
    : ` Al momento ci sono anche altre ${companions} ${companions === 1 ? 'persona' : 'persone'} sulla stessa tratta e data: il costo può essere diviso.`}`;
}

function updateConditionalFields(form) {
  const airportChoice = inputValue(form, 'airportMarsalaChoice');
  const carpoolRole = inputValue(form, 'carpoolRole');
  const transferConsent = form.querySelector('[data-transfer-consent]');
  const carpoolConsentNote = form.querySelector('[data-carpool-consent-note]');
  const carpoolSeats = form.querySelector('[data-carpool-seats]');
  if (airportChoice === 'ride_offer' && carpoolRole !== 'offer_ride') field(form, 'carpoolRole').value = 'offer_ride';
  const resolvedCarpoolRole = inputValue(form, 'carpoolRole');
  const needsTransferConsent = airportChoice === 'transfer';
  transferConsent.hidden = !needsTransferConsent;
  if (!needsTransferConsent) field(form, 'transferOperatorConsent').checked = false;
  const direction = form.closest('[data-travel-direction]')?.dataset.travelDirection;
  const priceNote = form.querySelector('[data-transfer-price-note]');
  if (priceNote) {
    const terminalAirport = (direction === 'return' ? inputValue(form, 'originAirport') : inputValue(form, 'destinationAirport')).toUpperCase();
    const noteText = needsTransferConsent ? transferPriceNote(terminalAirport, direction) : '';
    priceNote.textContent = noteText;
    priceNote.hidden = !noteText;
  }
  updateTransferAlert(form, direction, airportChoice, inputChecked(form, 'transferOperatorConsent'));
  const summary = form.querySelector('[data-travel-connection-summary]');
  if (direction && summary) {
    const copy = copyForLocale();
    const choiceText = needsTransferConsent && !inputChecked(form, 'transferOperatorConsent')
      ? copy.airportChoiceNeedsConsent : copy.airportChoiceSummary[airportChoice];
    summary.textContent = `${copy.direction[direction].eyebrow} · ${choiceText}`;
  }
  // Scegliere un ruolo passaggio è già il consenso: niente casella separata
  // (vedi ARRIVI_PARTENZE_SPEC.md), solo una nota informativa quando serve.
  carpoolConsentNote.hidden = !resolvedCarpoolRole;
  carpoolSeats.hidden = resolvedCarpoolRole !== 'offer_ride';
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
    // Scegliere un ruolo passaggio è già il consenso al matching: non esiste
    // una casella separata (vedi ARRIVI_PARTENZE_SPEC.md e copy.carpoolConsentNote).
    carpoolMatchConsent: selectValue(form, 'carpoolRole', CARPOOL_ROLES) !== '',
  };
}

function validationMessage(leg, copy) {
  if (leg.state !== 'ready') return '';
  if (!leg.transportMode) return copy.validationTransport;
  if (leg.airportMarsalaChoice === 'ride_offer' && leg.transportMode !== 'car') return copy.validationRideOfferTransport;
  if (!leg.originCity || !leg.destinationCity) return copy.validationRoute;
  if (!leg.departureDate || !leg.departureTime || !leg.arrivalDate || !leg.arrivalTime) return copy.validationTimes;
  if (leg.transportMode === 'flight' && (!leg.originAirport || !leg.destinationAirport)) return copy.validationFlightAirports;
  if (leg.transportMode === 'flight' && !leg.airportMarsalaChoice) return copy.validationAirportChoice;
  if (leg.airportMarsalaChoice === 'transfer' || leg.airportMarsalaChoice === 'ride_offer') {
    const terminalAirport = leg.direction === 'return' ? leg.originAirport : leg.destinationAirport;
    const hasTerminalAirport = TERMINAL_AIRPORTS.has(terminalAirport);
    if (!hasTerminalAirport) return copy.validationTransferAirport;
    if (leg.airportMarsalaChoice === 'transfer' && !leg.transferOperatorConsent) return copy.validationTransferConsent;
  }
  if (leg.carpoolRole === 'offer_ride' && leg.carpoolSeats < 1) return copy.validationCarpoolSeats;
  if (leg.airportMarsalaChoice === 'ride_offer' && (leg.carpoolRole !== 'offer_ride' || leg.carpoolSeats < 1)) return copy.validationRideOffer;
  if (`${leg.arrivalDate}T${leg.arrivalTime}` < `${leg.departureDate}T${leg.departureTime}`) return copy.validationChronology;
  return '';
}

function setSaving(form, saving) {
  form.querySelectorAll('[data-save-state]').forEach((button) => { button.disabled = saving; });
}

function updatePersistedLegState(card, direction, leg, copy) {
  card.dataset.travelState = leg.state;
  const status = legStatusText(leg, copy);
  card.querySelector('[data-travel-state]').textContent = status;
  card.querySelector('[data-travel-persisted-title]').textContent = status;
  card.querySelector('[data-travel-persisted-detail]').textContent = copy.savedStateLabel;
  const icon = card.querySelector('[data-travel-persisted-icon]');
  icon.textContent = leg.state === 'ready' ? '✓' : '!';
  icon.classList.toggle('is-pending', leg.state !== 'ready');
  // Il form porta lo stesso data-save-state="draft"/"ready" del pulsante
  // corrispondente (serve a sapere cosa salvare quando si preme Invio, vedi
  // riga 585 e il click handler in bindLegForm): un selettore senza `button`
  // trova prima il form stesso, che lo precede nell'ordine del documento, e
  // gli applica hidden/testo pensando di modificare il pulsante — bug reale
  // del 25/09/2026, catturato dal vivo (il volo confermato spariva del
  // tutto). Restringere a `button[...]` esclude sempre il form.
  const draftButton = card.querySelector('button[data-save-state="draft"]');
  draftButton.hidden = leg.state === 'ready';
  draftButton.type = leg.state === 'ready' ? 'button' : 'submit';
  card.querySelector('button[data-save-state="ready"]').textContent = leg.state === 'ready' ? copy.update[direction] : copy.confirm[direction];
  renderTransferProgress(card, direction, currentPersistedLegs[direction] || leg, copy);
}

// Prima diceva solo "chiedi al gestore i dettagli del ritrovo": il punto e
// l'orario che il gestore imposta sulla sua coda arrivano già su questo
// stesso documento (crewTravelStatus, via writeCrewTransferOperationStatus)
// quindi si possono mostrare qui, invece di rimandare a un messaggio esterno
// che l'operatore dovrebbe scrivere a mano a ogni persona (richiesta di
// Silvio, 30/09/2026). Mezzo assegnato e note restano solo dell'operatore.
function meetingDetailText(direction, key) {
  const meetingPoint = String(currentTransferOperationStatus?.[`${direction}MeetingPoint`] || '').trim();
  const meetingTime = String(currentTransferOperationStatus?.[`${direction}MeetingTime`] || '').trim();
  if (meetingPoint || meetingTime) {
    const timeLabel = meetingTime ? (isEnglish() ? `time ${meetingTime}` : `ore ${meetingTime}`) : '';
    const bits = [meetingPoint, timeLabel].filter(Boolean).join(' · ');
    return isEnglish() ? ` Meeting point: ${bits}.` : ` Punto di ritrovo: ${bits}.`;
  }
  if (key === 'planning' || key === 'confirmed') {
    return isEnglish()
      ? ' The meeting point will appear here as soon as the organiser sets it.'
      : ' Il punto di ritrovo comparirà qui appena il gestore lo imposta.';
  }
  return '';
}

function renderTransferProgress(card, direction, leg, copy) {
  const target = card.querySelector('[data-transfer-progress]');
  if (leg.airportMarsalaChoice !== 'transfer' || !leg.transferOperatorConsent) {
    target.hidden = true;
    target.replaceChildren();
    return;
  }
  const operational = currentTransferOperationStatus[`${direction}OperationStatus`];
  let key = 'requested';
  if (leg.state !== 'ready') key = 'draft';
  else if (transferProgressReadError) key = 'unavailable';
  else if (!transferProgressLoaded) key = 'loading';
  else if (operational === 'planned') key = 'planning';
  else if (['confirmed', 'completed', 'cancelled'].includes(operational)) key = operational;
  const [title, detail] = copy.transferProgress[key];
  const terminalAirport = String(direction === 'return' ? leg.originAirport || '' : leg.destinationAirport || '').toUpperCase();
  const paidServiceDetail = transferPriceNote(terminalAirport, direction);
  const meetingDetail = meetingDetailText(direction, key);
  const icon = key === 'confirmed' || key === 'completed' ? '✓' : key === 'cancelled' || key === 'draft' ? '!' : '•';
  target.hidden = false;
  target.className = `crew-transfer-progress crew-transfer-progress--${key}`;
  target.innerHTML = `<span class="crew-transfer-progress-icon" aria-hidden="true">${icon}</span><div><p class="eyebrow">${copy.transferProgress.eyebrow}</p><strong>${title}</strong><span>${detail}${meetingDetail} ${paidServiceDetail}</span></div>`;
}

function applySavedLegState(card, message, direction, leg, copy) {
  currentPersistedLegs[direction] = leg;
  updatePersistedLegState(card, direction, leg, copy);
  setMessage(message, `${copy.direction[direction].eyebrow}: ${savedLegMessage(leg, copy)}`);
}

function bindLegForm(form, direction) {
  installTravelAutocomplete(form);
  form.addEventListener('input', () => { form.dataset.travelDirty = 'true'; });
  form.addEventListener('change', () => {
    form.dataset.travelDirty = 'true';
    updateConditionalFields(form);
    const message = form.querySelector('[data-travel-message]');
    if (message.classList.contains('is-error')) setMessage(message, '');
  });
  form.querySelectorAll('[data-save-state]').forEach((button) => {
    button.addEventListener('click', () => { form.dataset.saveState = button.dataset.saveState || 'draft'; });
  });
  // Dall'avviso al transfer in un tocco: il pulsante sceglie per la persona e
  // la porta subito sul consenso, che resta l'unico passo che deve fare lei.
  form.querySelector('[data-transfer-request]')?.addEventListener('click', () => {
    const choiceField = field(form, 'airportMarsalaChoice');
    if (!choiceField) return;
    choiceField.value = 'transfer';
    form.dataset.travelDirty = 'true';
    updateConditionalFields(form);
    // Il consenso vive nel passo "Collegamento aeroporto": aprirlo fa parte
    // del gesto, altrimenti la spunta resta in un pannello che non si vede.
    setTravelStep(form.closest('details'), 'connection');
    const consent = field(form, 'transferOperatorConsent');
    consent?.focus();
    consent?.closest('label')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
      const card = form.closest('details');
      if (validation === copy.validationAirportChoice || validation === copy.validationTransferConsent) setTravelStep(card, 'connection');
      else if (validation === copy.validationCarpoolSeats || validation === copy.validationRideOffer) setTravelStep(card, 'carpool');
      else setTravelStep(card, 'trip');
      setMessage(message, validation, true);
      return;
    }
    setMessage(message, copy.saving);
    if (state === 'ready') {
      // Prima di confermare (non per le bozze, meno critiche) verifica che
      // la pagina esegua ancora le regole di validazione più recenti: una
      // scheda rimasta aperta da prima di una pubblicazione potrebbe
      // lasciar passare una conferma incompleta con la logica vecchia,
      // come successo il 23/09/2026 con Mirella Miccio.
      if (await isScriptStale(import.meta.url)) {
        setMessage(message, copy.staleReload, true);
        window.location.reload();
        return;
      }
    }
    setSaving(form, true);
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
    const card = form.closest('details');
    try {
      await withSaveRetry(
        () => setDoc(legReference(direction), payload),
        () => setMessage(message, copy.verifying),
      );
      form.dataset.travelDirty = 'false';
      populateLegForm(form, leg);
      applySavedLegState(card, message, direction, leg, copy);
      try {
        await renderMatchesSection(card, direction, leg);
      } catch (matchesError) {
        // Il salvataggio è già confermato sopra: un problema nella sezione
        // passaggi compatibili non deve mai sembrare un salvataggio fallito.
        console.error('Salvataggio riuscito, ma non sono riuscito ad aggiornare i passaggi compatibili.', matchesError);
      }
    } catch (error) {
      console.error('Impossibile salvare gli spostamenti dell’equipaggio.', error);
      setMessage(message, copy.saveError, true);
    } finally {
      setSaving(form, false);
    }
  });
}

function canHaveMatches(leg) {
  return leg.state === 'ready'
    && (leg.carpoolRole === 'need_ride' || leg.carpoolRole === 'offer_ride')
    && leg.carpoolMatchConsent === true;
}

function matchCandidateMarkup(candidate, copy) {
  if (candidate.status === 'revealed') {
    const digits = String(candidate.counterpartWhatsapp || '').replace(/\D/g, '');
    const whatsapp = digits ? `<a class="button button-primary" href="https://wa.me/${digits}" target="_blank" rel="noopener noreferrer">${copy.matchWhatsappButton}</a>` : '';
    return `<article class="travel-match travel-match-revealed" data-match-id="${candidate.id}">
      <p>${copy.matchRevealed}</p>
      <p class="travel-match-name">${escapeHtml(candidate.counterpartName || '')}</p>
      ${whatsapp}
    </article>`;
  }
  if (candidate.status === 'accepted') {
    return `<article class="travel-match" data-match-id="${candidate.id}"><p>${copy.matchAccepted}</p></article>`;
  }
  return `<article class="travel-match" data-match-id="${candidate.id}">
    <p>${copy.matchProposed}</p>
    <div class="travel-match-actions">
      <button class="button button-primary" type="button" data-match-respond="accept">${copy.matchAcceptButton}</button>
      <button class="button button-ghost" type="button" data-match-respond="decline">${copy.matchDeclineButton}</button>
    </div>
    <p class="travel-match-message" data-match-message role="status" aria-live="polite"></p>
  </article>`;
}

async function handleMatchResponse(event) {
  const button = event.target.closest('[data-match-respond]');
  if (!button) return;
  const card = button.closest('[data-match-id]');
  const matchId = card?.dataset.matchId;
  if (!matchId) return;
  const response = button.dataset.matchRespond;
  const copy = copyForLocale();
  const message = card.querySelector('[data-match-message]');
  card.querySelectorAll('button').forEach((el) => { el.disabled = true; });
  setMessage(message, copy.matchActing);
  try {
    await httpsCallable(functions, 'respondToTravelMatch')({ matchId, response });
    const section = card.closest('[data-travel-matches]');
    const direction = section.closest('[data-travel-direction]').dataset.travelDirection;
    const legSnapshot = await getDoc(legReference(direction));
    await renderMatchesSection(section.closest('details'), direction, normalizeLeg(legSnapshot.exists() ? legSnapshot.data() : null, direction));
  } catch (error) {
    console.error('Impossibile salvare la risposta all’abbinamento.', error);
    setMessage(message, copy.matchActionError, true);
    card.querySelectorAll('button').forEach((el) => { el.disabled = false; });
  }
}

async function renderMatchesSection(card, direction, leg) {
  const copy = copyForLocale();
  const section = card.querySelector('[data-travel-matches]');
  const list = section.querySelector('[data-travel-matches-list]');
  // La visibilità del fieldset dipende solo dallo step attivo (vedi
  // setTravelStep): qui si aggiorna solo il contenuto della lista.
  if (!canHaveMatches(leg)) {
    list.innerHTML = `<p class="empty-state">${copy.matchesNotOptedIn}</p>`;
    return;
  }
  list.innerHTML = `<p>${copy.matchesLoading}</p>`;
  try {
    const snapshot = await getDocs(collection(legReference(direction), 'matchCandidates'));
    if (snapshot.empty) {
      list.innerHTML = `<p class="empty-state">${copy.matchesNone}</p>`;
      return;
    }
    const candidates = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const summary = candidates.length === 1 ? copy.matchesFoundOne : copy.matchesFoundMany(candidates.length);
    list.innerHTML = `<p class="travel-matches-summary">${summary}</p>${candidates.map((candidate) => matchCandidateMarkup(candidate, copy)).join('')}`;
    list.removeEventListener('click', handleMatchResponse);
    list.addEventListener('click', handleMatchResponse);
  } catch (error) {
    console.error('Impossibile leggere le persone compatibili.', error);
    list.innerHTML = `<p class="empty-state">${copy.matchesError}</p>`;
  }
}

// Aggiorna lo stato dal server e riallinea i campi solo se la persona non
// sta compilando modifiche. Una lettura locale obsoleta non deve far apparire
// di nuovo "da confermare" una tratta già salvata.
function watchLegStatus(card, direction) {
  return onSnapshot(legReference(direction), { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    const leg = normalizeLeg(snapshot.exists() ? snapshot.data() : null, direction);
    currentPersistedLegs[direction] = leg;
    const copy = copyForLocale();
    updatePersistedLegState(card, direction, leg, copy);
    const form = card.querySelector('form');
    if (form?.dataset.travelDirty !== 'true') populateLegForm(form, leg);
  }, (error) => {
    console.error('Impossibile seguire in diretta lo stato di questa tratta.', error);
  });
}

async function loadLegs() {
  stopLegStatusSubscriptions.forEach((unsubscribe) => unsubscribe());
  stopLegStatusSubscriptions = [];
  if (stopTransferProgressSubscription) stopTransferProgressSubscription();
  currentTransferOperationStatus = {};
  transferProgressLoaded = false;
  transferProgressReadError = false;
  const snapshots = await Promise.all(DIRECTIONS.map((direction) => getDocFromServer(legReference(direction))));
  const target = document.querySelector('#travelForms');
  const legs = DIRECTIONS.map((direction, index) => normalizeLeg(snapshots[index].exists() ? snapshots[index].data() : null, direction));
  currentPersistedLegs = Object.fromEntries(DIRECTIONS.map((direction, index) => [direction, legs[index]]));
  const cards = DIRECTIONS.map((direction, index) => renderLegForm(direction, snapshots[index].exists() ? snapshots[index].data() : null));
  target.replaceChildren(...cards);
  await Promise.all(cards.map((card, index) => renderMatchesSection(card, DIRECTIONS[index], legs[index])));
  stopLegStatusSubscriptions = cards.map((card, index) => watchLegStatus(card, DIRECTIONS[index]));
  const progressRef = doc(db, 'boats', activeSession.invite.boatId, 'crewTravelStatus', activeSession.invite.id);
  stopTransferProgressSubscription = onSnapshot(progressRef, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    transferProgressLoaded = true;
    transferProgressReadError = false;
    currentTransferOperationStatus = snapshot.exists() ? snapshot.data() : {};
    document.querySelectorAll('[data-travel-direction]').forEach((card) => {
      const direction = card.dataset.travelDirection;
      renderTransferProgress(card, direction, currentPersistedLegs[direction] || defaultLeg(direction), copyForLocale());
    });
  }, (error) => {
    console.error('Impossibile aggiornare lo stato operativo del transfer.', error);
    transferProgressReadError = true;
    document.querySelectorAll('[data-travel-direction]').forEach((card) => {
      const direction = card.dataset.travelDirection;
      renderTransferProgress(card, direction, currentPersistedLegs[direction] || defaultLeg(direction), copyForLocale());
    });
  });
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
    showBlocked(copy.blockedNoProfile, { kind: 'profile', isError: false });
    return;
  }
  const briefing = briefingSnapshot.exists() ? briefingSnapshot.data() : null;
  if (!briefing || !text(briefing.rulesText)) {
    showBlocked(copy.blockedNoBriefing, { kind: 'briefing', isError: false });
    return;
  }
  const acceptance = acceptanceSnapshot.exists() ? acceptanceSnapshot.data() : null;
  if (!isAcceptedBriefing(briefing, acceptance, user.uid)) {
    showBlocked(copy.blockedBriefing, { kind: 'briefing', isError: false });
    return;
  }
  try {
    // Il transfer non è gratuito: senza questo dato la scelta "Transfer
    // organizzato" sembrava senza costi (segnalato dal titolare, 28/09/2026).
    // Un mancato aggiornamento in diretta qui non è critico: il prezzo
    // cambia raramente e si aggiorna comunque al prossimo caricamento.
    const pricingSnapshot = await getDoc(doc(db, 'events', 'egadi-2026', 'transferPricing', 'default'));
    activeTransferPricing = pricingSnapshot.exists() ? pricingSnapshot.data() : null;
  } catch (error) {
    console.info('Prezzo transfer non disponibile.', error?.code || error);
    activeTransferPricing = null;
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
    showBlocked(error ? crewAccessErrorMessage(error) : copy.invalidAccess, { kind: 'login' });
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

document.querySelector('#travelSignOutButton')?.addEventListener('click', async () => {
  try {
    await signOutCrew();
  } finally {
    window.location.assign('index.html');
  }
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
    const form = card.querySelector('form');
    return [direction, { leg: formData(form, direction, state), dirty: form.dataset.travelDirty === 'true' }];
  }));
  const target = document.querySelector('#travelForms');
  const cards = DIRECTIONS.map((direction) => {
    const pending = pendingLegs.get(direction);
    const card = renderLegForm(direction, currentPersistedLegs[direction] || pending.leg);
    if (pending.dirty) populateLegForm(card.querySelector('form'), pending.leg);
    card.querySelector('form').dataset.travelDirty = String(pending.dirty);
    return card;
  });
  target.replaceChildren(...cards);
  // Il cambio lingua ridisegna le card senza passare da loadLegs(): senza
  // questo, gli ascoltatori in diretta dello stato restavano agganciati alle
  // card precedenti (ormai rimosse dal DOM) e le nuove card smettevano di
  // aggiornarsi finché non si ricaricava tutta la pagina.
  stopLegStatusSubscriptions.forEach((unsubscribe) => unsubscribe());
  stopLegStatusSubscriptions = cards.map((card, index) => watchLegStatus(card, DIRECTIONS[index]));
});

window.addEventListener('beforeunload', () => {
  stopLegStatusSubscriptions.forEach((unsubscribe) => unsubscribe());
  if (stopTransferProgressSubscription) stopTransferProgressSubscription();
});

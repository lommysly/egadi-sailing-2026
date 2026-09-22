// Cataloghi locali: evitano API a pagamento e guidano la compilazione veloce.
// "Altra città" e "Altra compagnia" restano disponibili per non bloccare casi reali.
export const TRANSFER_CATALOG_VERSION = '2026-09-11';

export const CITY_CATALOG = [
  { id: 'alghero', label: 'Alghero', airportCodes: ['AHO'] },
  { id: 'ancona', label: 'Ancona', airportCodes: ['AOI'] },
  { id: 'bari', label: 'Bari', airportCodes: ['BRI'] },
  { id: 'bergamo', label: 'Bergamo', airportCodes: ['BGY', 'MXP', 'LIN'] },
  { id: 'bologna', label: 'Bologna', airportCodes: ['BLQ'] },
  { id: 'brescia', label: 'Brescia', airportCodes: ['BGY', 'VRN', 'MXP'] },
  { id: 'brindisi', label: 'Brindisi', airportCodes: ['BDS'] },
  { id: 'cagliari', label: 'Cagliari', airportCodes: ['CAG'] },
  { id: 'catania', label: 'Catania', airportCodes: ['CTA'] },
  { id: 'firenze', label: 'Firenze', airportCodes: ['FLR', 'PSA'] },
  { id: 'genova', label: 'Genova', airportCodes: ['GOA'] },
  { id: 'lamezia-terme', label: 'Lamezia Terme', airportCodes: ['SUF'] },
  { id: 'lecce', label: 'Lecce', airportCodes: ['BDS', 'BRI'] },
  { id: 'marsala', label: 'Marsala', airportCodes: ['TPS', 'PMO'] },
  { id: 'milano', label: 'Milano', airportCodes: ['LIN', 'MXP', 'BGY'] },
  { id: 'modena', label: 'Modena', airportCodes: ['BLQ', 'VRN'] },
  { id: 'monza', label: 'Monza e Brianza', airportCodes: ['LIN', 'BGY', 'MXP'] },
  { id: 'napoli', label: 'Napoli', airportCodes: ['NAP'] },
  { id: 'palermo', label: 'Palermo', airportCodes: ['PMO', 'TPS'] },
  { id: 'parma', label: 'Parma', airportCodes: ['BLQ', 'VRN'] },
  { id: 'pescara', label: 'Pescara', airportCodes: ['PSR'] },
  { id: 'pisa', label: 'Pisa', airportCodes: ['PSA', 'FLR'] },
  { id: 'reggio-calabria', label: 'Reggio Calabria', airportCodes: ['REG', 'CTA'] },
  { id: 'roma', label: 'Roma', airportCodes: ['FCO', 'CIA'] },
  { id: 'torino', label: 'Torino', airportCodes: ['TRN', 'MXP', 'LIN', 'BGY'] },
  { id: 'trani', label: 'Trani', airportCodes: ['BRI'] },
  { id: 'trapani', label: 'Trapani', airportCodes: ['TPS', 'PMO'] },
  { id: 'trieste', label: 'Trieste', airportCodes: ['TRS', 'VCE'] },
  { id: 'treviso', label: 'Treviso', airportCodes: ['TSF', 'VCE'] },
  { id: 'venezia', label: 'Venezia', airportCodes: ['VCE', 'TSF'] },
  { id: 'verona', label: 'Verona', airportCodes: ['VRN', 'BGY'] },
];

export const AIRPORT_CATALOG = [
  { iata: 'AHO', label: 'Alghero · Riviera del Corallo' },
  { iata: 'AOI', label: 'Ancona · Raffaello Sanzio' },
  { iata: 'BDS', label: 'Brindisi · Salento' },
  { iata: 'BGY', label: 'Bergamo · Orio al Serio' },
  { iata: 'BLQ', label: 'Bologna · Guglielmo Marconi' },
  { iata: 'BRI', label: 'Bari · Karol Wojtyła' },
  { iata: 'CAG', label: 'Cagliari · Elmas' },
  { iata: 'CIA', label: 'Roma · Ciampino' },
  { iata: 'CTA', label: 'Catania · Fontanarossa' },
  { iata: 'FCO', label: 'Roma · Fiumicino' },
  { iata: 'FLR', label: 'Firenze · Amerigo Vespucci' },
  { iata: 'GOA', label: 'Genova · Cristoforo Colombo' },
  { iata: 'LIN', label: 'Milano · Linate' },
  { iata: 'MXP', label: 'Milano · Malpensa' },
  { iata: 'NAP', label: 'Napoli · Capodichino' },
  { iata: 'PMO', label: 'Palermo · Falcone e Borsellino' },
  { iata: 'PSA', label: 'Pisa · Galileo Galilei' },
  { iata: 'PSR', label: 'Pescara · d’Abruzzo' },
  { iata: 'REG', label: 'Reggio Calabria · Tito Minniti' },
  { iata: 'SUF', label: 'Lamezia Terme' },
  { iata: 'TPS', label: 'Trapani · Birgi' },
  { iata: 'TRN', label: 'Torino · Caselle' },
  { iata: 'TRS', label: 'Trieste · Ronchi dei Legionari' },
  { iata: 'TSF', label: 'Treviso · Canova' },
  { iata: 'VCE', label: 'Venezia · Marco Polo' },
  { iata: 'VRN', label: 'Verona · Valerio Catullo' },
];

export const AIRLINE_CATALOG = [
  { id: 'aegean', label: 'Aegean Airlines' },
  { id: 'aeroitalia', label: 'Aeroitalia' },
  { id: 'air-france', label: 'Air France' },
  { id: 'air-serbia', label: 'Air Serbia' },
  { id: 'austrian', label: 'Austrian Airlines' },
  { id: 'british-airways', label: 'British Airways' },
  { id: 'brussels-airlines', label: 'Brussels Airlines' },
  { id: 'easyjet', label: 'easyJet' },
  { id: 'eurowings', label: 'Eurowings' },
  { id: 'iberia', label: 'Iberia' },
  { id: 'ita-airways', label: 'ITA Airways' },
  { id: 'klm', label: 'KLM' },
  { id: 'lufthansa', label: 'Lufthansa' },
  { id: 'norwegian', label: 'Norwegian' },
  { id: 'ryanair', label: 'Ryanair' },
  { id: 'swiss', label: 'Swiss' },
  { id: 'tap', label: 'TAP Air Portugal' },
  { id: 'transavia', label: 'Transavia' },
  { id: 'turkish-airlines', label: 'Turkish Airlines' },
  { id: 'volotea', label: 'Volotea' },
  { id: 'vueling', label: 'Vueling' },
  { id: 'wizz-air', label: 'Wizz Air' },
];

export const TRANSFER_LEG_CONFIG = {
  home_to_airport: {
    label: 'Città / zona → aeroporto',
    cityDirection: 'origin',
    cityLabel: 'Città o zona di partenza',
    airportLabel: 'Aeroporto da raggiungere',
    matchTimeLabel: 'Arrivo previsto in aeroporto',
    flightHint: 'Volo successivo (facoltativo)',
    operatorEligible: false,
  },
  airport_to_marsala: {
    label: 'Aeroporto → Marsala',
    cityDirection: 'fixed',
    cityLabel: 'Destinazione',
    airportLabel: 'Aeroporto di arrivo',
    matchTimeLabel: 'Atterraggio previsto',
    flightHint: 'Volo di arrivo (facoltativo)',
    operatorEligible: true,
  },
  marsala_to_airport: {
    label: 'Marsala → aeroporto',
    cityDirection: 'fixed',
    cityLabel: 'Partenza',
    airportLabel: 'Aeroporto di partenza',
    matchTimeLabel: 'Decollo previsto',
    flightHint: 'Volo di rientro (facoltativo)',
    operatorEligible: true,
  },
  airport_to_home: {
    label: 'Aeroporto → città / zona',
    cityDirection: 'destination',
    cityLabel: 'Città o zona di arrivo',
    airportLabel: 'Aeroporto di partenza',
    matchTimeLabel: 'Partenza prevista dall’aeroporto',
    flightHint: 'Volo appena arrivato (facoltativo)',
    operatorEligible: false,
  },
};

export function cityById(id) {
  return CITY_CATALOG.find((city) => city.id === id) || null;
}

export function airportByIata(iata) {
  return AIRPORT_CATALOG.find((airport) => airport.iata === iata) || null;
}

export function airlineById(id) {
  return AIRLINE_CATALOG.find((airline) => airline.id === id) || null;
}

export function airportsForCity(cityId) {
  const city = cityById(cityId);
  if (!city) return [];
  return city.airportCodes.map(airportByIata).filter(Boolean);
}

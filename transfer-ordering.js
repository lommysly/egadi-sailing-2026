const TRANSFER_TRAVEL_MINUTES = { TPS: 45, PMO: 105 };
const AIRPORT_BUFFER_WITH_CHECKED_BAG_MINUTES = 90;
const AIRPORT_BUFFER_HAND_LUGGAGE_MINUTES = 60;

export function additionalPassengerCount(record) {
  const value = record?.additionalPassengers;
  return Number.isInteger(value) && value >= 0 && value <= 8 ? value : 0;
}

export function transferPassengerCount(record) {
  return 1 + additionalPassengerCount(record);
}

export function transferSeatCount(record) {
  return !record || (record.recordState && record.recordState !== 'active') || ['cancelled', 'revoked'].includes(record.status)
    ? 0 : transferPassengerCount(record);
}

export function totalTransferSeats(records) {
  return records.reduce((total, record) => total + transferSeatCount(record), 0);
}

// Il limite si misura dal primo orario della fascia, non dal precedente:
// evita che una catena di voli vicini diventi un unico gruppo di molte ore.
export function groupByTimeBand(records, direction) {
  const bands = [];
  const withoutTime = [];
  sortTransferRecords(records, direction).forEach((record) => {
    const minutes = recordClusterMinutes(record, direction);
    if (minutes === null) { withoutTime.push(record); return; }
    const current = bands[bands.length - 1];
    if (current && minutes - current.minMinutes <= 120) {
      current.records.push(record);
      current.maxMinutes = minutes;
    } else {
      bands.push({ records: [record], minMinutes: minutes, maxMinutes: minutes });
    }
  });
  if (withoutTime.length) bands.push({ records: withoutTime, minMinutes: null, maxMinutes: null });
  return bands;
}

function normalizedDirection(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'return' ? 'return' : 'outbound';
}

function airportCode(record) {
  return String(record?.airport ?? '').trim().toUpperCase().slice(0, 4);
}

function normalizedDate(value) {
  const normalized = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '';
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === normalized ? normalized : '';
}

function scheduleDate(record) {
  const value = record?.transferDate
    || record?.date
    || record?.arrivalDate
    || record?.departureDate
    || '';
  return normalizedDate(value);
}

function scheduleTime(record) {
  const value = String(
    record?.transferTime
      || record?.time
      || record?.arrivalTime
      || record?.departureTime
      || '',
  ).trim();
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? value : '';
}

function timeToMinutes(value) {
  const normalized = String(value ?? '').trim();
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(normalized)) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function returnOffsetMinutes(record) {
  const travelMinutes = TRANSFER_TRAVEL_MINUTES[airportCode(record)];
  if (!travelMinutes) return 0;
  const airportBuffer = Number(record?.luggageCount) > 0
    ? AIRPORT_BUFFER_WITH_CHECKED_BAG_MINUTES
    : AIRPORT_BUFFER_HAND_LUGGAGE_MINUTES;
  return travelMinutes + airportBuffer;
}

export function suggestedMarsalaDeparture(record) {
  const flightMinutes = timeToMinutes(scheduleTime(record));
  const offsetMinutes = returnOffsetMinutes(record);
  if (flightMinutes === null || !offsetMinutes) return '';
  return minutesToTime(flightMinutes - offsetMinutes);
}

function calculatedOperationalTimestamp(record, direction) {
  const date = scheduleDate(record);
  const time = scheduleTime(record);
  const minutes = timeToMinutes(time);
  if (!date || minutes === null) return null;
  const [year, month, day] = date.split('-').map(Number);
  const base = Date.UTC(year, month - 1, day, 0, minutes);
  const offset = normalizedDirection(direction) === 'return' ? returnOffsetMinutes(record) : 0;
  return base - offset * 60_000;
}

export function transferOperationalTimestamp(record, direction) {
  const calculated = calculatedOperationalTimestamp(record, direction);
  const meetingMinutes = timeToMinutes(record?.meetingTime);
  if (meetingMinutes === null) return calculated;
  const operationalDate = normalizedDate(record?.meetingDate) || (calculated !== null
    ? new Date(calculated).toISOString().slice(0, 10)
    : scheduleDate(record));
  if (!operationalDate) return calculated;
  const [year, month, day] = operationalDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day, 0, meetingMinutes);
}

export function transferOperationalDate(record, direction) {
  const timestamp = transferOperationalTimestamp(record, direction);
  if (timestamp !== null) return new Date(timestamp).toISOString().slice(0, 10);
  return scheduleDate(record);
}

export function recordClusterMinutes(record, direction) {
  const timestamp = transferOperationalTimestamp(record, direction);
  if (timestamp !== null) {
    const date = new Date(timestamp);
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
  return timeToMinutes(scheduleTime(record));
}

// Che cosa non torna fra l'orario del volo e quello di ritrovo deciso dal
// gestore. Nasce dai casi veri del 7/10/2026, vigilia degli arrivi: una
// persona messa nella navetta delle 18:00 con il volo che atterrava alle
// 21:10, due conferme senza orario, attese in aeroporto fino a 3h45. Il
// portale accettava tutto in silenzio, e la scheda chiusa mostrava soltanto
// l'orario del volo.
//
// All'andata si misura quanto la persona aspetta dopo l'atterraggio; al
// ritorno quanti minuti le restano in aeroporto prima del decollo, tolto il
// viaggio da Marsala. `minutes` è sempre quel numero, mai negativo.
const LONG_WAIT_MINUTES = 120;
const TIGHT_AIRPORT_MARGIN_MINUTES = 45;

export function transferTimingCheck(record, direction) {
  const nothing = { level: 'none', code: '', minutes: null };
  if (!record || ['cancelled', 'revoked'].includes(record.status)) return nothing;
  const hasMeeting = timeToMinutes(record.meetingTime) !== null;
  if (!hasMeeting) {
    return ['confirmed', 'completed'].includes(record.status)
      ? { level: 'warning', code: 'confirmed_without_time', minutes: null }
      : nothing;
  }
  const flight = calculatedOperationalTimestamp(record, 'outbound');
  const meeting = transferOperationalTimestamp(record, direction);
  if (flight === null || meeting === null) return nothing;
  // Senza una data di ritrovo esplicita, un ritrovo dopo mezzanotte per un
  // volo delle 23:55 (o il contrario al rientro) risulterebbe sfasato di un
  // giorno: si riporta nella finestra di dodici ore attorno al volo.
  const explicitDate = Boolean(normalizedDate(record.meetingDate));
  const wrap = (minutes) => {
    if (explicitDate) return minutes;
    if (minutes < -720) return minutes + 1440;
    if (minutes > 720) return minutes - 1440;
    return minutes;
  };
  if (normalizedDirection(direction) === 'outbound') {
    const wait = wrap(Math.round((meeting - flight) / 60_000));
    if (wait < 0) return { level: 'error', code: 'pickup_before_landing', minutes: -wait };
    if (wait > LONG_WAIT_MINUTES) return { level: 'warning', code: 'long_wait', minutes: wait };
    return { level: 'ok', code: '', minutes: wait };
  }
  const travel = TRANSFER_TRAVEL_MINUTES[airportCode(record)];
  if (!travel) return nothing;
  const margin = wrap(Math.round((flight - meeting) / 60_000)) - travel;
  if (margin < 0) return { level: 'error', code: 'late_for_flight', minutes: -margin };
  if (margin < TIGHT_AIRPORT_MARGIN_MINUTES) return { level: 'warning', code: 'tight_margin', minutes: margin };
  return { level: 'ok', code: '', minutes: margin };
}

function participantName(record) {
  return String(
    record?.participantName
      || record?.displayName
      || record?.contactName
      || record?.name
      || '',
  ).trim();
}

function compareRecords(left, right, direction) {
  const leftDate = transferOperationalDate(left, direction);
  const rightDate = transferOperationalDate(right, direction);
  if (leftDate && rightDate && leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  if (leftDate && !rightDate) return -1;
  if (!leftDate && rightDate) return 1;

  const leftTimestamp = transferOperationalTimestamp(left, direction);
  const rightTimestamp = transferOperationalTimestamp(right, direction);
  if (leftTimestamp !== null && rightTimestamp !== null && leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }
  if (leftTimestamp !== null && rightTimestamp === null) return -1;
  if (leftTimestamp === null && rightTimestamp !== null) return 1;

  const byName = participantName(left).localeCompare(participantName(right), 'it', { sensitivity: 'base' });
  if (byName) return byName;
  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''));
}

export function sortTransferRecords(records, direction) {
  return [...records].sort((left, right) => compareRecords(left, right, direction));
}

export function groupTransferRecords(records, direction) {
  const dateGroups = new Map();
  sortTransferRecords(records, direction).forEach((record) => {
    const date = transferOperationalDate(record, direction);
    const dateKey = date || 'UNKNOWN';
    if (!dateGroups.has(dateKey)) dateGroups.set(dateKey, new Map());
    const airport = airportCode(record) || 'UNKNOWN';
    const airportGroups = dateGroups.get(dateKey);
    if (!airportGroups.has(airport)) airportGroups.set(airport, []);
    airportGroups.get(airport).push(record);
  });

  return [...dateGroups.entries()].map(([date, airportGroups]) => ({
    date: date === 'UNKNOWN' ? '' : date,
    count: [...airportGroups.values()].reduce((total, group) => total + totalTransferSeats(group), 0),
    airportGroups: [...airportGroups.entries()].map(([airport, groupedRecords]) => ({
      airport,
      records: groupedRecords,
    })),
  }));
}

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as ordering from '../transfer-ordering.js';
import { rosterMarkup } from '../boat-roster.js';
import { formatIsoDay } from '../date-format.js';

const source = readFileSync(new URL('../transfer.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../transfer.html', import.meta.url), 'utf8');
function between(start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

// La prova usa gli stessi renderer della pagina, solo dati fittizi e nessun
// Firebase/login. Non registra persone e non invia messaggi.
export function renderFixture(language = 'it', customRecords = null, options = {}) {
  const context = vm.createContext({
    ...ordering,
    Intl, Date, Set,
    state: {
      selectedRecordIds: new Set(),
      openPastDates: new Set(),
      records: customRecords || [],
      filters: options.direction ? { direction: options.direction } : undefined,
      completingPast: false,
    },
    // Un "adesso" fisso, prima dell'evento: le prove non devono cambiare
    // esito col passare dei giorni. Chi vuole provare il passato lo indica.
    operationalNow: () => ordering.operationalNow(new Date(options.now || '2026-10-06T10:00:00Z')),
    locale: () => language,
    normalizeDirection: (value) => value === 'return' ? 'return' : 'outbound',
    normalizedStatus: (value) => value || 'new',
    recordStatusKey: (record) => record.legState === 'draft' ? 'draft' : record.status || 'new',
    text: (value, limit) => String(value || '').slice(0, limit),
    optionalTime: (value) => value || '',
    directionLabel: (value) => value === 'return' ? 'Rientro' : 'Andata',
    airportLabel: (value) => value === 'PMO' ? 'Palermo (PMO)' : 'Trapani (TPS)',
    airportCode: (record) => record.airport,
    participantName: (record) => record.participantName,
    routeLabel: (record) => record.direction === 'return' ? `Marsala → ${record.airport}` : `${record.airport} → Marsala`,
    formatSchedule: (record) => `${formatIsoDay(record.date, { english: language === 'en' })} · ${record.time}`,
    recordFlight: () => 'Volo fittizio',
    recordLuggage: () => 'Bagagli da verificare',
    recordContactMarkup: () => 'Contatto fittizio',
    contactPhone: (record) => record.phone || '',
    renderDraftNotice: () => '',
  });
  const code = between('const COPY =', '\nconst state =')
    + '\n' + between('function t(key)', '\nfunction ',)
    + '\n' + between('function escapeHtml(', '\nfunction ')
    + '\n' + between('const STATUS_LABEL_KEYS =', '\nfunction statusLabel(')
    + '\n' + between('function statusLabel(', '\nfunction ')
    + '\nconst OPERATIONAL_STATUSES = ["new", "planned", "confirmed", "completed", "cancelled"];'
    + '\n' + between('function statusOptions(', '\nfunction ')
    + '\n' + between('function recordDetail(', '\nfunction ')
    + '\n' + between('function renderRecord(', '\nfunction recordStats(');
  vm.runInContext(code, context);
  const records = customRecords || [
    { id: 'referente', participantName: 'Referente fittizio', airport: 'TPS', date: '2026-10-08', time: '13:15', additionalPassengers: 2, direction: 'outbound', status: 'new' },
    { id: 'vicino', participantName: 'Persona fittizia', airport: 'TPS', date: '2026-10-08', time: '14:10', direction: 'outbound', status: 'confirmed' },
    { id: 'palermo', participantName: 'Altra persona', airport: 'PMO', date: '2026-10-08', time: '09:15', direction: 'outbound', status: 'planned' },
    { id: 'ritorno', participantName: 'Referente fittizio', airport: 'TPS', date: '2026-10-11', time: '20:35', additionalPassengers: 1, direction: 'return', status: 'new' },
  ];
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<link[^>]+fonts[^>]*>/g, '')
    .replace('<section id="transferHero" class="area-hero transfer-operator-hero"></section>', '<p>Anteprima con soli dati fittizi · nessun salvataggio online</p>')
    .replace('<section id="transferApp" class="transfer-operator-app" aria-live="polite"></section>', `<section id="transferApp" class="transfer-operator-app">${context.renderGroupedRecords(records)}</section>`);
}

export function renderSkipperFixture(language = 'it') {
  const ui = readFileSync(new URL('../area-transfer-cancel.js', import.meta.url), 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(ui.slice(ui.indexOf('export function cancellationActions'), ui.indexOf('export function bindTransferCancellation')).replace('export function ', 'function '), ctx);
  const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const rows = [{
    id: 'person', displayName: 'Partecipante fittizio', preferredLocale: language,
    outboundDate: '2026-10-08', outboundTime: '13:15', outboundTransport: 'flight',
    outboundTransfer: 'requested', outboundOperationStatus: 'confirmed',
    returnDate: '2026-10-11', returnTime: '20:35', returnTransport: 'flight',
    returnTransfer: 'requested', returnOperationStatus: 'new',
  }];
  const markup = rosterMarkup(rows, { english: language === 'en', azione: (row) => `<div class="crew-transfer-actions"><a class="button button-whatsapp" href="#">${language === 'en' ? 'Message on WhatsApp' : 'Scrivi su WhatsApp'}</a>${ctx.cancellationActions(row, row.id, escape, language === 'en')}</div>` });
  const scopedStyle = readFileSync(new URL('../area.html', import.meta.url), 'utf8').match(/<style>\.crew-transfer-actions[\s\S]*?<\/style>/)?.[0] || '';
  return `<!doctype html><html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css">${scopedStyle}<body><main class="container"><p>Anteprima fittizia · nessuna operazione online</p><div class="crew-travel-list">${markup}</div></main></body></html>`;
}

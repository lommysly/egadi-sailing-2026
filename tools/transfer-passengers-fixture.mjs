import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as ordering from '../transfer-ordering.js';

const source = readFileSync(new URL('../transfer.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../transfer.html', import.meta.url), 'utf8');
function between(start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

// La prova usa gli stessi renderer della pagina, solo dati fittizi e nessun
// Firebase/login. Non registra persone e non invia messaggi.
export function renderFixture(language = 'it') {
  const context = vm.createContext({
    ...ordering,
    Intl, Date, Set,
    state: { selectedRecordIds: new Set() },
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
    formatSchedule: (record) => `${record.date} · ${record.time}`,
    recordFlight: () => 'Volo fittizio',
    recordLuggage: () => 'Bagagli da verificare',
    recordContactMarkup: () => 'Contatto fittizio',
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
  const records = [
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

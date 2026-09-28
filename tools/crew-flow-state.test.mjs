import assert from 'node:assert/strict';
import test from 'node:test';
import { canConfirmCrewBriefing, crewTravelNeedsAttention } from '../crew-flow-state.js';

test('una richiesta transfer salvata non accende un allarme per l’equipaggio', () => {
  assert.equal(crewTravelNeedsAttention(
    { tone: 'waiting', label: 'Andata · transfer richiesto' },
    { tone: 'waiting', label: 'Rientro · transfer richiesto' },
  ), false);
});

test('una tratta da inserire o da correggere resta visibile come prossimo passo', () => {
  assert.equal(crewTravelNeedsAttention(
    { tone: 'attention', label: 'Andata · da inserire' },
    { tone: 'complete', label: 'Rientro · senza transfer organizzato' },
  ), true);
});

test('il briefing obbligatorio si può confermare solo dopo la lettura completa', () => {
  assert.equal(canConfirmCrewBriefing({ requiresFullRulesRead: true, fullRulesRead: false }), false);
  assert.equal(canConfirmCrewBriefing({ requiresFullRulesRead: true, fullRulesRead: true }), true);
  assert.equal(canConfirmCrewBriefing({ requiresFullRulesRead: false, fullRulesRead: false }), true);
});

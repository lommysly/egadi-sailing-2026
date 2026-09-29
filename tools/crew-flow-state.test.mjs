import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canConfirmCrewBriefing,
  crewTravelCardPresentation,
  crewTravelCardPriority,
  crewTravelNeedsAttention,
} from '../crew-flow-state.js';

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

test('le card skipper distinguono azione, gestione, conferma e annullamento', () => {
  assert.deepEqual(
    crewTravelCardPresentation({ outbound: 'missing', return: 'no_transfer' }),
    { tone: 'attention', label: 'Da completare' },
  );
  assert.deepEqual(
    crewTravelCardPresentation({ outbound: 'transfer_ready', return: 'no_transfer' }),
    { tone: 'planning', label: 'Transfer in gestione' },
  );
  assert.deepEqual(
    crewTravelCardPresentation({ outbound: 'transfer_confirmed', return: 'transfer_completed' }),
    { tone: 'confirmed', label: 'Transfer gestito' },
  );
  assert.deepEqual(
    crewTravelCardPresentation({ outbound: 'transfer_cancelled', return: 'transfer_pending' }),
    { tone: 'cancelled', label: 'Transfer da verificare' },
  );
  assert.deepEqual(
    crewTravelCardPresentation({ outbound: 'no_transfer', return: 'no_transfer' }),
    { tone: 'neutral', label: 'Nessun transfer richiesto' },
  );
  assert.deepEqual(
    ['neutral', 'confirmed', 'planning', 'attention', 'cancelled'].sort(
      (first, second) => crewTravelCardPriority(first) - crewTravelCardPriority(second),
    ),
    ['cancelled', 'attention', 'planning', 'confirmed', 'neutral'],
  );
});

test('il briefing obbligatorio si può confermare solo dopo la lettura completa', () => {
  assert.equal(canConfirmCrewBriefing({ requiresFullRulesRead: true, fullRulesRead: false }), false);
  assert.equal(canConfirmCrewBriefing({ requiresFullRulesRead: true, fullRulesRead: true }), true);
  assert.equal(canConfirmCrewBriefing({ requiresFullRulesRead: false, fullRulesRead: false }), true);
});

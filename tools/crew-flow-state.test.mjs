import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canConfirmCrewBriefing,
  crewTravelCardPresentation,
  crewTravelCardPriority,
  crewTravelOverviewGroup,
  crewTravelNeedsAttention,
} from '../crew-flow-state.js';

test('una richiesta transfer salvata non accende un allarme per l’equipaggio', () => {
  assert.equal(crewTravelNeedsAttention(
    { tone: 'waiting', label: 'Andata · transfer richiesto' },
    { tone: 'waiting', label: 'Rientro · transfer richiesto' },
  ), false);
});

// Dal 2/10/2026 il transfer si chiede: non averlo chiesto non è una pratica
// aperta. Nell'elenco dello skipper resta solo chi lo ha chiesto a metà.
test('nell’elenco skipper resta solo chi ha chiesto il transfer senza completarlo', () => {
  assert.equal(crewTravelOverviewGroup({ outbound: 'transfer_pending', return: 'no_transfer' }), 'waiting');
  assert.equal(crewTravelOverviewGroup({ outbound: 'missing', return: 'missing' }), 'submitted');
  assert.equal(crewTravelOverviewGroup({ outbound: 'transfer_ready', return: 'missing' }), 'submitted');
  assert.equal(crewTravelOverviewGroup({ outbound: 'transfer_ready', return: 'no_transfer' }), 'submitted');
  assert.equal(crewTravelOverviewGroup({ outbound: 'transfer_confirmed', return: 'transfer_completed' }), 'submitted');
  assert.equal(crewTravelOverviewGroup({ outbound: 'no_transfer', return: 'no_transfer' }), 'submitted');
});

test('una richiesta transfer rimasta a metà resta visibile come prossimo passo', () => {
  assert.equal(crewTravelNeedsAttention(
    { tone: 'attention', label: 'Andata · transfer da completare' },
    { tone: 'complete', label: 'Rientro · all’aeroporto ci arrivi tu' },
  ), true);
});

test('chi ci arriva per conto suo non ha nessun prossimo passo', () => {
  assert.equal(crewTravelNeedsAttention(
    { tone: 'complete', label: 'Andata · a Marsala ci arrivi tu' },
    { tone: 'complete', label: 'Rientro · all’aeroporto ci arrivi tu' },
  ), false);
});

test('le card skipper distinguono azione, gestione, conferma e annullamento', () => {
  assert.deepEqual(
    crewTravelCardPresentation({ outbound: 'transfer_pending', return: 'no_transfer' }),
    { tone: 'attention', label: 'Transfer da completare' },
  );
  assert.deepEqual(
    crewTravelCardPresentation({ outbound: 'missing', return: 'no_transfer' }),
    { tone: 'neutral', label: 'Nessun transfer richiesto' },
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

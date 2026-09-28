import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesCurrentInviteSession } from '../crew-invite-session.js';

const boatId = 'barca-prova';
const inviteId = 'a'.repeat(48);
const accessKey = 'b'.repeat(48);
const access = {
  invite: {
    boatId,
    id: inviteId,
    accessKey,
  },
};

test('link riaperto: riconosce soltanto la sessione dello stesso invito', () => {
  assert.equal(matchesCurrentInviteSession({ access, boatId, inviteId, accessKey }), true);
});

test('link riemesso: il codice precedente non diventa un accesso diretto', () => {
  assert.equal(matchesCurrentInviteSession({
    access,
    boatId,
    inviteId,
    accessKey: 'c'.repeat(48),
  }), false);
});

test('altro invito o dati mancanti non attivano la scorciatoia', () => {
  assert.equal(matchesCurrentInviteSession({
    access,
    boatId: 'altra-barca',
    inviteId,
    accessKey,
  }), false);
  assert.equal(matchesCurrentInviteSession({
    access: null,
    boatId,
    inviteId,
    accessKey,
  }), false);
});

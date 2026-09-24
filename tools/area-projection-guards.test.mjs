import assert from 'node:assert/strict';
import test from 'node:test';
import { hasVerifiedContribution } from '../area-projection-guards.js';

test('l’assenza di una scheda non avvia il calcolo dei pagamenti', () => {
  let calculated = false;
  const result = hasVerifiedContribution(null, () => {
    calculated = true;
    throw new Error('Il calcolo non deve partire senza scheda');
  });
  assert.equal(result, false);
  assert.equal(calculated, false);
});

test('una quota verificata protegge la scheda', () => {
  assert.equal(hasVerifiedContribution({ id: 'persona-1' }, () => ({ verifiedCents: 1 })), true);
  assert.equal(hasVerifiedContribution({ id: 'persona-2' }, () => ({ verifiedCents: 0 })), false);
});

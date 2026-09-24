// Guardie pure e testabili: l'area deve potersi avviare anche senza una
// scheda equipaggio aperta. Il calcolo dei pagamenti non va quindi invocato
// quando la selezione corrente è assente.
export function hasVerifiedContribution(projection, getPaymentBalance) {
  if (!projection) return false;
  return Number(getPaymentBalance(projection)?.verifiedCents || 0) > 0;
}

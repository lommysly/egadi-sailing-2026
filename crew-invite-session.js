// Decide solo la scorciatoia lato interfaccia: readCrewAccess ha gia'
// verificato che l'utente autenticato sia il titolare dell'invito attivo.
export function matchesCurrentInviteSession({ access, boatId, inviteId, accessKey }) {
  return access?.invite?.boatId === boatId
    && access.invite.id === inviteId
    // Il codice nel link deve essere ancora quello dell'invito attivo: un
    // collegamento precedente a una riemissione non diventa una scorciatoia.
    && access.invite.accessKey === accessKey;
}

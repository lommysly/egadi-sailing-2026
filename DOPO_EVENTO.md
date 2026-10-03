# Da fare dopo l'evento (8-11 ottobre 2026)

Cose decise durante la settimana della partenza e **rimandate di proposito** a
dopo il rientro, per non toccare parti delicate del sito con la gente che sta
già entrando, pagando e prenotando i voli. Non sono idee da valutare: sono
lavori concordati con Silvio, con il motivo per cui esistono.

Aggiornato il 3 ottobre 2026.

---

## 1. Avviso sugli inviti in scadenza

**Cosa succede oggi.** Un invito personale dura 14 giorni. Se nessuno lo apre,
scade in silenzio: il sito non lo segnala a nessuno. Lo scopri quando la
persona ti scrive che il link non funziona.

**Il caso reale.** Il 3/10/2026 l'invito di Andrea Garbellini (Karibu, creato
il 19/09) è scaduto alle 17:59. Silvio stava per mandarglielo poche ore dopo:
avrebbe visto la schermata "link non valido", come era successo a Stefania
Merche quella stessa mattina per un motivo diverso. È stato rigenerato a mano.

**Cosa fare.** Aggiungere il controllo alle "Cose da fare" della console
organizzatore (`transfer.js`, `renderTodoBoard` / `boat-todo-core.js`), con lo
stesso meccanismo già usato per le barche da sollecitare: un invito ancora
`pending`, mai attivato, che scade entro pochi giorni diventa una riga da
sistemare, con l'azione per rigenerarlo. Da valutare se mostrarlo anche nella
dashboard dello skipper per la propria barca.

Al 3/10/2026 non ci sono altri inviti nella stessa condizione: è stata una
coincidenza, non un arretrato.

---

## 2. Il pulsante "genera link di barca" nell'area skipper

**Cosa succede oggi.** Il link unico di barca (`unisciti.html`) funziona, ed è
stato usato davvero da Carpe Diem. Ma il documento `boats/{id}/boatLinks/default`
che lo rende valido è stato creato a mano da console amministrativa: non c'è
nessun modo, per uno skipper, di generarsi il proprio.

**Cosa fare.** Un pulsante nell'area skipper che crea o rigenera il link della
propria barca, lo mostra copiabile e ne dichiara la scadenza. Finché non c'è,
ogni nuova barca che vuole il link deve passare dall'organizzatore.

Serve anche la regola Firestore per `boatLinks/{linkId}`: oggi la collezione è
scritta e letta soltanto dalle Cloud Functions (`claimBoatLinkSlot`,
`listBoatLinkSlots`), che girano con privilegi di amministratore e quindi non
passano dalle Rules.

---

## 3. Attribuzione dei pagamenti: l'ultimo pezzo

Il 3/10/2026 sono state corrette due cose sui pagamenti (segnalazione
duplicata dalla riprova di rete, e conferma che ora può attribuire posto e
assicurazione). Resta fuori un caso: una ricevuta manuale **già verificata**
non è più modificabile, quindi un'attribuzione sbagliata si corregge solo
annullandola e registrandone una nuova.

Va bene così finché i numeri sono pochi. Se il modello cresce a più eventi,
serve un modo esplicito di correggere l'attribuzione lasciando traccia, invece
di annullare e riscrivere.

---

## 4. Il sito come piattaforma multi-evento

Analisi già fatta il 2/10/2026. Esistono già `events/{eventId}` e il campo
`boats.eventId`, ma `isOrganizer()` è legato a `events/egadi-2026` in una
ventina di punti di `firestore.rules`: è quello il vero blocco, non
l'interfaccia.

Da riprendere solo quando c'è un secondo evento vero da organizzare, non
prima: oggi sarebbe generalizzare su un caso solo.

---

## 5. Pulizie minori rimaste indietro

- **Passage Plan, sezione sicurezza**: il testo "Prossimi controlli: 28
  settembre · 3 ottobre…" è statico e ormai superato. Va tolto o reso vivo.
- **Karibu, posti liberi pubblici**: `fleetAvailableSeats` è un campo manuale e
  può non corrispondere ai posti realmente liberi dopo una rinuncia.
- **Schede equipaggio orfane di Carpe Diem**: le persone inserite a mano da
  Michele Pasini hanno un identificativo che non può diventare un invito. Il
  link di barca le sistema una per una man mano che entrano (sposta la scheda
  sull'identità giusta). Quando l'equipaggio è tutto dentro, verificare che non
  ne sia rimasta nessuna fuori.

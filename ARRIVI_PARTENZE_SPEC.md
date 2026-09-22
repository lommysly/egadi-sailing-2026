# Arrivi e partenze · specifica operativa Egadi 2026

Questa specifica traduce il piano transfer della flottiglia nel sito Egadi. Non è un'informativa privacy definitiva e non autorizza da sola la raccolta di dati reali.

## Obiettivo

Organizzare le tratte dei partecipanti verso e da Marsala senza duplicare persone, telefoni o orari in fogli separati. La sezione pubblica spiega il flusso; la compilazione avverrà solo nell'area personale protetta dell'equipaggio.

## Le quattro tratte facoltative

1. Città / punto di partenza → aeroporto di partenza.
2. Aeroporto di arrivo → porto di Marsala.
3. Porto di Marsala → aeroporto di rientro.
4. Aeroporto di arrivo → città / punto di arrivo.

Una persona può compilare una sola tratta, andata e ritorno diversi, oppure tutte e quattro. Città e aeroporto restano campi distinti: `Milano` non può sostituire `MXP`, `LIN` o `BGY`.

## Campi per ogni tratta

- Tipo di spostamento: volo, auto, treno, nave o altro.
- Città di partenza e città di arrivo.
- Aeroporto di partenza e aeroporto di arrivo, con codice IATA quando applicabile.
- Data, ora di partenza e ora di arrivo.
- Compagnia aerea e numero di volo facoltativi.
- Numero di bagagli e presenza di colli ingombranti.
- Disponibilità: cerco passaggio, posso offrire posti o solo coordinamento.
- Finestra di compatibilità fissa: **±120 minuti**.

Il matching considera stessa tratta, stessa data e stesso aeroporto reale. Per l'andata aeroportuale confronta l'orario di arrivo; per il ritorno confronta l'orario di partenza e l'organizzatore calcola il ritrovo a Marsala a ritroso.

## Ruoli e visibilità

| Ruolo | Cosa vede |
| --- | --- |
| Partecipante | Le proprie tratte e i match che ha accettato. |
| Skipper | Solo stato sintetico della propria barca, senza poter cercare contatti di altre barche. |
| Organizzazione | Le informazioni necessarie a coordinare l'evento e ad assegnare la società transfer. |
| Società transfer | Solo tratte aeroporto ↔ Marsala, con dati necessari a comporre i mezzi, contattare le persone, gestire orari e bagagli. Nessun passaggio casa ↔ aeroporto. |

L'area della società transfer richiede un accesso nominativo controllato; non sarà un link segreto né una pagina pubblica.

## Consenso e contatti

La gestione del transfer aeroportuale e la condivisione fra partecipanti sono due scelte separate.

- Nella tratta aeroporto ↔ Marsala, la scheda informa chiaramente che organizzatore e società incaricata ricevono i dati necessari al servizio e possono contattare la persona.
- Per i passaggi fra partecipanti, l'adesione al matching è facoltativa, per singola tratta e non preselezionata: scegliere "cerco un passaggio" o "posso offrire un passaggio" per quella tratta **è** l'atto di consenso (decisione del 22/09/2026 — prima era prevista una casella di conferma separata, rimossa perché ridondante: la scelta del ruolo è già un'azione deliberata e non predefinita). La nota informativa accanto al selettore spiega cosa comporta prima di scegliere.
- Prima che due partecipanti vedano i reciproci numeri WhatsApp, entrambi devono accettare lo specifico collegamento.
- Una revoca interrompe nuove proposte e nuove letture; non può cancellare un numero già salvato fuori dal sito da chi lo ha già visto.

Il numero di telefono non entra nei segnali di match, negli elenchi pubblici, negli URL né in JavaScript statico.

## Implementazione successiva

1. ✅ Card privata `Arrivi e partenze` — realizzata come pagina dedicata `travel.html`/`travel.js` (non dentro `my-area.html` come originariamente previsto), una tratta per documento, bozza modificabile in qualsiasi momento.
2. ✅ Raccolte Firestore dedicate: `boats/{boatId}/crewTravel/{inviteId}/legs/{outbound|return}` (equipaggio) e `boats/{boatId}/skipperTravel/{outbound|return}` (skipper), separate da Crew List e inviti.
3. ✅ Security Rules pubblicate: la persona legge solo le proprie tratte (`isCrewTravelOwner`), l'operatore solo i transfer aeroportuali assegnati (`transferOpsRecords`). Il matching tra partecipanti è ora implementato (22/09/2026): Cloud Function `matchCarpoolLegs` (attivata da ogni scrittura su una tratta con `carpoolRole` e `carpoolMatchConsent: true`) confronta stessa direzione/aeroporto/data entro ±120 minuti e crea una coppia anonima in `events/egadi-2026/travelMatchPairs` (mai leggibile dal client) più una scheda anonima per lato in `.../legs/{legId}/matchCandidates/{matchId}` (leggibile solo dal proprietario, senza alcuna identità della controparte). La funzione callable `respondToTravelMatch` gestisce l'accettazione: il contatto (nome + WhatsApp) viene scritto nella scheda di ciascun lato solo quando **entrambi** hanno accettato lo stesso abbinamento. Codice verificato con test end-to-end sull'emulatore (matching, esclusione fuori finestra, rivelazione reciproca corretta, rifiuto, revoca) — **non ancora deployato né testato con dati fittizi in produzione**, vedi `FIRESTORE_RULES_TEST_MATRIX.md` e `CHECKLIST_PUBBLICAZIONE.md`.
4. Area riservata della società transfer per raggruppare manualmente le persone, assegnare mezzo, punto/orario di ritrovo e inviare WhatsApp precompilati — non ancora costruita.
5. Aggiornare l'informativa definitiva con titolare, canale per i diritti, destinatari, conservazione, cancellazione e revoca — non ancora completata, vedi `PRIVACY_DA_COMPLETARE.md`.

~~Il matching automatico tra equipaggi deve avvenire lato server oppure usare esclusivamente segnali anonimi~~ — risolto: il matching gira interamente in una Cloud Function con privilegi Admin (mai nelle Security Rules), e la scheda che il client legge resta priva di qualunque identità della controparte finché non scatta la doppia accettazione.

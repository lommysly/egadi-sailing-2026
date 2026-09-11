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
- Per i passaggi fra partecipanti, l'adesione al matching è facoltativa, per singola tratta e non preselezionata.
- Prima che due partecipanti vedano i reciproci numeri WhatsApp, entrambi devono accettare lo specifico collegamento.
- Una revoca interrompe nuove proposte e nuove letture; non può cancellare un numero già salvato fuori dal sito da chi lo ha già visto.

Il numero di telefono non entra nei segnali di match, negli elenchi pubblici, negli URL né in JavaScript statico.

## Implementazione successiva

1. Aggiungere una card privata `Arrivi e partenze` in `my-area.html`, con una tratta per documento e possibilità di modifica.
2. Creare raccolte Firestore dedicate all'evento, separate da Crew List e inviti.
3. Pubblicare Security Rules che consentano alla persona solo le proprie tratte, all'operatore solo i transfer aeroportuali assegnati e agli altri partecipanti soltanto un match accettato.
4. Aggiungere un'area riservata della società transfer per raggruppare manualmente le persone, assegnare mezzo, punto/orario di ritrovo e inviare WhatsApp precompilati.
5. Aggiornare l'informativa definitiva con titolare, canale per i diritti, destinatari, conservazione, cancellazione e revoca.

Il matching automatico tra equipaggi deve avvenire lato server oppure usare esclusivamente segnali anonimi: Firestore non può nascondere singoli campi di un documento che un utente ha il diritto di leggere.

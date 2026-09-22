# Arrivi e partenze · specifica operativa Egadi 2026

Questa specifica traduce il piano transfer della flottiglia nel sito Egadi. Non è un'informativa privacy definitiva e non autorizza da sola la raccolta di dati reali.

## Obiettivo

Organizzare le tratte dei partecipanti verso e da Marsala senza duplicare persone, telefoni o orari in fogli separati. La sezione pubblica spiega il flusso; la compilazione avviene solo nell'area personale protetta dell'equipaggio.

## Le quattro tratte facoltative

1. Città / punto di partenza → aeroporto di partenza.
2. Aeroporto di arrivo → porto di Marsala.
3. Porto di Marsala → aeroporto di rientro.
4. Aeroporto di arrivo → città / punto di arrivo.

Una persona può compilare una sola tratta, andata e ritorno diversi, oppure tutte e quattro. Città e aeroporto restano campi distinti: `Milano` non può sostituire `MXP`, `LIN` o `BGY`.

## Compilazione guidata

Il modulo usa un catalogo locale, versionato e senza API a pagamento:

- città e zone frequenti, più l'opzione obbligatoria `Altra città o zona`;
- aeroporti con codice IATA e nome leggibile;
- compagnie aeree comuni, più l'opzione obbligatoria `Altra compagnia`.

La città e l'aeroporto sono due scelte diverse. Selezionando `Torino`, per esempio, il modulo suggerisce Caselle, Malpensa, Linate e Bergamo, ma consente di indicare correttamente `Torino → Milano Malpensa (MXP)` senza forzare Caselle.

Gli orari usano il selettore nativo in formato `HH:mm`, 24 ore e intervalli di cinque minuti. Ogni tratta richiede un solo **orario di riferimento** per il match e permette di aggiungere, se utili, anche partenza e arrivo della tratta: la compilazione resta rapida anche da telefono.

## Campi per ogni tratta

- Città / zona e aeroporto effettivo, con codice IATA quando applicabile.
- Data, orario di riferimento, partenza e arrivo facoltativi.
- Compagnia aerea e numero di volo facoltativi.
- Numero di bagagli e presenza di colli ingombranti.
- Disponibilità: cerco passaggio, offro posti in auto o solo coordinamento.
- Per chi offre: auto propria o a noleggio, posti liberi, spazio per valigie e disponibilità per colli ingombranti.
- Finestra di compatibilità fissa: **±120 minuti**.

Il matching considera stessa tratta, stessa data e stesso aeroporto reale. Per l'andata aeroportuale confronta l'orario di arrivo; per il ritorno confronta l'orario di partenza e l'organizzatore calcola il ritrovo a Marsala a ritroso. Per `città → aeroporto` e `aeroporto → città` serve anche la stessa città / zona del catalogo.

Un passaggio in auto è volontario fra partecipanti: il sito non raccoglie targa, patente, carta di credito, prezzo, assicurazione o pagamenti e non lo presenta come servizio professionale di trasporto.

## Ruoli e visibilità

| Ruolo | Cosa vede |
| --- | --- |
| Partecipante | Le proprie tratte; in una fase successiva anche i match che ha accettato. |
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

## Stato dell'implementazione

1. Il sorgente contiene la card privata `Arrivi e partenze`, con una tratta per documento, cataloghi guidati e modifica o eliminazione della propria tratta.
2. Il sorgente usa la raccolta dedicata `events/egadi-2026/transferProfiles/{uid}/transferLegs`, separata da Crew List e inviti. Lo skipper e gli altri equipaggi non possono leggerla; l'organizzazione può coordinarla.
3. Prima della pubblicazione operativa delle tratte reali: testare Rules con account fittizi e completare l'informativa su destinatari, conservazione, cancellazione e revoca.
4. In seguito: area nominativa della società transfer per le sole tratte aeroporto ↔ Marsala, gruppi, mezzi, punti/orari e WhatsApp precompilati.
5. In seguito: proposta anonima di match e doppia accettazione prima di mostrare il reciproco WhatsApp fra partecipanti.

Il matching automatico tra equipaggi deve avvenire lato server oppure usare esclusivamente segnali anonimi: Firestore non può nascondere singoli campi di un documento che un utente ha il diritto di leggere.

# Flotta pubblica · verifiche prima dell'apertura

Data verifica: 11 settembre 2026.

La raccolta pubblica è separata da barche, Crew List, inviti, pagamenti e contatti:

`events/egadi-2026/publicFleet/{idCasuale}`

L'ID casuale è collegato in una raccolta non leggibile dal web allo skipper che lo ha creato. Il collegamento non contiene dati della Crew List e non può essere trasferito a un altro skipper.

## Test Rules eseguiti in emulatore Firestore

- Registrazione atomica iniziale: barca privata, collegamento tecnico e card pubblica create insieme.
- Skipper proprietario: crea e aggiorna la propria card.
- Visitatore anonimo: non legge la flotta finché l'interruttore pubblico è spento.
- Visitatore anonimo: legge card e lista soltanto dopo l'attivazione della flotta pubblica.
- Visitatore anonimo: non legge il collegamento tecnico dello skipper.
- Altro skipper: non cambia l'ID pubblico della propria barca già associata.
- Altro skipper: non sovrascrive né cancella la card di un'altra barca.
- Payload non previsto: un campo come telefono della crew viene rifiutato.
- Skipper proprietario: può ritirare la propria card; l'organizzatore può moderarla.

Esito: 11 controlli superati nell'emulatore Firestore con le Rules candidate.

## Apertura controllata

Prima di impostare `publicFleetEnabled: true` nel documento `events/egadi-2026`:

1. Verificare dalla Console Firebase autorizzata che `publicFleet` sia vuota oppure contenga esclusivamente card con i nove campi previsti.
2. Pubblicare prima le Rules candidate, con l'interruttore ancora spento.
3. Con l'interruttore ancora spento, registrare o aggiornare una barca test dall'area skipper: la card viene salvata ma non è leggibile da visitatori anonimi.
4. Solo dopo il controllo riservato, impostare `publicFleetEnabled: true` e fare lo smoke anonimo su `flotta.html`.

L'interruttore può essere riportato a `false` per nascondere subito la flotta pubblica senza chiudere le aree private.

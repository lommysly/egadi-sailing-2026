# Matrice di test · Security Rules e flussi crew

Usare solo UID, nomi, documenti e richieste fittizi nel Rules Playground o nell'emulatore. Non creare nuovi inviti o Crew List nel progetto live per svolgere questi test.

## Fixture fittizia

- `SKIPPER_A`: proprietario di `boats/SKIPPER_A`.
- `ORGANIZER_A`: presente in `events/egadi-2026.organizerIds`.
- `OUTSIDER_A`: utente Google non associato.
- `CREW_OLD` e `CREW_NEW`: due UID anonimi di prova.
- `INVITE_A`: invito della barca dello skipper con `participantUid` inizialmente `CREW_OLD` e un record `participantAccess/CREW_OLD`.

## Casi da verificare

| Caso | Azione | Esito atteso |
| --- | --- | --- |
| Barca skipper | `SKIPPER_A` legge e aggiorna solo la propria barca. | Consenti. |
| Barca estranea | `OUTSIDER_A` legge, elenca o modifica barca, inviti, membri, contributi e bacheca. | Nega. |
| Invito esatto | `CREW_OLD` legge il proprio invito e il proprio membro. | Consenti. |
| Cambio browser | `CREW_NEW` reclama lo stesso link, poi crea `participantAccess/CREW_NEW`. | Consenti. |
| Accesso precedente | Dopo il cambio browser, `CREW_OLD` legge bacheca, annunci, membro o contributi. | Nega. Il suo vecchio record tecnico non deve più dare accesso ai contenuti. |
| Regole di bordo | `CREW_NEW` conferma la versione corrente dopo un precedente consenso di `CREW_OLD`. | Consenti e mostra di nuovo il pulsante prima della conferma. |
| Nuova versione | Lo skipper cambia testo regole e aumenta versione; `CREW_NEW` conferma la nuova versione. | Consenti. |
| Contributo | Solo skipper o organizzatore crea/aggiorna; solo il destinatario dell'invito corrente legge la propria richiesta. | Consenti / nega secondo ruolo. |

## Controllo capienza

L'interfaccia conta inviti e membri unici rispetto a `capacity`, definito come numero di posti per l'equipaggio escluso lo skipper. Firestore non può contare atomicamente una subcollection senza logica server: il controllo è operativo nell'interfaccia, non una garanzia anti-concorrenza.

## Chiusura del test

Annotare data, ambiente, regola pubblicata e risultato di ciascun caso. Solo dopo certificato HTTPS valido eseguire il test live con lo skipper e una persona invitata reale, con dati minimi e autorizzazione esplicita.

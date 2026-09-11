# Matrice di test · Security Rules e accesso crew con codice personale

Usare esclusivamente UID, nomi, numeri, documenti e contributi fittizi nel Rules Playground o nell'emulatore. Non creare inviti, account crew o Crew List nel progetto live per svolgere questi test.

## Fixture fittizia

- `ORGANIZER_A`: UID presente in `events/egadi-2026.organizerIds`.
- `SKIPPER_A`: proprietario di `boats/SKIPPER_A`; `OUTSIDER_A`: utente Google non associato.
- `CREW_A` e `CREW_B`: utenti Firebase Authentication con provider `password`, non anonimi, e token email rispettivamente `crew-a@crew.egadi.thatsablast.it` e `crew-b@crew.egadi.thatsablast.it`.
- `ANON_A`: utente Firebase anonimo; non deve ottenere nessun accesso crew.
- `events/egadi-2026.privateAreaEnabled`: inizialmente `false`; passarlo a `true` soltanto nella fixture dopo aver provato il blocco chiuso.
- `INVITE_A`: documento con ID di 48 caratteri esadecimali, `boatId: SKIPPER_A`, `status: pending`, `participantUid: null`, `accessVersion: 1`, `expiresAt` futura, `loginEmail: crew-a@crew.egadi.thatsablast.it`, `phoneFingerprint` fittizio e `accessKey` di 48 caratteri esadecimali.
- `MEMBER_A`: eventuale scheda in `boats/SKIPPER_A/members/{INVITE_A}`. Non usare dati reali.
- `COLLECTION_PROFILE_A`: documento `boats/SKIPPER_A/collectionProfile/default` con `collectorId: SKIPPER_A`, nome fittizio, soli quattro booleani dei metodi, `updatedAt` server e `updatedBy: SKIPPER_A`.
- `PAYMENT_A`: richiesta fittizia per `INVITE_A`, `amountCents` positivo, `currency: EUR`, uno o più tag dei metodi e stato `prepared`. Non includere link, alias, coordinate o credenziali.

Nel Playground simulare nel token crew `firebase.sign_in_provider: "password"` e `email` coerente con `loginEmail`. Un token Google o anonimo non può sostituirlo.

## Casi da verificare

| Caso | Azione | Esito atteso |
| --- | --- | --- |
| Area privata chiusa | Con `privateAreaEnabled: false`, skipper, crew password, anonimo e outsider leggono o scrivono evento, barca, inviti, membri, bacheca, richieste o record tecnici. | Nega tutto. |
| Apertura di test | Solo nella fixture, `ORGANIZER_A` imposta `privateAreaEnabled: true`. Skipper e outsider provano la stessa scrittura. | Consenti solo a `ORGANIZER_A`. |
| Barca skipper | `SKIPPER_A` crea `boats/SKIPPER_A`, legge e aggiorna solo la propria barca senza cambiare skipper o evento. Prova anche un secondo ID barca. | Consenti la propria; nega seconda barca, altra barca e trasferimento. |
| Separazione skipper / crew | `CREW_A`, `CREW_B` e `ANON_A` provano a creare una barca con ID uguale al proprio UID, a leggere `events/egadi-2026` o ad agire da skipper. Un utente Google non skipper prova a creare soltanto la propria barca. | Gli account crew/anonimi sono negati; l'utente Google può creare solo la propria barca. |
| Barca estranea | `OUTSIDER_A` legge, elenca o modifica barca, inviti, membri, contributi, bacheca e record tecnici. | Nega. |
| Schema invito | `SKIPPER_A` crea `INVITE_A` con ID/barca coerenti, campi esatti, `pending`, `participantUid: null`, `accessVersion: 1`, scadenza futura e timestamp server. Prova campo extra, stato diverso, chiave corta, ID/barca diversi e scadenza passata. | Consenti solo il payload esatto. |
| Invito prima dell'attivazione | `CREW_A`, `ANON_A` e outsider provano a leggere `INVITE_A`, a leggere `MEMBER_A` o a creare `crewAccess/{uid}`. | Nega: il link non concede da solo lettura Firestore. |
| Claim iniziale | `CREW_A` aggiorna esclusivamente `participantUid: CREW_A`, `status: active`, `activatedAt: request.time` su `INVITE_A`. Prova cambio di barca, numero, chiave, alias, scadenza o altri campi. | Consenti solo il claim minimo con email del token uguale a `loginEmail`. |
| Claim errato | `CREW_B`, token Google e `ANON_A` provano il claim di `INVITE_A`; prova anche `CREW_A` dopo scadenza o su invito già attivo. | Nega. |
| Record di accesso | Dopo il claim, `CREW_A` crea `crewAccess/CREW_A` con `boatId`, `inviteId`, `userId`, `loginEmail` e timestamp server esatti. Prova UID, alias o invito diversi e un record prima del claim. | Consenti solo dopo claim e solo al titolare UID. |
| Indice del numero | Dopo il record di accesso, `CREW_A` crea `crewLoginIndex/{phoneFingerprint}` con alias tecnico, `boatId`, `inviteId` e timestamp server. Prova impronta di un altro invito, nome, numero, documento o campi extra. Da client non autenticato prova `get` sull'impronta esatta e `list` sulla collection. | Consenti la scrittura solo al titolare; il `get` esatto è consentito a area aperta, la lista è negata. |
| Un numero, una barca | Dopo l'attivazione di `INVITE_A`, `CREW_B` prova a sostituire nello stesso indice un'altra barca o invito. Dall'interfaccia skipper prova a creare un secondo invito con lo stesso numero già attivo. | Nega la sostituzione lato Rules e blocca la creazione lato interfaccia. |
| Scheda personale | Dopo claim, `CREW_A` crea o aggiorna solo `members/INVITE_A` con i campi consentiti, `updatedBy: CREW_A` e timestamp server. Prova altro `memberId`, dati extra, `createdBy` o scheda dopo revoca. | Consenti solo la propria scheda dell'invito attivo. |
| Inserimento skipper | `SKIPPER_A` crea o aggiorna una scheda manuale con soli campi Crew List previsti, timestamp e autore alla creazione. Prova campi extra. | Consenti payload previsto; nega varianti. |
| Bacheca | `CREW_A` legge briefing e annunci della propria barca; prova altra barca. Skipper/organizzatore pubblicano briefing e annunci. | Consenti solo contenuti della propria barca; nega gli altri. |
| Profilo incasso | `SKIPPER_A` crea o aggiorna solo `collectionProfile/default` con nome, quattro booleani, autore e timestamp server. Crew, outsider e `list` provano a leggerlo; lo skipper prova `iban`, URL, alias o un campo extra. | Solo skipper della propria barca e organizzatore possono leggere; soltanto skipper può scrivere lo schema esatto. Nega crew, outsider, lista e campi finanziari. |
| Richiesta contributo | `SKIPPER_A` crea `PAYMENT_A` per `INVITE_A`: centesimi positivi, EUR, causale, uno o più tag abilitati nel profilo, stato `prepared` e timestamp server. Prova invito inesistente, importo decimale/zero, metodo non abilitato, `iban`, URL, dettagli liberi o stato `verified` alla creazione. | Consenti solo lo schema esatto per un invito della stessa barca; nega varianti, dettagli finanziari e conferma iniziale. |
| Lettura e stati contributo | `CREW_A` legge soltanto `PAYMENT_A`; `CREW_B` e outsider provano la stessa lettura o la lista. Skipper/organizzatore provano `prepared → verified` o `prepared → cancelled` con timestamp/autore server e poi provano a cambiare importo, destinatario, causale o metodi. | Crew legge solo la propria richiesta e mai il profilo incasso; skipper/organizzatore possono soltanto le due transizioni. Nega modifiche del contenuto, richiesta già chiusa e ogni scrittura crew. |
| Regole di bordo | `CREW_A` conferma la versione corrente della bacheca, poi lo skipper modifica le regole e aumenta la versione. La cronologia usa un documento nuovo `{rulesVersion}-{uid}` e il crew non può riscriverlo. | Consenti la conferma; l'interfaccia deve richiedere la nuova conferma e conservare lo storico precedente. |
| Riemissione | `SKIPPER_A` aggiorna lo **stesso** `INVITE_A` a `pending`, azzera `participantUid`, cambia chiave/alias/scadenza, aumenta `accessVersion` di uno e registra `reissuedAt/reissuedBy`. Prova a cambiare ID, barca o a saltare versione. | Consenti solo lo schema di riemissione sullo stesso invito. |
| Due schede skipper | Due richieste di riemissione partono dallo stesso `accessVersion`. | Solo la prima è consentita; la seconda è negata e deve ricaricare l'elenco, così non invia un link già superato. |
| Revoca effettiva | Dopo riemissione, `CREW_A` usa il vecchio `crewAccess` per leggere membro, bacheca, annunci, richieste, invito e record tecnico; prova a ricreare l'indice. | Nega tutto. La sua scheda resta associata a `INVITE_A`, ma non è leggibile con il vecchio UID. |
| Nuova attivazione | `CREW_B` ha il nuovo alias, reclama `INVITE_A`, crea `crewAccess/CREW_B` e aggiorna l'indice con la stessa impronta. | Consenti. La scheda e le richieste dello stesso `INVITE_A` restano disponibili al nuovo titolare. |
| Percorso legacy | Qualsiasi utente legge o scrive `boats/{boat}/participantAccess/{uid}`. | Nega sempre. |

## Test browser separati

Le Rules non verificano il PIN: Firebase Authentication lo fa. Prima dell'apertura reale verificare su dominio HTTPS con account fittizi:

1. Primo accesso dal link: numero corretto + due volte lo stesso codice di sei cifre; completamento della scheda e arrivo in `my-area.html`. Verificare anche che la pagina di attivazione invii `no-referrer` alle risorse esterne.
2. Ingresso quotidiano da `crew.html`: stesso numero + codice, senza link WhatsApp.
3. Codice errato, numero non presente, invito scaduto e provider Email/Password disabilitato: messaggio generico, nessun dato visibile.
4. Riemissione skipper: vecchio codice non entra più; nuovo link consente di impostare un nuovo codice e conserva la stessa scheda/PDF/richieste.
5. Logout, bacheca, conferma regole, profilo incasso, richiesta con uno o più tag, WhatsApp e stampa PDF con dati fittizi autorizzati. Dopo il reload, verificare che i dettagli digitati per WhatsApp non compaiano nel sito o in Firestore.

Firebase applica limiti antiabuso generici; questa soluzione non offre un blocco per-invito configurabile come “5 tentativi in 15 minuti”. Non introdurre dati reali finché i risultati di questa matrice non sono registrati.

## Controllo capienza

L'interfaccia conta inviti e membri unici rispetto a `capacity`, definito come numero di posti per l'equipaggio escluso lo skipper. Firestore non può contare atomicamente una subcollection senza logica server: il controllo è operativo nell'interfaccia, non una garanzia anti-concorrenza.

## Chiusura del test

Annotare data, ambiente, regola pubblicata e risultato di ogni caso. Nel progetto live `privateAreaEnabled` è stato attivato l'11 settembre 2026 con autorizzazione esplicita del titolare; per una chiusura immediata riportarlo a `false` e pubblicare anche `PRIVATE_AREA_ENABLED=false`. HTTPS resta necessario, ma non sostituisce i controlli privacy e operativi ancora aperti.

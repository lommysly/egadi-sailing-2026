# Egadi Sailing Experience · 8–11 ottobre 2026

Sito pubblico e area privata per skipper ed equipaggi della flotta Egadi. Il progetto usa Firebase Blaze soltanto per l’archivio privato delle due copie documentali dello skipper: nessun checkout, nessuna Cloud Function, nessun SMS e nessun pagamento automatico.

## Stato reale

- Il sito pubblico è raggiungibile su `https://egadi.thatsablast.it/`.
- Il sito usa un solo sorgente bilingue IT / EN: il selettore conserva lingua, query e hash. L'inglese è copy editoriale scritto e revisionato nel progetto, non un widget Google Translate o una traduzione al volo.
- L'area privata è attiva su HTTPS per autorizzazione esplicita del titolare: skipper con Google, equipaggio solo tramite invito WhatsApp personale e codice di sei cifre.
- `PRIVATE_AREA_ENABLED` nel sorgente e `events/egadi-2026.privateAreaEnabled` in Firestore sono entrambi `true`. Per una chiusura di emergenza basta riportare uno dei due a `false`; per coerenza operativa vanno riportati entrambi a `false`.
- Google ed Email/Password sono attivi; email-link e SMS non sono usati. Il dominio `egadi.thatsablast.it` è autorizzato in Firebase Authentication.

## Pagine e materiali

- `index.html`: presentazione pubblica della flotta e del viaggio.
- `passage-plan.html`: unica pagina pubblica per meteo e Passage Plan, alimentata da `passage-plan-data.js` e dalla sua edizione inglese editoriale `passage-plan-data-en.js`.
- `arrivi-partenze.html`: sezione pubblica che spiega le quattro tratte, la finestra di match ±2 ore e la visibilità controllata dei contatti; non raccoglie dati in pagina.
- `film.html` e `VIDEO_STORYBOARD.md`: storyboard del film; nessun filmato di terzi viene incorporato senza licenza.
- `area.html`: area skipper con Google Sign-In, una barca per skipper, piano equipaggio privato, dossier charter privato dello skipper, Crew List, PDF, bacheca, inviti WhatsApp, profilo privato di incasso, dashboard economica, piano quote a dieci voci e richieste di contributo con messaggio WhatsApp diretto.
- `participant.html`: primo accesso dal link WhatsApp; la persona conferma il suo numero e sceglie il proprio codice di 6 cifre, poi completa i dati necessari alla Crew List.
- `crew.html`: ingresso quotidiano dell'equipaggio con numero WhatsApp e codice personale.
- `my-area.html`: area personale con scheda, bacheca, regole e richieste dedicate.
- `crew-pdf.js`: foglio A4 orizzontale da salvare in PDF per charter / eventuali controlli, con skipper nella Crew List e riepilogo privato di patente/certificato radio; non esporta CSV né incorpora le copie dei documenti.
- `storage.rules` e `storage-cors.json`: archivio Firebase Storage privato per patente nautica e certificato radio dello skipper; non esiste un archivio documenti dell’equipaggio.
- `FIRESTORE_RULES_TEST_MATRIX.md`, `CHECKLIST_PUBBLICAZIONE.md` e `PRIVACY_DA_COMPLETARE.md`: tracciabilità dei controlli, delle verifiche da completare e delle decisioni privacy da formalizzare.
- `ARRIVI_PARTENZE_SPEC.md`: modello operativo per la futura scheda privata dell'equipaggio e per l'area riservata della società transfer.

## Accesso dell'equipaggio: flusso concordato

1. Lo skipper crea prima una **proiezione equipaggio privata**: nome, cognome, WhatsApp internazionale, consenso a essere contattata, ruolo e sistemazione previsti, lingua e voci di costo previste. La proiezione riserva un posto, ma non crea né un accesso, né una richiesta di pagamento, né una riga nel PDF charter.
2. Quando decide di coinvolgere quella persona, lo skipper trasforma la stessa proiezione in un invito: il sito mantiene il medesimo identificativo e genera un link personale casuale, valido 14 giorni. Lo skipper lo invia direttamente su WhatsApp: messaggio, Privacy e primo accesso usano la lingua selezionata.
3. Al primo accesso la persona apre quel link, conferma il numero WhatsApp e sceglie il proprio codice personale di **esattamente 6 cifre**. Non è il PIN di sblocco del telefono.
4. Prima della Crew List la persona legge una sintesi, scorre il regolamento completo della propria barca e conferma esplicitamente la versione pubblicata dallo skipper. La sintesi non sostituisce il testo integrale né il briefing pratico a bordo. In inglese la conferma è possibile soltanto quando lo skipper ha pubblicato anche la versione inglese ufficiale completa.
5. Dopo il briefing, la persona può salvare una **bozza privata** della propria anagrafica anche se non ha ancora un documento sotto mano. La bozza non è una Crew List, non occupa un posto, non attiva pagamenti e non entra nel PDF. È leggibile soltanto dalla stessa persona e resta legata alla versione del suo invito.
6. Solo con dati completi e consenso esplicito la scheda viene confermata nella Crew List. Il codice viene verificato da Firebase Authentication e non viene salvato nella Crew List, in Firestore o nel browser.
7. Dopo aver completato la scheda, la persona torna quando vuole da `crew.html`: inserisce numero + codice e viene portata soltanto nella barca e nell'area dello skipper associati. Se ha una bozza, torna direttamente alla compilazione precompilata. Per il weekend un numero WhatsApp può avere una sola barca attiva.
7. Una proiezione può essere liberata solo prima di creare il link. Dopo l'invito, la riemissione usa sempre lo stesso identificativo: proiezione, invito, scheda Crew List, richieste e PDF restano nella stessa posizione senza occupare un secondo posto. Se esiste una bozza anagrafica incompleta, viene cancellata nello stesso passaggio: il nuovo destinatario non può mai ereditarla.

Il link WhatsApp è un codice di attivazione, non un accesso permanente. Se viene inoltrato e usato **prima** della persona destinataria, chi lo possiede può attivarlo: un link diretto non può dimostrare l'identità del destinatario senza OTP o verifica esterna. Per questo scade, non va inoltrato e lo skipper può revocarlo.

### Lingua e contenuti ufficiali

Le pagine pubbliche, la navigazione e il percorso equipaggio hanno una traduzione inglese editoriale, non Google Translate. La lingua scelta dallo skipper nell’invito (`preferredLocale`) è privata e serve solo a comporre il messaggio WhatsApp e il primo link nella lingua della persona. Il sito non traduce automaticamente nomi, anagrafica, contatti, richieste di contributo, causali, annunci dello skipper, istruzioni di pagamento o note operative libere: una traduzione automatica potrebbe alterarne il significato o divulgare dati non necessari. Le richieste WhatsApp usano invece un testo guida italiano o inglese; una causale scritta liberamente dallo skipper resta nella sua lingua originale.

Il briefing safety segue una regola più rigorosa: italiano e inglese sono due versioni ufficiali parallele. Lo skipper completa e verifica titolo, sintesi e regolamento inglesi prima della pubblicazione; un contenuto inglese parziale viene rifiutato. Ogni modifica al regolamento italiano o inglese aumenta `rulesVersion`, richiede una nuova accettazione e registra `acceptedLocale`. Ritrovo, orari e note operative sono invece bacheca del viaggio: si aggiornano senza invalidare un regolamento già letto. Il browser non usa Google Translate per questo testo.

La pagina di attivazione imposta inoltre `Referrer-Policy: no-referrer`, così il codice presente nel link non viene passato come referrer a font, script o altre risorse esterne caricate dalla pagina.

### Limiti dichiarati del compromesso

- Non viene inviato nessun messaggio email e non è richiesto Google all'equipaggio.
- Non esiste ancora Face ID / impronta: una vera passkey richiede un server che generi e verifichi le challenge WebAuthn. Non viene simulata con un pulsante fittizio.
- Non c'è OTP SMS: comporterebbe costi e un piano di fatturazione.
- Firebase applica protezioni generiche contro l'abuso; il progetto non implementa un blocco configurabile tipo “5 tentativi per invito”, perché richiederebbe logica server-side a pagamento. Gli errori restano generici.
- Per rendere possibile l'ingresso con il solo numero, Firestore conserva un'impronta SHA-256 del numero e un indice tecnico pubblico consultabile solo per chi conosce il numero esatto. Non contiene nome, numero, documento o Crew List; contiene l'alias tecnico e gli identificativi tecnici della barca/invito, e può rivelare che quel numero ha un accesso Egadi attivo. Va indicato nell'informativa e cancellato dopo l'evento.

## Configurazione Firebase attiva

Nel progetto `egadi-sailing-2026`:

1. Conservare **Google** per skipper e organizzazione.
2. **Email/Password** è abilitato esclusivamente per la verifica tecnica del codice di 6 cifre. Email-link non è attivo: nessuna email viene inviata o usata dall'equipaggio.
3. Configurare la policy password con minimo 6 caratteri. L'interfaccia accetta solo sei cifre; Firebase non può imporre da solo “solo cifre” con questa soluzione.
4. Attivare la protezione contro l'enumerazione delle email se disponibile nel progetto: il codice gestisce gli errori generici di accesso.
5. Il provider **Anonimo** non è usato dal nuovo sorgente. Disabilitarlo soltanto dopo che la nuova versione e le nuove Rules sono pubblicate e provate, così non si interrompe una sessione della versione precedente durante il passaggio.
6. Lasciare autorizzati soltanto i domini necessari in Authentication, compreso `egadi.thatsablast.it` e, per i test locali, `127.0.0.1`.
7. Il documento `events/egadi-2026` contiene `organizerIds` con il solo UID autorizzato e `privateAreaEnabled: true`. Per chiudere l'operatività, riportare il flag a `false` e pubblicare anche `PRIVATE_AREA_ENABLED=false`.
8. Il bucket predefinito `egadi-sailing-2026.firebasestorage.app` è in `EUROPE-WEST1`; applicare `storage.rules` e il CORS ristretto al solo dominio HTTPS di produzione prima di abilitare caricamenti reali.

Nel profilo privato dello skipper possono essere conservati solo i dettagli necessari per ricevere il contributo: link HTTPS PayPal/Satispay, link HTTPS o Revtag Revolut e, per bonifico, IBAN più intestatario. Non inserire mai password, OTP, numeri di carta, chiavi API o credenziali dei provider. I dettagli non entrano nella Crew List o nella richiesta di pagamento e vengono composti solo nel messaggio WhatsApp per il destinatario scelto.

## Modello dati

```text
events/egadi-2026
  organizerIds: [uid]
  privateAreaEnabled: true

boats/{skipperUid}
  name, model, totalBerths (skipper incluso), capacity (partecipanti derivati)
  berthLayout e berthRates (privati), homePort, flag, skipperId, eventId
  crewProjections/{projectionId}
    firstName, lastName, displayName, whatsappNumber, contactConsent
    plannedRole, berthType, preferredLocale
    berthCents, starterPackCents, protectionInsuranceCents, refundableDepositCents
    pricingMode: dashboard | custom
    status: projected | invited, inviteId, invitedAt, createdAt, createdBy, updatedAt, updatedBy
  members/{inviteId}
    firstName, lastName, birthDate, birthPlace, nationality, gender
    documentType, documentNumber, documentExpiry, charterConsent
    role, email, phone, displayName, updatedAt
  crewDrafts/{inviteId}
    bozza anagrafica incompleta dell'invitato attivo, participantUid e accessVersion
    privata alla sola persona; mai PDF, capienza, flotta, pagamenti o Crew List
  skipperProfile/default
    anagrafica Crew List, documento, patente nautica e certificato radio
    stati di consegna al charter, consenso, updatedAt, updatedBy
    nessuna copia o URL di download nel documento Firestore
  skipperProfileDraft/default
    bozza privata e incompleta del dossier skipper; mai PDF o Crew List
  skipperTravel/outbound
  skipperTravel/return
    due bozze operative indipendenti, una per l’andata verso Marsala e una per il ritorno
    transportMode, città/aeroporti IATA, date/orari, compagnia/numero servizio,
    bagagli e flag transfer aeroporto ↔ Marsala
    i campi possono restare vuoti: ogni tratta si salva e si completa separatamente
    solo skipper della propria barca; mai Crew List, PDF, flotta, pagamenti,
    organizzatore, equipaggio, altro skipper o società transfer
  Cloud Storage privato
    boats/{skipperUid}/skipper-documents/sailing-license/current
    boats/{skipperUid}/skipper-documents/radio-certificate/current
    solo PDF, JPG o PNG fino a 8 MB; mai file dell’equipaggio, URL pubblici,
    nomi originali o metadati in Firestore
  invites/{inviteId}
    displayName, whatsappNumber, phoneFingerprint, loginEmail, accessKey
    participantUid, status, accessVersion, expiresAt, preferredLocale, createdAt
  collectionProfile/default
    collectorId, collectorName, paypalEnabled, satispayEnabled
    revolutEnabled, bankTransferEnabled, paymentDetails (privati), updatedAt, updatedBy
  contributionPlan/default
    items: { berth, starter_pack, linen_towels, protection_insurance,
             provisions, fuel, transfer, shore_dinner, mooring_fee,
             refundable_deposit }
    ogni voce: { state, amountCents }
    starterPackItems: elenco chiuso di servizi selezionati
    starterPackSettlementMode: cash_on_board
    updatedAt, updatedBy
  costPlan/default
    charterCents, skipperFlightTrainCents, skipperCarCents
    skipperLocalTransferCents, otherRecoverableCents, payingParticipants
    starterPackTotalCents, starterPackRateMode, starterPackFixedPerPersonCents,
    starterPackIncludedInCharter
    protectionInsuranceTotalCents, protectionInsuranceRateMode,
    protectionInsuranceFixedPerPersonCents, refundableDepositTotalCents
    depositParticipants
    dinettePayingParticipants, dinetteWeightPercent
    berthRoundingMode, berthRoundingIncrementCents, manualStandardBerthCents
    starterPackDescription, protectionInsuranceDescription,
    refundableDepositDescription
    updatedAt, updatedBy
  paymentRequests/{requestId}
    recipientId, memberId, payerInviteId, contributionItemId, amountCents, currency, reason, accountingCategory, isOptional, dueDate
    collectorId, collectorName, paymentMethods, status, createdAt, createdBy
    verifiedAt, verifiedBy, cancelledAt, cancelledBy
    private/message (facoltativo, solo skipper)
      messageDetails, createdAt, createdBy
  briefing/board
    rulesTitle, rulesSummary, rulesText, fullRulesRequired, rulesVersion
    rulesTitleEn, rulesSummaryEn, rulesTextEn (tutti completi oppure tutti vuoti)
    meetingPoint, boardingAt, departureAt, returnAt, scheduleNote, scheduleNoteEn
  announcements/{announcementId}
  ruleAcceptances/{inviteId}
    inviteId, acceptedBy, rulesVersion, fullRulesRead, acceptedLocale, acceptedAt
    history/{rulesVersion}-{participantUid}
      inviteId, acceptedBy, rulesVersion, fullRulesRead, acceptedLocale, acceptedAt

crewAccess/{participantUid}
  boatId, inviteId, userId, loginEmail, updatedAt

crewLoginIndex/{phoneFingerprint}
  loginEmail, boatId, inviteId, updatedAt
```

`loginEmail` è un alias tecnico pseudonimo: non è l'email reale della persona e non riceve messaggi. Dopo l'attivazione le autorizzazioni della Crew List sono legate al `participantUid` Firebase, non a quell'alias. Il percorso legacy `participantAccess` è negato dalle nuove Rules.

Il vincolo operativo è **un numero WhatsApp, una barca attiva** nello stesso evento. Il sito blocca un secondo invito dopo che il numero è stato attivato; se una persona deve cambiare barca, l'organizzatore deve prima verificare e chiudere l'associazione errata.

`crewProjections` è privato: fino all'attivazione lo leggono e modificano soltanto lo skipper della barca e l'organizzatore autorizzato. Dopo l'attivazione la persona può vedere soltanto la propria previsione associata allo stesso `inviteId`, mai l'elenco o le quote altrui. La previsione contiene un contatto e deve quindi essere creata solo dopo il consenso della persona; non è un dato pubblico, non viene copiato nella flotta e non viene esportato nel PDF. Le voci previste servono a orientare skipper e partecipante, non attestano un debito, una richiesta inviata o un pagamento.

## Crew List PDF e capienza

Il pulsante **Genera Crew List PDF** apre un foglio A4 orizzontale prestampato creato localmente nel browser. Lo skipper sceglie “Salva come PDF” dalla finestra di stampa. Il PDF si attiva solo con dati della barca, dossier skipper completo, le due copie private dello skipper caricate, dati richiesti per ogni persona e conferma di condivisione completati; non contiene proiezioni, inviti non completati o bozze private. La prima riga è lo skipper/comandante e una sezione separata riporta riferimenti e stato di documento, patente nautica e certificato radio. È un foglio operativo da verificare con il modello e il canale richiesti dal charter, non una conferma automatica di ricezione o un archivio di allegati. Le copie non sono incorporate nel PDF: lo skipper le scarica dal proprio archivio privato e le allega solo nel canale richiesto dal charter. Il porto di iscrizione non è un campo necessario.

Lo skipper inserisce `totalBerths`, cioè i posti totali a bordo incluso lo skipper. Il sito salva anche `capacity`, derivato come `totalBerths - 1`, per inviti, Crew List e flotta pubblica. Per Karibu: 4 cabine doppie + 2 posti dinette + cabina marinaio = 11 posti totali; 1 è dello skipper e 10 sono partecipanti invitabili o quotabili. Il conteggio operativo usa l'unione per identificativo di proiezioni, inviti e schede Crew List: quando una proiezione diventa invito e poi scheda, resta un solo posto. Le schede manuali o gli inviti legacy senza proiezione contano una volta ciascuno. Non è un vincolo atomico server-side e non sostituisce la valutazione nautica dello skipper.

Se lo skipper sceglie di mostrare disponibilità nella flotta, il sito pubblica **solo il numero calcolato** `capacity − posti unici riservati/occupati` e l'eventuale configurazione generica scelta. Non pubblica mai nomi, numeri, ruoli, cabine assegnate, quote previste, richieste o pagamenti. Il valore è una fotografia operativa: prima di lavorare da due schede contemporanee va ricaricata l'area skipper, perché Firestore non può imporre un limite atomico su più subcollection senza logica server.

`berthLayout` è facoltativo e privato: cabine doppie o singole, posti letto in dinette, cabina marinaio, altri posti letto reali e numero totale dei bagni. Quando è compilato, deve coincidere con `totalBerths`; non va mai aggiunto un posto fittizio per far quadrare i conti. La cabina marinaio conta come posto fisico riservato allo skipper, ma non è assegnabile alla Crew List o a una quota. Il numero dei bagni non incide sulla capienza e per ora non distingue bagni privati o condivisi. Il layout non alimenta la flotta pubblica né il PDF per il charter.

`berthRates` è un listino privato e facoltativo in centesimi per singolo posto letto: cabina doppia, cabina singola, dinette o altra sistemazione. Non esiste una quota per la cabina marinaio. È il fallback prima che la Dashboard economica ricavi una quota; con un preventivo completo, le nuove proiezioni seguono la dashboard. Resta disponibile come riferimento per una scelta manuale, ma non riserva nulla da solo: è la proiezione nominativa a riservare il posto. Né il listino né la proiezione rendono un pagamento automatico o verificato.

Ogni skipper gestisce una sola barca: per le nuove registrazioni l'ID della barca coincide con l'UID dello skipper e le Rules impediscono una seconda creazione. Il nome della barca, ad esempio `Karibu`, è modificabile dallo skipper.

## Proiezione equipaggio e quote previste

Il **Piano equipaggio** serve allo skipper per fare una previsione puntuale prima di inviare WhatsApp: a ogni posto riservato associa persona, ruolo, sistemazione e quattro componenti personali — posto, Starter Pack, assicurazione cauzione e cauzione rimborsabile. Il posto può essere una cabina oppure, in alternativa, la dinette. La **richiesta prevista** somma posto e assicurazione. Lo Starter Pack può essere già compreso nel charter oppure essere un costo esterno; in entrambi i casi resta una quota in contanti in loco. Quando è già compreso, il calcolatore ne scorpora il valore dalla quota cabina. Per co-skipper, hostess o collaboratori gratuiti lo skipper può disattivare la partecipazione alle quote: il posto resta nel piano e nella capienza, mentre quota posto, Starter Pack e assicurazione restano a zero. La cauzione rimborsabile rimane distinta e lo skipper può comunque prevederla. Tutte sono previsioni utili a stimare la copertura dei costi e vengono mostrate nella dashboard personale dopo l'attivazione, ma non sono una richiesta, un incasso, un pagamento verificato o un impegno automatico.

Per le nuove schede, il prezzo del posto arriva dalla **Dashboard economica**: cabina da due posti, cabina da un posto, dinette o altra sistemazione. Prima che il preventivo sia completo, il sito usa il listino base della barca. Starter Pack, assicurazione e cauzione arrivano dal preventivo della barca; per l'equipaggio il Pack è spiegato soltanto attraverso le inclusioni selezionate nell'elenco chiuso, non con descrizioni libere. La scheda salva `pricingMode: dashboard` quando segue queste impostazioni e `pricingMode: custom` solo se lo skipper apre l'eccezione personale e modifica un importo. Le schede precedenti senza il flag restano accordi storici: non vengono ricalcolate né sovrascritte automaticamente. Una richiesta WhatsApp, una volta preparata, resta comunque una fotografia dell'importo scelto e deve essere verificata manualmente dopo il versamento.

Per le sistemazioni in cabina doppia, la proiezione può indicare una cabina numerata (`Cabina doppia 1`, `Cabina doppia 2` e così via) derivata dalla configurazione privata della barca. Due persone con lo stesso gruppo condividono la cabina; il sito non salva un doppio collegamento fra persone, così uno spostamento non può lasciare una coppia incoerente. L'interfaccia non consente più di due persone nello stesso gruppo e impedisce di ridurre il numero di cabine finché restano assegnazioni fuori configurazione. È un controllo operativo lato skipper: prima di lavorare da più schede contemporanee si aggiorna l'area, come per la capienza complessiva.

La **cauzione rimborsabile** resta sempre una voce distinta, da portare o regolare in loco secondo charter e skipper. Non entra nel totale da chiedere via WhatsApp, non viene classificata come contributo, non entra nella Cassa skipper e non può diventare un pagamento remoto dal sito.

Solo dopo una scelta esplicita dello skipper la proiezione diventa un invito WhatsApp e, in un secondo momento, una richiesta personale può essere creata con importo, causale e metodi. Nessuna di queste tre azioni crea le altre automaticamente. Se la persona modifica dati o ruolo nella propria scheda, la Crew List conserva la sua dichiarazione aggiornata; la proiezione resta il piano iniziale dello skipper e non sostituisce i dati richiesti dal charter.

## Bacheca e contributi

Lo skipper pubblica regole di bordo, ritrovo, imbarco, partenza, rientro e avvisi. Il regolamento è composto da una sintesi iniziale e dal testo completo: la sintesi orienta ma non sostituisce mai il testo integrale. Prima dell'accettazione resta leggibile solo il briefing necessario a decidere consapevolmente; bacheca, piano quote e richieste personali si sbloccano soltanto con la conferma della versione corrente. Per i briefing pubblicati con `fullRulesRequired: true`, l'interfaccia sblocca la conferma solo dopo lo scorrimento del testo completo e Firestore richiede la dichiarazione `fullRulesRead: true` prima della Crew List o dell'aggiornamento della propria scheda. Quando cambia il regolamento, in italiano o nell'eventuale edizione inglese ufficiale, aumenta la versione e la persona deve confermare di nuovo la lettura della nuova versione; un aggiornamento di solo ritrovo, orario o avviso non tocca invece le conferme già raccolte.

Lo scorrimento e la conferma registrano una dichiarazione di lettura della versione, non possono dimostrare materialmente che ogni parola sia stata compresa. Indicazioni operative reali della singola barca, del charter, delle dotazioni e di eventuali cauzioni devono essere verificate dallo skipper e pubblicate solo quando confermate.

Il sito non incassa denaro, non genera o valida link dei provider e non dichiara pagamenti come eseguiti. Lo skipper configura una volta il proprio nome, i metodi e i dettagli privati di PayPal, Satispay, Revolut e/o bonifico; quindi crea una richiesta con importo, causale, scadenza e una o più alternative. Ogni nuova richiesta porta due etichette tecniche chiuse: `cost_recovery` se il versamento deve concorrere al recupero dei costi della barca, `other` negli altri casi; e `contributionItemId`, che identifica quota posto, assicurazione o altra voce senza interpretare la causale libera. Starter Pack e cauzione rimborsabile non sono ammessi nelle nuove richieste. Lo Starter Pack resta sempre cash/in loco; il flag “compreso nel charter” indica solo che il suo valore è già dentro il charter e viene scorporato dalla quota cabina. La cauzione resta sempre cash/in loco. Il messaggio WhatsApp prende soltanto i dettagli dei metodi selezionati e non li copia nella richiesta Firestore, che resta leggibile soltanto dallo skipper e dalla persona destinataria dopo l'accettazione corrente del briefing. Un'eventuale nota libera del messaggio vive invece nel figlio privato e immutabile `paymentRequests/{requestId}/private/message`: serve allo skipper per riaprire o copiare lo stesso testo, ma non compare nell'area della persona. Su Mac il pulsante prova l'app WhatsApp nativa; il recupero esplicito resta WhatsApp nel browser o la copia del messaggio. Il pagamento avviene fuori dal sito e può essere segnato come verificato solo dallo skipper, dopo controllo manuale dell'accredito reale. Le richieste create prima dell'introduzione di queste etichette restano aggiornabili soltanto nelle normali transizioni di stato, così possono essere verificate o annullate senza riscriverne il contenuto; restano fuori dai riepiloghi classificati finché il sito non conosce la loro voce.

Prima di chiedere una quota, lo skipper può pubblicare il **piano quote** della propria barca. È un riepilogo a dieci voci fisse, non un listino libero e non una prova di pagamento:

| Voce mostrata | Stato possibile |
| --- | --- |
| Quota posto in barca (noleggio) | da definire, compreso nella quota, da richiedere a parte, da regolare in loco / da dividere, non previsto |
| Starter Pack · servizi scelti per la barca | quota cash/in loco; valore già compreso nel charter oppure esterno |
| Lenzuola e asciugamani | voce tecnica già compresa nel Pack; nella scheda equipaggio le inclusioni sono elencate direttamente nel Pack |
| Assicurazione cauzione | gli stessi stati |
| Cambusa | gli stessi stati |
| Gasolio per la navigazione | gli stessi stati |
| Transfer aeroporto ↔ porto, andata e ritorno | gli stessi stati |
| Cena a terra programmata | gli stessi stati |
| Porto / ormeggio programmato | gli stessi stati |
| Cauzione rimborsabile | solo contanti, in loco e rimborsabile |

Le voci generiche partono da **da definire**: il sito non presume cosa sia incluso. Un importo per persona può comparire soltanto per “da richiedere a parte” o “da regolare in loco / da dividere”; “compreso”, “da definire” e “non previsto” restano a zero. Il piano V4 non conserva testi liberi per l'equipaggio: le spiegazioni sono editoriali e statiche, associate alle dieci voci chiuse.

Lo **Starter Pack** e la **cauzione rimborsabile** sono casi diversi: non possono essere inclusi nella richiesta WhatsApp. Il Pack può essere già dentro il costo charter (e allora il calcolatore lo scorpora dalla cabina) oppure esterno; in entrambi i casi si regola in contanti in loco. La cauzione resta sempre in contanti in loco. Lo skipper seleziona soltanto le inclusioni reali della propria barca da un elenco chiuso: lenzuola, asciugamani, kit bagno/consumabili, telo mare, fuoribordo, pulizie finali, SUP, permesso o contributo di navigazione Egadi e, se previsto dal charter, tender. Non fanno parte dello Starter Pack cambusa, gasolio effettivamente consumato, transfer aeroporto-porto in entrambi i sensi, porto/ormeggio/boa se non inclusi e cena a terra. Il piano non contiene link, IBAN, Revtag, contatti, causali o altri testi liberi. È leggibile dallo skipper, dall'organizzatore e dall'equipaggio solo dopo l'accettazione della versione corrente delle regole di bordo; le coordinate di incasso restano invece nel profilo privato dello skipper.

### Preventivo barca privato

Il **Preventivo barca / quote automatiche** è un prospetto interno separato dal piano quote e dalle richieste personali. Serve a evitare che lo skipper sostenga da solo i costi necessari alla barca: costo charter, viaggio andata/ritorno dello skipper (volo o treno), auto, transfer locale e un unico totale per altre spese recuperabili, per esempio un porto già certo. Per Starter Pack e assicurazione sceglie esplicitamente se il dato è un totale da dividere o un fisso per persona; il Pack può anche risultare già compreso nel charter. La cauzione rimborsabile mantiene invece il suo totale e il suo divisore separato. Le inclusioni del Pack arrivano all'equipaggio soltanto come elenco chiuso, senza note libere. La cena a terra, un ormeggio da dividere successivamente o un altro extra programmato restano nel piano quote: lo skipper decide lì se sono inclusi, separati, cash/in loco o non previsti. Il preventivo non contiene nominativi dell'equipaggio, quote individuali, istruzioni di pagamento o coordinate di incasso.

Lo skipper non rientra nei partecipanti paganti: nel modello operativo non paga quota posto né spese collettive come cambusa, Starter Pack o navigazione. Le sole cene a terra restano personali e non entrano nel prospetto. Il **listino della barca** resta un riferimento iniziale o manuale; quando il preventivo è completo, la Dashboard economica applica alle nuove schede la quota ricavata per cabina, dinette o altra sistemazione. Il calcolo di pareggio resta un controllo separato: per default, `costi recuperabili / ((ospiti paganti − posti dinette paganti) + posti dinette paganti × percentuale dinette)`; la quota dinette è la quota cabina moltiplicata per la percentuale, inizialmente 65%. In alternativa lo skipper può fissare direttamente il prezzo della dinette: la quota cabina diventa `(costi recuperabili − posti dinette paganti × prezzo dinette) / ospiti in cabina`. Il prezzo fisso è consentito solo se resta almeno un ospite in cabina e il totale delle dinette non supera i costi da recuperare. Starter Pack e assicurazione possono essere sia un totale diviso fra gli ospiti paganti sia una quota fissa per persona; se il Pack è già incluso nel charter, il suo valore viene scorporato dalla quota cabina e regolato cash/in loco. La cauzione rimborsabile ha invece un divisore separato, `depositParticipants`, così può comprendere anche un co-skipper o una hostess gratuiti che devono portarla. Per evitare cifre scomode, lo skipper può lasciare il calcolo al centesimo, arrotondare sempre per eccesso al prossimo euro, 5 euro o 10 euro, oppure scegliere una quota cabina che non lasci neppure un centesimo scoperto. Il charter reale non cambia mai: il dashboard mostra la differenza come riserva da riallocare nella cassa comune, non come guadagno. Dopo le cinque voci per persona, skipper ed equipaggio vedono i tre importi operativi: totale da bonificare/versare per cabina (posto più assicurazione), totale per dinette (posto più assicurazione) e totale contanti all’imbarco (Starter Pack più cauzione rimborsabile). Il valore “ricevuto” riguarda soltanto le richieste che lo skipper ha verificato manualmente dopo un accredito reale; Starter Pack e cauzione cash restano una previsione da raccogliere a bordo e questo rilascio non registra il contante ricevuto. Il prospetto non calcola profitto, non invia richieste e non riserva posti: per il bilancio considera soltanto le richieste della stessa barca marcate `cost_recovery` e verificate manualmente dallo skipper. Cambusa, assicurazione, transfer ed extra marcati `other` restano fuori; la cauzione rimborsabile resta sempre separata, da portare/regolare in loco e fuori da incassi e pareggio. Un avanzo è da riallocare, non un guadagno automatico.

Il documento `costPlan/default` è leggibile e modificabile soltanto dallo skipper della relativa barca. Organizzatore, equipaggio, altri skipper e web pubblico non hanno accesso; non è cancellabile dall'area skipper. La procedura amministrativa di conservazione e cancellazione deve quindi essere definita prima dell'uso reale.

## Verifiche manuali ancora necessarie

Prima di inserire l'equipaggio reale, usare soltanto account, nomi, numeri, importi e metodi fittizi e registrare l'esito nella matrice di test.

1. Creare una proiezione, ricaricare l'area e verificare che riservi un solo posto, non generi link, richiesta, PDF o dati pubblici.
2. Dalla stessa riga creare l'invito WhatsApp, fare primo accesso con account crew fittizio, accettare il briefing e completare la Crew List: proiezione, invito, scheda e capienza devono conservare lo stesso identificativo e non contare due volte.
3. Provare a liberare un posto prima dell'invito e verificare che, dopo l'invito o l'attivazione, l'azione non cancelli la storia né l'accesso; usare solo la riemissione del link sullo stesso invito.
4. Verificare nella dashboard crew che quota prevista e cauzione rimborsabile siano separate dalle richieste personali; creare poi una richiesta fittizia separata e segnare manualmente uno stato, senza simulare o dichiarare un pagamento reale.
5. Su HTTPS e da una seconda sessione, controllare la disponibilità pubblica dopo riserva, invito, completamento e liberazione di un posto. Deve cambiare soltanto il numero; nessun dato personale o economico deve apparire in flotta.
6. Con account skipper e file fittizi, caricare soltanto i due file consentiti, scaricarli dallo stesso account e verificare che equipaggio, organizzatore, altro skipper, estraneo e `list` siano negati. Non usare documenti reali.

## Arrivi e partenze

La sezione pubblica è online e descrive il flusso per aeroporto, Marsala e passaggi fra amici. Nell’area skipper esiste ora il solo modulo privato `skipperTravel`: i documenti fissi `outbound` e `return` raccolgono in modo indipendente città di partenza/arrivo, aeroporto reale, data e orari, compagnia e numero di servizio facoltativi, bagagli e una richiesta indicativa di transfer aeroporto ↔ Marsala. Sono bozze operative: si possono salvare anche incomplete, non inviano una richiesta alla società transfer e non entrano nella Crew List, nel PDF, nella flotta o nella contabilità.

Le due tratte sono leggibili e modificabili soltanto dallo skipper associato alla propria barca; `list`, cancellazione e accessi di equipaggio, organizzatore, altro skipper o società transfer sono negati. Il flag transfer resta quindi privato finché non saranno pronti informativa specifica, consenso e un processo distinto che generi una scheda aeroportuale minimizzata.

La società transfer avrà in seguito un’area riservata separata per le sole tratte aeroporto ↔ Marsala: potrà raggruppare persone, assegnare il mezzo e contattarle. I passaggi casa ↔ aeroporto restano fuori dalla sua area. I contatti fra partecipanti non saranno pubblici: saranno visibili solo dopo la scelta per tratta e l'accettazione del collegamento da entrambe le persone. La raccolta effettiva per equipaggio e le Rules dedicate verranno implementate soltanto dopo la definizione dell'accesso nominativo della società e dell'informativa definitiva.

## Attivazione operativa

1. Il sorgente, le Security Rules e il dominio HTTPS sono pubblicati.
2. Google, Email/Password e il dominio autorizzato sono stati riletti; email-link resta disattivato.
3. Con autorizzazione del titolare dell'11 settembre 2026 sono stati attivati insieme `PRIVATE_AREA_ENABLED=true` e `privateAreaEnabled: true`.
4. Il primo utilizzo deve partire dallo skipper: Google, verifica della barca `Karibu`, poi un invito personale a una persona alla volta.
5. Restano da completare e formalizzare i punti in `PRIVACY_DA_COMPLETARE.md`, in particolare contatto, tempi di conservazione e procedura di cancellazione.

L'invito resta obbligatorio: l'apertura dell'area non crea una registrazione pubblica libera.

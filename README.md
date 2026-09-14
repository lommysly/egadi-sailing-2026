# Egadi Sailing Experience · 8–11 ottobre 2026

Sito pubblico e area privata per skipper ed equipaggi della flotta Egadi. Il progetto resta sul piano Firebase Spark: nessun checkout, nessuna Cloud Function, nessun SMS e nessun servizio a consumo.

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
- `area.html`: area skipper con Google Sign-In, una barca per skipper, Crew List, PDF, bacheca, inviti WhatsApp, profilo privato di incasso, piano quote a otto voci e richieste di contributo con messaggio WhatsApp diretto.
- `participant.html`: primo accesso dal link WhatsApp; la persona conferma il suo numero e sceglie il proprio codice di 6 cifre, poi completa i dati necessari alla Crew List.
- `crew.html`: ingresso quotidiano dell'equipaggio con numero WhatsApp e codice personale.
- `my-area.html`: area personale con scheda, bacheca, regole e richieste dedicate.
- `crew-pdf.js`: foglio A4 orizzontale da salvare in PDF per charter / eventuali controlli; non esporta CSV.
- `FIRESTORE_RULES_TEST_MATRIX.md`, `CHECKLIST_PUBBLICAZIONE.md` e `PRIVACY_DA_COMPLETARE.md`: tracciabilità dei controlli, delle verifiche da completare e delle decisioni privacy da formalizzare.
- `ARRIVI_PARTENZE_SPEC.md`: modello operativo per la futura scheda privata dell'equipaggio e per l'area riservata della società transfer.

## Accesso dell'equipaggio: flusso concordato

1. Lo skipper crea un invito con nome, numero WhatsApp internazionale e lingua preferita della persona (italiano o inglese).
2. Il sito genera un link personale casuale, valido 14 giorni. Lo skipper lo invia direttamente su WhatsApp: messaggio, Privacy e primo accesso usano la lingua selezionata.
3. Al primo accesso la persona apre quel link, conferma il numero WhatsApp e sceglie il proprio codice personale di **esattamente 6 cifre**. Non è il PIN di sblocco del telefono.
4. Prima della Crew List la persona legge una sintesi, scorre il regolamento completo della propria barca e conferma esplicitamente la versione pubblicata dallo skipper. La sintesi non sostituisce il testo integrale né il briefing pratico a bordo. In inglese la conferma è possibile soltanto quando lo skipper ha pubblicato anche la versione inglese ufficiale completa.
5. Il codice viene verificato da Firebase Authentication e non viene salvato nella Crew List, in Firestore o nel browser.
6. Dopo aver completato la scheda, la persona torna quando vuole da `crew.html`: inserisce numero + codice e viene portata soltanto nella barca e nell'area dello skipper associati. Per il weekend un numero WhatsApp può avere una sola barca attiva.
7. Se dimentica il codice o perde il link, lo skipper usa **Revoca e genera nuovo link**. L'invito conserva lo stesso identificativo, quindi anagrafica, richieste e associazione al PDF restano nella stessa posizione; il precedente accesso smette di funzionare.

Il link WhatsApp è un codice di attivazione, non un accesso permanente. Se viene inoltrato e usato **prima** della persona destinataria, chi lo possiede può attivarlo: un link diretto non può dimostrare l'identità del destinatario senza OTP o verifica esterna. Per questo scade, non va inoltrato e lo skipper può revocarlo.

### Lingua e contenuti ufficiali

Le pagine pubbliche, la navigazione e il percorso equipaggio hanno una traduzione inglese editoriale, non Google Translate. La lingua scelta dallo skipper nell’invito (`preferredLocale`) è privata e serve solo a comporre il messaggio WhatsApp e il primo link nella lingua della persona. Il sito non traduce automaticamente nomi, anagrafica, contatti, richieste di contributo, causali, annunci dello skipper, istruzioni di pagamento o note operative libere: una traduzione automatica potrebbe alterarne il significato o divulgare dati non necessari. Le richieste WhatsApp usano invece un testo guida italiano o inglese; una causale scritta liberamente dallo skipper resta nella sua lingua originale.

Il briefing safety segue una regola più rigorosa: italiano e inglese sono due versioni ufficiali parallele. Lo skipper completa e verifica titolo, sintesi e regolamento inglesi prima della pubblicazione; un contenuto inglese parziale viene rifiutato. Ogni modifica italiana o inglese aumenta `rulesVersion`, richiede una nuova accettazione e registra `acceptedLocale`. Il browser non usa Google Translate per questo testo.

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

Nel profilo privato dello skipper possono essere conservati solo i dettagli necessari per ricevere il contributo: link HTTPS PayPal/Satispay, link HTTPS o Revtag Revolut e, per bonifico, IBAN più intestatario. Non inserire mai password, OTP, numeri di carta, chiavi API o credenziali dei provider. I dettagli non entrano nella Crew List o nella richiesta di pagamento e vengono composti solo nel messaggio WhatsApp per il destinatario scelto.

## Modello dati

```text
events/egadi-2026
  organizerIds: [uid]
  privateAreaEnabled: true

boats/{skipperUid}
  name, model, totalBerths (skipper incluso), capacity (partecipanti derivati)
  berthLayout e berthRates (privati), homePort, flag, skipperId, eventId
  members/{inviteId}
    firstName, lastName, birthDate, birthPlace, nationality, gender
    documentType, documentNumber, documentExpiry, charterConsent
    role, email, phone, displayName, updatedAt
  invites/{inviteId}
    displayName, whatsappNumber, phoneFingerprint, loginEmail, accessKey
    participantUid, status, accessVersion, expiresAt, preferredLocale, createdAt
  collectionProfile/default
    collectorId, collectorName, paypalEnabled, satispayEnabled
    revolutEnabled, bankTransferEnabled, paymentDetails (privati), updatedAt, updatedBy
  contributionPlan/default
    items: { berth, starter_pack, linen_towels, protection_insurance,
             provisions, fuel, transfer, refundable_deposit }
    ogni voce: { state, amountCents }; updatedAt, updatedBy
  costPlan/default
    charterCents, skipperFlightTrainCents, skipperCarCents
    skipperLocalTransferCents, otherRecoverableCents, payingParticipants
    updatedAt, updatedBy
  paymentRequests/{requestId}
    recipientId, memberId, payerInviteId, amountCents, currency, reason, accountingCategory, isOptional, dueDate
    collectorId, collectorName, paymentMethods, status, createdAt, createdBy
    verifiedAt, verifiedBy, cancelledAt, cancelledBy
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

## Crew List PDF e capienza

Il pulsante **Genera Crew List PDF** apre un foglio A4 orizzontale prestampato. Lo skipper sceglie “Salva come PDF” dalla finestra di stampa. Il PDF si attiva solo con dati della barca, dati richiesti per ogni persona e conferma di condivisione completati. Il porto di iscrizione non è un campo necessario.

Lo skipper inserisce `totalBerths`, cioè i posti totali a bordo incluso lo skipper. Il sito salva anche `capacity`, derivato come `totalBerths - 1`, per inviti, Crew List e flotta pubblica. Per Karibu: 4 cabine doppie + 1 posto dinette + cabina marinaio = 10 posti totali; 1 è dello skipper e 9 sono partecipanti invitabili o quotabili. L'interfaccia conta inviti e membri unici rispetto a `capacity`; non è un vincolo atomico server-side e non sostituisce la valutazione nautica dello skipper.

`berthLayout` è facoltativo e privato: cabine doppie o singole, posti letto in dinette, cabina marinaio, altri posti letto reali e numero totale dei bagni. Quando è compilato, deve coincidere con `totalBerths`; non va mai aggiunto un posto fittizio per far quadrare i conti. La cabina marinaio conta come posto fisico riservato allo skipper, ma non è assegnabile alla Crew List o a una quota. Il numero dei bagni non incide sulla capienza e per ora non distingue bagni privati o condivisi. Il layout non alimenta la flotta pubblica né il PDF per il charter.

`berthRates` è un listino privato e facoltativo in centesimi per singolo posto letto: cabina doppia, cabina singola, dinette o altra sistemazione. Non esiste una quota per la cabina marinaio. Il listino precompila importo e causale nella richiesta personale WhatsApp, ma lo skipper può sempre modificarli. Non riserva automaticamente una cuccetta a una persona e non rende il pagamento automatico o verificato.

Ogni skipper gestisce una sola barca: per le nuove registrazioni l'ID della barca coincide con l'UID dello skipper e le Rules impediscono una seconda creazione. Il nome della barca, ad esempio `Karibu`, è modificabile dallo skipper.

## Bacheca e contributi

Lo skipper pubblica regole di bordo, ritrovo, imbarco, partenza, rientro e avvisi. Il regolamento è composto da una sintesi iniziale e dal testo completo: la sintesi orienta ma non sostituisce mai il testo integrale. Prima dell'accettazione resta leggibile solo il briefing necessario a decidere consapevolmente; bacheca, piano quote e richieste personali si sbloccano soltanto con la conferma della versione corrente. Per i briefing pubblicati con `fullRulesRequired: true`, l'interfaccia sblocca la conferma solo dopo lo scorrimento del testo completo e Firestore richiede la dichiarazione `fullRulesRead: true` prima della Crew List o dell'aggiornamento della propria scheda. Quando cambia il regolamento, in italiano o nell'eventuale edizione inglese ufficiale, aumenta la versione e la persona deve confermare di nuovo la lettura della nuova versione.

Lo scorrimento e la conferma registrano una dichiarazione di lettura della versione, non possono dimostrare materialmente che ogni parola sia stata compresa. Indicazioni operative reali della singola barca, del charter, delle dotazioni e di eventuali cauzioni devono essere verificate dallo skipper e pubblicate solo quando confermate.

Il sito non incassa denaro, non genera o valida link dei provider e non dichiara pagamenti come eseguiti. Lo skipper configura una volta il proprio nome, i metodi e i dettagli privati di PayPal, Satispay, Revolut e/o bonifico; quindi crea una richiesta con importo, causale, scadenza e una o più alternative. Ogni nuova richiesta porta anche una classificazione tecnica chiusa: `cost_recovery` se il versamento deve concorrere al recupero dei costi della barca, `other` negli altri casi. Il messaggio WhatsApp prende soltanto i dettagli dei metodi selezionati e non li copia nella richiesta Firestore, che resta leggibile soltanto dallo skipper e dalla persona destinataria dopo l'accettazione corrente del briefing. Il pagamento avviene fuori dal sito e può essere segnato come verificato solo dallo skipper, dopo controllo manuale dell'accredito reale. Le richieste create prima dell'introduzione della classificazione restano aggiornabili soltanto nelle normali transizioni di stato, così possono essere verificate o annullate senza riscriverne il contenuto; restano fuori dal bilancio Cassa finché non sono già classificate, perché il sito non può attribuirle automaticamente.

Prima di chiedere una quota, lo skipper può pubblicare il **piano quote** della propria barca. È un riepilogo a otto voci fisse, non un listino libero e non una prova di pagamento:

| Voce mostrata | Stato possibile |
| --- | --- |
| Quota posto in barca (noleggio) | da definire, compreso nella quota, da richiedere a parte, da regolare in loco / da dividere, non previsto |
| Starter Pack · pulizie finali, fuoribordo e tender | gli stessi stati |
| Lenzuola e asciugamani | gli stessi stati |
| Assicurazione cauzione | gli stessi stati |
| Cambusa | gli stessi stati |
| Gasolio per la navigazione | gli stessi stati |
| Transfer da/per il porto | gli stessi stati |
| Cauzione rimborsabile | gli stessi stati tranne “compreso nella quota” |

Tutte le voci partono da **da definire**: il sito non presume cosa sia incluso. Un importo per persona può comparire soltanto per “da richiedere a parte” o “da regolare in loco / da dividere”; “compreso”, “da definire” e “non previsto” restano a zero. Il piano non contiene link, IBAN, Revtag, contatti, causali libere o istruzioni di pagamento. È leggibile dallo skipper, dall'organizzatore e dall'equipaggio solo dopo l'accettazione della versione corrente delle regole di bordo; le coordinate di incasso restano invece nel profilo privato dello skipper.

### Cassa skipper privata

La **Cassa skipper / costi da ripartire** è un prospetto interno separato dal piano quote e dalle richieste personali. Serve a evitare che lo skipper sostenga da solo i costi necessari alla barca: costo charter, viaggio andata/ritorno dello skipper (volo o treno), auto, transfer locale e un unico totale per altre spese recuperabili. Non contiene nominativi dell'equipaggio, quote individuali, istruzioni di pagamento, note libere o una voce per le cene a terra.

Lo skipper non rientra nei partecipanti paganti: nel modello operativo non paga quota posto né spese collettive come cambusa, Starter Pack o navigazione. Le sole cene a terra restano personali e non entrano nel prospetto. La stima è `(<costo charter> + <viaggio skipper> + <auto skipper> + <transfer locale skipper> + <altre spese recuperabili>) / <partecipanti paganti>`. L'eventuale arrotondamento al centesimo va reso esplicito nella richiesta individuale. Il prospetto non calcola profitto, non invia richieste e non riserva posti: per il bilancio considera soltanto le richieste della stessa barca marcate `cost_recovery` e verificate manualmente dallo skipper. Cambusa, assicurazione, transfer ed extra marcati `other` restano fuori; un avanzo è da riallocare, non un guadagno automatico.

Il documento `costPlan/default` è leggibile e modificabile soltanto dallo skipper della relativa barca. Organizzatore, equipaggio, altri skipper e web pubblico non hanno accesso; non è cancellabile dall'area skipper. La procedura amministrativa di conservazione e cancellazione deve quindi essere definita prima dell'uso reale.

## Arrivi e partenze

La sezione pubblica è online e descrive il flusso per aeroporto, Marsala e passaggi fra amici. La futura scheda privata richiederà città di partenza/arrivo, aeroporto reale, data e orari, compagnia e numero di volo facoltativi, bagagli e una finestra di compatibilità fissa di ±120 minuti.

La società transfer avrà un'area riservata separata per le sole tratte aeroporto ↔ Marsala: potrà raggruppare persone, assegnare il mezzo e contattarle. I passaggi casa ↔ aeroporto restano fuori dalla sua area. I contatti fra partecipanti non saranno pubblici: saranno visibili solo dopo la scelta per tratta e l'accettazione del collegamento da entrambe le persone. La raccolta effettiva e le Rules dedicate verranno implementate soltanto dopo la definizione dell'accesso nominativo della società e dell'informativa definitiva.

## Attivazione operativa

1. Il sorgente, le Security Rules e il dominio HTTPS sono pubblicati.
2. Google, Email/Password e il dominio autorizzato sono stati riletti; email-link resta disattivato.
3. Con autorizzazione del titolare dell'11 settembre 2026 sono stati attivati insieme `PRIVATE_AREA_ENABLED=true` e `privateAreaEnabled: true`.
4. Il primo utilizzo deve partire dallo skipper: Google, verifica della barca `Karibu`, poi un invito personale a una persona alla volta.
5. Restano da completare e formalizzare i punti in `PRIVACY_DA_COMPLETARE.md`, in particolare contatto, tempi di conservazione e procedura di cancellazione.

L'invito resta obbligatorio: l'apertura dell'area non crea una registrazione pubblica libera.

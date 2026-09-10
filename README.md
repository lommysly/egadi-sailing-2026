# Egadi Sailing Experience · 8–11 ottobre 2026

Sito pubblico statico e futura area privata per skipper ed equipaggi. Il progetto e' pensato per restare sul piano Firebase Spark: nessun checkout, nessuna Cloud Function, nessun SMS e nessun servizio a consumo.

## Stato attuale

- `index.html`: sito pubblico, presentazione della flotta e collegamento al briefing comune.
- `passage-plan.html`: unica pagina pubblica per meteo e Passage Plan, alimentata da `passage-plan-data.js`.
- `PASSAGE_PLAN_PROMPT.md`: modello per aggiornare il briefing a T−30, T−10, T−5, T−72/48 e durante il viaggio.
- `area.html`: area skipper con Google Sign-In via finestra popup, registrazione barca, Crew List, bacheca di bordo, inviti WhatsApp e richieste di contributo solo descrittive.
- `participant.html`: compilazione della Crew List dal link WhatsApp personale; dopo il salvataggio compare una conferma e la persona viene portata nella propria area.
- `my-area.html`: area personale con riepilogo dei dati inviati, bacheca della barca, regole e richieste dedicate.
- `crew.html`: istruzioni per recuperare il proprio invito chiedendo allo skipper di reinviarlo.
- `privacy.html`: principi da completare con informativa definitiva prima della raccolta dati.
- `firestore.rules`: regole di accesso pubblicate per il progetto Firebase; skipper e organizzatore vedono solo le barche autorizzate.
- `FIRESTORE_RULES_TEST_MATRIX.md`: casi fittizi da provare nel Playground o nell'emulatore prima del test live.
- `CONTRIBUTI_OPERATIVI.md`, `PRIVACY_DA_COMPLETARE.md` e `MEDIA_REGISTER_TEMPLATE.md`: procedure e materiali da completare prima dell'uso reale.

## Firebase creato

Il progetto Firebase separato `egadi-sailing-2026` e l'app web sono stati creati senza account di fatturazione. Firestore e' nella regione Milano (`europe-west8`) con protezione dall'eliminazione attiva.

1. Attivare Firebase Authentication con Google per skipper e organizzazione e `Anonimo` per l'equipaggio. L'invito WhatsApp è l'unica chiave personale del partecipante: non richiede Google, password né OTP SMS.
2. Accedere una prima volta con l'account organizzatore e annotarne l'UID dalla console Firebase Authentication.
3. Creare dalla console il documento `events/egadi-2026` con il campo `organizerIds`, un array che contiene esclusivamente quell'UID. La configurazione iniziale e' gia' stata eseguita per l'organizzatore corrente.
4. Testare le Security Rules nel simulatore: organizzazione, skipper della propria barca e utente estraneo. Le regole presenti non danno accesso diretto ai partecipanti.
5. Per il test locale aggiungere `127.0.0.1` in Firebase Authentication > Impostazioni > Domini autorizzati. Prima della pubblicazione aggiungere anche il dominio reale del sito; non usare un elenco aperto di domini.

## Modello dati iniziale

```text
events/egadi-2026
  organizerIds: [uid]

boats/{boatId}
  name, model, capacity, homePort, note, skipperId, eventId
  members/{memberId}
    firstName, lastName, birthDate, birthPlace, nationality
    documentType, documentNumber, documentExpiry, charterConsent
    role, email, phone, createdAt
  invites/{inviteId}
    boatId, displayName, whatsappNumber, participantUid, status, createdAt
  participantAccess/{userId}
    inviteId, boatId, userId, updatedAt
  paymentRequests/{requestId}
    recipientId, amount, reason, isOptional, dueDate, instructions, status, createdAt
  briefing/board
    rulesTitle, rulesText, rulesVersion, meetingPoint
    boardingAt, departureAt, returnAt, scheduleNote, updatedAt
  announcements/{announcementId}
    title, message, isImportant, createdAt, createdBy
  ruleAcceptances/{inviteId}
    inviteId, acceptedBy, rulesVersion, acceptedAt
    history/{rulesVersion}
      inviteId, acceptedBy, rulesVersion, acceptedAt
```

Non inserire in Firestore credenziali PayPal, Satispay, Revolut, carte o coordinate bancarie. Le richieste di contributo mostrano solo istruzioni dello skipper nella pagina privata e restano `requested` fino alla conferma manuale.

Il pulsante `Genera Crew List PDF` apre un foglio A4 orizzontale prestampato per charter / eventuali controlli dell'autorita marittima. Lo skipper sceglie `Salva come PDF` dalla finestra di stampa: il file non viene inviato dal sito e si attiva solo quando sono completi i dati della barca, di ogni persona e la relativa conferma di condivisione. Il comandante è nell'intestazione e nella firma, mentre il conteggio indica le persone nella Crew List: prima della consegna, verificare con il charter se il comandante deve comparire anche come riga o se richiede un proprio modello o ulteriori campi.

I dati della barca, incluso il nome, sono modificabili dallo skipper con `Modifica questa barca`; la stessa Crew List e le richieste personali restano associate alla barca esistente. Il PDF non richiede il porto di iscrizione della barca.

`capacity` indica i posti destinati all'equipaggio, escluso lo skipper. L'interfaccia conta inviti e membri unici e non consente di aggiungere oltre quel numero; il controllo è operativo e non sostituisce la valutazione nautica dello skipper né un vincolo atomico lato server.

Ogni skipper gestisce una sola barca e la relativa Crew List; per le nuove registrazioni l'identificativo della barca coincide con l'UID dello skipper, così le regole Firestore impediscono una seconda barca. Lo skipper può aggiornare i dati operativi, ma non può trasferire la barca a un altro account né cambiarne l'evento associato.

## Bacheca di bordo

Lo skipper pubblica per la propria barca le regole di bordo, ritrovo, imbarco, partenza, rientro e avvisi. Ogni partecipante vede solo la bacheca della barca associata al proprio invito. Quando le regole cambiano, la versione aumenta e il partecipante deve confermare di nuovo la lettura. Se lo stesso link viene riaperto da un altro browser, l'accesso corrente passa al nuovo browser e quello precedente non può più leggere bacheca, anagrafica o richieste; la nuova sessione deve confermare le regole a suo nome.

## Limiti e privacy

- Questa struttura non e' un sistema di pagamento: non chiama API dei provider e non riceve webhook. Lo skipper può definire importo, causale, eventuale scadenza e istruzioni, quindi copiare un messaggio da inviare manualmente. Per ogni persona può creare più richieste, comprese voci facoltative come assicurazione, cena, porto o cambusa.
- Solo lo skipper può segnare una richiesta come verificata, dopo aver controllato l'accredito reale fuori dal sito. Un click non attiva né dimostra un pagamento.
- Per documenti, dati sanitari, titolare del trattamento e tempi di cancellazione serve una decisione esplicita e un'informativa completa prima dell'uso reale. La matrice da chiudere è in `PRIVACY_DA_COMPLETARE.md`.
- Non usare `localStorage` per dati di crew o documenti.

## Da fare prima dell'uso con partecipanti

Ogni invito personale ha un codice casuale a 192 bit nel link e viene legato alla sessione tecnica aperta da chi lo utilizza. Il link associa già quella persona alla barca e allo skipper corretti; il partecipante non deve scegliere un account. Può leggere e aggiornare soltanto la propria anagrafica, bacheca e richieste; skipper e organizzatore mantengono l'accesso operativo alla barca. Se perde il messaggio WhatsApp, lo skipper può reinviare lo stesso link dall'area della barca. Il link è una chiave personale: se viene aperto da un altro browser, quell'accesso diventa quello corrente e il precedente perde l'accesso ai contenuti. Non inoltrarlo.

## Pubblicazione

Il sito pubblico puo' essere pubblicato su GitHub Pages. Prima di usare l'area privata con dati reali: versione nel repository, test delle Security Rules, certificato HTTPS valido, verifica da un account skipper e da un account crew separati, quindi lettura finale del sito realmente pubblicato.

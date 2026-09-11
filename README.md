# Egadi Sailing Experience · 8–11 ottobre 2026

Sito pubblico e area privata per skipper ed equipaggi della flotta Egadi. Il progetto resta sul piano Firebase Spark: nessun checkout, nessuna Cloud Function, nessun SMS e nessun servizio a consumo.

## Stato reale

- Il sito pubblico è raggiungibile su `https://egadi.thatsablast.it/`.
- Il certificato HTTPS è valido, ma l'area privata resta volutamente chiusa sia nell'interfaccia sia nelle Security Rules finché non sono completati test, configurazione Auth e informativa privacy.
- `PRIVATE_AREA_ENABLED` nel sorgente e `events/egadi-2026.privateAreaEnabled` in Firestore devono rimanere `false` fino alla checklist finale. HTTPS è necessario, ma da solo non autorizza la raccolta dei dati della Crew List.
- Questa cartella è la sorgente versionata del nuovo accesso con numero WhatsApp e codice personale. Prima dell'uso occorre pubblicare sorgente e Rules, poi eseguire il collaudo con soli dati fittizi.

## Pagine e materiali

- `index.html`: presentazione pubblica della flotta e del viaggio.
- `passage-plan.html`: unica pagina pubblica per meteo e Passage Plan, alimentata da `passage-plan-data.js`.
- `film.html` e `VIDEO_STORYBOARD.md`: storyboard del film; nessun filmato di terzi viene incorporato senza licenza.
- `area.html`: area skipper con Google Sign-In, una barca per skipper, Crew List, PDF, bacheca, inviti WhatsApp e richieste di contributo solo descrittive.
- `participant.html`: primo accesso dal link WhatsApp; la persona conferma il suo numero e sceglie il proprio codice di 6 cifre, poi completa i dati necessari alla Crew List.
- `crew.html`: ingresso quotidiano dell'equipaggio con numero WhatsApp e codice personale.
- `my-area.html`: area personale con scheda, bacheca, regole e richieste dedicate.
- `crew-pdf.js`: foglio A4 orizzontale da salvare in PDF per charter / eventuali controlli; non esporta CSV.
- `FIRESTORE_RULES_TEST_MATRIX.md`, `CHECKLIST_PUBBLICAZIONE.md` e `PRIVACY_DA_COMPLETARE.md`: controlli da chiudere prima dell'uso reale.

## Accesso dell'equipaggio: flusso concordato

1. Lo skipper crea un invito con nome e numero WhatsApp internazionale.
2. Il sito genera un link personale casuale, valido 14 giorni. Lo skipper lo invia direttamente su WhatsApp.
3. Al primo accesso la persona apre quel link, conferma il numero WhatsApp e sceglie il proprio codice personale di **esattamente 6 cifre**. Non è il PIN di sblocco del telefono.
4. Il codice viene verificato da Firebase Authentication e non viene salvato nella Crew List, in Firestore o nel browser.
5. Dopo aver completato la scheda, la persona torna quando vuole da `crew.html`: inserisce numero + codice e viene portata soltanto nella barca e nell'area dello skipper associati. Per il weekend un numero WhatsApp può avere una sola barca attiva.
6. Se dimentica il codice o perde il link, lo skipper usa **Revoca e genera nuovo link**. L'invito conserva lo stesso identificativo, quindi anagrafica, richieste e associazione al PDF restano nella stessa posizione; il precedente accesso smette di funzionare.

Il link WhatsApp è un codice di attivazione, non un accesso permanente. Se viene inoltrato e usato **prima** della persona destinataria, chi lo possiede può attivarlo: un link diretto non può dimostrare l'identità del destinatario senza OTP o verifica esterna. Per questo scade, non va inoltrato e lo skipper può revocarlo.

La pagina di attivazione imposta inoltre `Referrer-Policy: no-referrer`, così il codice presente nel link non viene passato come referrer a font, script o altre risorse esterne caricate dalla pagina.

### Limiti dichiarati del compromesso

- Non viene inviato nessun messaggio email e non è richiesto Google all'equipaggio.
- Non esiste ancora Face ID / impronta: una vera passkey richiede un server che generi e verifichi le challenge WebAuthn. Non viene simulata con un pulsante fittizio.
- Non c'è OTP SMS: comporterebbe costi e un piano di fatturazione.
- Firebase applica protezioni generiche contro l'abuso; il progetto non implementa un blocco configurabile tipo “5 tentativi per invito”, perché richiederebbe logica server-side a pagamento. Gli errori restano generici.
- Per rendere possibile l'ingresso con il solo numero, Firestore conserva un'impronta SHA-256 del numero e un indice tecnico pubblico consultabile solo per chi conosce il numero esatto. Non contiene nome, numero, documento o Crew List; contiene l'alias tecnico e gli identificativi tecnici della barca/invito, e può rivelare che quel numero ha un accesso Egadi attivo. Va indicato nell'informativa e cancellato dopo l'evento.

## Configurazione Firebase necessaria prima del test

Nel progetto `egadi-sailing-2026`:

1. Conservare **Google** per skipper e organizzazione.
2. Abilitare **Email/Password** in Firebase Authentication esclusivamente per la verifica tecnica del codice di 6 cifre. Non abilitare l'email-link: nessuna email viene inviata o usata dall'equipaggio.
3. Configurare la policy password con minimo 6 caratteri. L'interfaccia accetta solo sei cifre; Firebase non può imporre da solo “solo cifre” con questa soluzione.
4. Attivare la protezione contro l'enumerazione delle email se disponibile nel progetto: il codice gestisce gli errori generici di accesso.
5. Il provider **Anonimo** non è usato dal nuovo sorgente. Disabilitarlo soltanto dopo che la nuova versione e le nuove Rules sono pubblicate e provate, così non si interrompe una sessione della versione precedente durante il passaggio.
6. Lasciare autorizzati soltanto i domini necessari in Authentication, compreso `egadi.thatsablast.it` e, per i test locali, `127.0.0.1`.
7. Il documento `events/egadi-2026` deve contenere `organizerIds` con il solo UID autorizzato e mantenere `privateAreaEnabled: false` fino al collaudo finale.

Non inserire in Firestore credenziali PayPal, Satispay, Revolut, carte, coordinate bancarie, PIN o chiavi di pagamento.

## Modello dati

```text
events/egadi-2026
  organizerIds: [uid]
  privateAreaEnabled: false

boats/{skipperUid}
  name, model, capacity, homePort, flag, skipperId, eventId
  members/{inviteId}
    firstName, lastName, birthDate, birthPlace, nationality, gender
    documentType, documentNumber, documentExpiry, charterConsent
    role, email, phone, displayName, updatedAt
  invites/{inviteId}
    displayName, whatsappNumber, phoneFingerprint, loginEmail, accessKey
    participantUid, status, accessVersion, expiresAt, createdAt
  paymentRequests/{requestId}
    recipientId, amount, reason, isOptional, dueDate, instructions, status
  briefing/board
  announcements/{announcementId}
  ruleAcceptances/{inviteId}
    history/{rulesVersion}-{participantUid}
      inviteId, acceptedBy, rulesVersion, acceptedAt

crewAccess/{participantUid}
  boatId, inviteId, userId, loginEmail, updatedAt

crewLoginIndex/{phoneFingerprint}
  loginEmail, boatId, inviteId, updatedAt
```

`loginEmail` è un alias tecnico pseudonimo: non è l'email reale della persona e non riceve messaggi. Dopo l'attivazione le autorizzazioni della Crew List sono legate al `participantUid` Firebase, non a quell'alias. Il percorso legacy `participantAccess` è negato dalle nuove Rules.

Il vincolo operativo è **un numero WhatsApp, una barca attiva** nello stesso evento. Il sito blocca un secondo invito dopo che il numero è stato attivato; se una persona deve cambiare barca, l'organizzatore deve prima verificare e chiudere l'associazione errata.

## Crew List PDF e capienza

Il pulsante **Genera Crew List PDF** apre un foglio A4 orizzontale prestampato. Lo skipper sceglie “Salva come PDF” dalla finestra di stampa. Il PDF si attiva solo con dati della barca, dati richiesti per ogni persona e conferma di condivisione completati. Il porto di iscrizione non è un campo necessario.

`capacity` indica i posti per l'equipaggio, escluso lo skipper. L'interfaccia conta inviti e membri unici e non aggiunge oltre il limite; non è un vincolo atomico server-side e non sostituisce la valutazione nautica dello skipper.

Ogni skipper gestisce una sola barca: per le nuove registrazioni l'ID della barca coincide con l'UID dello skipper e le Rules impediscono una seconda creazione. Il nome della barca, ad esempio `Karibu`, è modificabile dallo skipper.

## Bacheca e contributi

Lo skipper pubblica regole di bordo, ritrovo, imbarco, partenza, rientro e avvisi. Ogni persona vede soltanto la bacheca della propria barca. Quando cambia il testo delle regole, aumenta la versione e la persona deve confermare di nuovo la lettura.

Il sito non incassa denaro e non dichiara pagamenti come eseguiti. Lo skipper può creare richieste personali con importo, causale, scadenza e istruzioni, incluse voci facoltative come assicurazione, cena, porto o cambusa. Il pagamento avviene fuori dal sito (PayPal, Satispay, Revolut o bonifico) e può essere segnato come verificato solo dopo controllo manuale dell'accredito reale.

## Sequenza obbligatoria di apertura

1. Versionare e pubblicare questo sorgente e le Security Rules, mantenendo l'area chiusa.
2. Abilitare il provider Email/Password e verificare i domini autorizzati.
3. Provare nel Playground/emulatore tutti i casi di `FIRESTORE_RULES_TEST_MATRIX.md` con UID, nomi e numeri fittizi.
4. Eseguire un test browser con skipper e crew fittizi: primo invito, numero + codice, compilazione, ingresso successivo, PDF, bacheca, revoca e nuovo invito.
5. Chiudere e pubblicare l'informativa privacy definitiva, inclusi indice tecnico, Firebase Authentication e tempi di cancellazione.
6. Rileggere il sito realmente pubblicato su HTTPS.
7. Solo allora, con conferma del titolare, impostare `privateAreaEnabled: true` e `PRIVATE_AREA_ENABLED=true`, quindi eseguire il test live finale.

Un deploy del sito pubblico o un certificato HTTPS valido non sostituiscono gli altri passaggi.

# Egadi Sailing Experience · 8–11 ottobre 2026

Sito pubblico statico e futura area privata per skipper ed equipaggi. Il progetto e' pensato per restare sul piano Firebase Spark: nessun checkout, nessuna Cloud Function, nessun SMS e nessun servizio a consumo.

## Stato attuale

- `index.html`: sito pubblico, passage plan flessibile e presentazione della flotta.
- `area.html`: area skipper con Google Sign-In via redirect, registrazione barca, Crew List, inviti WhatsApp e richieste di contributo solo descrittive.
- `participant.html`: spazio personale aperto dal link WhatsApp, protetto anche dall'accesso Google, per completare l'anagrafica e vedere le richieste dedicate.
- `privacy.html`: principi da completare con informativa definitiva prima della raccolta dati.
- `firestore.rules`: regole di accesso pubblicate per il progetto Firebase; skipper e organizzatore vedono solo le barche autorizzate.

## Firebase creato

Il progetto Firebase separato `egadi-sailing-2026` e l'app web sono stati creati senza account di fatturazione. Firestore e' nella regione Milano (`europe-west8`) con protezione dall'eliminazione attiva.

1. Attivare Firebase Authentication con Google e/o email-password. Non usare login via link email: il piano Spark ha un limite molto basso di email di accesso.
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
  paymentRequests/{requestId}
    recipientId, amount, reason, isOptional, dueDate, instructions, status, createdAt
```

Non inserire in Firestore credenziali PayPal, Satispay, Revolut, carte o coordinate bancarie. Le richieste di contributo mostrano solo istruzioni dello skipper nella pagina privata e restano `in_attesa_di_verifica` fino alla conferma manuale.

Il pulsante `Genera Crew List PDF` apre un foglio A4 orizzontale prestampato per charter / eventuali controlli dell'autorita marittima. Lo skipper sceglie `Salva come PDF` dalla finestra di stampa: il file non viene inviato dal sito e si attiva solo quando sono completi i dati della barca, di ogni persona e la relativa conferma di condivisione. Prima della consegna, verificare con il charter se richiede un proprio modello o ulteriori campi.

I dati della barca, incluso il nome, sono modificabili dallo skipper con `Modifica questa barca`; la stessa Crew List e le richieste personali restano associate alla barca esistente. Il PDF non richiede il porto di iscrizione della barca.

Ogni skipper gestisce una sola barca e la relativa Crew List; per le nuove registrazioni l'identificativo della barca coincide con l'UID dello skipper, così le regole Firestore impediscono una seconda barca. Lo skipper può aggiornare i dati operativi, ma non può trasferire la barca a un altro account né cambiarne l'evento associato.

## Limiti e privacy

- Questa struttura non e' un sistema di pagamento: non chiama API dei provider e non riceve webhook. Lo skipper può definire importo, causale, eventuale scadenza e istruzioni, quindi copiare un messaggio da inviare manualmente. Per ogni persona può creare più richieste, comprese voci facoltative come assicurazione, cena, porto o cambusa.
- Solo lo skipper può segnare una richiesta come verificata, dopo aver controllato l'accredito reale fuori dal sito. Un click non attiva né dimostra un pagamento.
- Per documenti, dati sanitari, titolare del trattamento e tempi di cancellazione serve una decisione esplicita e un'informativa completa prima dell'uso reale.
- Non usare `localStorage` per dati di crew o documenti.

## Da fare prima dell'uso con partecipanti

Ogni invito personale ha un codice casuale a 192 bit nel link e viene legato al primo account Google che lo apre. Il partecipante può leggere e aggiornare soltanto la propria anagrafica e le proprie richieste; skipper e organizzatore mantengono l'accesso operativo alla barca.

## Pubblicazione

Il sito pubblico puo' essere pubblicato su GitHub Pages. Prima di mettere online l'area privata: versione nel repository, test delle Security Rules, verifica da un account skipper e da un account crew separati, quindi lettura finale del sito realmente pubblicato.

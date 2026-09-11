# Checklist di pubblicazione · Egadi Sailing Experience

Ultimo aggiornamento: 11 settembre 2026. Le caselle descrivono lo stato verificato, non autorizzano l'apertura dell'area privata.

## Sito pubblico e contenuti

- [x] Programma pubblico flessibile Marsala, Levanzo, Marettimo e Favignana.
- [x] Unica pagina pubblica Meteo & Passage Plan, con file dati separato e prompt operativo per aggiornamenti progressivi.
- [x] Storyboard video in `VIDEO_STORYBOARD.md`; non sono incorporati filmati di terzi.
- [x] Richieste di contributo con tag dei metodi e messaggio WhatsApp diretto: nessun checkout, API, creazione o persistenza di link, dato bancario, credenziale o conferma automatica nel sito.
- [x] Crew List A4 orizzontale, da salvare come PDF dallo skipper; il PDF resta disattivato con dati obbligatori mancanti o documento in scadenza prima dell'11 ottobre 2026.
- [x] Nome e dati della barca modificabili dallo skipper; una sola barca per skipper.
- [x] Bacheca per barca con regole versionate, orari, comunicazioni e conferma di lettura dell'equipaggio.
- [x] HTTPS pubblico verificato su `egadi.thatsablast.it`; HTTP reindirizza a HTTPS e la pagina anonima non mostra Crew List, inviti, pagamenti o dati personali.
- [x] Con area chiusa, anche il modulo crew pubblicato resta disattivato e non invia dati a Firebase.

## Nuovo accesso equipaggio

- [x] Sorgente locale: primo accesso dal link WhatsApp, conferma del numero e scelta di un codice personale di sei cifre.
- [x] Sorgente locale: ingresso successivo da `crew.html` con numero WhatsApp + codice, senza Google, email o SMS.
- [x] Sorgente locale: scadenza del link a 14 giorni e riemissione sullo stesso invito, con revoca del precedente UID e conservazione di scheda/richieste/PDF.
- [x] Sorgente locale: un numero WhatsApp può avere una sola barca attiva nell'evento; il secondo invito viene bloccato dopo l'attivazione.
- [x] Sorgente locale: nessun PIN viene scritto in Firestore, Crew List o browser.
- [x] Sorgente locale: Face ID / impronta non sono mostrati come disponibili; una vera passkey resta fuori da questa versione.
- [ ] Pubblicare il nuovo sorgente su GitHub Pages, mantenendo `PRIVATE_AREA_ENABLED=false`.
- [ ] Pubblicare e rileggere le nuove `firestore.rules`, mantenendo `events/egadi-2026.privateAreaEnabled=false`.
- [ ] Abilitare Firebase Authentication **Email/Password** per il codice tecnico; Google resta per skipper/organizzatore. Non attivare email-link o OTP SMS.
- [ ] Dopo la pubblicazione e i test, disabilitare Firebase Authentication **Anonimo** se non serve più ad altri flussi del progetto.

## Security Rules e test fittizi obbligatori

- [ ] Eseguire ogni caso di `FIRESTORE_RULES_TEST_MATRIX.md` nel Playground/emulatore con soli UID, telefoni e dati fittizi.
- [ ] Verificare che il flag chiuso neghi anche il client Firebase diretto, non solo l'interfaccia.
- [ ] Test skipper: Google Sign-In, propria barca, altra barca negata, PDF, bacheca e richiesta contributo.
- [ ] Test crew: claim dal nuovo link, creazione scheda, ingresso successivo con numero + codice e accesso soltanto alla propria barca.
- [ ] Test negativo: numero assente, codice errato, link scaduto, token Google/anonimo e account estraneo non leggono dati.
- [ ] Test riemissione: il vecchio codice/UID perde accesso; il nuovo link conserva lo stesso `inviteId`, scheda, richieste e PDF.
- [ ] Test bacheca: pubblicazione skipper, lettura crew, conferma regole e nuova conferma dopo modifica.
- [ ] Test contributi: profilo incasso, uno o più tag, WhatsApp con dettaglio non persistito, destinatario vede solo le proprie richieste e lo skipper registra “verificato” o “annullata” solo dopo controllo esterno reale. Un click non prova il pagamento.
- [ ] Test browser separato su HTTPS con account fittizi approvati e senza documenti reali.

## Dati reali e privacy

- [ ] Chiudere `privacy.html` e `PRIVACY_DA_COMPLETARE.md`: titolare, contatto, finalità, base giuridica, destinatari, retention, PDF e procedura di cancellazione.
- [ ] Inserire esplicitamente nell'informativa: Firebase Authentication tecnico, impronta del numero, indice di ingresso e assenza di OTP/verifica del possesso del numero.
- [ ] Definire data e responsabile per cancellare Crew List, inviti, `crewAccess`, `crewLoginIndex`, account Firebase tecnici, PDF locali e messaggi WhatsApp dopo l'evento.
- [ ] Prima di qualunque pulizia, inventariare i documenti di test e confermare il bersaglio esatto: non eliminare per errore barca, skipper, inviti o dati che devono restare.
- [ ] Confrontare il PDF con il modello effettivamente richiesto da charter / Capitaneria.

## Media editoriali

- [ ] Realizzare o raccogliere soltanto riprese originali dell'organizzazione o con licenza esplicita.
- [ ] Ottenere autorizzazioni di immagine prima di usare primi piani riconoscibili.
- [ ] Montare film home 45–60 secondi, MP4 H.264 1920×1080, meno di 10 MB e poster separato.
- [ ] Esportare tre clip verticali 1080×1920 da 12–18 secondi.
- [ ] Verificare diritti musica e audio prima della pubblicazione.

## Apertura finale, solo dopo tutti i punti sopra

- [ ] Rileggere il commit pubblicato, il build GitHub Pages e il dominio HTTPS effettivo.
- [ ] Con conferma esplicita del titolare, impostare insieme `PRIVATE_AREA_ENABLED=true` nel sorgente e `privateAreaEnabled: true` nel documento evento.
- [ ] Eseguire il test live conclusivo con skipper e una crew autorizzata, poi controllare che non esistano dati test indesiderati.

HTTPS è ora valido: non è un motivo sufficiente per spuntare l'apertura finale. Il flag rimane chiuso finché questi controlli non sono completati.

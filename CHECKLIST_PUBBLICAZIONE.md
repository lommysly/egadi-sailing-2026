# Checklist di pubblicazione · Egadi Sailing Experience

Ultimo aggiornamento: 10 settembre 2026.

## Pronto nel progetto

- [x] Sito pubblico con programma flessibile Marsala, Levanzo, Marettimo e Favignana.
- [x] Area privata skipper con accesso Google, modifica della barca, Crew List e richieste di contributo manuali.
- [x] Un solo skipper, una sola barca: le nuove registrazioni usano l'UID dello skipper anche come ID della barca e le regole Firestore bloccano una seconda creazione.
- [x] Crew List in formato stampabile A4 orizzontale, da salvare come PDF dallo skipper.
- [x] Regole Firestore compilate e pubblicate nel progetto `egadi-sailing-2026` il 10 settembre 2026.
- [x] Storyboard video presente in `VIDEO_STORYBOARD.md`; non sono incorporati filmati di terzi.
- [x] Nessun pagamento online, API di pagamento o dato bancario nel sito.

## Da verificare prima di raccogliere dati reali

- [ ] Test Google Sign-In sul dominio pubblico con un account skipper reale.
- [ ] Test delle regole: skipper della propria barca, organizzatore e account estraneo senza accesso.
- [ ] Inserimento di una Crew List completa con dati autorizzati e prova di stampa `Salva come PDF`.
- [ ] Confronto del PDF con il modello effettivamente richiesto dal charter / Capitaneria.
- [ ] Definizione della procedura pratica per i contributi: istruzioni, causale e verifica manuale dello skipper.
- [ ] Informativa privacy definitiva: titolare, contatto, basi giuridiche, tempi di cancellazione e procedura di consegna del PDF.

## Materiali editoriali

- [ ] Realizzare o raccogliere soltanto riprese originali dell'organizzazione o con licenza esplicita.
- [ ] Ottenere le autorizzazioni di immagine necessarie prima di usare primi piani riconoscibili.
- [ ] Montare il film home (45-60 secondi, MP4 H.264 1920x1080, meno di 10 MB, poster separato).
- [ ] Esportare le tre clip verticali (1080x1920, 12-18 secondi) per WhatsApp, Instagram e pagina viaggio.
- [ ] Verificare i diritti per musica e audio prima della pubblicazione.

## Pubblicazione tecnica

- [ ] Ripetere il deploy GitHub Pages della revisione corrente `11c8cc8`: un vecchio deploy GitHub Pages è rimasto in coda e deve liberarsi prima che la versione aggiornata possa essere letta online.
- [ ] Leggere il sito pubblico dopo il deploy e verificare che non compaia più l'opzione di aggiungere una seconda barca.
- [ ] Come ultimo passaggio, configurare `egadi.thatsablast.it`: record DNS, dominio personalizzato GitHub Pages, HTTPS e dominio autorizzato in Firebase Authentication.

# Checklist di pubblicazione · Egadi Sailing Experience

Ultimo aggiornamento: 10 settembre 2026.

## Pronto nel progetto

- [x] Sito pubblico con programma flessibile Marsala, Levanzo, Marettimo e Favignana.
- [x] Area privata skipper con accesso Google, modifica della barca, Crew List e richieste di contributo manuali.
- [x] Un solo skipper, una sola barca: le nuove registrazioni usano l'UID dello skipper anche come ID della barca e le regole Firestore bloccano una seconda creazione.
- [x] Il proprietario e l'evento di una barca non sono modificabili dallo skipper; solo l'organizzatore può correggerli.
- [x] Crew List in formato stampabile A4 orizzontale, da salvare come PDF dallo skipper.
- [x] Il PDF resta disattivato se un documento scade prima della fine dell'evento, l'11 ottobre 2026.
- [x] Regole Firestore compilate e pubblicate nel progetto `egadi-sailing-2026` il 10 settembre 2026.
- [x] Storyboard video presente in `VIDEO_STORYBOARD.md`; non sono incorporati filmati di terzi.
- [x] Nessun pagamento online, API di pagamento o dato bancario nel sito.
- [x] Richieste personali con importo, causale, scadenza facoltativa e messaggio copiabile per l'invio manuale.
- [x] Invito personale WhatsApp: link con codice casuale, accesso Google e anagrafica compilata direttamente dal partecipante.
- [x] Più voci per persona, incluse spese facoltative aggiungibili in un secondo momento.

## Da verificare prima di raccogliere dati reali

- [ ] Test Google Sign-In sul dominio pubblico con un account skipper reale e un account partecipante differente.
- [ ] Test delle regole: skipper della propria barca, organizzatore e account estraneo senza accesso.
- [ ] Invio WhatsApp di prova, apertura del link personale, compilazione di una Crew List autorizzata e prova di stampa `Salva come PDF`.
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

- [x] GitHub Pages ripristinato con un build standard il 10 settembre 2026.
- [ ] Leggere il sito pubblico dopo il deploy e verificare inviti WhatsApp, area personale e richieste facoltative.
- [ ] Come ultimo passaggio, configurare `egadi.thatsablast.it`: record DNS, dominio personalizzato GitHub Pages, HTTPS e dominio autorizzato in Firebase Authentication.

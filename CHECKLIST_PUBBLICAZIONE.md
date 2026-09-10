# Checklist di pubblicazione · Egadi Sailing Experience

Ultimo aggiornamento: 11 settembre 2026.

## Pronto nel progetto

- [x] Sito pubblico con programma flessibile Marsala, Levanzo, Marettimo e Favignana.
- [x] Area privata skipper con accesso Google, modifica della barca, Crew List e richieste di contributo manuali.
- [x] Un solo skipper, una sola barca: le nuove registrazioni usano l'UID dello skipper anche come ID della barca e le regole Firestore bloccano una seconda creazione.
- [x] Il proprietario e l'evento di una barca non sono modificabili dallo skipper; solo l'organizzatore può correggerli.
- [x] Crew List in formato stampabile A4 orizzontale, da salvare come PDF dallo skipper.
- [x] Il PDF resta disattivato se un documento scade prima della fine dell'evento, l'11 ottobre 2026.
- [x] Regole Firestore iniziali compilate e pubblicate nel progetto `egadi-sailing-2026` il 10 settembre 2026.
- [x] Correzione delle regole Firestore pubblicata l'11 settembre 2026: se un invito WhatsApp viene aperto da un nuovo browser, la vecchia sessione non può più leggere dati della barca; la nuova sessione deve confermare le regole a proprio nome.
- [x] Capienza esplicita dei posti equipaggio: l'interfaccia conta inviti e membri unici, non aggiunge oltre il limite e ricorda che lo skipper non è conteggiato.
- [x] Storyboard video presente in `VIDEO_STORYBOARD.md`; non sono incorporati filmati di terzi.
- [x] Nessun pagamento online, API di pagamento o dato bancario nel sito.
- [x] Richieste personali con importo, causale, scadenza facoltativa e messaggio copiabile per l'invio manuale.
- [x] Procedura operativa per i contributi documentata in `CONTRIBUTI_OPERATIVI.md`: richiesta, invio manuale, accredito esterno e verifica skipper.
- [x] Invito personale WhatsApp: link con codice casuale, accesso diretto, conferma di salvataggio e area personale separata per il partecipante.
- [x] Più voci per persona, incluse spese facoltative aggiungibili in un secondo momento.
- [x] Bacheca privata per barca: regole versionate, orari operativi, comunicazioni dello skipper e conferma di lettura dell'equipaggio.
- [x] Unica pagina pubblica Meteo & Passage Plan, con file dati separato e prompt operativo per aggiornamenti progressivi.
- [x] Crediti delle foto Commons corretti con autore, fonte e licenza; nessuna foto o video di terzi è stata scaricata nel repository.
- [x] Matrice di test delle regole e registri pronti per media e privacy: `FIRESTORE_RULES_TEST_MATRIX.md`, `MEDIA_REGISTER_TEMPLATE.md`, `PRIVACY_DA_COMPLETARE.md`.

## Da verificare prima di raccogliere dati reali

- [ ] Test Google Sign-In skipper e invito WhatsApp diretto per un partecipante sul dominio pubblico.
- [ ] Provare nel Playground/emulatore i casi senza dati personali della matrice delle regole pubblicate.
- [ ] Test delle regole live: skipper della propria barca, organizzatore e account estraneo senza accesso.
- [ ] Invio WhatsApp di prova, apertura del link personale, compilazione di una Crew List autorizzata e prova di stampa `Salva come PDF`.
- [ ] Test della bacheca: pubblicazione skipper, lettura partecipante, conferma regole e nuova conferma dopo una modifica.
- [ ] Confronto del PDF con il modello effettivamente richiesto dal charter / Capitaneria.
- [x] Definizione della procedura pratica per i contributi: istruzioni, causale e verifica manuale dello skipper.
- [ ] Informativa privacy definitiva: titolare, contatto, basi giuridiche, tempi di cancellazione e procedura di consegna del PDF.
- [x] Pubblicato il primo briefing T−27 con fonti, dati astronomici verificati e distinzione esplicita fra pianificazione e previsioni operative.

## Materiali editoriali

- [ ] Realizzare o raccogliere soltanto riprese originali dell'organizzazione o con licenza esplicita.
- [ ] Ottenere le autorizzazioni di immagine necessarie prima di usare primi piani riconoscibili.
- [ ] Montare il film home (45-60 secondi, MP4 H.264 1920x1080, meno di 10 MB, poster separato).
- [ ] Esportare le tre clip verticali (1080x1920, 12-18 secondi) per WhatsApp, Instagram e pagina viaggio.
- [ ] Verificare i diritti per musica e audio prima della pubblicazione.

## Pubblicazione tecnica

- [x] GitHub Pages ripristinato con un build standard il 10 settembre 2026.
- [x] Versione pubblicata su `main` e riletta in HTTP senza autenticazione; il JavaScript pubblico espone `area.js?v=20260911-safety`.
- [ ] Verificare inviti WhatsApp, area personale e richieste facoltative su dominio HTTPS con account autorizzati e dati di prova approvati.
- [x] Configurati file `CNAME`, dominio personalizzato GitHub Pages e dominio autorizzato in Firebase Authentication per `egadi.thatsablast.it`; il sito risponde in HTTP.
- [ ] Risolvere lo stato GitHub Pages “DNS check in progress” e verificare il certificato HTTPS valido per `egadi.thatsablast.it`; fino ad allora non raccogliere dati reali né eseguire test autenticati sul dominio personalizzato.

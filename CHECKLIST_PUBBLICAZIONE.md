# Checklist di pubblicazione · Egadi Sailing Experience

Ultimo aggiornamento: 11 settembre 2026. Le caselle descrivono lo stato verificato; l'area privata è stata attivata con autorizzazione esplicita del titolare.

## Sito pubblico e contenuti

- [x] Programma pubblico flessibile Marsala, Levanzo, Marettimo e Favignana.
- [x] Unica pagina pubblica Meteo & Passage Plan, con file dati separato e prompt operativo per aggiornamenti progressivi.
- [x] Storyboard video in `VIDEO_STORYBOARD.md`; non sono incorporati filmati di terzi.
- [x] Sorgente: richieste di contributo con tag dei metodi e messaggio WhatsApp diretto; nessun checkout, API dei provider o conferma automatica. I dettagli di incasso restano nel solo profilo privato dello skipper e non sono copiati nella richiesta.
- [ ] Pubblicare e rileggere il piano quote V4: le cinque quote principali restano separate; le dieci voci descrivono le spese del weekend con soli stato e importo. Starter Pack sempre cash/in loco, anche quando il suo valore è già dentro il charter; inclusioni selezionate esclusivamente dall'elenco chiuso (lenzuola, asciugamani, kit bagno/consumabili, telo mare, fuoribordo, pulizie finali, SUP, permesso/contributo Egadi e, se previsto, tender). Cambusa, gasolio, transfer aeroporto-porto, porto/ormeggio/boa e cena a terra restano fuori dal Pack. Nessun link, IBAN, contatto o testo libero nell'area equipaggio.
- [ ] Pubblicare e testare il Preventivo barca privato v7: costi aggregati, Starter Pack, assicurazione, cauzione e partecipanti paganti; il Pack può essere interno o esterno al charter e ripartito come totale o fisso/persona, ma resta cash; divisore cauzione separato anche per collaboratori gratuiti, formula esplicita senza skipper nel divisore, dinette al 65% o a prezzo fisso con cabina ricavata dopo lo scorporo del Pack, quota cabina calcolata o arrotondata sempre senza lasciare centesimi scoperti, nessuna voce cena, nessun profitto, nessun accesso equipaggio/organizzazione e nessun incasso automatico.
- [ ] Rilascio schema v6 → v7: verificare una volta il salvataggio dalla pagina aggiornata. Le Rules accettano temporaneamente il formato v6 soltanto su un documento che non ha ancora marcatori v7; dopo la prima migrazione non è possibile tornare indietro da una pagina cache.
- [ ] Migrazione piano quote V3 → V4: con soli dati fittizi, verificare che il salvataggio aggiornato trasformi un piano storico in dieci voci senza `description` più `starterPackItems`, mantenga gli extra già configurati e blocchi il downgrade da una pagina cache. Prima della verifica emulatore e del test browser separato, non considerare il riepilogo equipaggio aggiornato automaticamente dal Preventivo barca.
- [x] Crew List A4 orizzontale, da salvare come PDF dallo skipper; il PDF resta disattivato con dati obbligatori mancanti o documento in scadenza prima dell'11 ottobre 2026.
- [x] Nome e dati della barca modificabili dallo skipper; una sola barca per skipper.
- [x] Bacheca per barca con regole versionate, orari, comunicazioni e conferma di lettura dell'equipaggio.
- [x] HTTPS pubblico verificato su `egadi.thatsablast.it`; HTTP reindirizza a HTTPS e la pagina anonima non mostra Crew List, inviti, pagamenti o dati personali.
- [x] Area privata attiva su HTTPS: accesso skipper con Google e equipaggio solo tramite invito personale.

## Arrivi e partenze

- [x] Sezione pubblica online con le quattro tratte, città/aeroporti reali, orari, volo facoltativo, bagagli e finestra di match ±2 ore.
- [x] Passage Plan separa scenari di luce da porto, campo boe o rada e dichiara stato, validità e prossimo aggiornamento.
- [ ] Aggiungere la scheda privata per raccogliere le tratte nell'area equipaggio: nessun modulo pubblico con contatti.
- [ ] Creare l'area riservata della società transfer con identità nominative, gruppi, veicoli, orari e contatti limitati alle tratte aeroporto ↔ Marsala.
- [ ] Pubblicare Rules, indici e test: le tratte restano separate da Crew List e inviti; i passaggi fra partecipanti usano consenso per tratta e doppia conferma prima di mostrare WhatsApp.
- [ ] Aggiornare l'informativa definitiva con società transfer, destinatari, finalità, revoca e tempi di conservazione.

## Nuovo accesso equipaggio

- [x] Sorgente locale: primo accesso dal link WhatsApp, conferma del numero e scelta di un codice personale di sei cifre.
- [x] Sorgente locale: ingresso successivo da `crew.html` con numero WhatsApp + codice, senza Google, email o SMS.
- [x] Sorgente locale: scadenza del link a 14 giorni e riemissione sullo stesso invito, con revoca del precedente UID e conservazione di scheda/richieste/PDF.
- [x] Sorgente locale: un numero WhatsApp può avere una sola barca attiva nell'evento; il secondo invito viene bloccato dopo l'attivazione.
- [x] Sorgente locale: nessun PIN viene scritto in Firestore, Crew List o browser.
- [x] Sorgente locale: Face ID / impronta non sono mostrati come disponibili; una vera passkey resta fuori da questa versione.
- [x] Nuovo sorgente pubblicato su GitHub Pages con `PRIVATE_AREA_ENABLED=true`.
- [x] Nuove `firestore.rules` pubblicate e rilette; `events/egadi-2026.privateAreaEnabled=true` è stato confermato dal readback.
- [x] Firebase Authentication **Email/Password** attivo per il codice tecnico; Google resta per skipper/organizzatore. Email-link e OTP SMS non sono attivati.
- [ ] Dopo la pubblicazione e i test, disabilitare Firebase Authentication **Anonimo** se non serve più ad altri flussi del progetto.

## Security Rules e test fittizi obbligatori

- [ ] Eseguire ogni caso di `FIRESTORE_RULES_TEST_MATRIX.md` nel Playground/emulatore con soli UID, telefoni e dati fittizi.
- [ ] Verificare che il flag chiuso neghi anche il client Firebase diretto, non solo l'interfaccia.
- [ ] Test skipper: Google Sign-In, propria barca, altra barca negata, PDF, bacheca e richiesta contributo.
- [ ] Test dossier skipper con soli dati fittizi: lo skipper completa anagrafica, documento, patente, certificato radio e stati di consegna; carica e scarica soltanto una copia fittizia della patente e una del certificato radio. Il PDF mostra la prima riga e il riepilogo documentale, senza incorporare file. Crew, organizzatore, flotta, altri skipper, estranei e `list` non possono leggere, modificare o elencare `skipperProfile/default` o le due copie Storage.
- [ ] Test crew: claim dal nuovo link, creazione scheda, ingresso successivo con numero + codice e accesso soltanto alla propria barca.
- [ ] Test negativo: numero assente, codice errato, link scaduto, token Google/anonimo e account estraneo non leggono dati.
- [ ] Test riemissione: il vecchio codice/UID perde accesso; il nuovo link conserva lo stesso `inviteId`, scheda, richieste e PDF.
- [ ] Test bacheca: prima dell'accettazione il briefing resta leggibile ma bacheca e richieste sono negate; dopo la conferma corrente verificare pubblicazione skipper, lettura della sola crew destinataria e nuova conferma dopo modifica.
- [ ] Test piano quote V4: con soli dati fittizi, skipper salva le cinque quote automatiche e le dieci voci del weekend in un'unica transazione; il percorso deve restare sotto il limite di valutazione delle Rules. Verificare che Starter Pack sia sempre cash/in loco, anche se già nel charter, e mostri soltanto le inclusioni chiuse selezionate; lenzuola/asciugamani restano comprese nel Pack e la cauzione rimborsabile è sempre cash/in loco. Verificare che cambusa, gasolio consumato, transfer aeroporto-porto andata/ritorno, porto/ormeggio/boa e cena a terra restino fuori dal Pack. Crew legge il piano solo dopo briefing corrente, senza dati di incasso né testi liberi.
- [ ] Test bilingue: verificare IT/EN su desktop e telefono, inclusi menu, URL con `?lang=en`, immagini con alt inglese e ritorno a IT. Il Passage Plan inglese deve essere l'edizione editoriale `passage-plan-data-en.js`, non una traduzione browser.
- [ ] Test briefing bilingue: con soli dati fittizi, provare un briefing inglese incompleto (deve essere negato), poi la versione completa. Un accesso equipaggio in inglese deve restare bloccato fino alla pubblicazione della versione inglese ufficiale e una modifica in una delle due lingue deve richiedere nuova accettazione.
- [ ] Test invito bilingue: con soli dati fittizi, creare un invito italiano e uno inglese. Verificare che WhatsApp, Privacy e `participant.html` aprano rispettivamente in IT/EN, che la richiesta WhatsApp usi il testo guida nella lingua dell’invitato e che un invito EN sia bloccato finché il briefing ufficiale EN non è pubblicato.
- [ ] Test Preventivo barca: `costPlan/default` v7 con soli importi fittizi, 1–30 ospiti paganti e persone che portano la cauzione, posti dinette paganti, percentuale 1–100 oppure prezzo fisso coerente; skipper legge/salva/rilegge la propria barca, mentre organizzatore, crew, outsider, `list` e `delete` sono negati. Verificare quota cabina, dinette al 65% predefinito e a prezzo fisso, calcolo al centesimo, arrotondamento per eccesso a €1/€5/€10 e quota cabina manuale che non lascia centesimi scoperti, con differenza mostrata come riserva da riallocare; verificare inoltre i totali pratici da bonificare/versare e da portare in contanti per cabina e dinette, esclusione skipper/staff gratuiti dal divisore delle quote, divisore cauzione separato anche per staff gratuito, entrambe le provenienze del Pack (interno/esterno charter) e i due metodi di riparto (totale/fisso), con Pack sempre cash-in-loco, e che il bilancio usi solo richieste `cost_recovery` verificate manualmente.
- [ ] Test contributi: ogni nuova richiesta usa soltanto `cost_recovery` o `other`; Starter Pack, lenzuola/asciugamani e cauzione rimborsabile non compaiono nelle richieste WhatsApp. Una richiesta legacy senza categoria resta verificabile o annullabile senza poterne riscrivere il contenuto. Verificare inoltre profilo incasso privato con uno o più metodi e relativi dettagli, WhatsApp con solo i dettagli dei metodi selezionati, destinatario con briefing corrente vede solo le proprie richieste e soltanto lo skipper registra “verificato” o “annullata” dopo controllo esterno reale; organizzatore e altri skipper sono negati. Un click non prova il pagamento.
- [ ] Test browser separato su HTTPS con account fittizi approvati e due file fittizi consentiti; mai documenti reali.

## Dati reali e privacy

- [ ] Chiudere `privacy.html` e `PRIVACY_DA_COMPLETARE.md`: titolare, contatto, finalità, base giuridica, destinatari, retention, piano quote, Cassa skipper, PDF, due copie private dello skipper e procedura di cancellazione.
- [ ] Inserire esplicitamente nell'informativa: Firebase Authentication tecnico, impronta del numero, indice di ingresso e assenza di OTP/verifica del possesso del numero.
- [ ] Definire data e responsabile per cancellare Crew List, inviti, `crewAccess`, `crewLoginIndex`, `costPlan/default`, le due copie private Storage, account Firebase tecnici, PDF locali e messaggi WhatsApp dopo l'evento; Cassa skipper, dossier e Storage richiedono una procedura amministrativa perché l'area skipper non può eliminarli.
- [ ] Prima di qualunque pulizia, inventariare i documenti di test e confermare il bersaglio esatto: non eliminare per errore barca, skipper, inviti o dati che devono restare.
- [ ] Confrontare il PDF con il modello effettivamente richiesto da charter / Capitaneria.

## Media editoriali

- [ ] Realizzare o raccogliere soltanto riprese originali dell'organizzazione o con licenza esplicita.
- [ ] Ottenere autorizzazioni di immagine prima di usare primi piani riconoscibili.
- [ ] Montare film home 45–60 secondi, MP4 H.264 1920×1080, meno di 10 MB e poster separato.
- [ ] Esportare tre clip verticali 1080×1920 da 12–18 secondi.
- [ ] Verificare diritti musica e audio prima della pubblicazione.

## Apertura effettuata

- [x] Commit pubblicato, build GitHub Pages e dominio HTTPS riletti.
- [x] Con conferma esplicita del titolare, impostati insieme `PRIVATE_AREA_ENABLED=true` nel sorgente e `privateAreaEnabled: true` nel documento evento.
- [ ] Eseguire il test live conclusivo con skipper e una crew autorizzata, poi controllare che non esistano dati test indesiderati.

L'area è attiva: l'invito personale resta obbligatorio. I punti privacy ancora non spuntati vanno completati prima di estendere l'uso a tutta la flotta.

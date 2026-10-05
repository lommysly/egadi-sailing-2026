# Egadi · briefing del 5 ottobre 2026

Dati atmosferici e onde consultati **05/10/2026 alle 08:09 CEST (UTC+2, Europe/Rome)**. Periodo: **8–11 ottobre 2026**. Edizione del mattino per la call skipper delle **20:00**. Il prossimo controllo è configurato per le **19:00 di oggi**, una sola volta, non come monitoraggio continuo.

## Programma da confrontare

- Gruppo A: Marsala giovedì 8 circa 15:00 → Levanzo, 14–16 NM operative (linea geometrica 12,8 NM), a Est di Favignana. A 4 kn: 3 h 30–4 h, arrivo 18:30–19:00 contro tramonto 18:43. Un anticipo 13:30–14:00 richiede possibilità reale di imbarco/charter, non è confermato.
- Gruppo B: Marsala venerdì 9 mattina → Marettimo senza Levanzo, scenario 22–24 NM a Sud/Ovest di Favignana. A 4 / 5 / 6 kn: circa 5 h 30–6 h / 4 h 25–4 h 50 / 3 h 40–4 h. Rotta vera orientativa 300°, da ricostruire su carta con largo e limiti AMP.
- Obiettivo condiviso dato dal titolare: **dentro il porto di Marettimo venerdì sera**, se le condizioni lo consentono, poi **dentro quello di Favignana sabato sera**. Nessun accesso o posto è confermato da questa ricerca.
- Sabato: Marettimo → Favignana, 12,1 NM dirette oppure 14,5–15 via Punta Troia. Deviazione esposta facoltativa, non indispensabile.
- Domenica: Favignana → Marsala, 11,5–12,5 NM con giro a Est e Punta Marsala, entro le 18:00. Confrontare uscita 14:00–14:30 con 15:30 sulla barca più lenta.

## Fonti, run e copertura verificata

API pubbliche Open-Meteo interrogate separatamente per ECMWF IFS, NOAA GFS e DWD ICON; onde ECMWF WAM, NOAA GFS-Wave e Météo-France MFWAM. Tre modelli atmosferici distinti; prodotti d'onda non equivalgono a tre forcing atmosferici indipendenti. Link numerici e metadati nella pagina pubblica.

| Prodotto | Run UTC | Fine del prodotto dai metadati, UTC | Uso nell’edizione |
| --- | --- | --- | --- |
| ECMWF IFS | 04/10 18:00 | 10/10 19:00 = 21:00 CEST | 8–10; non domenica |
| NOAA GFS | 05/10 00:00 | 21/10 01:00 | 8–11 |
| DWD ICON | 05/10 00:00 | 12/10 13:00 | 8–11 |
| ECMWF WAM | 04/10 18:00 | 10/10 21:00 = 23:00 CEST | 8–10; non domenica |
| NOAA GFS-Wave | 05/10 00:00 | 21/10 01:00 | 8–11 |
| Météo-France MFWAM | 04/10 12:00 | 14/10 03:00 | 8–11 |

Le API possono restituire valori precedenti oltre la fine dell’ultimo run corto. Quei valori non sono stati attribuiti all’ultima emissione ECMWF. Nessun ensemble recente acquisito: rimosse le percentuali della precedente edizione. Direzioni vento/onde **di provenienza**, correnti **verso**; Hs non è l'onda massima. Periodi di griglie a 3 ore possono essere interpolati nella risposta oraria.

Controllo qualità aggiuntivo: GFS restituisce alcune raffiche inferiori al vento medio nello stesso punto/ora (esempio Est Marettimo il 9 alle 13:00: medio 11,5 kn, raffica 7). Raffiche GFS escluse dalla valutazione e indicate da ricontrollare, senza alzarle artificialmente; restano ECMWF/ICON e la verifica reale. L’incoerenza del campo non viene usata per dichiarare favorevole una finestra.

Provenienza delle estrazioni locali (JSON non pubblici, nessun dato personale): meteo/onde SHA-256 `cbd574064c7d0e5cd8f9f6f63d4a8b876c26963d35bb0c9a578ed91e8ab4fe61`; metadati `dfac8f1272abcfc54a727b37eb3c548a82dcec87b9a138ba996c4c9812b94f16`. Consultazioni HTTP 200, otto punti per prodotto, 08:09; metadati verificati alle 08:10. Non confondere queste ore con l'ora di pubblicazione della pagina.

Punti richiesti (latitudine, longitudine): Marsala offshore (37,82;12,42), Est Favignana (37,91;12,37), Levanzo (38;12,33), canale centrale (37,96;12,20), Est Marettimo (37,97;12,07), Nord Favignana (37,93;12,34), Sud Favignana (37,84;12,28), canale meridionale (37,90;12,18). I punti di griglia restituiti possono differire: **nessuno è una previsione risolta dentro il porto**.

## Confronto operativo, non via libera

| Fase e finestra locale | Atmosfera | Onde Hs | Decisione interessata |
| --- | --- | --- | --- |
| Giovedì alle 15, Marsala/Levanzo | IFS/GFS 16–20 kn SSE–S, raffiche 26; ICON 11–13 kn | 12–21: WAM/GFS-Wave 0,7–1,1 m; MFWAM 1–1,3 m; 3,5–4,8 s | Uscita, margine luce, riparo per notte e rotazione |
| Venerdì 08–16, scenario da Marsala | IFS 3–18 kn con temporali circa 09–14; GFS 4–12; ICON 12–22, raffiche 31 O–ONO | WAM 0,6–1,4 m; GFS-Wave 0,4–0,7; MFWAM 0,7–0,9 | Una partenza precoce non evita automaticamente i fenomeni lungo 4–6 ore |
| Venerdì 12–21, canale Levanzo/Marettimo | IFS 9–19 kn; GFS 6–12; ICON 13–21, raffiche 28 | WAM 1,1–1,8 m; GFS-Wave 0,4–0,9; MFWAM 0,6–1 | Mare in crescita: attendere la pioggia può aumentare l'esposizione successiva |
| Venerdì 16–23, Est Marettimo offshore | Circa 10–20 kn O–NO, raffiche 28 | WAM 1,4–2 m; GFS-Wave 0,7–1; MFWAM circa 1; 4–6 s | Ingresso e permanenza sono verifiche distinte |
| Sabato 08–19, Marettimo/canale/Favignana | 9–16 kn O–NNO, raffiche fino a 25 fra i modelli | WAM 1,3–1,7 m; GFS-Wave 1–1,5; MFWAM 0,6–1,1; 5,1–6,4 s | Punta Troia, comfort e pontile Favignana |
| Sabato 16–18, Nord Favignana offshore | 11–16 kn ONO–NNO, raffiche 21 | WAM 1,4–1,5 m; GFS-Wave 1–1,1; MFWAM 0,6–0,7 | Onda residua e traversia dichiarata del settore Praia |
| Domenica 10–18 | GFS/ICON 6–12 kn ONO–NNO; raffiche 18 | GFS-Wave 0,6–1 m; MFWAM 0,4–0,6; IFS/WAM nuovi non coprono | Anticipare per la barca lenta; nuovo run lungo ECMWF necessario |

Le durate sono scenari a velocità costante, non polari né ETA certe. Nessuna soglia universale garantisce la sicurezza della flotta. Non dedurre onda dal vento locale né risacca dal grid point offshore.

## Porti e campi boe: cosa resta aperto

- **Marettimo:** Scalo Nuovo sul lato orientale del paese; ridosso con O–NO è un'inferenza geografica, non conferma di ingresso o tenuta. Contatto primario [Marettimo Marine](https://www.marettimomarine.it/contatti-marettimo-marine-egadi/) trovato nella scheda indicizzata; nessuna risposta diretta acquisita. Non confondere con Scalo Vecchio o Scalo Maestro/Punta Troia. Verificare banchina esatta, posti per tutta la flotta, pescaggio, risacca, raffiche sottovento, traghetti, lavori/restrizioni attuali. Il progetto regionale di messa in sicurezza del 2025 e il dragaggio del 2022 **non** provano lavori attivi, chiusura o fondali attuali.
- **Favignana:** [il gestore del settore Praia](https://favonianaservice.com/postibarca.html) dichiara esposizione ai venti settentrionali e traversia del maestrale. Non estendere questa descrizione a tutte le banchine; nessuna garanzia commerciale è usata come prova di sicurezza. Serve conferma del pontile assegnato e della risacca notturna.
- **Boe:** [pagina ufficiale AMP](https://www.ampisoleegadi.it/index.php/campi-boe/) dichiara campi stagionali, non la disponibilità di ottobre. Il [disciplinare 2026](https://www.ampisoleegadi.it/files/Normativa/%20disciplinare_integrativo_2026_mase.pdf), art.7, elenca Cala Azzurra, Marasolo, Scindo Passo, Preveto anche sul lato meridionale. Candidati geografici con NO, non rifugi certificati: verificare onda aggirante, rotazioni, installazione, disponibilità, limiti lunghezza/dislocamento e autorizzazione notturna. La supposizione «dall’altra parte del porto» non identifica un campo; ancoraggio e boa non hanno le stesse regole.

**Prima di ogni partenza:** Meteomar/NETTUNO, allerta ufficiale, radar/fulminazioni, osservazioni reali e contatto con il porto. Meteomar del 5/10 alle 02:00 CEST descrive la situazione attuale (Stretto S3, Tirreno meridionale ovest SE4), non il viaggio 8–11. Nessun bollettino operativo ufficiale consultato copre integralmente tutte le date. Avvisi IIM fascicolo 20/2026 (30 settembre), incluso 20.15 Favignana e avviso Marsala su relitto/area vietata: rileggere con carta aggiornata. RON Mazara/Capo Granitola consultata ieri, senza dato utile onda/corrente locale. Nessuna osservazione locale corrente/marea acquisita.

SST e corrente: Marine API consultata alle 07:06, emissione non verificata, griglia circa 8 km; velocità ricevuta km/h, convertita in nodi. Astronomia USNO consultata il 4/10, località 37,9N/12,4E, UTC+2. Non aggiornare artificialmente queste due ore alle 08:09.

## Ambito di rilascio e verifica

Solo briefing pubblico IT/EN, renderer, stile dedicato e documentazione. Nessun dato personale, Firestore, flusso di pagamento o accesso modificato. Versione asset: `20261005-two-departures-v2`. Verifica locale: sintassi JS, `git diff --check`, `flutter analyze` senza errori, suite unitaria 134/134 (incluse tre verifiche in `tools/passage-briefing.test.mjs`). Browser Chromium IT/EN, viewport 320/390/1280 px: due schede partenza, tre schede porti/boe, cinque righe di sintesi (due origini del venerdì), nessun overflow orizzontale della pagina; dettagli a comparsa e cambio lingua funzionanti. Questi viewport non sostituiscono una prova su dispositivo fisico. La pubblicazione richiede ancora build Pages e confronto dei file serviti col commit; il responso in chat distingue il readback reale dal test locale. La conferma sul posto di porti e boe resta un requisito operativo esterno, non una casella risolta dal deploy.

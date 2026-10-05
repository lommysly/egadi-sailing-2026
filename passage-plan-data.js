/*
 * Briefing pubblico Meteo & Passage Plan. Nessun dato personale va inserito
 * in questo file. Vento e onde indicano la direzione di provenienza.
 */
window.PASSAGE_PLAN_DATA = {
  updatedAt: "5 ottobre 2026 · 08:09 CEST (UTC+2)",
  phase: "Briefing per la call skipper · T−3",
  confidence: "Alta incertezza venerdì 9 · domenica valutata con GFS e ICON, in attesa del nuovo run ECMWF lungo",
  status: "Previsione multi-modello disponibile · non è ancora il via libera dello skipper",
  publishedAt: "5 ottobre 2026 · edizione del mattino per la call skipper delle 20:00",
  validFrom: "Periodo analizzato: 8–11 ottobre 2026 · orari locali Europe/Rome (CEST, UTC+2)",
  validUntil: "Quadro da riesaminare oggi alle 19:00, prima della call; osservazioni reali, avvisi e bollettini più recenti prevalgono sempre.",
  nextUpdateAt: "5 ottobre · controllo programmato alle 19:00, prima della call delle 20:00",
  nextUpdateReason: "È configurato un singolo controllo prima della call, non un monitoraggio continuo. Serviranno poi nuove verifiche il 7 e prima di ogni partenza: temporali del 9, mare da O–NO del 9–10, notte a Levanzo e accessi ai porti possono cambiare le decisioni.",
  dataMode: "operational",
  weatherNoticeTitle: "La previsione copre il viaggio, ma manca ancora la conferma ufficiale a breve termine.",
  weatherNoticeText: "Confronto separato di ECMWF, GFS e ICON per l’atmosfera e WAM, GFS-Wave e MFWAM per le onde. L’ultimo run corto ECMWF non copre domenica: non attribuiamo a quel run valori provenienti da una previsione precedente.",
  summary: "Due partenze da Marsala: giovedì pomeriggio via Levanzo e venerdì mattina direttamente verso Marettimo. L’obiettivo comune è ormeggiare dentro il porto di Marettimo venerdì sera e dentro quello di Favignana sabato sera, ma soltanto se condizioni, accesso e posti lo consentono. Venerdì è la giornata più incerta: possibili temporali e mare occidentale in aumento. Non c’è oggi un via libera per la traversata. Le boe a sud di Favignana restano un piano B da verificare, non un riparo già disponibile. Domenica il rientro a Marsala entro le 18:00 richiede margine sulla barca più lenta.",
  decisiveFactors: [
    "Giovedì 8 alle 15:00: ECMWF/GFS circa 16–20 nodi da SSE–S, raffiche fino a 26; ICON circa 11–13 nodi. A 4 nodi, 14–16 NM richiedono 3 h 30–4 h: si arriva vicino o dopo il tramonto delle 18:43.",
    "Venerdì 9: ECMWF colloca il segnale temporalesco circa fra le 09:00 e le 14:00 e WAM porta l’onda fino a 1,8 m nel pomeriggio; GFS è più debole. Nessuna finestra per Marettimo è acquisita.",
    "Domenica 11: Favignana–Marsala richiede circa 2 h 25 min a 5 nodi. Partire alle 15:30 lascia quasi zero margine; a 4 nodi non consente l’arrivo entro le 18:00."
  ],
  callBriefing: {
    title: "Due partenze, sempre da Marsala",
    introduction: "Giovedì 8 nel pomeriggio e venerdì 9 al mattino: ciascun gruppo ha il proprio briefing da Marsala. Dati controllati il 5 ottobre alle 08:09, per la call delle 20:00. Appuntamento desiderato: tutti dentro il porto di Marettimo venerdì sera. Saltare Levanzo accorcia il programma del venerdì, ma non elimina temporali, mare aperto e verifica dell’ingresso.",
    options: [
      {
        title: "Giovedì 8 · partenza intorno alle 15:00", route: "Marsala → Levanzo · circa 14–16 NM", course: "NNO, circa 338° veri · passaggio a Est di Favignana con adeguato largo", duration: "4 kn: 3 h 30–4 h · 5 kn: 2 h 50–3 h 15 · 6 kn: 2 h 20–2 h 40",
        ratings: { departure: { tone: "caution", text: "SSE–S 16–20 kn, raffiche fino a 26; verificare onda e vento reali all’imboccatura di Marsala." }, passage: { tone: "caution", text: "Mare corto da SSE–S, Hs 0,7–1,3 m; sull’andatura portante conta il comfort della barca più lenta." }, arrival: { tone: "unknown", text: "Approdo non scelto: serve un riparo consentito anche con la rotazione a O–NO di venerdì, non soltanto un bel tramonto." } },
        wind: "12–21: ECMWF 13–20 kn / raffiche 26, GFS 14–19 kn (raffiche da ricontrollare), da 150–173° (SSE–S). ICON 3–15 kn / 22, da S verso O–NO la sera.", sea: "WAM 0,7–1,1 m, GFS-Wave 0,7–1,1 m, MFWAM 1–1,3 m; provenienza SSE–S (148–168°), periodo 3,5–4,8 s. Prevale il mare di vento.", window: "Alle 15:00, a 4 kn, arrivo indicativo 18:30–19:00 contro il tramonto delle 18:43. Valutare 13:30–14:00 soltanto se charter e imbarco lo consentono; non è un nuovo orario confermato.", decision: "Confermare prima della partenza la notte e un’alternativa. Venerdì questo gruppo riparte da Levanzo: la sua traversata è nella scheda giornaliera qui sotto.", alternative: "Restare a Marsala o accorciare sul porto di Favignana con posto e accesso confermati. Cala Fredda/Minnola/Dogana non sono una soluzione automatica con vento da S–SE."
      },
      {
        title: "Venerdì 9 · partenza al mattino", route: "Da Marsala · scenario diretto per Marettimo, senza Levanzo · circa 22–24 NM", course: "NO, circa 300° veri · percorso a Sud/Ovest di Favignana da verificare su carta", duration: "4 kn: 5 h 30–6 h · 5 kn: 4 h 25–4 h 50 · 6 kn: 3 h 40–4 h",
        ratings: { departure: { tone: "caution", text: "06–12: al largo di Marsala ECMWF 2–6 kn con raffiche 9–15, GFS 6–13 kn, ICON 12–14 kn con raffiche fino a 23. Le direzioni divergono; l’imboccatura va verificata sul posto." }, passage: { tone: "adverse", text: "Fra le 08 e le 16 ECMWF vede temporali lungo la rotta; ICON indica O–NO fino a 22 kn e raffiche 31. Il vento può essere quasi contrario verso Marettimo." }, arrival: { tone: "unknown", text: "Marettimo è l’obiettivo comune, ma accesso e posto dentro il porto non sono confermati. Il mare può crescere ancora durante la notte." } },
        wind: "08–16 lungo lo scenario: ECMWF 3–18 kn / raffiche 25 da SO–NO; GFS 4–12 kn (raffiche da ricontrollare) da SE verso NO; ICON 12–22 kn / 31 da O–ONO (278–296°). Non fare la media tra questi scenari.", sea: "08–16: WAM Hs 0,6–1,4 m da SO verso NO, GFS-Wave 0,4–0,7 m, MFWAM 0,7–0,9 m. Periodo 3,1–5,3 s; residuo da S e nuovo mare occidentale possono sovrapporsi. Nel canale a Nord WAM cresce fino a 1,8 m la sera.", window: "Confrontare 06–08 e 08–10 senza dichiarare oggi una finestra favorevole: la traversata dura 4–6 ore e può incontrare i fenomeni circa 09–14. Fra le 06 e le 07:13 manca la piena luce; rimandare oltre il mattino può aumentare l’esposizione al mare occidentale del pomeriggio.", decision: "Puntare a Marettimo senza passare da Levanzo, solo dopo verifica della traversata e conferma del porto. Stabilire nella call un orario limite per rinunciare: l’appuntamento non impone di entrare con condizioni inadeguate.", alternative: "Restare a Marsala; oppure accorciare sul porto di Favignana, circa 11–13 NM, soltanto con finestra, accesso e posto verificati. Passare da Levanzo aggiunge 14–16 NM più altre circa 13 NM per Marettimo: non è la scorciatoia del venerdì."
      }
    ],
    decisions: [
      "Prima notte: quale riparo documentato resta adatto con vento da Sud che gira a Ovest–Nord-Ovest? Non scegliere una rada solo perché guarda il tramonto.",
      "Marettimo venerdì e Favignana sabato: quale banchina, quale esposizione e quali posti sono confermati? Le boe di Favignana restano da identificare e verificare per ottobre e notte.",
      "Domenica: concordare un’uscita indicativa alle 14:00–14:30, da ricalcolare sulla barca più lenta e sulle operazioni di rientro."
    ]
  },
  harbourChecks: {
    title: "Le due notti: porto e possibile piano B",
    introduction: "Ingresso e permanenza sono verifiche diverse. Le onde qui riportate sono al largo: non misurano la risacca in porto. Non abbiamo una conferma attuale di agibilità, disponibilità per la flotta o operatività delle boe.",
    items: [
      {
        title: "Venerdì 9 · Marettimo, Scalo Nuovo",
        rating: { tone: "unknown", text: "Obiettivo comune · ingresso e posti da confermare direttamente." },
        exposure: "Gli scali del paese sono sulla costa orientale. Con O–NO il lato est può beneficiare del ridosso dell’isola: è un’inferenza geografica, non una misura dell’onda all’imboccatura. Vento da E–SE e onda residua da Sud richiedono una valutazione diversa. Non scambiare Scalo Nuovo, Scalo Vecchio e Scalo Maestro presso Punta Troia.",
        forecast: "16–23: al largo del lato est vento circa 10–20 kn da O–NO, raffiche fino a 28. WAM Hs 1,4–2 m; GFS-Wave 0,7–1 m; MFWAM circa 1 m. Periodi 4–6 s; lo scenario WAM cresce anche dopo l’arrivo.",
        check: "Chiedere al gestore banchina esatta e posti per tutte le barche, pescaggi ammessi, risacca reale su accesso e pontili, raffiche sottovento, traffico traghetti ed eventuali lavori o restrizioni attuali. Non è disponibile qui un rilievo aggiornato dell’imboccatura.",
        alternative: "Chi parte da Marsala può restare in base. Chi è a Levanzo deve avere prima un riparo consentito per l’attesa o un altro porto con posto e accesso verificati. Non raggiungere Marettimo soltanto per rispettare l’appuntamento.",
        sourceLabel: "Marettimo Marine · contatti del gestore", sourceUrl: "https://www.marettimomarine.it/contatti-marettimo-marine-egadi/"
      },
      {
        title: "Sabato 10 · porto di Favignana",
        rating: { tone: "caution", text: "Mare da O–NO · verificare il pontile assegnato e la risacca notturna." },
        exposure: "Il gestore Marina di Favignana dichiara il proprio settore Praia esposto ai venti settentrionali e alla traversia del maestrale. Non estendiamo questa indicazione a ogni banchina del porto: sapere soltanto «siamo dentro» non descrive il riparo effettivo.",
        forecast: "16–18 sul lato nord: vento circa 11–16 kn da ONO–NNO, raffiche fino a 21. WAM Hs 1,4–1,5 m, GFS-Wave 1–1,1 m, MFWAM 0,6–0,7 m; periodo circa 5–6 s. GFS-Wave mantiene circa 1–1,2 m fino alle 23: il calo del vento non azzera subito l’onda.",
        check: "Confermare pontile, esposizione, risacca e posto per ciascuna barca; verificare fondali, ingresso con luce, traffico e avvisi/lavori in vigore. Avviso IIM 20.15 e carta 259 riguardano anche limiti d’ancoraggio: non sono una conferma dell’accesso.",
        alternative: "Se il posto non offre condizioni adeguate, considerare solo un altro ormeggio documentato oppure un campo boe verificato per quella notte. Le schede qui sotto non costituiscono prenotazioni.",
        sourceLabel: "Marina di Favignana · esposizione dichiarata dal gestore", sourceUrl: "https://favonianaservice.com/postibarca.html"
      },
      {
        title: "Favignana · alternativa alle boe",
        rating: { tone: "unknown", text: "Campo esatto e operatività in ottobre non confermati." },
        exposure: "Il disciplinare AMP 2026 elenca, fra gli altri, Cala Azzurra, Marasolo, Scindo Passo e Preveto sul lato sud. Questo lato può essere meno esposto al NO per posizione geografica, ma onda aggirante, raffiche e rotazioni possono cambiare la sosta. I campi settentrionali non sono equivalenti.",
        forecast: "Valutare la direzione e il periodo dell’onda residua per tutta la notte, non soltanto il vento all’arrivo. Non abbiamo una misura dentro questi campi né una verifica della tenuta dei singoli ormeggi.",
        check: "Chiedere all’AMP nome e posizione del campo, boe ancora installate in ottobre, disponibilità, limiti di lunghezza/dislocamento, autorizzazione alla notte ed eventuali sospensioni. Ormeggiarsi a una boa e ancorare sono attività diverse, con regole diverse.",
        alternative: "La boa «dall’altra parte del porto» non è stata identificata: non la presentiamo come rifugio. Se manca conferma, mantenere un porto o riparo alternativo già verificato.",
        sourceLabel: "AMP Egadi · campi stagionali e autorizzazioni", sourceUrl: "https://www.ampisoleegadi.it/index.php/campi-boe/"
      }
    ]
  },
  missingChecks: [
    "Bollettino Meteomar/NETTUNO, eventuale allerta della Protezione Civile, radar e osservazioni costiere nella finestra 24–72 ore.",
    "Posti barca a Marettimo e Favignana, operatività dei campi boe in ottobre e autorizzazioni dell’Area Marina Protetta.",
    "Condizioni reali alle imboccature, fondali/pescaggio, traffico traghetti e Avvisi ai Naviganti aggiornati prima di ogni ingresso.",
    "Non è disponibile una misura ufficiale locale di corrente o marea per Marsala–Egadi: il modello largo non sostituisce la verifica a bordo."
  ],
  orientationNotes: [
    "Schema di orientamento: non è una carta nautica e non va usato per navigare.",
    "Punti esposti: uscita di Marsala con mare da Sud; traversata Levanzo–Marettimo; costa NO e Punta Troia; giro di Punta Marsala al rientro.",
    "Giovedì si passa da Levanzo; venerdì lo scenario diretto da Marsala la salta, passando a Sud/Ovest di Favignana. Obiettivo comune Marettimo venerdì, soltanto se consentito dalle condizioni.",
    "Alternative da verificare: restare a Marsala; rinviare Marettimo; rotta diretta per Favignana; anticipare il rientro. Porto o posto barca vanno sempre confermati."
  ],
  sourceNote: "Dati consultati il 5 ottobre alle 08:09 CEST su otto punti in mare, inclusi Sud di Favignana e canale meridionale per chi parte venerdì da Marsala. Run atmosferici: IFS 04/10 18 UTC, GFS e ICON 05/10 00 UTC; onde WAM 04/10 18 UTC, GFS-Wave 05/10 00 UTC, MFWAM 04/10 12 UTC. Il run corto IFS termina il 10 alle 21 CEST e WAM il 10 alle 23 CEST: domenica è valutata solo con GFS/ICON e GFS-Wave/MFWAM. Le direzioni di vento e onde sono di provenienza; quelle di corrente indicano dove scorre l’acqua. Hs è l’altezza significativa, non l’onda massima. Le griglie offshore non descrivono le imboccature. Alcune raffiche GFS restituite risultano inferiori al vento medio nello stesso punto/ora: campo escluso dal confronto delle raffiche, da ricontrollare.",
  sources: [
    { label: "ECMWF IFS · dati interrogati", url: "https://api.open-meteo.com/v1/forecast?latitude=37.96&longitude=12.20&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&wind_speed_unit=kn&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=ecmwf_ifs&cell_selection=sea", scope: "vento, raffiche e pioggia lungo l’area", checkedAt: "5 ottobre · 08:09 CEST", product: "Open-Meteo Forecast API", model: "ECMWF IFS HRES · run 04/10 18 UTC · circa 9 km", availability: "ultimo run corto fino al 10 ottobre alle 21 CEST; escluso dalla valutazione di domenica" },
    { label: "NOAA GFS · dati interrogati", url: "https://api.open-meteo.com/v1/forecast?latitude=37.96&longitude=12.20&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&wind_speed_unit=kn&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=ncep_gfs_global&cell_selection=sea", scope: "secondo scenario atmosferico indipendente", checkedAt: "5 ottobre · 08:09 CEST", product: "Open-Meteo Forecast API", model: "NOAA GFS · run 05/10 00 UTC · circa 13 km", availability: "orario · 8–11 ottobre" },
    { label: "DWD ICON · dati interrogati", url: "https://api.open-meteo.com/v1/forecast?latitude=37.96&longitude=12.20&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&wind_speed_unit=kn&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=icon_global&cell_selection=sea", scope: "terzo scenario atmosferico indipendente", checkedAt: "5 ottobre · 08:09 CEST", product: "Open-Meteo Forecast API", model: "DWD ICON globale · run 05/10 00 UTC · circa 11 km", availability: "orario · 8–11 ottobre" },
    { label: "Open-Meteo Marine · confronto onde", url: "https://marine-api.open-meteo.com/v1/marine?latitude=37.96&longitude=12.20&hourly=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=ecmwf_wam025,ncep_gfswave025,meteofrance_wave&cell_selection=sea", scope: "altezza significativa, direzione, periodo e componenti quando disponibili", checkedAt: "5 ottobre · 08:09 CEST", product: "Marine Weather API", model: "WAM 04/10 18 UTC · GFS-Wave 05/10 00 UTC · MFWAM 04/10 12 UTC", availability: "WAM fino al 10 alle 23 CEST; domenica solo GFS-Wave/MFWAM · griglie offshore" },
    { label: "Emissione e copertura dei modelli", url: "https://open-meteo.com/en/docs/model-updates", scope: "metadati di ciascun modello, distinti dall’ora di consultazione", checkedAt: "5 ottobre · 08:10 CEST", product: "static/meta.json dei modelli", model: "latest run e data_end_time", availability: "nessun valore fuori dal run corto ECMWF attribuito a quell’emissione" },
    { label: "Correnti e temperatura del mare", url: "https://open-meteo.com/en/docs/marine-weather-api", scope: "Marsala offshore e canale Levanzo–Marettimo; non imboccature", checkedAt: "5 ottobre · 07:06 CEST", product: "Marine API · SST e corrente oceanica", model: "prodotti Météo-France · emissione non verificata nell’estrazione", availability: "8–11 ottobre; circa 8 km · velocità ricevuta in km/h e convertita in nodi" },
    { label: "Aeronautica Militare · Meteomar", url: "https://www.meteoam.it/it/meteomar", scope: "Stretto di Sicilia e Tirreno Meridionale Ovest; da rileggere prima di ogni tratta", checkedAt: "5 ottobre · emissione 02:00 CEST, consultazione 07:05", product: "Meteomar", model: "bollettino ufficiale", availability: "situazione attuale: S3 nello Stretto, SE4 nel Tirreno; non è la previsione dell’8–11" },
    { label: "ISPRA · Rete Ondametrica", url: "https://www.mareografico.it/it/stazioni.html", scope: "osservazione di riferimento più vicina: boa Mazara del Vallo/Capo Granitola", checkedAt: "4 ottobre · 20:30 CEST", product: "RON", model: "osservazione, non previsione", availability: "onda e corrente non disponibili nell’ultima misura; non rappresenta Marsala/Egadi" },
    { label: "Istituto Idrografico della Marina · Avvisi", url: "https://www.marina.difesa.it/noi-siamo-la-marina/pilastro-logistico/scientifici/idrografico/Pagine/Avvisi.aspx", scope: "relitto/area vietata a Marsala e limiti di ancoraggio a Favignana", checkedAt: "fascicolo 20/2026 del 30 settembre", product: "Avvisi ai Naviganti · carte 258, 259 e 260", model: "fonte ufficiale" },
    { label: "Area Marina Protetta · Disciplinare 2026", url: "https://www.ampisoleegadi.it/files/Normativa/%20disciplinare_integrativo_2026_mase.pdf", scope: "zonazione, autorizzazioni, fondali sensibili, ancoraggi e campi boe", checkedAt: "5 ottobre 2026 · valido fino al 31 dicembre", product: "Disciplinare integrativo 2026", model: "fonte ufficiale locale", availability: "campi stagionali e disponibilità reale da confermare direttamente" },
    { label: "US Naval Observatory · astronomia", url: "https://aa.usno.navy.mil/data/api", scope: "alba, tramonto, crepuscolo e luna · 37,9 N / 12,4 E", checkedAt: "4 ottobre 2026", product: "Sun and Moon Data for One Day", model: "calcolo astronomico · Europe/Rome UTC+2" },
    { label: "Marettimo Marine · gestore", url: "https://www.marettimomarine.it/contatti-marettimo-marine-egadi/", scope: "contatto per posto, accesso e condizioni di Scalo Nuovo", checkedAt: "5 ottobre · 08:15 CEST · scheda indicizzata", product: "pagina del gestore", model: "nessuna misura meteo", availability: "nessuna risposta diretta né conferma di agibilità/posti acquisita" },
    { label: "Marina di Favignana · gestore", url: "https://favonianaservice.com/postibarca.html", scope: "settore Praia dichiarato esposto a venti settentrionali e traversia del maestrale", checkedAt: "5 ottobre · 08:15 CEST", product: "descrizione del gestore", model: "esposizione locale, non previsione", availability: "non descrive tutte le banchine e non conferma il posto assegnato" },
    { label: "AMP Egadi · campi boe", url: "https://www.ampisoleegadi.it/index.php/campi-boe/", scope: "campi stagionali e autorizzazioni, da integrare con disciplinare 2026", checkedAt: "5 ottobre · 08:15 CEST", product: "informazione ufficiale locale", model: "non misura vento/onda", availability: "installazione, disponibilità e pernottamento di ottobre da confermare" }
  ],
  modelComparison: [
    { parameter: "Vento · 8 ottobre alle 15", scenarios: "ECMWF/GFS 16–20 kn da SSE–S, raffiche fino a 26 · ICON 11–13 kn", divergence: "alta sull’intensità", decisionImpact: "pianificare sullo scenario sostenuto e garantire riparo e margine di luce" },
    { parameter: "Uscita da Marsala · 9 ottobre al mattino", scenarios: "ECMWF debole in uscita ma temporali circa 09–14; GFS meno severo; ICON O–NO in rinforzo lungo la rotta fino a 22 kn / raffiche 31", divergence: "alta tra uscita e mare attraversato, non solo tra modelli", decisionImpact: "non usare il solo dato del porto per confermare una traversata di 4–6 ore" },
    { parameter: "Vento/fenomeni · 9 ottobre", scenarios: "ECMWF temporali circa 09–14 e O–NO fino a 19 kn · ICON O–NO fino a 21 kn · GFS più debole, pioggia limitata", divergence: "alta su fenomeni, intensità e orario della rotazione", decisionImpact: "partire venerdì non è automaticamente meglio; Marettimo resta subordinata alla verifica reale" },
    { parameter: "Onde · 9–10 ottobre", scenarios: "Venerdì pomeriggio WAM fino a 1,8 m da NO, GFS-Wave 0,4–0,9 m, MFWAM 0,6–1 m. Sabato WAM 1,3–1,7 m, GFS-Wave 1–1,5 m, MFWAM 0,6–1,1 m", divergence: "alta, senza mediare via lo scenario WAM", decisionImpact: "traversata occidentale e Punta Troia da rivalutare; possibile mare residuo anche se il vento cala" },
    { parameter: "Rientro · 11 ottobre", scenarios: "GFS/ICON circa 6–12 kn da ONO–NNO; GFS-Wave 0,6–1 m, MFWAM 0,4–0,6 m. Ultimo run corto IFS/WAM non valido per queste ore", divergence: "onda non identica e confronto ECMWF ancora mancante", decisionImpact: "preservare il margine sull’orario e rileggere il prossimo run lungo" }
  ],
  climateOutlook: {
    title: "Aria, acqua e luce del viaggio",
    disclaimer: "Questi sono valori dei modelli e calcoli astronomici, non climatologia né misure nelle calette. Il dettaglio operativo è nelle schede.",
    items: [
      { icon: "air", label: "Aria", value: "20–27°C", detail: "intervallo indicativo nei punti e nelle fasce analizzate" },
      { icon: "water", label: "Mare", value: "24–25°C", detail: "temperatura superficiale modellata, non misura in rada" },
      { icon: "wind", label: "Vento", value: "variabile", detail: "marcata divergenza dei modelli l’8 e il 9" },
      { icon: "rain", label: "Instabilità", value: "venerdì", detail: "segnale ECMWF soprattutto mattina/primo pomeriggio del 9" },
      { icon: "sun", label: "Luce", value: "circa 11 h 30 min", detail: "tramonto tra le 18:43 e le 18:39" }
    ]
  },
  stopsNote: "Una cala panoramica non è automaticamente una rada sicura. Ridosso, onda residua, fondo, spazio di manovra, regole AMP, autorizzazione e disponibilità reale vanno controllati insieme; un campo boe stagionale non può essere dato per operativo in ottobre senza conferma.",
  mooringGuide: {
    title: "Dove si può dormire o aspettare la luce?",
    introduction: "Le località sono scenari da verificare, non prenotazioni. I lati occidentali guardano il tramonto, quelli orientali l’alba; la protezione reale dipende però da vento e onda durante tutta la notte.",
    checks: [
      { title: "Levanzo · tramonto", text: "Cala Tramontana e Capo Grosso guardano a Ovest–Nord-Ovest, ma sono esposti al mare da N e O. Cala del Genovese è soggetta alle regole AMP: sosta e notte vanno verificate." },
      { title: "Levanzo · alba e piano B", text: "Cala Fredda, Cala Minnola e Cala Dogana sono sul lato E–SE. Cala Dogana ha traffico di linea: manovre e permanenza non si improvvisano." },
      { title: "Marettimo e Favignana", text: "Le notti in porto valgono solo con posto confermato. A Marettimo il Miglio Blu impone specifici divieti; a Favignana il nuovo Avviso 20.15 modifica limiti vietati all’ancoraggio sulla carta 259." }
    ]
  },
  days: [
    {
      date: "Giovedì 8 ottobre",
      route: "Marsala → Levanzo",
      distance: "circa 14–16 NM operative · linea geometrica circa 12,8 NM",
      course: "circa 338° veri · a Est di Favignana con adeguato largo",
      duration: "4 kn: 3 h 30–4 h · 5 kn: 2 h 50–3 h 15 · 6 kn: 2 h 20–2 h 40",
      window: "Alle 15:00, a 4 kn, arrivo indicativo 18:30–19:00 contro il tramonto delle 18:43. Valutare 13:30–14:00 solo se charter e imbarco lo consentono; nessun orario anticipato è confermato.",
      criticality: "Uscita con vento e onda da Sud; scelta notturna a Levanzo ancora aperta.",
      uncertainty: "Alta sul vento: ECMWF/GFS sono sostenuti, ICON molto più debole e ruota a Ovest.",
      ratings: {
        departure: { tone: "caution", text: "Alle 15 ECMWF/GFS indicano 16–20 kn da SSE–S, raffiche fino a 26; verificare imboccatura e avvisi." },
        passage: { tone: "caution", text: "Mare corto da SSE–S, Hs 0,7–1,3 m; andatura portante ma comfort e velocità reale da valutare." },
        arrival: { tone: "unknown", text: "Non è stato scelto un approdo preciso; rada e boe di ottobre non sono confermate." }
      },
      operationalChecks: ["Meteomar/NETTUNO e osservazioni reali di Marsala prima di mollare gli ormeggi.", "Avvisi IIM su relitto e area vietata presso Marsala.", "Ridosso, fondale, autorizzazione AMP e piano di uscita dalla rada se il vento ruota."],
      glance: { wind: "SSE–S 16–20 kn alle 15", windTone: "caution", sea: "0,7–1,3 m da SSE–S", seaTone: "caution", sky: "Asciutto nei 3 modelli", skyIcon: "sun", skyTone: "good" },
      plan: "Questa scheda riguarda le barche del giovedì. Cambusa già a bordo, rotta a Est di Favignana e notte a Levanzo soltanto con riparo consentito e margine di luce. La linea geometrica non comprende tutto il largo e le manovre.",
      navigation: "Con rotta verso NNO e vento/onda da S–SSE l’andatura è portante. Se si realizza la rotazione a Ovest di ICON, l’ultimo tratto cambia assetto e comfort.",
      overnight: "Rada sul lato realmente ridossato soltanto dopo verifica; altrimenti porto/posto confermato o un’alternativa più documentata.",
      overnightType: "Prima notte · scelta aperta",
      overnightStatus: "Da verificare sul posto",
      alternative: "Restare a Marsala oppure accorciare su Favignana con posto già confermato. La vicinanza non rende un approdo automaticamente sicuro.",
      stops: [
        { moment: "Tramonto · lato O/NO", title: "Cala Tramontana o scenario del Genovese", description: "Luce favorevole verso Ovest, ma esposizione maggiore con onda da Ovest o Nord.", check: "Zonazione AMP, fondo, spazio, onda residua, traffico e possibilità di uscire senza ritardi." },
        { moment: "Alba · lato E/SE", title: "Cala Fredda, Minnola o Dogana", description: "Lato adatto alla prima luce; Cala Dogana è anche approdo di linea.", check: "Non pernottare per il solo valore panoramico: servono permesso, ridosso e gestione del traffico." }
      ],
      wind: "12–21: ECMWF 13–20 kn / raffiche fino a 26; GFS 14–19 kn (raffiche da ricontrollare), da 143–173° (SE–S). ICON 3–15 kn / 22, da S verso O–NO la sera. Intensità 1–5 Bft secondo modello e ora; venerdì prevale la rotazione occidentale.",
      sea: "Poco mosso, al limite mosso (Douglas 3–4) nello scenario più alto. WAM Hs 0,7–1,1 m; GFS-Wave 0,7–1,1 m; MFWAM 1–1,3 m, da SSE–S (148–168°), periodo 3,5–4,8 s. GFS-Wave è quasi tutto mare di vento; MFWAM separa swell 0,1–0,4 m da S–SO, periodo 4,3–5,2 s. Hs non è l’onda massima.",
      visibility: "Circa 24–36 km nei prodotti ECMWF/GFS lungo la rotta; dato ICON non disponibile. Verifica locale all’imboccatura.",
      phenomena: "Scenario asciutto nei tre deterministici; probabilità ensemble puntuale non disponibile in questa estrazione. Lo sviluppo convettivo reale va comunque osservato.",
      air: "Circa 23–27°C nelle fasce analizzate; nuvolosità diversa fra modelli, tipo di nube non risolto.",
      water: "Temperatura superficiale modellata circa 24,6–24,8°C; non è una misura della cala.",
      currents: "Modello oceanico nel canale circa 0,2–1,1 kn verso N–NE (0–45°). Griglia circa 8 km: non descrive correnti, marea o opposizione vento-corrente all’imboccatura. Verifica a bordo.",
      decision: "Confermare entro il primo pomeriggio sia l’uscita sia la notte. Se il margine di luce si riduce, usare un riparo già verificato.",
      sun: "Alba 07:12 · tramonto 18:43 · crepuscolo civile fino alle 19:09.",
      moon: "Falce calante, illuminazione 6% · levata 04:45 · tramonto 17:30."
    },
    {
      date: "Venerdì 9 ottobre",
      route: "Levanzo → Marettimo · gruppo del giovedì",
      distance: "circa 13 NM",
      course: "uscita a Sud di Levanzo, poi circa 267° veri",
      duration: "4 kn: 3 h 15 min · 5 kn: 2 h 36 min · 6 kn: 2 h 10 min",
      window: "Confrontare 08–10 e dopo le 14 con radar e mare reale: ECMWF segnala fenomeni circa 09–14, WAM aumenta poi verso sera. Nessuna finestra favorevole acquisita.",
      criticality: "Traversata aperta, possibili temporali e mare da O–NO in aumento; ingresso e notte a Marettimo da verificare.",
      uncertainty: "Alta su temporali e onda: WAM fino a 1,8 m contro GFS-Wave 0,4–0,9 m nel pomeriggio/sera.",
      ratings: {
        departure: { tone: "adverse", text: "Possibili temporali soprattutto circa 09–14: non mollare il riparo senza radar, bollettino e osservazioni aggiornati." },
        passage: { tone: "adverse", text: "O–NO quasi contrario sulla rotta Ovest, con mare in crescita: rinvio o alternativa da considerare." },
        arrival: { tone: "unknown", text: "Obiettivo dentro Scalo Nuovo venerdì sera; accesso, posti e risacca notturna non sono confermati." }
      },
      operationalChecks: ["Radar e fulminazioni, osservazione delle nubi e Meteomar prima della traversata.", "Posto, canale di chiamata e istruzioni del porto di Marettimo.", "Se modelli e osservazioni non convergono, rinunciare a Marettimo prima di impegnare il canale."],
      glance: { wind: "O–NO · 6–21 kn (12–21)", windTone: "caution", sea: "0,4–1,8 m fra i modelli", seaTone: "caution", sky: "Temporali possibili circa 09–14", skyIcon: "rain", skyTone: "caution" },
      plan: "Questa tratta è per chi ha lasciato Marsala giovedì. Chi parte venerdì usa la scheda Marsala → Marettimo sopra. Tutti puntano al porto venerdì sera, ma la traversata può essere rinviata o annullata.",
      navigation: "Nel pomeriggio i tre modelli ruotano sul quadrante occidentale: sulla rotta 267° vento da O–NO può imporre bolina o risultare quasi contrario. Nessuna prestazione a vela è garantita.",
      overnight: "Dentro il porto di Marettimo solo con posto, ingresso e permanenza notturna verificati; WAM aumenta fino a circa 2 m al largo alle 23.",
      overnightType: "Seconda notte · porto",
      overnightStatus: "Disponibilità da confermare",
      alternative: "Restare in un riparo legale a Levanzo, dirigere su Favignana con posto confermato o rientrare a Marsala. Nessuna alternativa è automatica.",
      stops: [
        { moment: "Prima della traversata", title: "Cala Fredda o Cala Minnola", description: "Eventuale sosta breve soltanto se non sottrae margine alla decisione meteo.", check: "Temporali, rotazione del vento, ridosso e orario limite per rinunciare." },
        { moment: "Arrivo", title: "Scalo Nuovo di Marettimo", description: "Approdo con traffico di linea e spazi limitati: l’arrivo va coordinato.", check: "Posto barca, istruzioni locali, vento sull’imboccatura, traghetti e visibilità." }
      ],
      wind: "12–21: ECMWF 9–19 kn / raffiche 25, GFS 6–12 kn (raffiche da ricontrollare), ICON 13–21 kn / 28, da O–NO (257–316°). 2–5 Bft; rotazione e rinforzo occidentale rispetto a giovedì. I valori mattutini non vanno sostituiti con quelli serali.",
      sea: "Poco mosso/mosso, Douglas 3–4 nello scenario WAM. 12–21: WAM 1,1–1,8 m da NO (296–308°), GFS-Wave 0,4–0,9 m da S verso ONO, MFWAM 0,6–1 m da S verso O. Periodo 3,6–5,9 s. GFS-Wave: mare di vento 0,3–0,7 m e swell 0,2–0,4 m, periodo 4,5–7,2 s; MFWAM swell 0,5–0,8 m. Possibile sovrapposizione di residuo meridionale e nuovo mare occidentale.",
      visibility: "Può calare rapidamente sotto un rovescio o temporale: la griglia non descrive il bordo della cella.",
      phenomena: "ECMWF segnala temporali circa 09–14 lungo l’area, con pioggia oraria fino a circa 3 mm nei punti analizzati. GFS è asciutto e ICON vede pioggia debole su alcuni punti della rotta da Marsala. Ensemble aggiornato non disponibile: nessuna percentuale di affidabilità. Celle e raffiche locali possono non essere risolte.",
      air: "Circa 20–25°C; copertura e pioggia variabili, nubi convettive possibili nello scenario ECMWF.",
      water: "Temperatura superficiale modellata circa 24,8°C.",
      currents: "Modello oceanico nel canale circa 0,2–0,7 kn verso N–NE–E (14–90°); risoluzione insufficiente per rotta costiera e ingresso, verifica locale necessaria.",
      decision: "È la giornata di possibile NO-GO. Temporali, salto del vento o mare disordinato richiedono rinvio o cambio destinazione.",
      sun: "Alba 07:13 · tramonto 18:42 · crepuscolo civile fino alle 19:08.",
      moon: "Falce calante, illuminazione 2% · levata 05:51 · tramonto 17:54."
    },
    {
      date: "Sabato 10 ottobre",
      route: "Marettimo → Favignana",
      distance: "circa 12,1 NM dirette · 14,5–15 NM via Punta Troia",
      course: "diretta circa 100° veri; deviazione a Nord solo con mare e margine adeguati",
      duration: "diretta: 4 kn 3 h 02 min · 5 kn 2 h 25 min · 6 kn 2 h 01 min",
      window: "Confrontare 08–11 e 12–15: onde occidentali ancora presenti in entrambe. Il pomeriggio non è automaticamente migliore; arrivo con luce e pontile verificato prima di lasciare Marettimo.",
      criticality: "Onda residua da NO sulla costa esposta di Marettimo e divergenza sull’altezza significativa.",
      uncertainty: "Alta sull’onda: WAM 1,3–1,7 m, GFS-Wave 1–1,5 m, MFWAM 0,6–1,1 m.",
      ratings: {
        departure: { tone: "caution", text: "Controllare l’onda da NO prima di uscire dal ridosso e avvicinarsi alla costa esposta." },
        passage: { tone: "caution", text: "O–NO/NNO 9–16 kn e onda fino a 1,7 m; evitare deviazioni esposte non necessarie." },
        arrival: { tone: "caution", text: "Verificare il pontile a Favignana: il settore Praia del gestore consultato è esposto al maestrale. Posti non confermati." }
      },
      operationalChecks: ["Altezza e direzione reale dell’onda sul lato NO di Marettimo.", "Divieti AMP e Miglio Blu: nessun ancoraggio senza verifica.", "Posto barca e istruzioni d’ingresso a Favignana, con luce per la manovra."],
      glance: { wind: "9–16 kn da O–NNO", windTone: "caution", sea: "0,6–1,7 m da O–NO", seaTone: "caution", sky: "Possibili rovesci deboli", skyIcon: "rain", skyTone: "caution" },
      plan: "Visita di Marettimo soltanto fin dove il mare resta semplice, poi trasferimento diretto verso Favignana per entrare con luce.",
      navigation: "La rotta verso Est mette il vento occidentale alle spalle; il comfort dipende però dall’onda residua, non solo dai nodi di vento locale.",
      overnight: "Porto di Favignana con pontile e condizioni notturne verificati. Boe meridionali solo con conferma AMP di operatività, disponibilità e notte.",
      overnightType: "Terza notte · porto",
      overnightStatus: "Disponibilità da confermare",
      alternative: "Saltare Punta Troia e andare diretti. Se anche la rotta diretta non offre margine, restare a Marettimo in posto confermato.",
      stops: [
        { moment: "Mattino · Marettimo", title: "Punta Troia solo se il mare lo consente", description: "La deviazione aggiunge circa 2,5–3 NM e porta sul lato più esposto.", check: "Onda da NO, distanza dalla costa, aree protette e tempo residuo." },
        { moment: "Arrivo · Favignana", title: "Porto prima della sera", description: "L’ingresso con luce protegge la gestione della flotta.", check: "Disponibilità, canale di chiamata, traffico traghetti e Avviso 20.15." }
      ],
      wind: "08–19: ECMWF 12–16 kn / raffiche 22 da NO (300–320°); GFS 9–15 kn (raffiche da ricontrollare) da O–NO (276–309°); ICON 12–16 kn / 25 da NNO (327–344°). 3–4 Bft; in calo nei modelli di domenica, con mare residuo.",
      sea: "Poco mosso/mosso, Douglas 3–4. WAM 1,3–1,7 m da NO (293–320°), GFS-Wave 1–1,5 m da ONO (295–300°), MFWAM 0,6–1,1 m da O (272–282°); periodo 5,1–6,4 s. GFS-Wave mare di vento 0,9–1,5 m, swell 0,1–0,7 m; MFWAM swell 0,6–0,9 m. Le componenti non si sommano aritmeticamente.",
      visibility: "ECMWF circa 6–42 km nei punti analizzati; verificare possibili rovesci e visibilità all’ingresso.",
      phenomena: "Pioggia debole in ECMWF/ICON (fino a circa 0,5 mm/h), GFS asciutto. Ensemble aggiornato non disponibile; non è un’assenza garantita di temporali locali.",
      air: "Circa 21–23°C, nuvolosità variabile.",
      water: "Temperatura superficiale modellata circa 24,5°C.",
      currents: "Modello oceanico circa 0,2–0,3 kn, direzione variabile; non usarlo per manovre costiere.",
      decision: "Controllare il mare da NO prima di uscire. La rotta diretta evita Punta Troia, ma resta subordinata alle condizioni reali e al riparo assegnato a Favignana.",
      sun: "Alba 07:14 · tramonto 18:40 · crepuscolo civile fino alle 19:07.",
      moon: "Luna nuova, illuminazione 0% · levata 06:57 · tramonto 18:19."
    },
    {
      date: "Domenica 11 ottobre",
      route: "Favignana → Marsala",
      distance: "circa 11,5–12,5 NM evitando la terra",
      course: "uscita a Est, costa orientale, giro di Punta Marsala e poi SE",
      duration: "4 kn: circa 3 h · 5 kn: circa 2 h 25 min · 6 kn: circa 2 h",
      window: "Partire prima delle 15:30 per avere margine. Alle 15:30, 5 nodi portano vicino alle 17:55 senza riserva; a 4 nodi si arriva dopo le 18:30.",
      criticality: "Orario di rientro e accesso a Marsala; direzione del vento non ancora risolta.",
      uncertainty: "Confronto ECMWF ancora mancante: il run corto più recente non copre queste ore. GFS/ICON concordano sul quadrante O–N, non sull’intensità precisa.",
      ratings: {
        departure: { tone: "caution", text: "Vento e onda generalmente contenuti, ma il bollettino ufficiale della giornata e l’accesso locale non sono ancora disponibili." },
        passage: { tone: "caution", text: "Meteo relativamente favorevole, ma le 15:30 non lasciano margine a 4–5 nodi." },
        arrival: { tone: "caution", text: "Ingresso a Marsala con Avvisi IIM e necessità di arrivare prima delle 18:00." }
      },
      operationalChecks: ["ETA della barca più lenta prima dell’ultimo bagno.", "Visibilità, traffico e condizioni sull’imboccatura di Marsala.", "Avvisi IIM, carburante e riserva di tempo per check-out."],
      glance: { wind: "6–12 kn da ONO–NNO", windTone: "calm", sea: "0,4–1 m, residuo occidentale", seaTone: "caution", sky: "Asciutto in GFS/ICON", skyIcon: "sun", skyTone: "good" },
      plan: "Ultima sosta a Favignana solo se non intacca il rientro. La rotta deve aggirare l’isola a Est e Punta Marsala: una linea diretta attraverserebbe terra.",
      navigation: "Con vento leggero la velocità a vela può ridursi: il calcolo dell’arrivo non deve presumere una prestazione che la barca non garantisce.",
      overnight: "Nessun pernottamento: Marsala entro le 18:00.",
      overnightType: "Rientro · porto di Marsala",
      overnightStatus: "Vincolo operativo",
      alternative: "Ridurre o eliminare la sosta balneare e partire prima. Se il meteo peggiora, entrare nella prima finestra utile.",
      stops: [
        { moment: "Mattino · lato scelto sul meteo", title: "Cala Rossa, Cala Azzurra o alternativa", description: "Sosta diurna, non promessa: dipende da mare, affollamento e regole AMP.", check: "Orario limite, fondo, traffico, divieti e possibilità di ripartire senza attesa." },
        { moment: "Rientro", title: "Punta Marsala e accesso al porto", description: "Due passaggi da affrontare con margine; non comprimere l’ETA per salvare l’ultima sosta.", check: "Visibilità, avvisi, traffico, carburante e orario del check-out." }
      ],
      wind: "10–18: GFS 6–10 kn (raffiche da ricontrollare) da ONO–NO (292–317°); ICON 8–12 kn / 18 da NNO–N (315–351°). 2–4 Bft, generalmente più debole di sabato. Nessun valore attribuito al nuovo run corto IFS oltre la sua validità.",
      sea: "Poco mosso, Douglas 3. GFS-Wave Hs 0,6–1 m da O–ONO (278–286°), periodo 5,4–6,2 s, swell 0,6–0,9 m; MFWAM 0,4–0,6 m da NO–NNO, periodo 3,8–4,7 s, swell 0,3–0,4 m. WAM più recente non copre la tratta di domenica.",
      visibility: "GFS circa 23–24 km, dato ICON non disponibile; da verificare con le osservazioni del giorno.",
      phenomena: "Nessun segnale condiviso di fenomeni intensi; probabilità ensemble puntuale non disponibile. Aggiornare con il bollettino a breve termine.",
      air: "Circa 22–24°C, nuvolosità variabile.",
      water: "Temperatura superficiale modellata circa 24,3–24,4°C.",
      currents: "Modello oceanico nel canale circa 0–0,4 kn, direzione variabile; presso Marsala fino a circa 0,6 kn. Non disponibile una misura locale di marea/corrente: verifica a bordo.",
      decision: "Fissare la partenza sulla barca più lenta e sul meteo reale. Se alle 15:30 non c’è margine credibile, il bagno finale si accorcia.",
      sun: "Alba 07:15 · tramonto 18:39 · crepuscolo civile fino alle 19:05.",
      moon: "Falce crescente, illuminazione 1% · levata 08:01 · tramonto 18:45."
    }
  ]
};

/*
 * Briefing pubblico Meteo & Passage Plan. Nessun dato personale va inserito
 * in questo file. Vento e onde indicano la direzione di provenienza.
 */
window.PASSAGE_PLAN_DATA = {
  updatedAt: "5 ottobre 2026 · 18:50 CEST (UTC+2)",
  phase: "Briefing per la call skipper · T−3",
  confidence: "Alta incertezza sui temporali di venerdì e sul vento di sabato · ECMWF corto non copre il rientro di domenica",
  status: "Previsione multi-modello disponibile · non è ancora il via libera dello skipper",
  publishedAt: "5 ottobre 2026 · edizione serale per la call skipper delle 20:00",
  validFrom: "Periodo analizzato: 8–11 ottobre 2026 · orari locali Europe/Rome (CEST, UTC+2)",
  validUntil: "Edizione per la call del 5 ottobre alle 20:00; riesaminare il 7 e prima di ogni tratta. Osservazioni reali, avvisi e bollettini più recenti prevalgono sempre.",
  nextUpdateAt: "7 ottobre e prima di ogni partenza · nuovi controlli da eseguire",
  nextUpdateReason: "Il controllo serale richiesto per la call è stato eseguito. Non sono configurati aggiornamenti continuativi. Ricontrollare temporali e rotazioni del 9, mare occidentale del 10, notte a Levanzo e accessi ai porti.",
  dataMode: "operational",
  weatherNoticeTitle: "La previsione copre il viaggio, ma manca ancora la conferma ufficiale a breve termine.",
  weatherNoticeText: "Nuovo confronto ECMWF, GFS e ICON per l’atmosfera; WAM, GFS-Wave e MFWAM per le onde. Rispetto al mattino venerdì ha meno onda, ma resta il segnale temporalesco ECMWF; sabato il suo scenario è più sostenuto. Il run corto ECMWF non copre le ore del rientro domenicale: valori precedenti non sono attribuiti alla nuova emissione.",
  summary: "Due partenze da Marsala: giovedì pomeriggio via Levanzo e venerdì mattina direttamente verso Marettimo. Il confronto serale riduce l’onda del venerdì rispetto al mattino, ma ECMWF mantiene temporali all’alba e verso mezzogiorno lungo il canale. Sabato ECMWF prevede più vento e mare di GFS/ICON: non va scelto soltanto lo scenario più debole. Marettimo venerdì e Favignana sabato restano obiettivi subordinati ad accesso, condizioni notturne e posti confermati. Nessun campo boe è già acquisito come rifugio. Domenica anticipare il rientro sulla barca più lenta, entro le 18:00 a Marsala.",
  decisiveFactors: [
    "Giovedì 8 alle 15:00: ECMWF 15–16 kn da SSE–S, GFS 19–20 e ICON circa 13–14; raffiche IFS/ICON fino a 23 nella fascia 12–21. A 4 kn l’arrivo a Levanzo può coincidere con il tramonto delle 18:43: serve margine di luce e riparo per la notte.",
    "Venerdì l’onda prevista è più bassa del mattino, ma ECMWF segnala temporali circa 03–06 e una nuova fase verso le 12 nel canale; GFS/ICON non li confermano. Sabato WAM sale fino a 1,9 m e IFS fino a 21 kn / raffiche 29: rivalutare attraversamento e pontile a Favignana.",
    "Domenica 11: Favignana–Marsala richiede circa 2 h 25 min a 5 nodi. Partire alle 15:30 lascia quasi zero margine; a 4 nodi non consente l’arrivo entro le 18:00."
  ],
  callBriefing: {
    title: "Due partenze, sempre da Marsala",
    introduction: "Giovedì 8 nel pomeriggio e venerdì 9 al mattino: ciascun gruppo ha il proprio briefing da Marsala. Nuovo controllo il 5 ottobre alle 18:50 per la call delle 20:00. Obiettivo comune: dentro il porto di Marettimo venerdì sera, se consentito. Venerdì ha meno onda rispetto al confronto del mattino, non un via libera: rimangono temporali possibili e verifica dell’ingresso.",
    options: [
      {
        title: "Giovedì 8 · partenza intorno alle 15:00", route: "Marsala → Levanzo · circa 14–16 NM", course: "NNO, circa 338° veri · passaggio a Est di Favignana con adeguato largo", duration: "4 kn: 3 h 30–4 h · 5 kn: 2 h 50–3 h 15 · 6 kn: 2 h 20–2 h 40",
        ratings: { departure: { tone: "caution", text: "Alle 15 ECMWF 15–16 kn, GFS 19–20, ICON 13–14 da SSE–S; verificare vento e onda reali all’imboccatura di Marsala." }, passage: { tone: "caution", text: "Mare corto da SSE–S, Hs circa 0,6–1,2 m; andatura portante, comfort e velocità della barca più lenta da valutare." }, arrival: { tone: "unknown", text: "Approdo non scelto: serve un riparo consentito anche con la rotazione a O–NO di venerdì, non soltanto un bel tramonto." } },
        wind: "12–21: ECMWF 12–17 kn / raffiche 23, GFS 14–20 (raffiche escluse per incoerenze), ICON 7–14 / 20; direzioni circa 141–185° (SE–S). ICON non indica più la marcata rotazione serale del confronto precedente.", sea: "WAM Hs 0,6–0,9 m, GFS-Wave 0,7–1,2 m, MFWAM 0,6–0,9 m; da SSE–S (147–169°), periodo 3,3–4,9 s. Prevale il mare di vento; Hs non è l’onda massima.", window: "Alle 15:00, a 4 kn, arrivo indicativo 18:30–19:00 contro il tramonto delle 18:43. Valutare 13:30–14:00 soltanto se charter e imbarco lo consentono; non è un nuovo orario confermato.", decision: "Confermare prima della partenza la notte e un’alternativa. Venerdì questo gruppo riparte da Levanzo: la sua traversata è nella scheda giornaliera qui sotto.", alternative: "Restare a Marsala o accorciare sul porto di Favignana con posto e accesso confermati. Cala Fredda/Minnola/Dogana non sono una soluzione automatica con vento da S–SE."
      },
      {
        title: "Venerdì 9 · partenza al mattino", route: "Da Marsala · scenario diretto per Marettimo, senza Levanzo · circa 22–24 NM", course: "NO, circa 300° veri · percorso a Sud/Ovest di Favignana da verificare su carta", duration: "4 kn: 5 h 30–6 h · 5 kn: 4 h 25–4 h 50 · 6 kn: 3 h 40–4 h",
        ratings: { departure: { tone: "caution", text: "06–12, Marsala offshore: ECMWF 3–7 kn / raffiche 15, GFS 9–10, ICON 8–11 / 16. ECMWF vede fenomeni anche alle 06: non basta il vento debole per decidere." }, passage: { tone: "adverse", text: "ECMWF mantiene un segnale temporalesco nel canale verso le 12; ICON indica ONO–NO fino a 19 kn / raffiche 26. Vento quasi contrario e visibilità da controllare." }, arrival: { tone: "unknown", text: "Marettimo è l’obiettivo comune, ma accesso e posto dentro il porto non sono confermati. Il mare può crescere ancora durante la notte." } },
        wind: "08–16: ECMWF 1–8 kn / raffiche 25, direzione molto variabile presso i fenomeni; GFS 3–10 kn da SE verso NO (raffiche escluse); ICON 9–19 / 26 da ONO–NO (291–310°). Divergenza rilevante, non una media fra scenari.", sea: "08–16: WAM Hs 0,5–0,8 m, GFS-Wave 0,3–0,5 m, MFWAM 0,4–0,8 m. Periodo 3,4–5,2 s, residuo meridionale e nuova onda O–NO. Più contenuto del mattino; non è un dato dell’imboccatura né elimina i temporali.", window: "Confrontare 07:30–08:30 e 09–10: una traversata di 4–6 ore può incontrare la nuova fase ECMWF verso le 12. Fenomeni anche 03–06, prima della piena luce delle 07:13. Non dichiarare una finestra favorevole senza radar, bollettino e osservazioni; valutare anche il mare successivo.", decision: "Puntare a Marettimo senza passare da Levanzo, solo dopo verifica della traversata e conferma del porto. Stabilire nella call un orario limite per rinunciare: l’appuntamento non impone di entrare con condizioni inadeguate.", alternative: "Restare a Marsala; oppure accorciare sul porto di Favignana, circa 11–13 NM, soltanto con finestra, accesso e posto verificati. Passare da Levanzo aggiunge 14–16 NM più altre circa 13 NM per Marettimo: non è la scorciatoia del venerdì."
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
        forecast: "Venerdì 16–23 sul lato est offshore: ECMWF 7–10 kn / raffiche 16, GFS 3–8, ICON 11–17 / 23, da O–NO. WAM Hs 0,8–0,9 m, GFS-Wave 0,5–0,9, MFWAM 0,8–1,2; 4,3–5,5 s. Nella notte fino alle 06 WAM cresce a 1,2 m e MFWAM a 1,5: verificare anche la permanenza, non solo l’arrivo.",
        check: "Chiedere al gestore banchina esatta e posti per tutte le barche, pescaggi ammessi, risacca reale su accesso e pontili, raffiche sottovento, traffico traghetti ed eventuali lavori o restrizioni attuali. Non è disponibile qui un rilievo aggiornato dell’imboccatura.",
        alternative: "Chi parte da Marsala può restare in base. Chi è a Levanzo deve avere prima un riparo consentito per l’attesa o un altro porto con posto e accesso verificati. Non raggiungere Marettimo soltanto per rispettare l’appuntamento.",
        sourceLabel: "Marettimo Marine · contatti del gestore", sourceUrl: "https://www.marettimomarine.it/contatti-marettimo-marine-egadi/"
      },
      {
        title: "Sabato 10 · porto di Favignana",
        rating: { tone: "caution", text: "Mare da O–NO · verificare il pontile assegnato e la risacca notturna." },
        exposure: "Il gestore Marina di Favignana dichiara il proprio settore Praia esposto ai venti settentrionali e alla traversia del maestrale. Non estendiamo questa indicazione a ogni banchina del porto: sapere soltanto «siamo dentro» non descrive il riparo effettivo.",
        forecast: "Sabato 16–23 sul lato nord offshore: ECMWF 11–21 kn / raffiche 29 da ONO, GFS 9–13, ICON 1–9 / 14. WAM Hs 1,2–1,6 m, GFS-Wave 0,8–0,9, MFWAM 0,8–0,9; periodo 5–5,6 s. È il confronto più divergente sul vento: verificare pontile e notte sullo scenario sostenuto, senza dedurre la risacca dalla griglia.",
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
  sourceNote: "Dati nuovamente consultati il 5 ottobre alle 18:50 CEST su otto punti richiesti in mare. IFS/GFS run 05/10 06 UTC, ICON 05/10 12 UTC; onde WAM/GFS-Wave 05/10 06 UTC, MFWAM 05/10 00 UTC. Il run corto IFS termina domenica alle 09 CEST e WAM alle 11: non coprono il rientro 14–18; per quelle ore si usano GFS/ICON e GFS-Wave/MFWAM. Alcuni punti ricadono nella stessa cella: otto richieste non sono otto osservazioni indipendenti. Vento e onde indicano provenienza; corrente indica destinazione. Hs non è l’onda massima. Le griglie offshore non risolvono porti e calette. Raffiche GFS ancora inferiori al medio in 187 campioni punto/ora: escluse dal confronto, non corrette artificialmente.",
  sources: [
    { label: "ECMWF IFS · dati interrogati", url: "https://api.open-meteo.com/v1/forecast?latitude=37.96&longitude=12.20&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&wind_speed_unit=kn&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=ecmwf_ifs&cell_selection=sea", scope: "vento, raffiche e pioggia lungo l’area", checkedAt: "5 ottobre · 18:50 CEST", product: "Open-Meteo Forecast API", model: "ECMWF IFS HRES · run 05/10 06 UTC · circa 9 km", availability: "ultimo run corto fino all’11 ottobre alle 09 CEST; escluso dalle ore della tratta domenicale" },
    { label: "NOAA GFS · dati interrogati", url: "https://api.open-meteo.com/v1/forecast?latitude=37.96&longitude=12.20&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&wind_speed_unit=kn&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=ncep_gfs_global&cell_selection=sea", scope: "secondo scenario atmosferico indipendente", checkedAt: "5 ottobre · 18:50 CEST", product: "Open-Meteo Forecast API", model: "NOAA GFS · run 05/10 06 UTC · circa 13 km", availability: "orario · 8–11 ottobre" },
    { label: "DWD ICON · dati interrogati", url: "https://api.open-meteo.com/v1/forecast?latitude=37.96&longitude=12.20&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&wind_speed_unit=kn&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=icon_global&cell_selection=sea", scope: "terzo scenario atmosferico indipendente", checkedAt: "5 ottobre · 18:50 CEST", product: "Open-Meteo Forecast API", model: "DWD ICON globale · run 05/10 12 UTC · circa 11 km", availability: "orario · 8–11 ottobre" },
    { label: "Open-Meteo Marine · confronto onde", url: "https://marine-api.open-meteo.com/v1/marine?latitude=37.96&longitude=12.20&hourly=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=ecmwf_wam025,ncep_gfswave025,meteofrance_wave&cell_selection=sea", scope: "altezza significativa, direzione, periodo e componenti quando disponibili", checkedAt: "5 ottobre · 18:50 CEST", product: "Marine Weather API", model: "WAM 05/10 06 UTC · GFS-Wave 05/10 06 UTC · MFWAM 05/10 00 UTC", availability: "WAM fino all’11 alle 11 CEST; non copre il rientro pomeridiano · griglie offshore" },
    { label: "Emissione e copertura dei modelli", url: "https://open-meteo.com/en/docs/model-updates", scope: "metadati di ciascun modello, distinti dall’ora di consultazione", checkedAt: "5 ottobre · 18:50 CEST", product: "static/meta.json dei modelli", model: "latest run e data_end_time", availability: "nessun valore fuori dal run corto ECMWF attribuito a quell’emissione" },
    { label: "Correnti e temperatura del mare", url: "https://open-meteo.com/en/docs/marine-weather-api", scope: "Marsala offshore e canale Levanzo–Marettimo; non imboccature", checkedAt: "5 ottobre · 18:50 CEST", product: "Marine API · SST e corrente oceanica", model: "prodotti Météo-France · emissione non verificata nell’estrazione", availability: "8–11 ottobre; circa 8 km · velocità ricevuta in km/h e convertita in nodi" },
    { label: "Aeronautica Militare · Meteomar", url: "https://www.meteoam.it/it/meteomar", scope: "Stretto di Sicilia e Tirreno Meridionale Ovest; da rileggere prima di ogni tratta", checkedAt: "5 ottobre · emissione 14:00 CEST, consultazione 18:52", product: "Meteomar", model: "bollettino ufficiale", availability: "situazione attuale: S4 nello Stretto, S4 con tendenza S5/temporali nel Tirreno meridionale ovest; non copre l’8–11" },
    { label: "ISPRA · Rete Ondametrica", url: "https://www.mareografico.it/it/stazioni.html", scope: "osservazione di riferimento più vicina: boa Mazara del Vallo/Capo Granitola", checkedAt: "4 ottobre · 20:30 CEST", product: "RON", model: "osservazione, non previsione", availability: "onda e corrente non disponibili nell’ultima misura; non rappresenta Marsala/Egadi" },
    { label: "Istituto Idrografico della Marina · Avvisi", url: "https://www.marina.difesa.it/noi-siamo-la-marina/pilastro-logistico/scientifici/idrografico/Pagine/Avvisi.aspx", scope: "relitto/area vietata a Marsala e limiti di ancoraggio a Favignana", checkedAt: "fascicolo 20/2026 del 30 settembre", product: "Avvisi ai Naviganti · carte 258, 259 e 260", model: "fonte ufficiale" },
    { label: "Area Marina Protetta · Disciplinare 2026", url: "https://www.ampisoleegadi.it/files/Normativa/%20disciplinare_integrativo_2026_mase.pdf", scope: "zonazione, autorizzazioni, fondali sensibili, ancoraggi e campi boe", checkedAt: "5 ottobre 2026 · valido fino al 31 dicembre", product: "Disciplinare integrativo 2026", model: "fonte ufficiale locale", availability: "campi stagionali e disponibilità reale da confermare direttamente" },
    { label: "US Naval Observatory · astronomia", url: "https://aa.usno.navy.mil/data/api", scope: "alba, tramonto, crepuscolo e luna · 37,9 N / 12,4 E", checkedAt: "4 ottobre 2026", product: "Sun and Moon Data for One Day", model: "calcolo astronomico · Europe/Rome UTC+2" },
    { label: "Marettimo Marine · gestore", url: "https://www.marettimomarine.it/contatti-marettimo-marine-egadi/", scope: "contatto per posto, accesso e condizioni di Scalo Nuovo", checkedAt: "5 ottobre · 08:15 CEST · scheda indicizzata", product: "pagina del gestore", model: "nessuna misura meteo", availability: "nessuna risposta diretta né conferma di agibilità/posti acquisita" },
    { label: "Marina di Favignana · gestore", url: "https://favonianaservice.com/postibarca.html", scope: "settore Praia dichiarato esposto a venti settentrionali e traversia del maestrale", checkedAt: "5 ottobre · 18:49 CEST", product: "descrizione del gestore", model: "esposizione locale, non previsione", availability: "non descrive tutte le banchine e non conferma il posto assegnato" },
    { label: "AMP Egadi · campi boe", url: "https://www.ampisoleegadi.it/index.php/campi-boe/", scope: "campi stagionali e autorizzazioni, da integrare con disciplinare 2026", checkedAt: "5 ottobre · 18:49 CEST", product: "informazione ufficiale locale", model: "non misura vento/onda", availability: "installazione, disponibilità e pernottamento di ottobre da confermare" },
    { label: "Protezione Civile · allertamento meteo-idro", url: "https://rischi.protezionecivile.gov.it/it/meteo-idro/allertamento/", scope: "vigilanza, criticità e radar ufficiali; non previsione puntuale in porto", checkedAt: "5 ottobre · consultazione 18:52 CEST", product: "pagina di allertamento · bollettino 05/10 ore 14:17", model: "fonte ufficiale, non modello deterministico", availability: "periodo corrente, non copre l’intero viaggio 8–11; allerta locale da ricontrollare prima di ogni tratta" }
  ],
  modelComparison: [
    { parameter: "Vento · 8 ottobre alle 15", scenarios: "Alle 15: IFS 15–16 kn, GFS 19–20, ICON 13–14 da SSE–S; raffiche IFS/ICON fino a 23 nella fascia 12–21", divergence: "alta sull’intensità", decisionImpact: "pianificare sullo scenario sostenuto e garantire riparo e margine di luce" },
    { parameter: "Uscita da Marsala · 9 ottobre al mattino", scenarios: "Uscita 06–12: IFS 3–7 kn, GFS 9–10, ICON 8–11. Nel canale IFS segnala temporali circa 03–06 e verso le 12; ICON ONO–NO fino a 19 kn / raffiche 26", divergence: "alta tra uscita e mare attraversato, non solo tra modelli", decisionImpact: "non usare il solo dato del porto per confermare una traversata di 4–6 ore" },
    { parameter: "Vento/fenomeni · 9 ottobre", scenarios: "Venerdì 12–21: IFS 1–10 kn con temporali verso le 12; GFS 3–10 asciutto; ICON 9–17 da ONO–NO, raffiche 23", divergence: "alta su fenomeni, intensità e orario della rotazione", decisionImpact: "partire venerdì non è automaticamente meglio; Marettimo resta subordinata alla verifica reale" },
    { parameter: "Onde · 9–10 ottobre", scenarios: "Venerdì 12–21: WAM 0,6–0,9 m, GFS-Wave 0,3–0,8, MFWAM 0,6–1. Sabato 08–19: WAM 1,1–1,9, GFS-Wave 0,6–1,1, MFWAM 0,9–1,5 m. IFS sabato fino a 21 kn / raffiche 29, ICON molto più debole", divergence: "alta, senza mediare via lo scenario WAM", decisionImpact: "meno onda venerdì rispetto al mattino, ma sabato lo scenario IFS/WAM richiede attenzione; verificare pontile e notte a Favignana" },
    { parameter: "Rientro · 11 ottobre", scenarios: "Domenica 10–18: GFS 8–14 kn ONO, ICON 2–8 da SE verso O. GFS-Wave 0,7–0,9 m, MFWAM 0,3–0,6; ultimi IFS/WAM corti non coprono le ore di rientro", divergence: "onda non identica e confronto ECMWF ancora mancante", decisionImpact: "preservare il margine sull’orario e rileggere il prossimo run lungo" }
  ],
  climateOutlook: {
    title: "Aria, acqua e luce del viaggio",
    disclaimer: "Questi sono valori dei modelli e calcoli astronomici, non climatologia né misure nelle calette. Il dettaglio operativo è nelle schede.",
    items: [
      { icon: "air", label: "Aria", value: "19–27°C", detail: "intervallo indicativo nei punti e nelle fasce analizzate" },
      { icon: "water", label: "Mare", value: "24,5–25,1°C", detail: "temperatura superficiale modellata, non misura in rada" },
      { icon: "wind", label: "Vento", value: "variabile", detail: "marcata divergenza soprattutto venerdì e sabato" },
      { icon: "rain", label: "Instabilità", value: "venerdì", detail: "segnale ECMWF circa 03–06 e di nuovo verso le 12 nel canale" },
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
      uncertainty: "Differenza d’intensità: alle 15 ECMWF 15–16 kn, GFS 19–20, ICON 13–14; riparo e luce restano decisivi.",
      ratings: {
        departure: { tone: "caution", text: "Alle 15 ECMWF 15–16 kn, GFS 19–20, ICON 13–14 da SSE–S; osservazioni reali all’imboccatura e avvisi prima di partire." },
        passage: { tone: "caution", text: "Mare corto da SSE–S, Hs 0,6–1,2 m; andatura portante ma comfort e velocità reale da valutare." },
        arrival: { tone: "unknown", text: "Non è stato scelto un approdo preciso; rada e boe di ottobre non sono confermate." }
      },
      operationalChecks: ["Meteomar/NETTUNO e osservazioni reali di Marsala prima di mollare gli ormeggi.", "Avvisi IIM su relitto e area vietata presso Marsala.", "Ridosso, fondale, autorizzazione AMP e piano di uscita dalla rada se il vento ruota."],
      glance: { wind: "SSE–S · 13–20 kn alle 15", windTone: "caution", sea: "0,6–1,2 m da SSE–S", seaTone: "caution", sky: "Asciutto nei 3 modelli", skyIcon: "sun", skyTone: "good" },
      plan: "Questa scheda riguarda le barche del giovedì. Cambusa già a bordo, rotta a Est di Favignana e notte a Levanzo soltanto con riparo consentito e margine di luce. La linea geometrica non comprende tutto il largo e le manovre.",
      navigation: "Rotta verso NNO con vento/onda da S–SSE: andatura portante. La scelta del riparo deve considerare la successiva rotazione occidentale e la notte, non solo questo tratto.",
      overnight: "Rada sul lato realmente ridossato soltanto dopo verifica; altrimenti porto/posto confermato o un’alternativa più documentata.",
      overnightType: "Prima notte · scelta aperta",
      overnightStatus: "Da verificare sul posto",
      alternative: "Restare a Marsala oppure accorciare su Favignana con posto già confermato. La vicinanza non rende un approdo automaticamente sicuro.",
      stops: [
        { moment: "Tramonto · lato O/NO", title: "Cala Tramontana o scenario del Genovese", description: "Luce favorevole verso Ovest, ma esposizione maggiore con onda da Ovest o Nord.", check: "Zonazione AMP, fondo, spazio, onda residua, traffico e possibilità di uscire senza ritardi." },
        { moment: "Alba · lato E/SE", title: "Cala Fredda, Minnola o Dogana", description: "Lato adatto alla prima luce; Cala Dogana è anche approdo di linea.", check: "Non pernottare per il solo valore panoramico: servono permesso, ridosso e gestione del traffico." }
      ],
      wind: "12–21: ECMWF 12–17 kn / raffiche 23 da SSE–S (149–175°); GFS 14–20 da SE–S (raffiche escluse); ICON 7–14 / 20 da SSE–S (159–185°). Circa 3–5 Bft secondo modello/ora; successiva rotazione occidentale venerdì.",
      sea: "Poco mosso, Douglas 3, vicino al limite dello stato mosso nello scenario più alto. WAM Hs 0,6–0,9 m, GFS-Wave 0,7–1,2, MFWAM 0,6–0,9; provenienza SSE–S (147–169°), periodo 3,3–4,9 s. GFS-Wave quasi tutto mare di vento; MFWAM swell 0,1–0,5 m. Hs non è l’onda massima; componenti non sommabili.",
      visibility: "ECMWF circa 18–36 km; GFS circa 24 km nei punti campionati; ICON non disponibile. La visibilità all’imboccatura richiede verifica locale.",
      phenomena: "Scenario asciutto nei tre deterministici; probabilità ensemble puntuale non disponibile in questa estrazione. Lo sviluppo convettivo reale va comunque osservato.",
      air: "Circa 23–27°C nelle fasce analizzate; nuvolosità diversa fra modelli, tipo di nube non risolto.",
      water: "Temperatura superficiale modellata circa 24,6–25°C, consultata alle 18:50; non è una misura nella cala.",
      currents: "Modello oceanico circa 0,1–0,6 kn presso Marsala e 0,3–1,2 nel canale, direzione variabile con componente N–NE. Griglia circa 8 km, emissione non verificata; velocità ricevuta km/h e convertita in nodi. Non descrive marea/corrente d’imboccatura: verifica a bordo.",
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
      window: "Confrontare 08–10 e 13–14 dopo il controllo di radar e mare reale: IFS segnala fenomeni all’alba e una nuova fase verso le 12 nel canale. L’onda del venerdì è più contenuta del mattino, ma la notte può crescere. Nessuna finestra acquisita.",
      criticality: "Temporali possibili nel canale, vento quasi contrario e condizioni notturne di Marettimo non confermate.",
      uncertainty: "Alta sui fenomeni: IFS segnala temporali, GFS/ICON no; onde 12–21 circa 0,3–1 m fra i prodotti, meno del mattino.",
      ratings: {
        departure: { tone: "adverse", text: "IFS segnala temporali circa 03–06 e verso le 12 nel canale, assenti negli altri deterministici: rinvio o alternativa se radar e osservazioni confermano i fenomeni." },
        passage: { tone: "adverse", text: "Vento variabile nello scenario temporalesco IFS; ICON ONO–NO fino a 17 kn / raffiche 23 quasi contrario sulla rotta Ovest. Rivalutare prima di impegnare il canale." },
        arrival: { tone: "unknown", text: "Obiettivo dentro Scalo Nuovo venerdì sera; accesso, posti e risacca notturna non sono confermati." }
      },
      operationalChecks: ["Radar e fulminazioni, osservazione delle nubi e Meteomar prima della traversata.", "Posto, canale di chiamata e istruzioni del porto di Marettimo.", "Se modelli e osservazioni non convergono, rinunciare a Marettimo prima di impegnare il canale."],
      glance: { wind: "Variabile / ONO–NO · 1–17 kn (12–21)", windTone: "caution", sea: "0,3–1 m fra i modelli", seaTone: "caution", sky: "Temporali IFS all’alba e verso le 12", skyIcon: "rain", skyTone: "caution" },
      plan: "Questa tratta è per chi ha lasciato Marsala giovedì. Chi parte venerdì usa la scheda Marsala → Marettimo sopra. Tutti puntano al porto venerdì sera, ma la traversata può essere rinviata o annullata.",
      navigation: "ICON/GFS ruotano sul quadrante occidentale; ECMWF è più variabile vicino ai fenomeni. Sulla rotta 267° vento da O–NO può imporre bolina o risultare quasi contrario. Nessuna prestazione a vela è garantita.",
      overnight: "Dentro Marettimo solo con ingresso, posto e notte verificati. Venerdì 16–23 Hs offshore circa 0,5–1,2 m fra i prodotti; fino alle 06 di sabato MFWAM sale a 1,5 m. Non è la risacca in porto.",
      overnightType: "Seconda notte · porto",
      overnightStatus: "Disponibilità da confermare",
      alternative: "Restare in un riparo legale a Levanzo, dirigere su Favignana con posto confermato o rientrare a Marsala. Nessuna alternativa è automatica.",
      stops: [
        { moment: "Prima della traversata", title: "Cala Fredda o Cala Minnola", description: "Eventuale sosta breve soltanto se non sottrae margine alla decisione meteo.", check: "Temporali, rotazione del vento, ridosso e orario limite per rinunciare." },
        { moment: "Arrivo", title: "Scalo Nuovo di Marettimo", description: "Approdo con traffico di linea e spazi limitati: l’arrivo va coordinato.", check: "Posto barca, istruzioni locali, vento sull’imboccatura, traghetti e visibilità." }
      ],
      wind: "12–21: ECMWF 1–10 kn / raffiche 19, direzione variabile; GFS 3–10 da SO–NO (raffiche escluse); ICON 9–17 / 23 da ONO–NO (292–311°). Circa 1–4 Bft; il valore medio basso non esclude raffiche convettive.",
      sea: "12–21: WAM Hs 0,6–0,9 m da O–ONO, GFS-Wave 0,3–0,8 da S verso NO, MFWAM 0,6–1 da O–NO. Periodo 3,5–5,9 s. GFS-Wave mare di vento 0–0,6 m e swell 0,2–0,6; MFWAM swell 0,4–0,8. Meno onda del mattino, ma possibile sovrapposizione di residuo meridionale e mare occidentale.",
      visibility: "Può calare rapidamente sotto un rovescio o temporale: la griglia non descrive il bordo della cella.",
      phenomena: "IFS: segnali temporaleschi circa 03–06 e una nuova fase alle 12 sui punti Levanzo/canale/Marettimo, pioggia oraria fino a 2,2 mm nei punti analizzati. GFS e ICON asciutti. Non è un orario esatto della cella né una probabilità: ensemble recente non acquisito, verificare radar/fulminazioni.",
      air: "Circa 19–25°C; nuvolosità variabile e possibili nubi convettive in IFS.",
      water: "Temperatura superficiale modellata circa 24,6–25,1°C.",
      currents: "Modello oceanico circa 0,2–0,7 kn nel canale, verso N–NE poi E–SE; presso Marsala circa 0,1–0,5 kn. Emissione non verificata, griglia 8 km: non usare per rotta costiera, marea o ingresso.",
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
      criticality: "Sabato IFS/WAM più sostenuti di ICON/GFS; onda occidentale, costa NO di Marettimo e pontile di Favignana da rivalutare.",
      uncertainty: "Alta: IFS fino a 21 kn / raffiche 29 contro ICON 2–10; WAM 1,1–1,9 m, GFS-Wave 0,6–1,1, MFWAM 0,9–1,5.",
      ratings: {
        departure: { tone: "caution", text: "Controllare l’onda da NO prima di uscire dal ridosso e avvicinarsi alla costa esposta." },
        passage: { tone: "caution", text: "IFS O–ONO fino a 21 kn / raffiche 29 e WAM fino a 1,9 m; GFS/ICON più deboli. Evitare deviazioni esposte non necessarie." },
        arrival: { tone: "caution", text: "Verificare il pontile a Favignana: il settore Praia del gestore consultato è esposto al maestrale. Posti non confermati." }
      },
      operationalChecks: ["Altezza e direzione reale dell’onda sul lato NO di Marettimo.", "Divieti AMP e Miglio Blu: nessun ancoraggio senza verifica.", "Posto barca e istruzioni d’ingresso a Favignana, con luce per la manovra."],
      glance: { wind: "O–NO · 2–21 kn fra i modelli", windTone: "caution", sea: "0,6–1,9 m da O–NO", seaTone: "caution", sky: "Possibili rovesci deboli", skyIcon: "rain", skyTone: "caution" },
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
      wind: "08–19: ECMWF 13–21 kn / raffiche 29 da OSO–ONO (251–293°), GFS 10–14 da ONO–NO (raffiche escluse), ICON 2–10 / 14 da ONO–NNO (288–336°). Circa 1–5 Bft secondo modello, forte divergenza: non scegliere automaticamente il dato più debole.",
      sea: "Douglas 3–4: WAM Hs 1,1–1,9 m da O–ONO (276–287°), GFS-Wave 0,6–1,1 da ONO–NO (295–323°), MFWAM 0,9–1,5 da ONO–NO; periodo 5–6,4 s. GFS-Wave mare di vento 0,5–1,1 e swell 0,1–0,5; MFWAM swell 0,6–1,2 m. Le componenti non si sommano aritmeticamente.",
      visibility: "ECMWF circa 11–42 km nelle ore 08–19, poi possibile riduzione verso sera; GFS circa 24 km, ICON non disponibile. Verifica reale sull’ingresso.",
      phenomena: "Pioggia debole in ECMWF/ICON (fino a circa 0,5 mm/h), GFS asciutto. Ensemble aggiornato non disponibile; non è un’assenza garantita di temporali locali.",
      air: "Circa 22–25°C, nuvolosità variabile.",
      water: "Temperatura superficiale modellata circa 24,5–24,9°C.",
      currents: "Modello oceanico circa 0,2–0,7 kn nel canale, componente NE–SE; presso Marsala fino a 0,5 kn. Emissione non verificata: non usarlo per manovre costiere.",
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
      uncertainty: "IFS corto valido fino alle 09 CEST e WAM fino alle 11, non per il rientro pomeridiano. GFS 8–14 kn ONO; ICON 2–8 da SE verso O: direzione/intensità ancora divergenti.",
      ratings: {
        departure: { tone: "caution", text: "Vento e onda generalmente contenuti, ma il bollettino ufficiale della giornata e l’accesso locale non sono ancora disponibili." },
        passage: { tone: "caution", text: "Meteo relativamente favorevole, ma le 15:30 non lasciano margine a 4–5 nodi." },
        arrival: { tone: "caution", text: "Ingresso a Marsala con Avvisi IIM e necessità di arrivare prima delle 18:00." }
      },
      operationalChecks: ["ETA della barca più lenta prima dell’ultimo bagno.", "Visibilità, traffico e condizioni sull’imboccatura di Marsala.", "Avvisi IIM, carburante e riserva di tempo per check-out."],
      glance: { wind: "GFS 8–14 kn ONO · ICON 2–8 variabile", windTone: "calm", sea: "0,3–0,9 m fra GFS-Wave/MFWAM", seaTone: "caution", sky: "Asciutto / pioggia debole GFS", skyIcon: "sun", skyTone: "caution" },
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
      wind: "10–18: GFS 8–14 kn da ONO (283–298°), raffiche escluse per incoerenze; ICON 2–8 kn / 11, da SE verso SO–O (132–280°). Circa 1–4 Bft. IFS corto non valido per queste ore: nessuna attribuzione al nuovo run.",
      sea: "Poco mosso, Douglas 3: GFS-Wave Hs 0,7–0,9 m da O–ONO (283–293°), periodo 5–5,3 s; MFWAM 0,3–0,6 da NO (322–327°), 4,3–4,8 s, swell 0,3–0,5 m. WAM corto non copre il rientro pomeridiano.",
      visibility: "GFS circa 23–24 km, dato ICON non disponibile; da verificare con le osservazioni del giorno.",
      phenomena: "GFS segnala solo pioggia debole fino a 0,1 mm/h al mattino; ICON asciutto. Nessun segnale intenso condiviso, ma ensemble recente non acquisito e bollettino operativo da aggiornare.",
      air: "Circa 22–24°C, nuvolosità variabile.",
      water: "Temperatura superficiale modellata circa 24,6–24,8°C.",
      currents: "Modello oceanico circa 0–0,4 kn nel canale, direzione variabile; presso Marsala fino a circa 0,6 kn. Emissione non verificata e nessuna misura locale di marea/corrente: verifica a bordo.",
      decision: "Fissare la partenza sulla barca più lenta e sul meteo reale. Se alle 15:30 non c’è margine credibile, il bagno finale si accorcia.",
      sun: "Alba 07:15 · tramonto 18:39 · crepuscolo civile fino alle 19:05.",
      moon: "Falce crescente, illuminazione 1% · levata 08:01 · tramonto 18:45."
    }
  ]
};

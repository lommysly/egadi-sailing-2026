/*
 * Briefing pubblico Meteo & Passage Plan. Nessun dato personale va inserito
 * in questo file. Vento e onde indicano la direzione di provenienza.
 */
window.PASSAGE_PLAN_DATA = {
  updatedAt: "4 ottobre 2026 · 21:25 CEST (UTC+2)",
  phase: "Briefing operativo preliminare · T−4",
  confidence: "Media-bassa venerdì 9 · media negli altri giorni · bollettini ufficiali ancora da acquisire",
  status: "Previsione multi-modello disponibile · non è ancora il via libera dello skipper",
  publishedAt: "4 ottobre 2026 · confronto degli ultimi run disponibili",
  validFrom: "Periodo analizzato: 8–11 ottobre 2026 · orari locali Europe/Rome (CEST, UTC+2)",
  validUntil: "Valido come quadro preliminare fino al controllo del 6 ottobre; osservazioni reali, avvisi e bollettini più recenti prevalgono sempre.",
  nextUpdateAt: "6 ottobre, sera · poi il 7 e prima di ogni partenza",
  nextUpdateReason: "Non è un aggiornamento automatico. Ricontrollare soprattutto instabilità e salto del vento del 9, onda residua da NO del 10, direzione del vento al rientro e avvisi di porto. Un rinforzo, una rotazione o un avviso ufficiale possono cambiare la rotta.",
  dataMode: "operational",
  weatherNoticeTitle: "La previsione copre il viaggio, ma manca ancora la conferma ufficiale a breve termine.",
  weatherNoticeText: "Tre modelli atmosferici e tre modelli d’onda sono stati letti separatamente. Non sono stati mediati: quando divergono viene mostrato lo scenario peggiore plausibile.",
  summary: "La rotta Marsala → Levanzo → Marettimo → Favignana → Marsala resta possibile, ma non è ancora confermata. Giovedì può avere vento da Sud sostenuto e mare corto; venerdì è il nodo del viaggio per temporali possibili e direzioni opposte fra i modelli; sabato va valutata l’onda residua da Nord-Ovest; domenica il mare cala, ma la partenza delle 15:30 lascia pochissimo margine per rientrare entro le 18:00.",
  decisiveFactors: [
    "Giovedì 8: ECMWF e GFS indicano 17–20 nodi da S–SSE alla partenza, mentre ICON è molto più debole. Si pianifica sullo scenario più sostenuto.",
    "Venerdì 9: ECMWF vede temporali tra notte e primo mattino e una rotazione a NO; GFS resta da Sud e ICON da ONO. La traversata per Marettimo richiede una nuova decisione, non una media.",
    "Domenica 11: Favignana–Marsala richiede circa 2 h 25 min a 5 nodi. Partire alle 15:30 lascia quasi zero margine; a 4 nodi non consente l’arrivo entro le 18:00."
  ],
  missingChecks: [
    "Bollettino Meteomar/NETTUNO, eventuale allerta della Protezione Civile, radar e osservazioni costiere nella finestra 24–72 ore.",
    "Posti barca a Marettimo e Favignana, operatività dei campi boe in ottobre e autorizzazioni dell’Area Marina Protetta.",
    "Condizioni reali alle imboccature, fondali/pescaggio, traffico traghetti e Avvisi ai Naviganti aggiornati prima di ogni ingresso.",
    "Non è disponibile una misura ufficiale locale di corrente o marea per Marsala–Egadi: il modello largo non sostituisce la verifica a bordo."
  ],
  orientationNotes: [
    "Schema di orientamento: non è una carta nautica e non va usato per navigare.",
    "Punti esposti: uscita di Marsala con mare da Sud; traversata Levanzo–Marettimo; costa NO e Punta Troia; giro di Punta Marsala al rientro.",
    "Alternative da verificare: restare a Marsala; rinviare Marettimo; rotta diretta per Favignana; anticipare il rientro. Porto o posto barca vanno sempre confermati."
  ],
  sourceNote: "Elaborazione del 4 ottobre su punti in mare lungo le tratte. Run: ECMWF IFS 04/10 12 UTC, GFS 04/10 12 UTC, ICON 04/10 12 UTC; onde ECMWF WAM 06 UTC, GFS-Wave 12 UTC e Météo-France MFWAM 00 UTC. Il modello oceanico per corrente e temperatura superficiale ha risoluzione larga e non è adatto a decidere un accesso costiero. I prodotti ufficiali a corto raggio non coprono ancora l’intero 8–11 ottobre.",
  sources: [
    { label: "ECMWF IFS · dati interrogati", url: "https://api.open-meteo.com/v1/forecast?latitude=37.96&longitude=12.20&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&wind_speed_unit=kn&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=ecmwf_ifs&cell_selection=sea", scope: "vento, raffiche e pioggia lungo l’area", checkedAt: "4 ottobre · 21:25 CEST", product: "Open-Meteo Forecast API", model: "ECMWF IFS HRES · run 04/10 12 UTC · circa 9 km", availability: "orario · 8–11 ottobre" },
    { label: "NOAA GFS · dati interrogati", url: "https://api.open-meteo.com/v1/forecast?latitude=37.96&longitude=12.20&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&wind_speed_unit=kn&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=ncep_gfs_global&cell_selection=sea", scope: "secondo scenario atmosferico indipendente", checkedAt: "4 ottobre · 21:25 CEST", product: "Open-Meteo Forecast API", model: "NOAA GFS · run 04/10 12 UTC · circa 13 km", availability: "orario · 8–11 ottobre" },
    { label: "DWD ICON · dati interrogati", url: "https://api.open-meteo.com/v1/forecast?latitude=37.96&longitude=12.20&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&wind_speed_unit=kn&timezone=Europe%2FRome&start_date=2026-10-08&end_date=2026-10-11&models=icon_global&cell_selection=sea", scope: "terzo scenario atmosferico indipendente", checkedAt: "4 ottobre · 21:25 CEST", product: "Open-Meteo Forecast API", model: "DWD ICON globale · run 04/10 12 UTC · circa 11 km", availability: "orario · 8–11 ottobre" },
    { label: "Open-Meteo Marine · confronto onde", url: "https://open-meteo.com/en/docs/marine-weather-api", scope: "altezza significativa, direzione e periodo d’onda", checkedAt: "4 ottobre · 21:25 CEST", product: "Marine Weather API", model: "ECMWF WAM · NOAA GFS-Wave · Météo-France MFWAM", availability: "copertura 8–11 ottobre; output di griglia offshore" },
    { label: "Aeronautica Militare · Meteomar", url: "https://www.meteoam.it/it/meteomar", scope: "bollettino marino ufficiale da rileggere a ridosso di ciascuna tratta", checkedAt: "emissione 4 ottobre · 20:00 CEST", product: "Meteomar / NETTUNO", model: "bollettino ufficiale", availability: "quadro corrente e breve termine; non approva ancora il viaggio" },
    { label: "ISPRA · Rete Ondametrica", url: "https://www.mareografico.it/it/stazioni.html", scope: "osservazione di riferimento più vicina: boa Mazara del Vallo/Capo Granitola", checkedAt: "4 ottobre · 20:30 CEST", product: "RON", model: "osservazione, non previsione", availability: "onda e corrente non disponibili nell’ultima misura; non rappresenta Marsala/Egadi" },
    { label: "Istituto Idrografico della Marina · Avvisi", url: "https://www.marina.difesa.it/noi-siamo-la-marina/pilastro-logistico/scientifici/idrografico/Pagine/Avvisi.aspx", scope: "relitto/area vietata a Marsala e limiti di ancoraggio a Favignana", checkedAt: "fascicolo 20/2026 del 30 settembre", product: "Avvisi ai Naviganti · carte 258, 259 e 260", model: "fonte ufficiale" },
    { label: "Area Marina Protetta · Disciplinare 2026", url: "https://www.ampisoleegadi.it/files/Normativa/%20disciplinare_integrativo_2026_mase.pdf", scope: "zonazione, autorizzazioni, fondali sensibili, ancoraggi e campi boe", checkedAt: "4 ottobre 2026 · valido fino al 31 dicembre", product: "Disciplinare integrativo 2026", model: "fonte ufficiale locale", availability: "campi stagionali e disponibilità reale da confermare direttamente" },
    { label: "US Naval Observatory · astronomia", url: "https://aa.usno.navy.mil/data/api", scope: "alba, tramonto, crepuscolo e luna · 37,9 N / 12,4 E", checkedAt: "4 ottobre 2026", product: "Sun and Moon Data for One Day", model: "calcolo astronomico · Europe/Rome UTC+2" }
  ],
  modelComparison: [
    { parameter: "Vento · 8 ottobre", scenarios: "ECMWF 15–20 kn e GFS 16–21 kn da S–SSE · ICON 6–13 kn, poi O", divergence: "alta sull’intensità e sulla rotazione", decisionImpact: "uscire pianificando sullo scenario 17–20 kn e scegliere il lato di Levanzo solo dopo il controllo reale" },
    { parameter: "Vento/fenomeni · 9 ottobre", scenarios: "ECMWF S→NO con temporali notturni/mattutini · GFS 9–19 kn da S · ICON 13–17 kn da ONO", divergence: "molto alta: scenari quasi opposti", decisionImpact: "nessuna finestra per Marettimo va data per acquisita; possibile rinvio o rotta alternativa" },
    { parameter: "Onda · 10 ottobre", scenarios: "ECMWF WAM e MFWAM 0,6–1,2 m da NO · GFS-Wave 0,44–0,50 m", divergence: "alta sull’onda residua", decisionImpact: "ridurre la visita della costa esposta/Punta Troia se il mare reale conferma circa 1 m" },
    { parameter: "Rientro · 11 ottobre", scenarios: "mare 0,2–0,5 m in calo · vento ECMWF da N, GFS da S–SO, ICON da NO", divergence: "intensità contenuta ma direzione non risolta", decisionImpact: "la velocità reale della flotta e l’orario contano più di una singola freccia del modello" }
  ],
  climateOutlook: {
    title: "Contesto di inizio ottobre",
    disclaimer: "Climatologia e previsione non sono la stessa cosa. I valori operativi sono nelle schede qui sotto.",
    items: [
      { icon: "air", label: "Aria", value: "mite", detail: "previsione attuale intorno a 21–28°C nelle ore diurne" },
      { icon: "water", label: "Mare", value: "24–25°C", detail: "temperatura superficiale modellata, non misura in rada" },
      { icon: "wind", label: "Vento", value: "variabile", detail: "marcata divergenza dei modelli l’8 e il 9" },
      { icon: "rain", label: "Instabilità", value: "da seguire", detail: "segnale principale nella notte/mattina del 9" },
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
      distance: "circa 12,8 NM",
      course: "338° veri, poi 351° e 336° evitando Favignana",
      duration: "4 kn: 3 h 12 min · 5 kn: 2 h 34 min · 6 kn: 2 h 08 min",
      window: "Partenza prevista 15:00. A 4 nodi l’arrivo è circa 18:12, soltanto 31 minuti prima del tramonto: nessun margine per cercare una rada.",
      criticality: "Uscita con vento e onda da Sud; scelta notturna a Levanzo ancora aperta.",
      uncertainty: "Alta sul vento: ECMWF/GFS sono sostenuti, ICON molto più debole e ruota a Ovest.",
      ratings: {
        departure: { tone: "caution", text: "Alle 15 ECMWF/GFS indicano circa 19 kn da S–SSE e raffiche 21–26 kn; verificare imboccatura e avvisi." },
        passage: { tone: "caution", text: "Mare corto da S–SSE, fino a 1,2 m nello scenario GFS-Wave; andatura portante ma comfort da valutare." },
        arrival: { tone: "unknown", text: "Non è stato scelto un approdo preciso; rada e boe di ottobre non sono confermate." }
      },
      operationalChecks: ["Meteomar/NETTUNO e osservazioni reali di Marsala prima di mollare gli ormeggi.", "Avvisi IIM su relitto e area vietata presso Marsala.", "Ridosso, fondale, autorizzazione AMP e piano di uscita dalla rada se il vento ruota."],
      glance: { wind: "S–SSE 17–20 kn", windTone: "caution", sea: "0,6–1,2 m da S", seaTone: "caution", sky: "Asciutto nei 3 modelli", skyIcon: "sun", skyTone: "good" },
      plan: "Cambusa già a bordo e partenza intorno alle 15:00. La rotta passa a Ovest di Favignana e raggiunge Levanzo con luce soltanto se velocità e manovre restano nei tempi.",
      navigation: "Con rotta verso NNO e vento/onda da S–SSE l’andatura è portante. Se si realizza la rotazione a Ovest di ICON, l’ultimo tratto cambia assetto e comfort.",
      overnight: "Rada sul lato realmente ridossato soltanto dopo verifica; altrimenti porto/posto confermato o un’alternativa più documentata.",
      overnightType: "Prima notte · scelta aperta",
      overnightStatus: "Da verificare sul posto",
      alternative: "Restare a Marsala oppure accorciare su Favignana con posto già confermato. La vicinanza non rende un approdo automaticamente sicuro.",
      stops: [
        { moment: "Tramonto · lato O/NO", title: "Cala Tramontana o scenario del Genovese", description: "Luce favorevole verso Ovest, ma esposizione maggiore con onda da Ovest o Nord.", check: "Zonazione AMP, fondo, spazio, onda residua, traffico e possibilità di uscire senza ritardi." },
        { moment: "Alba · lato E/SE", title: "Cala Fredda, Minnola o Dogana", description: "Lato adatto alla prima luce; Cala Dogana è anche approdo di linea.", check: "Non pernottare per il solo valore panoramico: servono permesso, ridosso e gestione del traffico." }
      ],
      wind: "3–5 Bft secondo il modello. ECMWF 15–20 kn e GFS 16–21 kn da S–SSE, raffiche massime 25–26 kn; ICON 6–13 kn da S con rotazione verso O. Alla partenza ECMWF/GFS sono circa 19 kn.",
      sea: "Poco mosso, Douglas 3. Hs: ECMWF WAM 0,54–0,84 m; GFS-Wave 0,90–1,22 m; MFWAM 0,58–1,02 m, prevalentemente da S–SSE, periodo 2,9–5,0 s. È soprattutto mare di vento; Hs non è l’onda massima.",
      visibility: "Buona nella griglia, da verificare localmente all’imboccatura.",
      phenomena: "Scenario asciutto nei tre deterministici; probabilità ensemble puntuale non disponibile in questa estrazione. Lo sviluppo convettivo reale va comunque osservato.",
      air: "Circa 24–28°C nel pomeriggio, nuvolosità diversa fra modelli; tipo di nube non risolto dal prodotto consultato.",
      water: "Temperatura superficiale modellata circa 24,8°C; non è una misura della cala.",
      currents: "Modello oceanico circa 0,5–0,7 kn; direzione e valore nearshore non bastano per il piano, verifica a bordo.",
      decision: "Confermare entro il primo pomeriggio sia l’uscita sia la notte. Se il margine di luce si riduce, usare un riparo già verificato.",
      sun: "Alba 07:12 · tramonto 18:43 · crepuscolo civile fino alle 19:09.",
      moon: "Falce calante, illuminazione 6% · levata 04:45 · tramonto 17:30."
    },
    {
      date: "Venerdì 9 ottobre",
      route: "Levanzo → Marettimo",
      distance: "circa 13 NM",
      course: "uscita a Sud di Levanzo, poi circa 267° veri",
      duration: "4 kn: 3 h 15 min · 5 kn: 2 h 36 min · 6 kn: 2 h 10 min",
      window: "Nessuna finestra affidabile oggi. Rivalutare tra 08:00 e 10:00 con radar, bollettino, osservazioni e mare reale.",
      criticality: "Traversata aperta senza vero riparo intermedio, con temporali possibili e direzioni quasi opposte fra modelli.",
      uncertainty: "Molto alta: ECMWF ruota da S a NO, GFS resta da S, ICON da ONO.",
      ratings: {
        departure: { tone: "adverse", text: "ECMWF segnala temporali 03–05 e piogge/rovesci fino alla mattina: rinvio o alternativa da considerare." },
        passage: { tone: "adverse", text: "È la tratta più esposta; direzione del vento e del mare può cambiare durante l’attraversamento." },
        arrival: { tone: "caution", text: "Ingresso a Marettimo da coordinare con porto e traffico; posto non ancora confermato." }
      },
      operationalChecks: ["Radar e fulminazioni, osservazione delle nubi e Meteomar prima della traversata.", "Posto, canale di chiamata e istruzioni del porto di Marettimo.", "Se modelli e osservazioni non convergono, rinunciare a Marettimo prima di impegnare il canale."],
      glance: { wind: "Scenari S / NO · 9–19 kn", windTone: "caution", sea: "0,4–1,0 m, rotazione possibile", seaTone: "caution", sky: "Temporali possibili al mattino", skyIcon: "rain", skyTone: "caution" },
      plan: "La mattina a Levanzo resta subordinata al cielo e al mare. Marettimo non è un appuntamento da raggiungere a ogni costo: si parte soltanto quando osservazioni e bollettini danno margine.",
      navigation: "Con GFS il vento da Sud sarebbe al traverso/lasco sulla rotta Ovest; con ICON da ONO diventerebbe contrario; con ECMWF può ruotare durante la traversata.",
      overnight: "Porto di Marettimo solo con posto e istruzioni confermati.",
      overnightType: "Seconda notte · porto",
      overnightStatus: "Disponibilità da confermare",
      alternative: "Restare in un riparo legale a Levanzo, dirigere su Favignana con posto confermato o rientrare a Marsala. Nessuna alternativa è automatica.",
      stops: [
        { moment: "Prima della traversata", title: "Cala Fredda o Cala Minnola", description: "Eventuale sosta breve soltanto se non sottrae margine alla decisione meteo.", check: "Temporali, rotazione del vento, ridosso e orario limite per rinunciare." },
        { moment: "Arrivo", title: "Scalo Nuovo di Marettimo", description: "Approdo con traffico di linea e spazi limitati: l’arrivo va coordinato.", check: "Posto barca, istruzioni locali, vento sull’imboccatura, traghetti e visibilità." }
      ],
      wind: "1–5 Bft secondo il modello. ECMWF 1–12 kn da S poi NO, raffiche fino a 18,5 kn; GFS 9–19 kn da S, raffiche 20,8 kn; ICON 13–17 kn da ONO, raffiche 21,6 kn.",
      sea: "Quasi calmo o poco mosso, Douglas 2–3. Hs 0,44–1,00 m. WAM/MFWAM ruotano da S verso NO; GFS-Wave ruota più lentamente. Periodo breve-moderato: possibile mare incrociato/residuo.",
      visibility: "Può calare rapidamente sotto un rovescio o temporale: la griglia non descrive il bordo della cella.",
      phenomena: "ECMWF codifica temporali 03–05 e rovesci/piogge 06–11 e 18–21; GFS e ICON restano asciutti. Ensemble pioggia ≥0,1 mm/h alle 06: ECMWF 54%, GEFS 20%, ICON-EPS 46%.",
      air: "Circa 22–25°C, copertura e precipitazione molto variabili; nubi convettive possibili nello scenario ECMWF.",
      water: "Temperatura superficiale modellata circa 24,8°C.",
      currents: "Modello oceanico circa 0,3–0,65 kn; risoluzione insufficiente per rotta costiera e ingresso.",
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
      window: "Preferire tarda mattina/primo pomeriggio dopo aver misurato il mare residuo. Accorciare la visita se riduce il margine d’ingresso a Favignana.",
      criticality: "Onda residua da NO sulla costa esposta di Marettimo e divergenza sull’altezza significativa.",
      uncertainty: "Media-alta sull’onda: WAM/MFWAM indicano circa 1 m, GFS-Wave circa 0,5 m.",
      ratings: {
        departure: { tone: "caution", text: "Controllare l’onda da NO prima di uscire dal ridosso e avvicinarsi alla costa esposta." },
        passage: { tone: "caution", text: "Vento perlopiù debole/moderato, ma mare residuo fino a 1,2 m nello scenario WAM/MFWAM." },
        arrival: { tone: "caution", text: "Posto e ingresso a Favignana vanno confermati; presente traffico di linea." }
      },
      operationalChecks: ["Altezza e direzione reale dell’onda sul lato NO di Marettimo.", "Divieti AMP e Miglio Blu: nessun ancoraggio senza verifica.", "Posto barca e istruzioni d’ingresso a Favignana, con luce per la manovra."],
      glance: { wind: "3–13 kn da O/NO", windTone: "calm", sea: "0,5–1,2 m da NO", seaTone: "caution", sky: "Perlopiù asciutto", skyIcon: "sun", skyTone: "good" },
      plan: "Visita di Marettimo soltanto fin dove il mare resta semplice, poi trasferimento diretto verso Favignana per entrare con luce.",
      navigation: "La rotta verso Est mette il vento occidentale alle spalle; il comfort dipende però dall’onda residua, non solo dai nodi di vento locale.",
      overnight: "Porto di Favignana con posto confermato.",
      overnightType: "Terza notte · porto",
      overnightStatus: "Disponibilità da confermare",
      alternative: "Saltare Punta Troia e andare diretti. Se anche la rotta diretta non offre margine, restare a Marettimo in posto confermato.",
      stops: [
        { moment: "Mattino · Marettimo", title: "Punta Troia solo se il mare lo consente", description: "La deviazione aggiunge circa 2,5–3 NM e porta sul lato più esposto.", check: "Onda da NO, distanza dalla costa, aree protette e tempo residuo." },
        { moment: "Arrivo · Favignana", title: "Porto prima della sera", description: "L’ingresso con luce protegge la gestione della flotta.", check: "Disponibilità, canale di chiamata, traffico traghetti e Avviso 20.15." }
      ],
      wind: "2–4 Bft secondo il modello. ECMWF 4–13 kn da O poi N, raffiche 18,5 kn; GFS 3–5 kn da SO/O; ICON 5–11 kn da NO, raffiche 15 kn.",
      sea: "Quasi calmo o poco mosso, Douglas 2–3. WAM 0,66–1,16 m e MFWAM 0,64–1,22 m da NO; GFS-Wave 0,44–0,50 m. Periodo circa 5–6,7 s.",
      visibility: "Generalmente buona; verificare eventuali rovesci isolati.",
      phenomena: "ECMWF e GFS asciutti; ICON indica circa 0,6 mm al mattino. Probabilità ensemble puntuale non disponibile; nessun segnale condiviso di fenomeni intensi.",
      air: "Circa 21–25°C, nuvolosità variabile.",
      water: "Temperatura superficiale modellata circa 24,5°C.",
      currents: "Modello oceanico circa 0,2–0,3 kn, direzione variabile; non usarlo per manovre costiere.",
      decision: "Se l’onda intorno a 1 m si verifica, evitare la costa più esposta e preservare la rotta diretta.",
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
      uncertainty: "Media: mare in calo condiviso, vento da N per ECMWF, S–SO per GFS e NO per ICON.",
      ratings: {
        departure: { tone: "caution", text: "Vento e onda generalmente contenuti, ma il bollettino ufficiale della giornata e l’accesso locale non sono ancora disponibili." },
        passage: { tone: "caution", text: "Meteo relativamente favorevole, ma le 15:30 non lasciano margine a 4–5 nodi." },
        arrival: { tone: "caution", text: "Ingresso a Marsala con Avvisi IIM e necessità di arrivare prima delle 18:00." }
      },
      operationalChecks: ["ETA della barca più lenta prima dell’ultimo bagno.", "Visibilità, traffico e condizioni sull’imboccatura di Marsala.", "Avvisi IIM, carburante e riserva di tempo per check-out."],
      glance: { wind: "4–10 kn, direzione incerta", windTone: "calm", sea: "0,2–0,5 m da NO", seaTone: "calm", sky: "Mare in calo", skyIcon: "sun", skyTone: "good" },
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
      wind: "2–3 Bft. ECMWF 5–10 kn da N, raffiche fino a 14 kn; GFS 4–7 kn da S–SO; ICON 4–6 kn da NO. Intensità contenuta, direzione non risolta.",
      sea: "Quasi calmo, Douglas 2. WAM 0,28–0,48 m; GFS-Wave 0,24–0,32 m; MFWAM 0,20–0,40 m, soprattutto da NO, periodo 3,4–5,4 s.",
      visibility: "Generalmente buona nella griglia; da verificare con le osservazioni del giorno.",
      phenomena: "Nessun segnale condiviso di fenomeni intensi; probabilità ensemble puntuale non disponibile. Aggiornare con il bollettino a breve termine.",
      air: "Circa 20–25°C, nuvolosità variabile.",
      water: "Temperatura superficiale modellata circa 24,3–24,4°C.",
      currents: "Modello oceanico da circa 0,6 kn a metà giornata a 0,1–0,2 kn verso sera; valore costiero da verificare.",
      decision: "Fissare la partenza sulla barca più lenta e sul meteo reale. Se alle 15:30 non c’è margine credibile, il bagno finale si accorcia.",
      sun: "Alba 07:15 · tramonto 18:39 · crepuscolo civile fino alle 19:05.",
      moon: "Falce crescente, illuminazione 1% · levata 08:01 · tramonto 18:45."
    }
  ]
};

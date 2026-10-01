/*
 * Dati pubblici del Passage Plan. Vengono aggiornati dallo skipper dopo ogni
 * briefing: nessun dato personale o informazione di Crew List va inserito qui.
 */
window.PASSAGE_PLAN_DATA = {
  updatedAt: "1 ottobre 2026 · prima tendenza operativa vento/mare",
  phase: "Tendenza operativa · 7 giorni alla partenza",
  confidence: "Rotta definita · astronomia verificata · meteo: prima tendenza multi-modello, affidabilità media (i modelli divergono ancora su vento e pioggia)",
  status: "Dati vento/mare pubblicati giorno per giorno · i modelli professionali non sono ancora allineati, nuovo controllo entro il lunedì 5 ottobre",
  publishedAt: "1 ottobre 2026 · aggiornamento meteo operativo preliminare",
  validFrom: "Valido come tendenza operativa preliminare fino al prossimo aggiornamento meteo, atteso il lunedì 5 ottobre quando i bollettini ufficiali ed i servizi nautici copriranno davvero l’8 ottobre",
  validUntil: "Non è un bollettino di bordo: non conferma vento, onda, porto, boe o rada.",
  nextUpdateAt: "lunedì 5 ottobre · quando meteoam, Windy e PredictWind copriranno l’8 ottobre con dati affidabili",
  dataMode: "operational",
  weatherNoticeTitle: "Prima tendenza operativa pubblicata, i modelli non sono ancora allineati.",
  weatherNoticeText: "Il 1° ottobre abbiamo confrontato più modelli professionali (ECMWF, GFS, ICON, meteoblue AI su Windy): concordano su un giovedì 8 probabilmente asciutto, ma divergono su intensità del vento e su quando arriverà la pioggia. Nuovo controllo con fonti ufficiali il lunedì 5 ottobre.",
  summary: "La rotta desiderata resta Marsala → Levanzo → Marettimo → Favignana → Marsala. Giovedì 8 si annuncia probabilmente asciutto, ma restiamo prudenti: il rischio di pioggia potrebbe spostarsi su venerdì 9. La decisione finale — partire giovedì o venerdì mattina — arriva con il bollettino ufficiale, 2-4 giorni prima della partenza.",
  sourceNote: "Controllo del 20 settembre: l’Area Marina Protetta richiede di verificare zonazione, autorizzazioni e campi boe prima della sosta. Le calette qui raccontano possibilità di giornata, non posti assegnati né promesse di rada. Ogni scelta serale resta allo skipper della singola barca, dopo aver letto il mare reale. Il controllo meteo dell’1 ottobre viene dal confronto diretto di più modelli professionali su Windy (vedi le fonti qui sotto).",
  sources: [
    { label: "Fonte astronomica", url: "https://aa.usno.navy.mil/data/api", scope: "alba, tramonto e luna · fuso Europe/Rome", checkedAt: "calcolo del piano: 11 settembre 2026" },
    { label: "Windy · confronto multi-modello (ECMWF, GFS, ICON, meteoblue AI)", url: "https://www.windy.com/multimodel/37.798/12.431?37.495,12.431,9", scope: "vento, pioggia, nuvolosità e stato del mare punto per punto, con confronto diretto fra modelli", checkedAt: "1 ottobre 2026, circa le 11:00" },
    { label: "Meteo Aeronautica Militare · Sicilia", url: "https://www.meteoam.it/it/sicilia", scope: "previsioni e mare nella finestra utile (non copriva ancora l’8-11 ottobre al controllo del 1° ottobre)", checkedAt: "1 ottobre 2026" },
    { label: "AMP Egadi · moduli e autorizzazioni", url: "https://www.ampisoleegadi.it/index.php/moduli-e-istanze/", scope: "permessi, ancoraggio e ormeggio", checkedAt: "20 settembre 2026" },
    { label: "AMP Egadi · campi boe", url: "https://redirect.ampisoleegadi.it/1497.html", scope: "aree e disponibilità da verificare", checkedAt: "20 settembre 2026" },
    { label: "Medie climatiche · Isole Egadi", url: "https://www.climieviaggi.it/clima/italia/isole-egadi", scope: "temperature, mare, pioggia e sole medi di ottobre (dato storico, non una previsione)", checkedAt: "22 settembre 2026" }
  ],
  // Media storica del periodo, non una previsione per questo viaggio: serve
  // solo a farsi un'idea mentre si aspetta la prima tendenza reale del 28/9.
  climateOutlook: {
    title: "Cosa aspettarsi di solito a inizio ottobre",
    disclaimer: "Media storica delle Egadi, non una previsione per questo viaggio: può cambiare. La tendenza operativa reale, giorno per giorno, è qui sotto.",
    items: [
      { icon: "air", label: "Aria", value: "16–24°C", detail: "mite di giorno, si rinfresca la sera" },
      { icon: "water", label: "Mare", value: "circa 22°C", detail: "acqua ancora calda, bagno normalmente comodo" },
      { icon: "wind", label: "Vento", value: "variabile", detail: "spesso brezza, possibili giornate più ventose" },
      { icon: "rain", label: "Pioggia", value: "circa 7 giorni su 31", detail: "il resto del mese è tipicamente asciutto" },
      { icon: "sun", label: "Sole", value: "7–8 ore al giorno", detail: "luce piena per gran parte della giornata" }
    ]
  },
  stopsNote: "Per una notte in rada non basta che una cala sia bella: servono ridosso, fondo adatto, spazio di manovra, regole AMP e autorizzazioni effettive. Se uno di questi elementi manca, il piano cambia senza rimpianti: porto o altro riparo sono parte della navigazione, non un ripiego.",
  mooringGuide: {
    title: "Dove si dorme davvero?",
    introduction: "Rada significa dormire fuori dal porto, con la barca all’ancora. Un campo boe è invece un’area attrezzata dove la barca si ormeggia a un gavitello autorizzato. Le immagini aiutano a immaginare il viaggio; la decisione arriva soltanto dopo i controlli della giornata.",
    checks: [
      { title: "1 · Regole e permessi", text: "Lo skipper controlla zonazione, eventuali autorizzazioni e se il campo boe è attivo e disponibile. Una boa vista su una mappa non è una prenotazione e non va data per scontata." },
      { title: "2 · Il ridosso prima della vista", text: "La stessa cala può essere perfetta per un bagno e scomoda per la notte. Vento, onda residua, profondità e spazio di manovra contano più del nome della cala." },
      { title: "3 · La scelta che fa stare bene tutti", text: "Quando non c’è una notte davvero tranquilla, si entra in porto o si cambia lato dell’isola. Il viaggio resta bello anche se cambia l’ordine delle tappe; il mare non va forzato." }
    ]
  },
  days: [
    {
      date: "Giovedì 8 ottobre",
      route: "Marsala → Levanzo",
      glance: { wind: "2-17 nodi (modelli discordi)", windTone: "caution", sea: "0,3-1,0 m", seaTone: "calm", sky: "Probabilmente asciutto", skyIcon: "sun", skyTone: "good", air: "17-26°C" },
      plan: "Ci si incontra a Marsala con la cambusa già pronta e si parte intorno alle 15:00. La prima uscita serve a prendere il ritmo della flotta, arrivare con luce e cercare un tramonto che non chieda fretta.",
      navigation: "Una navigazione di apertura, pensata per chiudere la giornata prima del buio. Levanzo è l’orizzonte della prima sera, non un punto da raggiungere a ogni costo.",
      overnight: "Prima scelta: una rada a Levanzo soltanto se, sul posto, è consentita e realmente calma. In caso contrario si cerca un riparo diverso deciso dallo skipper.",
      overnightType: "Prima notte · rada da confermare",
      overnightStatus: "Idea · nessun posto assegnato",
      alternative: "Se la condizione è già scomoda, si riduce la tratta o si cambia riparo: la prima sera non deve mettere pressione alla giornata successiva.",
      stops: [
        {
          moment: "Tramonto · lato da scegliere",
          title: "Cala del Genovese o Cala Tramontana",
          description: "Due scenari per arrivare a Levanzo con la luce della sera. Sono luoghi da guardare dal mare e valutare lì, non una promessa di pernottamento.",
          check: "Prima della sosta: esposizione reale, fondo, profondità, traffico, zonazione AMP e autorizzazioni. Se manca anche una sola verifica, la cala resta solo una bella immagine."
        },
        {
          moment: "Alba · alternativa sul lato est",
          title: "Cala Fredda, Cala Minnola o Cala Dogana",
          description: "Opzioni da tenere aperte per il mattino dopo, se il lato scelto protegge davvero la barca e permette di partire con serenità verso Marettimo.",
          check: "La notte non è garantita: ogni barca segue la decisione del proprio skipper, non la lista delle calette."
        }
      ],
      wind: "I modelli professionali non sono ancora allineati sull’intensità: meteoblue AI indica vento leggero (2-5 nodi, raffiche fino a 11), ECMWF indica invece brezza moderata per l’intera giornata (13-17 nodi). Direzione prevalentemente da terra (quadrante N-NO) in entrambi, ma la lettura va confermata più vicino alla data.",
      sea: "Da poco mosso a localmente mosso: l’onda combinata varia da 0,3 m (GFS) a 0,6-1,0 m (ECMWF) nell’arco della giornata, periodo breve (circa 5 secondi, onda di vento locale, non swell lungo).",
      air: "Tra 17°C (notte) e 26°C (primo pomeriggio) secondo i modelli; cielo prevalentemente sereno o poco nuvoloso in giornata.",
      water: "Non rilevata in questa sessione dai modelli consultati (non espongono la temperatura del mare nella vista oraria): stima storica di inizio ottobre circa 22°C (vedi clima tipico sopra), da confermare con una fonte marina vicino alla partenza.",
      currents: "Nessuna fonte con dati di corrente puntuali per quest’area a questa distanza: verifica nel briefing operativo e a bordo.",
      decision: "Giovedì sembra, oggi, la giornata più asciutta — ma restiamo prudenti a 7 giorni dalla partenza. Lo skipper confermerà se partire giovedì o restare a Marsala (cena a terra) e partire venerdì mattina, con il bollettino ufficiale 2-4 giorni prima.",
      sun: "Alba 07:12 · tramonto 18:43 · crepuscolo civile fino alle 19:09.",
      moon: "Falce calante · levata 04:45 · tramonto 17:29."
    },
    {
      date: "Venerdì 9 ottobre",
      route: "Levanzo → Marettimo",
      glance: { wind: "7-19 nodi, in aumento", windTone: "caution", sea: "~1,0-1,1 m", seaTone: "caution", sky: "Pioggia possibile (solo GFS)", skyIcon: "rain", skyTone: "caution", air: "17-26°C" },
      plan: "Il mattino resta aperto a un bagno o a una piccola esplorazione di Levanzo. Dopo pranzo la flotta punta Marettimo: la serata ha una base precisa, il porto e il borgo.",
      navigation: "È la tratta che chiede più margine. La sosta a Levanzo deve restare leggera: per Marettimo si parte quando il mare permette a tutte le barche una traversata comoda.",
      overnight: "Porto di Marettimo: piano della notte, con cena libera a terra o a bordo e ritrovo nel borgo.",
      overnightType: "Seconda notte · porto",
      overnightStatus: "Piano base · posto barca da confermare",
      alternative: "Se mare e onda non lasciano una finestra confortevole, si ridisegna l’ordine delle tappe. Il porto di Marettimo non si raggiunge forzando una traversata.",
      stops: [
        {
          moment: "Mattino · sosta breve",
          title: "Cala Fredda o Cala Minnola",
          description: "Una seconda cala di Levanzo per il primo bagno o per una colazione lenta, senza trasformarla in una lunga giornata ferma.",
          check: "Sosta diurna soltanto, quando consentita e semplice da gestire. Profondità, fondo e spazio per tutte le barche si controllano sul posto."
        },
        {
          moment: "Marettimo · arrivo serale",
          title: "Il porto prima della festa",
          description: "La sera è pensata per vivere il borgo. Arrivare in porto con margine evita di trasformare l’ultimo tratto in una decisione affrettata.",
          check: "Posto barca, canale di contatto e orario di arrivo vengono confermati dallo skipper con la struttura portuale."
        }
      ],
      wind: "Ancora brezza moderata secondo ECMWF (17-19 nodi al mattino presto, poi in attenuazione), più leggera secondo meteoblue AI (fino a 7 nodi); GFS indica invece vento in aumento nel pomeriggio (7-15 nodi), in coincidenza con il possibile arrivo della pioggia.",
      sea: "Poco mosso: onda combinata intorno a 1,0-1,1 m secondo ECMWF, periodo breve; dato più calmo nelle prime ore secondo GFS.",
      air: "Tra 17°C e 26°C secondo i modelli. GFS è l’unico a indicare pioggia in aumento durante la giornata (da circa 0,6 mm al mattino presto fino a circa 11 mm nel primo pomeriggio): meteoblue AI ed ECMWF non la mostrano. È il giorno in cui i modelli divergono di più: da riverificare a ridosso della data.",
      water: "Dato marino non rilevato in questa sessione: stima storica circa 22°C, da aggiornare nella settimana della partenza con una fonte marina.",
      currents: "Da controllare nella finestra operativa: nessuna fonte con dati puntuali a questa distanza.",
      decision: "Se giovedì si restasse a Marsala, venerdì mattina diventerebbe la partenza: anche venerdì, però, potrebbe portare più vento e qualche rovescio nel pomeriggio. La partenza si valuta con calma al mattino, non è scontata, e si parte per Marettimo solo con una finestra che lasci margine a tutte le barche.",
      sun: "Alba 07:13 · tramonto 18:42 · crepuscolo civile fino alle 19:08.",
      moon: "Falce calante · levata 05:52 · tramonto 17:54."
    },
    {
      date: "Sabato 10 ottobre",
      route: "Marettimo → Favignana",
      glance: { wind: "Da confermare", sea: "Fino a ~1,3-1,4 m (bassa affidabilità)", sky: "Da confermare", skyIcon: "sun", air: "Da confermare" },
      plan: "Marettimo merita una mattina vista dal mare, con calma e senza avvicinamenti inutili. Poi si imposta il trasferimento verso Favignana per entrare in porto nel pomeriggio e vivere la cena collettiva.",
      navigation: "Si visita Marettimo solo fin dove il mare resta leggibile; la tratta per Favignana va impostata con margine per arrivare in porto ancora con luce.",
      overnight: "Porto di Favignana: cena collettiva, DJ set e rientro a bordo a fine serata.",
      overnightType: "Terza notte · porto",
      overnightStatus: "Piano base · posto barca da confermare",
      alternative: "Se la costa di Marettimo è esposta o la finestra si accorcia, l’esplorazione si riduce e si anticipa la partenza. Favignana è la base della sera, non una corsa contro il tempo.",
      stops: [
        {
          moment: "Mattino · costa di Marettimo",
          title: "Punta Troia, Scalo Maestro o Cala Manione",
          description: "Punti da osservare dal mare per sentire la scala dell’isola. Distanza dalla costa, rotta e durata restano scelte tecniche dello skipper.",
          check: "Le zone e i fondali sono tutelati: non sono indicazioni di ancoraggio né di avvicinamento."
        },
        {
          moment: "Favignana · arrivo con luce",
          title: "Entrare in porto prima che inizi la sera",
          description: "Il tramonto accompagna l’arrivo in paese; la notte è in porto, per godersi la cena senza una barca da controllare in rada.",
          check: "Orario e approccio dipendono dalla traversata reale, dagli avvisi e dalla conferma del posto barca."
        }
      ],
      wind: "A 9 giorni di anticipo il dato non è ancora affidabile: i modelli mostrano un lieve aumento rispetto ai due giorni precedenti, ma il valore puntuale va preso con cautela fino al prossimo controllo (lunedì 5 ottobre).",
      sea: "Onda in leggero aumento secondo il modello ECMWF-mare (fino a circa 1,3-1,4 m), ma a questa distanza l’affidabilità resta bassa: dettaglio e swell saranno letti meglio quando la previsione entra nella finestra operativa.",
      air: "Temperatura e copertura del cielo verranno confermate nel prossimo aggiornamento, quando il dato sarà più affidabile.",
      water: "Dato marino da verificare vicino alla partenza.",
      currents: "Da verificare nel briefing operativo e durante la navigazione.",
      decision: "L’ordine tra visita e trasferimento resta flessibile: si sceglie il momento che lascia più margine.",
      sun: "Alba 07:15 · tramonto 18:42 · crepuscolo civile fino alle 19:08.",
      moon: "Luna nuova · levata 06:58 · tramonto 18:20."
    },
    {
      date: "Domenica 11 ottobre",
      route: "Favignana → Marsala",
      glance: { wind: "Non disponibile a 10 giorni", sea: "Da confermare", sky: "Da confermare", skyIcon: "sun", air: "Da confermare" },
      plan: "L’ultima mattina è per Favignana: Cala Azzurra, Cala Rossa o un’altra sosta scelta sul momento. Alle 15:30 circa si punta Marsala, con l’obiettivo di essere in porto entro le 18:00.",
      navigation: "È una giornata di rientro: il bagno è un regalo, non un vincolo. Il tempo di uscita da Favignana protegge il viaggio verso Marsala e il check-out della flotta.",
      overnight: "Nessun pernottamento: rientro a Marsala entro le 18:00.",
      overnightType: "Rientro · porto di Marsala",
      overnightStatus: "Orario vincolante",
      alternative: "Se il mare costruisce o la flotta accumula ritardo, la sosta finale si accorcia o si anticipa la partenza. Tornare bene vale più di un ultimo bagno lungo.",
      stops: [
        {
          moment: "Mattino · luce e bagno",
          title: "Cala Azzurra, Cala Rossa o Bue Marino",
          description: "Tre immagini possibili di Favignana, da scegliere solo se mare, affollamento e gestione della barca rendono la sosta semplice.",
          check: "Sono soste diurne possibili: non sono un programma obbligato e richiedono la verifica delle regole dell’Area Marina Protetta."
        },
        {
          moment: "Piano B · lato alternativo",
          title: "Cala Rotonda o Preveto",
          description: "Alternative da tenere aperte se il lato scelto al mattino non è confortevole. Il percorso verso Marsala resta sempre davanti a noi.",
          check: "La partenza è intorno alle 15:30, salvo anticipo deciso dallo skipper per rientrare con tranquillità."
        }
      ],
      wind: "A 10 giorni di anticipo nessun modello consultato dà un valore puntuale solido: il dato utile arriverà con il prossimo controllo (lunedì 5 ottobre) e poi nel briefing operativo.",
      sea: "Mare e onda saranno riletti prima della sosta e prima del rientro, quando il dato sarà più affidabile.",
      air: "Temperatura, visibilità e fenomeni saranno aggiornati nel briefing operativo.",
      water: "Dato marino da verificare nella settimana della partenza.",
      currents: "Nessun valore affidabile anticipato: si controllano con le fonti operative e a bordo.",
      decision: "Il rientro puntuale a Marsala prevale sempre sulla durata dell’ultima sosta a Favignana.",
      sun: "Alba 07:15 · tramonto 18:39 · crepuscolo civile fino alle 19:05.",
      moon: "Falce crescente · levata 08:02 · tramonto 18:45."
    }
  ]
};

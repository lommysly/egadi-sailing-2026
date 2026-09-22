/*
 * Dati pubblici del Passage Plan. Vengono aggiornati dallo skipper dopo ogni
 * briefing: nessun dato personale o informazione di Crew List va inserito qui.
 */
window.PASSAGE_PLAN_DATA = {
  updatedAt: "20 settembre 2026 · piano di rotta aggiornato",
  phase: "Conto alla rovescia in aggiornamento",
  confidence: "Rotta definita · astronomia verificata · meteo: prima tendenza dal 28 settembre",
  status: "Pianificazione aggiornata · meteo in attesa della finestra utile",
  publishedAt: "20 settembre 2026 · aggiornamento di pianificazione",
  validFrom: "Valido come piano di navigazione e preparazione dell’equipaggio fino al prossimo aggiornamento meteo",
  validUntil: "Non è un bollettino di bordo: non conferma vento, onda, porto, boe o rada.",
  nextUpdateAt: "28 settembre · prima tendenza a 10 giorni",
  dataMode: "planning",
  weatherNoticeTitle: "Per vento e onda aspettiamo la finestra utile.",
  weatherNoticeText: "Siamo ancora fuori dalla finestra utile: una previsione puntuale sarebbe poco seria. Il 28 settembre arriverà una prima tendenza; dal 3 ottobre pubblicheremo i dati per giornata, poi le conferme quotidiane dello skipper.",
  summary: "La rotta desiderata resta Marsala → Levanzo → Marettimo → Favignana → Marsala. In questa fase il lavoro utile è fissare ripari, margini e alternative; il meteo vero entrerà nel piano soltanto quando potrà aiutare davvero a decidere.",
  sourceNote: "Controllo del 20 settembre: l’Area Marina Protetta richiede di verificare zonazione, autorizzazioni e campi boe prima della sosta. Le calette qui raccontano possibilità di giornata, non posti assegnati né promesse di rada. Ogni scelta serale resta allo skipper della singola barca, dopo aver letto il mare reale.",
  sources: [
    { label: "Fonte astronomica", url: "https://aa.usno.navy.mil/data/api", scope: "alba, tramonto e luna · fuso Europe/Rome", checkedAt: "calcolo del piano: 11 settembre 2026" },
    { label: "Meteo Aeronautica Militare · Sicilia", url: "https://www.meteoam.it/it/sicilia", scope: "previsioni e mare nella finestra utile", checkedAt: "20 settembre 2026" },
    { label: "AMP Egadi · moduli e autorizzazioni", url: "https://www.ampisoleegadi.it/index.php/moduli-e-istanze/", scope: "permessi, ancoraggio e ormeggio", checkedAt: "20 settembre 2026" },
    { label: "AMP Egadi · campi boe", url: "https://redirect.ampisoleegadi.it/1497.html", scope: "aree e disponibilità da verificare", checkedAt: "20 settembre 2026" },
    { label: "Medie climatiche · Isole Egadi", url: "https://www.climieviaggi.it/clima/italia/isole-egadi", scope: "temperature, mare, pioggia e sole medi di ottobre (dato storico, non una previsione)", checkedAt: "22 settembre 2026" }
  ],
  // Media storica del periodo, non una previsione per questo viaggio: serve
  // solo a farsi un'idea mentre si aspetta la prima tendenza reale del 28/9.
  climateOutlook: {
    title: "Cosa aspettarsi di solito a inizio ottobre",
    disclaimer: "Media storica delle Egadi, non una previsione per questo viaggio: può cambiare. La prima tendenza reale arriva il 28 settembre.",
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
      wind: "Finché non entra la finestra utile non pubblichiamo una direzione o un’intensità: sarebbe una falsa precisione.",
      sea: "Onda e periodo saranno indicati solo nel briefing operativo, con fonte e ora di emissione.",
      air: "Temperatura, nuvolosità e percezione del vento arriveranno con la previsione per giornata.",
      water: "La temperatura dell’acqua sarà aggiornata vicino alla partenza con una fonte marina e l’osservazione a bordo.",
      currents: "Nessun valore affidabile da anticipare ora: verifica nel briefing operativo e a bordo.",
      decision: "Lo skipper conferma rotta, orario e notte dopo aver verificato condizioni reali e avvisi locali.",
      sun: "Alba 07:12 · tramonto 18:43 · crepuscolo civile fino alle 19:09.",
      moon: "Falce calante · levata 04:45 · tramonto 17:29."
    },
    {
      date: "Venerdì 9 ottobre",
      route: "Levanzo → Marettimo",
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
      wind: "La prima tendenza sarà pubblicata il 28 settembre; prima non indicheremo nodi o direzioni come fossero affidabili.",
      sea: "Il briefing utile separerà onda, periodo e direzione di provenienza quando la fonte li renderà disponibili.",
      air: "Temperatura, visibilità e eventuali fenomeni saranno aggiornati vicino alla data.",
      water: "Dato marino da aggiornare nella settimana della partenza.",
      currents: "Da controllare nella finestra operativa: non vengono stimati oggi.",
      decision: "La partenza per Marettimo avviene solo con una finestra che lasci margine a tutte le barche.",
      sun: "Alba 07:13 · tramonto 18:42 · crepuscolo civile fino alle 19:08.",
      moon: "Falce calante · levata 05:52 · tramonto 17:54."
    },
    {
      date: "Sabato 10 ottobre",
      route: "Marettimo → Favignana",
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
      wind: "Nessun valore puntuale oggi: la tendenza viene controllata dal 28 settembre.",
      sea: "Onda e swell saranno letti con dettaglio solo quando la previsione entra nella finestra utile.",
      air: "Temperatura e copertura del cielo verranno aggiornate nel briefing per giornata.",
      water: "Dato marino da verificare vicino alla partenza.",
      currents: "Da verificare nel briefing operativo e durante la navigazione.",
      decision: "L’ordine tra visita e trasferimento resta flessibile: si sceglie il momento che lascia più margine.",
      sun: "Alba 07:15 · tramonto 18:42 · crepuscolo civile fino alle 19:08.",
      moon: "Luna nuova · levata 06:58 · tramonto 18:20."
    },
    {
      date: "Domenica 11 ottobre",
      route: "Favignana → Marsala",
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
      wind: "Il valore utile verrà pubblicato soltanto nell’ultima settimana.",
      sea: "Mare e onda saranno riletti prima della sosta e prima del rientro.",
      air: "Temperatura, visibilità e fenomeni saranno aggiornati nel briefing operativo.",
      water: "Dato marino da verificare nella settimana della partenza.",
      currents: "Nessun valore affidabile anticipato: si controllano con le fonti operative e a bordo.",
      decision: "Il rientro puntuale a Marsala prevale sempre sulla durata dell’ultima sosta a Favignana.",
      sun: "Alba 07:15 · tramonto 18:39 · crepuscolo civile fino alle 19:05.",
      moon: "Falce crescente · levata 08:02 · tramonto 18:45."
    }
  ]
};

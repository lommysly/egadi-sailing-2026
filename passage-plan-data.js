/*
 * Dati pubblici del Passage Plan. Vengono aggiornati dallo skipper dopo ogni
 * briefing: nessun dato personale o informazione di Crew List va inserito qui.
 */
window.PASSAGE_PLAN_DATA = {
  updatedAt: "11 settembre 2026 · quadro pubblicato 27 giorni prima della partenza",
  phase: "27 giorni alla partenza · quadro di pianificazione",
  confidence: "Astronomia alta · meteo non previsionale",
  status: "Pianificazione iniziale pubblicata",
  summary: "Questo è il primo quadro per organizzare la flotta: conferma l'itinerario flessibile, la luce disponibile e gli scenari di cala da vivere. Non contiene una previsione di vento, onda o correnti; quella verrà pubblicata solo nella finestra utile, con fonti e ora di emissione.",
  sourceNote: "Consultazione astronomica: 11 settembre 2026, 01:56 CEST, fuso Europe/Rome. Le calette sono scenari possibili, non posti assegnati: ogni sera lo skipper sceglie porto, boa autorizzata o rada ammessa solo dopo controllo di meteo, onda, fondale, zonazione AMP, ordinanze e disponibilità.",
  sources: [
    { label: "Fonte astronomica", url: "https://aa.usno.navy.mil/data/api" },
    { label: "AMP Egadi · zonazione", url: "https://www.ampisoleegadi.it/index.php/zonazione/" },
    { label: "AMP Egadi · campi boe", url: "https://www.ampisoleegadi.it/index.php/campi-boe/" }
  ],
  stopsNote: "Per ottobre 2026, la disciplina AMP, le eventuali autorizzazioni e le ordinanze vigenti andranno controllate nel briefing operativo: una bella cala non equivale automaticamente a una rada idonea per la notte.",
  days: [
    {
      date: "Giovedì 8 ottobre",
      route: "Marsala → Levanzo",
      plan: "Partenza alle 15:00 con cambusa già pronta. Cerchiamo la luce del tramonto e, se le condizioni lo consentono, una notte calma a Levanzo.",
      overnight: "Rada a Levanzo solo se ammessa, ridossata e confortevole; altrimenti porto o ridosso alternativo scelto dallo skipper.",
      alternative: "Ridosso alternativo o variazione di rotta decisi dagli skipper.",
      stops: [
        {
          moment: "Tramonto · possibile rada",
          title: "Cala Tramontana o Cala del Genovese",
          description: "Scenari sul lato ovest / nord-ovest da considerare per la luce della sera, senza preassegnare una cala alla flotta.",
          check: "Da validare: ridosso, fondale, zonazione AMP, ordinanze, autorizzazioni e traffico."
        },
        {
          moment: "Alba · ridosso alternativo",
          title: "Cala Fredda, Cala Minnola o Cala Dogana",
          description: "Alternative sul lato est per svegliarsi con il sole, se sono compatibili con la condizione reale e con il piano di navigazione del venerdì.",
          check: "La notte non è promessa: l'ultima scelta è dello skipper della singola barca."
        }
      ],
      wind: "Nessun valore pubblicato 27 giorni prima della partenza: non è una previsione.",
      sea: "Nessun valore pubblicato: onda e periodo saranno indicati nel briefing utile.",
      air: "Scenario stagionale soltanto; temperatura operativa nel briefing utile.",
      water: "Dato locale da verificare con fonte marina e osservazione a bordo.",
      currents: "Da valutare nella finestra operativa, non stimati ora.",
      decision: "Rada, ridosso e orario definitivo vengono confermati dallo skipper prima della partenza.",
      sun: "Alba 07:12 · tramonto 18:43 · crepuscolo civile fino alle 19:09.",
      moon: "Falce calante · levata 04:45 · tramonto 17:29."
    },
    {
      date: "Venerdì 9 ottobre",
      route: "Levanzo → Marettimo",
      plan: "Seconda caletta a Levanzo, pranzo a bordo e navigazione verso Marettimo. Notte in porto e serata nel borgo.",
      overnight: "Porto di Marettimo: è il piano base della serata, con cena libera a terra o a bordo e ritrovo nel borgo.",
      alternative: "La traversata e le soste dipendono da onda, vento e comfort della flotta.",
      stops: [
        {
          moment: "Alba / bagno · sosta diurna",
          title: "Cala Fredda o Cala Minnola",
          description: "Una seconda cala di Levanzo, da scegliere al risveglio per luce, mare e comodità dell'equipaggio prima della traversata.",
          check: "Sosta solo diurna e solo se ammessa dalle regole vigenti e dal fondale controllato."
        },
        {
          moment: "Marettimo · arrivo serale",
          title: "Porto, non rada improvvisata",
          description: "La meta della notte è il porto: permette di vivere il borgo senza trasformare la serata in una decisione di ancoraggio.",
          check: "Eventuali boe restano soltanto un'opzione autorizzata e disponibile, mai il piano presunto."
        }
      ],
      wind: "Nessun valore pubblicato 27 giorni prima della partenza: non è una previsione.",
      sea: "Nessun valore pubblicato: onda e periodo saranno indicati nel briefing utile.",
      air: "Scenario stagionale soltanto; temperatura operativa nel briefing utile.",
      water: "Dato locale da verificare con fonte marina e osservazione a bordo.",
      currents: "Da valutare nella finestra operativa, non stimati ora.",
      decision: "La traversata verso Marettimo parte solo con finestra confortevole per la flotta.",
      sun: "Alba 07:13 · tramonto 18:42 · crepuscolo civile fino alle 19:08.",
      moon: "Falce calante · levata 05:52 · tramonto 17:54."
    },
    {
      date: "Sabato 10 ottobre",
      route: "Marettimo → Favignana",
      plan: "Esplorazione di Marettimo, poi rotta verso Favignana. Arrivo in porto, cena collettiva, DJ set e festa.",
      overnight: "Porto di Favignana: cena collettiva, DJ set e festa, con rientro a bordo a fine serata.",
      alternative: "Boe, porto e percorso costiero saranno confermati nel briefing del giorno.",
      stops: [
        {
          moment: "Marettimo · luce del mattino",
          title: "Punta Troia, Scalo Maestro o Cala Manione",
          description: "Scenari di costa per osservare Marettimo dal mare, lasciando allo skipper distanza, rotta e sosta effettiva.",
          check: "Le zone e i fondali sono soggetti a tutela: non sono istruzioni di ancoraggio."
        },
        {
          moment: "Favignana · arrivo e festa",
          title: "Ingresso in porto nel tardo pomeriggio",
          description: "Il tramonto accompagna l'arrivo in paese; il pernottamento già previsto è in porto, non in cala.",
          check: "Orario e approccio vengono adattati alla traversata reale e alla disponibilità di posto barca."
        }
      ],
      wind: "Nessun valore pubblicato 27 giorni prima della partenza: non è una previsione.",
      sea: "Nessun valore pubblicato: onda e periodo saranno indicati nel briefing utile.",
      air: "Scenario stagionale soltanto; temperatura operativa nel briefing utile.",
      water: "Dato locale da verificare con fonte marina e osservazione a bordo.",
      currents: "Da valutare nella finestra operativa, non stimati ora.",
      decision: "Boe, porto e approccio costiero restano subordinati a ordinanze, disponibilità e condizioni reali.",
      sun: "Alba 07:15 · tramonto 18:42 · crepuscolo civile fino alle 19:08.",
      moon: "Luna nuova · levata 06:58 · tramonto 18:20."
    },
    {
      date: "Domenica 11 ottobre",
      route: "Favignana → Marsala",
      plan: "Calette di Favignana fino alle 15:30 circa, quindi rientro per essere a Marsala entro le 18:00.",
      overnight: "Nessun pernottamento: rientro a Marsala in porto entro le 18:00.",
      alternative: "La sosta finale viene ridotta o anticipata se necessario per un rientro puntuale e sicuro.",
      stops: [
        {
          moment: "Alba / bagno · costa est",
          title: "Cala Azzurra o Cala Rossa",
          description: "Scenari per il sole del mattino, da scegliere soltanto se mare, fondale e affollamento rendono la sosta semplice e sicura.",
          check: "Sono soste diurne possibili: non prevedono pernottamento e non sostituiscono la verifica AMP."
        },
        {
          moment: "Piano B · costa ovest",
          title: "Cala Rotonda o Preveto",
          description: "Alternative da valutare se il lato est non è confortevole; il tempo di rientro verso Marsala rimane sempre prioritario.",
          check: "Partenza da Favignana intorno alle 15:30, salvo anticipo deciso dallo skipper."
        }
      ],
      wind: "Nessun valore pubblicato 27 giorni prima della partenza: non è una previsione.",
      sea: "Nessun valore pubblicato: onda e periodo saranno indicati nel briefing utile.",
      air: "Scenario stagionale soltanto; temperatura operativa nel briefing utile.",
      water: "Dato locale da verificare con fonte marina e osservazione a bordo.",
      currents: "Da valutare nella finestra operativa, non stimati ora.",
      decision: "Il rientro puntuale a Marsala prevale sulla durata dell'ultima sosta a Favignana.",
      sun: "Alba 07:15 · tramonto 18:39 · crepuscolo civile fino alle 19:05.",
      moon: "Falce crescente · levata 08:02 · tramonto 18:45."
    }
  ]
};

/*
 * Dati pubblici del Passage Plan. Vengono aggiornati dallo skipper dopo ogni
 * briefing: nessun dato personale o informazione di Crew List va inserito qui.
 */
window.PASSAGE_PLAN_DATA = {
  updatedAt: "11 settembre 2026 · briefing T−27",
  phase: "T−27 · quadro di pianificazione",
  confidence: "Astronomia alta · meteo non previsionale",
  status: "Pianificazione iniziale pubblicata",
  summary: "Questo è il primo quadro per organizzare la flotta: conferma l'itinerario flessibile e la luce disponibile in ogni giornata. Non contiene una previsione di vento, onda o correnti; quella verrà pubblicata solo nella finestra utile, con fonti e ora di emissione.",
  sourceNote: "Astronomia: U.S. Naval Observatory, servizio Sun and Moon Data, coordinate delle tappe e fuso Europe/Rome. Per il briefing operativo saranno confrontati i bollettini Meteo Aeronautica per la Sicilia sud-occidentale e i dati marini Copernicus, con verifica reale dello skipper.",
  days: [
    {
      date: "Giovedì 8 ottobre",
      route: "Marsala → Levanzo",
      plan: "Partenza alle 15:00 con cambusa già pronta. Rada e sosta al tramonto da scegliere secondo ridosso, mare e ordinanze.",
      alternative: "Ridosso alternativo o variazione di rotta decisi dagli skipper.",
      wind: "Nessun valore pubblicato a T−27: non è una previsione.",
      sea: "Nessun valore pubblicato a T−27: onda e periodo saranno indicati a T−10.",
      air: "Scenario stagionale soltanto; temperatura operativa a T−10.",
      water: "Dato locale da verificare con fonte marina e osservazione a bordo.",
      currents: "Da valutare nella finestra operativa, non stimati ora.",
      sun: "Alba 07:12 · tramonto 18:43 · crepuscolo civile fino alle 19:09.",
      moon: "Falce calante · levata 04:45 · tramonto 17:29."
    },
    {
      date: "Venerdì 9 ottobre",
      route: "Levanzo → Marettimo",
      plan: "Seconda caletta a Levanzo, pranzo a bordo e navigazione verso Marettimo. Notte in porto e serata nel borgo.",
      alternative: "La traversata e le soste dipendono da onda, vento e comfort della flotta.",
      wind: "Nessun valore pubblicato a T−27: non è una previsione.",
      sea: "Nessun valore pubblicato a T−27: onda e periodo saranno indicati a T−10.",
      air: "Scenario stagionale soltanto; temperatura operativa a T−10.",
      water: "Dato locale da verificare con fonte marina e osservazione a bordo.",
      currents: "Da valutare nella finestra operativa, non stimati ora.",
      sun: "Alba 07:13 · tramonto 18:42 · crepuscolo civile fino alle 19:08.",
      moon: "Falce calante · levata 05:52 · tramonto 17:54."
    },
    {
      date: "Sabato 10 ottobre",
      route: "Marettimo → Favignana",
      plan: "Esplorazione di Marettimo, poi rotta verso Favignana. Arrivo in porto, cena collettiva, DJ set e festa.",
      alternative: "Bo(e), porto e percorso costiero saranno confermati nel briefing del giorno.",
      wind: "Nessun valore pubblicato a T−27: non è una previsione.",
      sea: "Nessun valore pubblicato a T−27: onda e periodo saranno indicati a T−10.",
      air: "Scenario stagionale soltanto; temperatura operativa a T−10.",
      water: "Dato locale da verificare con fonte marina e osservazione a bordo.",
      currents: "Da valutare nella finestra operativa, non stimati ora.",
      sun: "Alba 07:15 · tramonto 18:42 · crepuscolo civile fino alle 19:08.",
      moon: "Luna nuova · levata 06:58 · tramonto 18:20."
    },
    {
      date: "Domenica 11 ottobre",
      route: "Favignana → Marsala",
      plan: "Calette di Favignana fino alle 15:30 circa, quindi rientro per essere a Marsala entro le 18:00.",
      alternative: "La sosta finale viene ridotta o anticipata se necessario per un rientro puntuale e sicuro.",
      wind: "Nessun valore pubblicato a T−27: non è una previsione.",
      sea: "Nessun valore pubblicato a T−27: onda e periodo saranno indicati a T−10.",
      air: "Scenario stagionale soltanto; temperatura operativa a T−10.",
      water: "Dato locale da verificare con fonte marina e osservazione a bordo.",
      currents: "Da valutare nella finestra operativa, non stimati ora.",
      sun: "Alba 07:15 · tramonto 18:39 · crepuscolo civile fino alle 19:05.",
      moon: "Falce crescente · levata 08:02 · tramonto 18:45."
    }
  ]
};

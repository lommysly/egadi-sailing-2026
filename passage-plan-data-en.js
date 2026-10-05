/*
 * Edizione inglese editoriale del briefing pubblico.
 * URL condivisi con l'edizione italiana; testi e valutazioni tradotti a mano.
 */
(() => {
  const base = window.PASSAGE_PLAN_DATA;
  if (!base) return;
  const source = (index, label, scope, checkedAt, product, model, availability = '') => ({
    url: base.sources[index].url, label, scope, checkedAt, product, model, availability
  });
  window.PASSAGE_PLAN_DATA_EN = {
    updatedAt: "5 October 2026 · 08:09 CEST (UTC+2)",
    phase: "Skippers’ call briefing · T−3",
    confidence: "High uncertainty on Friday 9 · Sunday assessed with GFS and ICON, pending a new long ECMWF run",
    status: "Multi-model forecast available · not the skipper’s go-ahead",
    publishedAt: "5 October 2026 · morning edition for the 20:00 skippers’ call",
    validFrom: "Period assessed: 8–11 October 2026 · local Europe/Rome times (CEST, UTC+2)",
    validUntil: "Review today at 19:00 before the call; current observations, warnings and newer official bulletins always take priority.",
    nextUpdateAt: "5 October · scheduled check at 19:00 before the 20:00 call",
    nextUpdateReason: "One pre-call check is configured, not continuous monitoring. Further checks are needed on the 7th and before each departure: Friday thunderstorms, W–NW waves on the 9th–10th, the Levanzo overnight stop and harbour access may change the plan.",
    dataMode: "operational",
    weatherNoticeTitle: "The forecast covers the trip, but official short-range confirmation is still pending.",
    weatherNoticeText: "ECMWF, GFS and ICON atmospheric scenarios and WAM, GFS-Wave and MFWAM wave scenarios are compared separately. The latest short ECMWF run does not cover Sunday: older stitched values are not attributed to that run.",
    summary: "Two departures from Marsala: Thursday afternoon via Levanzo, and Friday morning directly towards Marettimo. The shared aim is to berth inside Marettimo harbour on Friday evening and Favignana harbour on Saturday evening, but only if conditions, access and space allow. Friday is the most uncertain day, with possible thunderstorms and rising westerly seas; there is no confirmed crossing window yet. Southern Favignana moorings remain a fallback to verify, not an available refuge. Sunday’s return to Marsala by 18:00 needs margin for the slowest boat.",
    decisiveFactors: [
      "Thursday 8 at 15:00: ECMWF/GFS show roughly 16–20 kn from SSE–S, gusting 26; ICON about 11–13 kn. At 4 kn, 14–16 NM takes 3 h 30–4 h, reaching Levanzo near or after the 18:43 sunset.",
      "Friday 9: ECMWF places the thunderstorm signal around 09:00–14:00; WAM brings waves up to 1.8 m in the afternoon/evening. GFS is weaker. No Marettimo window is secured.",
      "Sunday 11: Favignana–Marsala takes about 2 h 25 min at 5 kn. A 15:30 departure leaves almost no margin; at 4 kn the 18:00 deadline cannot be met."
    ],
    callBriefing: {
      title: "Two departures, both from Marsala",
      introduction: "Thursday 8 afternoon and Friday 9 morning each need their own departure briefing. Data checked on 5 October at 08:09 for the 20:00 call. The shared aim is to be inside Marettimo harbour on Friday evening. Skipping Levanzo shortens Friday’s programme, but does not remove thunderstorms, open-water exposure or the need to check the entrance.",
      options: [
        {
          title: "Thursday 8 · departure around 15:00", route: "Marsala → Levanzo · about 14–16 NM", course: "NNW, about 338° true · east of Favignana with appropriate offing", duration: "4 kn: 3 h 30–4 h · 5 kn: 2 h 50–3 h 15 · 6 kn: 2 h 20–2 h 40",
          ratings: { departure: { tone: "caution", text: "SSE–S 16–20 kn, gusting 26; check actual wind and waves at Marsala’s entrance." }, passage: { tone: "caution", text: "Short SSE–S sea, Hs 0.7–1.3 m; a broadly following passage, with comfort assessed for the slowest boat." }, arrival: { tone: "unknown", text: "No exact overnight berth or anchorage selected. It must remain suitable through Friday’s W–NW shift, not simply offer a sunset view." } },
          wind: "12:00–21:00: ECMWF 13–20 kn / gusts 26; GFS 14–19 kn (gusts need rechecking), from 150–173° (SSE–S). ICON 3–15 kn / 22, turning S to W–NW later.",
          sea: "WAM 0.7–1.1 m, GFS-Wave 0.7–1.1 m, MFWAM 1–1.3 m; from SSE–S (148–168°), period 3.5–4.8 s. Mostly wind sea.",
          window: "A 15:00 start at 4 kn gives an indicative 18:30–19:00 arrival, against sunset at 18:43. Consider 13:30–14:00 only if charter handover and boarding allow; an earlier departure is not confirmed.",
          decision: "Confirm the overnight stop and fallback before leaving. On Friday this group departs from Levanzo; use the daily crossing card below.",
          alternative: "Stay in Marsala or shorten to Favignana harbour with access and a berth confirmed. Cala Fredda, Minnola and Dogana are not automatic shelters in S–SE wind."
        },
        {
          title: "Friday 9 · morning departure", route: "Marsala → Marettimo direct, skipping Levanzo · about 22–24 NM", course: "NW, about 300° true · south/west of Favignana, to be checked on a chart", duration: "4 kn: 5 h 30–6 h · 5 kn: 4 h 25–4 h 50 · 6 kn: 3 h 40–4 h",
          ratings: { departure: { tone: "caution", text: "06:00–12:00 off Marsala: ECMWF 2–6 kn / gusts 9–15; GFS 6–13 kn; ICON 12–14 kn / gusts 23. Directions differ; check the entrance locally." }, passage: { tone: "adverse", text: "ECMWF shows thunderstorms along the route during 08:00–16:00; ICON W–NW up to 22 kn / gusts 31. Wind can be almost head-on towards Marettimo." }, arrival: { tone: "unknown", text: "Marettimo is the shared aim, but harbour access and berths are unconfirmed. Offshore waves may continue rising overnight." } },
          wind: "08:00–16:00 along this route: ECMWF 3–18 kn / gusts 25 from SW–NW; GFS 4–12 kn (gusts need rechecking) turning SE to NW; ICON 12–22 kn / 31 from W–WNW (278–296°). Do not average these scenarios.",
          sea: "08:00–16:00: WAM Hs 0.6–1.4 m turning SW to NW, GFS-Wave 0.4–0.7 m, MFWAM 0.7–0.9 m; period 3.1–5.3 s. Southerly residual waves and new westerly sea may overlap. WAM reaches 1.8 m in the northern channel later.",
          window: "Compare 06:00–08:00 and 08:00–10:00, without calling either favourable yet: a 4–6-hour passage can encounter the 09:00–14:00 weather. Full daylight is unavailable before sunrise at 07:13. Leaving later can expose the boat to rising afternoon seas.",
          decision: "Aim for Marettimo without Levanzo only after checking the passage and confirming the harbour. Agree a latest time to abandon the crossing in the call; the rendezvous must not force an unsuitable entry.",
          alternative: "Stay in Marsala, or shorten to Favignana harbour, about 11–13 NM, with conditions, access and a berth checked. Via Levanzo adds 14–16 NM followed by another 13 NM to Marettimo: it is not Friday’s shortcut."
        }
      ],
      decisions: [
        "First night: which documented shelter remains suitable as S wind turns W–NW? A sunset view is not a shelter assessment.",
        "Friday Marettimo and Saturday Favignana: which berth, exposure and spaces are confirmed? Identify any Favignana mooring field and verify October and overnight operation.",
        "Sunday: consider a 14:00–14:30 departure, recalculated for the slowest boat and check-out arrangements."
      ]
    },
    harbourChecks: {
      title: "The two harbour nights and a possible fallback",
      introduction: "Entering a harbour and staying overnight are separate checks. Wave heights below are offshore forecasts, not harbour surge measurements. Current access, fleet berth availability and mooring-field operation have not been confirmed.",
      items: [
        {
          title: "Friday 9 · Marettimo, Scalo Nuovo",
          rating: { tone: "unknown", text: "Shared aim · access and berths need direct confirmation." },
          exposure: "The village’s landings are on the eastern coast. With W–NW wind the island may shelter that side: this is a geographical inference, not an entrance-wave measurement. E–SE wind and residual southerly waves need a different assessment. Do not confuse Scalo Nuovo, Scalo Vecchio and Scalo Maestro near Punta Troia.",
          forecast: "16:00–23:00 offshore east of the island: about 10–20 kn from W–NW, gusts up to 28. WAM Hs 1.4–2 m; GFS-Wave 0.7–1 m; MFWAM about 1 m. Period 4–6 s; WAM continues rising after arrival.",
          check: "Ask the operator for the exact berth and spaces for all boats, permitted draught, actual surge at the entrance and pontoons, lee-side gusts, ferry movements and current works or restrictions. No up-to-date entrance survey is available here.",
          alternative: "The Marsala group can remain at base. The Levanzo group needs a legal, checked waiting shelter or another confirmed harbour before committing. Do not reach Marettimo merely to keep the rendezvous.",
          sourceLabel: "Marettimo Marine · operator contacts", sourceUrl: base.harbourChecks.items[0].sourceUrl
        },
        {
          title: "Saturday 10 · Favignana harbour",
          rating: { tone: "caution", text: "W–NW sea · verify the assigned pontoon and overnight surge." },
          exposure: "Marina di Favignana describes its Praia sector as exposed to northerly winds and mistral seas. This cannot be extended to every berth in the harbour: being inside does not by itself establish the shelter available.",
          forecast: "16:00–18:00 off the north coast: about 11–16 kn from WNW–NNW, gusts 21. WAM Hs 1.4–1.5 m, GFS-Wave 1–1.1 m, MFWAM 0.6–0.7 m; period about 5–6 s. GFS-Wave retains 1–1.2 m until 23:00; easing wind does not immediately remove the waves.",
          check: "Confirm pontoon, exposure, surge and each boat’s berth; check depth, daylight entry, ferry traffic and current notices/works. Hydrographic Notice 20.15 and chart 259 also concern anchoring restrictions, not proof of harbour access.",
          alternative: "If the assigned berth is unsuitable, consider only another documented berth or a mooring field verified for that night. These cards are not bookings.",
          sourceLabel: "Marina di Favignana · operator’s exposure description", sourceUrl: base.harbourChecks.items[1].sourceUrl
        },
        {
          title: "Favignana · possible mooring-field fallback",
          rating: { tone: "unknown", text: "Exact field and October operation unconfirmed." },
          exposure: "The 2026 MPA rules list Cala Azzurra, Marasolo, Scindo Passo and Preveto on the southern side among other fields. Geography may provide less exposure to NW weather, but wrapping swell, gusts and wind shifts can change that. Northern fields are not equivalent.",
          forecast: "Assess wave direction and period throughout the night, not just arrival wind. No measurements inside these fields or checks of individual moorings are available here.",
          check: "Ask the MPA for the field’s name and location, moorings still installed in October, availability, length/displacement limits, overnight permission and any suspension. Mooring to a buoy and anchoring are different activities with different rules.",
          alternative: "The buoy field ‘on the other side of the harbour’ has not been identified and is not presented as a refuge. Without confirmation, retain a previously checked harbour or shelter.",
          sourceLabel: "Egadi MPA · seasonal fields and permits", sourceUrl: base.harbourChecks.items[2].sourceUrl
        }
      ]
    },
    missingChecks: [
      "Meteomar/NETTUNO, Civil Protection alerts, radar and coastal observations within the 24–72-hour window.",
      "Marettimo and Favignana berths, October mooring-field operation and MPA permits.",
      "Actual entrance conditions, depth/draught, ferry traffic and current Notices to Mariners before every approach.",
      "No official local tide or current observation for Marsala–Egadi is available here. Coarse model output cannot replace onboard checks."
    ],
    orientationNotes: [
      "Orientation sketch only: not a nautical chart and not for navigation.",
      "Exposed points: Marsala in southerly seas; open Levanzo–Marettimo crossing; the southern/western approach from Marsala; Punta Troia; Punta Marsala on return.",
      "Thursday uses Levanzo. Friday’s direct scenario skips it, passing south/west of Favignana. Both aim for Marettimo on Friday, weather permitting.",
      "Alternatives require access and berth checks: stay in Marsala, postpone Marettimo, shorten to Favignana, return earlier."
    ],
    sourceNote: "Checked on 5 October at 08:09 CEST at eight sea points, including southern Favignana and the southern channel for Friday’s Marsala group. Atmospheric runs: IFS 04/10 18 UTC, GFS/ICON 05/10 00 UTC; waves WAM 04/10 18 UTC, GFS-Wave 05/10 00 UTC, MFWAM 04/10 12 UTC. The short IFS run ends on the 10th at 21:00 CEST and WAM on the 10th at 23:00 CEST. Sunday uses only GFS/ICON and GFS-Wave/MFWAM. Wind/wave directions are FROM; current directions are TO. Hs is significant height, not maximum wave height. Offshore grids do not resolve harbour entrances. Some returned GFS gust values are lower than mean wind at the same point/hour: this field is excluded from gust comparisons pending recheck.",
    sources: [
      source(0, "ECMWF IFS · queried data", "wind, gusts and rain along the area", "5 October · 08:09 CEST", "Open-Meteo Forecast API", "ECMWF IFS HRES · 04/10 18 UTC run · about 9 km", "latest short run to 10 October 21:00 CEST; excluded from Sunday"),
      source(1, "NOAA GFS · queried data", "independent atmospheric scenario", "5 October · 08:09 CEST", "Open-Meteo Forecast API", "NOAA GFS · 05/10 00 UTC run · about 13 km", "hourly · 8–11 October"),
      source(2, "DWD ICON · queried data", "third independent atmospheric scenario", "5 October · 08:09 CEST", "Open-Meteo Forecast API", "DWD global ICON · 05/10 00 UTC run · about 11 km", "hourly · 8–11 October"),
      source(3, "Open-Meteo Marine · wave comparison", "significant height, direction, period and available components", "5 October · 08:09 CEST", "Marine Weather API", "WAM 04/10 18 UTC · GFS-Wave 05/10 00 UTC · MFWAM 04/10 12 UTC", "WAM to 10 October 23:00 CEST; Sunday GFS-Wave/MFWAM only"),
      source(4, "Model issue times and coverage", "model metadata, distinct from consultation time", "5 October · 08:10 CEST", "model static/meta.json", "latest run and data_end_time", "no attribution beyond the latest short ECMWF run"),
      source(5, "Currents and sea temperature", "Marsala offshore and Levanzo–Marettimo channel, not entrances", "5 October · 07:06 CEST", "Marine API · SST and ocean currents", "Météo-France products · issue time not verified", "8–11 October · about 8 km · km/h converted to knots"),
      source(6, "Italian Air Force · Meteomar", "Sicily Channel and western Southern Tyrrhenian", "5 October · 02:00 CEST issue, checked 07:05", "Meteomar", "official bulletin", "current S3 / SE4 situation, not an 8–11 October forecast"),
      source(7, "ISPRA · wave buoy network", "nearest reference: Mazara del Vallo/Capo Granitola", "4 October · 20:30 CEST", "RON", "observation, not forecast", "wave/current unavailable in latest report; not representative of Marsala/Egadi"),
      source(8, "Italian Hydrographic Institute · Notices", "Marsala wreck/exclusion and Favignana anchoring limits", "issue 20/2026 · 30 September", "Notices to Mariners · charts 258, 259, 260", "official source"),
      source(9, "Egadi MPA · 2026 rules", "zoning, permits, sensitive seabeds, anchoring and moorings", "5 October · valid to 31 December", "2026 supplementary rules", "official local source", "seasonal fields and availability require direct confirmation"),
      source(10, "US Naval Observatory · astronomy", "sunrise, sunset, twilight and Moon · 37.9 N / 12.4 E", "4 October 2026", "Sun and Moon Data for One Day", "astronomical calculation · Europe/Rome UTC+2"),
      source(11, "Marettimo Marine · operator", "contact for Scalo Nuovo access, berths and conditions", "5 October · 08:15 CEST · indexed page", "operator page", "no weather measurement", "no direct reply or access/berth confirmation obtained"),
      source(12, "Marina di Favignana · operator", "Praia sector exposed to northerly winds and mistral seas", "5 October · 08:15 CEST", "operator description", "local exposure, not forecast", "does not cover every berth or confirm assigned space"),
      source(13, "Egadi MPA · mooring fields", "seasonal fields and permits alongside the 2026 rules", "5 October · 08:15 CEST", "official local information", "no wind/wave measurement", "October installation, availability and overnight permission unconfirmed")
    ],
    modelComparison: [
      { parameter: "Wind · 8 October at 15:00", scenarios: "ECMWF/GFS SSE–S 16–20 kn / gusts 26 · ICON 11–13 kn", divergence: "high on strength", decisionImpact: "plan for the stronger scenario, shelter and daylight margin" },
      { parameter: "Marsala departure · Friday morning", scenarios: "ECMWF light at the exit but thunderstorms around 09:00–14:00; GFS less severe; ICON W–NW rising to 22 kn / gusts 31 along the route", divergence: "high between exit and crossing, not just models", decisionImpact: "one harbour value cannot clear a 4–6-hour passage" },
      { parameter: "Wind/weather · 9 October", scenarios: "ECMWF thunderstorms around 09:00–14:00 and W–NW up to 19 kn · ICON W–NW up to 21 kn · GFS weaker and limited rain", divergence: "high on weather, strength and shift timing", decisionImpact: "Friday is not automatically better; Marettimo needs an on-the-day decision" },
      { parameter: "Waves · 9–10 October", scenarios: "Friday afternoon WAM up to 1.8 m NW, GFS-Wave 0.4–0.9 m, MFWAM 0.6–1 m. Saturday WAM 1.3–1.7 m, GFS-Wave 1–1.5 m, MFWAM 0.6–1.1 m", divergence: "high; do not average away WAM", decisionImpact: "western crossing and Punta Troia need review; residual sea may outlast the wind" },
      { parameter: "Return · 11 October", scenarios: "GFS/ICON WNW–NNW about 6–12 kn; GFS-Wave 0.6–1 m, MFWAM 0.4–0.6 m. Latest short IFS/WAM run does not cover these hours", divergence: "wave spread and missing fresh ECMWF comparison", decisionImpact: "retain time margin and review the next long run" }
    ],
    climateOutlook: {
      title: "Air, water and daylight",
      disclaimer: "Modelled values and astronomical calculations, not climate averages or measurements in coves. Operational detail is in the cards.",
      items: [
        { icon: "air", label: "Air", value: "20–27°C", detail: "indicative range at the points and times assessed" },
        { icon: "water", label: "Sea", value: "24–25°C", detail: "modelled surface temperature, not an anchorage reading" },
        { icon: "wind", label: "Wind", value: "variable", detail: "large model spread on the 8th and 9th" },
        { icon: "rain", label: "Instability", value: "Friday", detail: "ECMWF signal mainly morning/early afternoon on the 9th" },
        { icon: "sun", label: "Daylight", value: "about 11 h 30 min", detail: "sunset moves from 18:43 to 18:39" }
      ]
    },
    stopsNote: "A scenic cove is not automatically a safe anchorage. Shelter, residual sea, seabed, swinging room, MPA rules, permits and availability must be checked together. A seasonal field cannot be assumed operational in October.",
    mooringGuide: {
      title: "Where could we stay or wait for daylight?",
      introduction: "Scenarios to verify, not bookings. Western shores face sunset, eastern shores sunrise; shelter depends on wind and waves throughout the night.",
      checks: [
        { title: "Levanzo · sunset", text: "Cala Tramontana and Capo Grosso face W–NW but are exposed to N and W seas. Cala del Genovese is subject to MPA rules: stopping and overnight permission need checking." },
        { title: "Levanzo · sunrise and fallback", text: "Cala Fredda, Minnola and Dogana lie on the E–SE side. Dogana has ferry traffic; neither manoeuvres nor an overnight stay should be improvised." },
        { title: "Marettimo and Favignana", text: "Harbour nights require confirmed spaces. Marettimo’s Miglio Blu has restrictions; Favignana Notice 20.15 changes no-anchoring limits on chart 259. See the harbour cards above." }
      ]
    },
    days: [
      {
        date: "Thursday 8 October", route: "Marsala → Levanzo", distance: "about 14–16 NM operational · geometric line about 12.8 NM", course: "about 338° true · east of Favignana with suitable offing", duration: "4 kn: 3 h 30–4 h · 5 kn: 2 h 50–3 h 15 · 6 kn: 2 h 20–2 h 40",
        window: "At 15:00, 4 kn gives an indicative arrival 18:30–19:00, against sunset 18:43. Consider 13:30–14:00 only if handover/boarding allow; no earlier time is confirmed.",
        criticality: "Southerly wind and waves at departure; Levanzo’s overnight location still open.", uncertainty: "High on wind: ECMWF/GFS stronger, ICON lighter and turning W.",
        ratings: { departure: { tone: "caution", text: "At 15:00 ECMWF/GFS SSE–S 16–20 kn / gusts 26; check the entrance and notices." }, passage: { tone: "caution", text: "Short SSE–S waves, Hs 0.7–1.3 m; following passage but comfort and real speed need checking." }, arrival: { tone: "unknown", text: "No exact berth or anchorage selected; October moorings unconfirmed." } },
        operationalChecks: ["Meteomar/NETTUNO and actual Marsala observations.", "Hydrographic notices on the Marsala wreck/exclusion.", "Shelter, seabed, MPA permission and an exit plan if wind shifts."],
        glance: { wind: "SSE–S 16–20 kn at 15:00", windTone: "caution", sea: "SSE–S 0.7–1.3 m", seaTone: "caution", sky: "Dry in all 3 models", skyIcon: "sun", skyTone: "good" },
        plan: "For Thursday’s boats. Provisions aboard, east of Favignana; Levanzo overnight only with legal shelter and daylight margin. The geometric line excludes some offing and manoeuvres.",
        navigation: "A NNW course with SSE–S wind/waves is broadly following. ICON’s later W shift would change the final leg and comfort.",
        overnight: "A genuinely sheltered, permitted anchorage after checking; otherwise a confirmed harbour or a better-documented fallback.", overnightType: "First night · option open", overnightStatus: "Check on the day",
        alternative: "Stay in Marsala or shorten to Favignana with a confirmed berth. A nearby landfall is not automatically safe.",
        stops: [
          { moment: "Sunset · W/NW side", title: "Cala Tramontana or Genovese area", description: "Sunset aspect, but more exposed to W or N waves.", check: "MPA zoning, seabed, room, residual sea, traffic and exit route." },
          { moment: "Sunrise · E/SE side", title: "Cala Fredda, Minnola or Dogana", description: "First-light aspect; Dogana also has ferry traffic.", check: "Permission, shelter and traffic, not just the view." }
        ],
        wind: "12:00–21:00: ECMWF 13–20 kn / gusts 26; GFS 14–19 (gusts need rechecking) from SE–S (143–173°). ICON 3–15 / 22 turning S to W–NW later. 1–5 Bft depending on time/model; Friday brings a westerly shift.",
        sea: "Slight, locally moderate at the upper scenario (Douglas 3–4). WAM 0.7–1.1 m; GFS-Wave 0.7–1.1 m; MFWAM 1–1.3 m, SSE–S (148–168°), period 3.5–4.8 s. GFS-Wave mostly wind sea; MFWAM swell 0.1–0.4 m from S–SW, 4.3–5.2 s. Hs is not maximum height.",
        visibility: "ECMWF/GFS about 24–36 km; ICON unavailable. Check locally at the entrance.",
        phenomena: "Dry in all three deterministic models; fresh point ensemble unavailable. Watch actual convective development.",
        air: "About 23–27°C; variable cloud, cloud type not resolved.", water: "Modelled sea-surface temperature about 24.6–24.8°C, not a cove reading.",
        currents: "Coarse channel model about 0.2–1.1 kn towards N–NE (0–45°), about 8 km grid. Does not resolve entrance currents, tides or wind-current opposition; check on board.",
        decision: "Confirm departure and overnight stop in the early afternoon. If daylight margin shrinks, use a checked shelter.",
        sun: "Sunrise 07:12 · sunset 18:43 · civil twilight ends 19:09.", moon: "Waning crescent, 6% illuminated · moonrise 04:45 · moonset 17:30."
      },
      {
        date: "Friday 9 October", route: "Levanzo → Marettimo · Thursday group", distance: "about 13 NM", course: "south of Levanzo, then about 267° true", duration: "4 kn: 3 h 15 min · 5 kn: 2 h 36 min · 6 kn: 2 h 10 min",
        window: "Compare 08:00–10:00 and after 14:00 with radar and actual seas: ECMWF weather around 09:00–14:00, then WAM rises towards evening. No favourable window secured.",
        criticality: "Open crossing, possible thunderstorms and rising W–NW seas; entry and overnight conditions at Marettimo unconfirmed.", uncertainty: "High on storms and waves: WAM up to 1.8 m versus GFS-Wave 0.4–0.9 m later.",
        ratings: { departure: { tone: "adverse", text: "Possible thunderstorms mainly around 09:00–14:00: retain shelter until radar, bulletins and observations are checked." }, passage: { tone: "adverse", text: "W–NW can be almost head-on on the westerly course, with rising seas. Consider postponement or an alternative." }, arrival: { tone: "unknown", text: "Aim for Scalo Nuovo Friday evening; access, berths and overnight surge unconfirmed." } },
        operationalChecks: ["Radar/lightning, clouds and Meteomar before crossing.", "Marettimo berth, calling channel and instructions.", "Abandon the crossing before committing if observations do not support it."],
        glance: { wind: "W–NW 6–21 kn (12–21)", windTone: "caution", sea: "0.4–1.8 m model spread", seaTone: "caution", sky: "Storms possible around 09–14", skyIcon: "rain", skyTone: "caution" },
        plan: "For boats that left Marsala Thursday. Friday departures use the Marsala → Marettimo card above. All aim for the harbour that evening, but the crossing can be postponed or cancelled.",
        navigation: "Afternoon models turn westerly. On course 267°, W–NW can mean beating or an almost head-on wind. No sailing performance is guaranteed.",
        overnight: "Inside Marettimo only with berth, entry and overnight conditions checked; WAM approaches 2 m offshore by 23:00.", overnightType: "Second night · harbour", overnightStatus: "Availability to confirm",
        alternative: "Remain in a legal checked Levanzo shelter, move to a confirmed Favignana berth, or return to Marsala only if that route is suitable.",
        stops: [
          { moment: "Before the crossing", title: "Cala Fredda or Minnola", description: "A short stop only if it preserves the weather-decision margin.", check: "Storms, wind shift, shelter and latest abandonment time." },
          { moment: "Arrival", title: "Marettimo Scalo Nuovo", description: "Coordinate the approach to this landing with ferry traffic.", check: "Berth, local instructions, entrance wind, traffic and visibility." }
        ],
        wind: "12:00–21:00: ECMWF 9–19 kn / gusts 25; GFS 6–12 (gusts need rechecking); ICON 13–21 / 28 from W–NW (257–316°). 2–5 Bft; westerly shift/strengthening since Thursday. Do not replace morning values with evening values.",
        sea: "Slight/moderate, Douglas 3–4 in WAM. 12:00–21:00: WAM 1.1–1.8 m NW (296–308°); GFS-Wave 0.4–0.9 m S turning WNW; MFWAM 0.6–1 m S turning W. Period 3.6–5.9 s. GFS-Wave wind sea 0.3–0.7 m, swell 0.2–0.4 m at 4.5–7.2 s; MFWAM swell 0.5–0.8 m. Southerly residual sea may overlap new westerly waves.",
        visibility: "May fall rapidly in showers/storms; grid output does not resolve cell edges.",
        phenomena: "ECMWF storms around 09:00–14:00 across the area, hourly rain up to about 3 mm at sampled points. GFS dry; ICON light rain at some points on the Marsala route. No fresh ensemble or reliability percentage. Local cells/gusts may remain unresolved.",
        air: "About 20–25°C, variable cloud/rain; convective cloud possible in ECMWF.", water: "Modelled sea-surface temperature about 24.8°C.",
        currents: "Channel model about 0.2–0.7 kn towards N–NE–E (14–90°); too coarse for coastal routing or access.",
        decision: "Possible NO-GO day: storms, a wind shift or confused seas may require postponement or another destination.",
        sun: "Sunrise 07:13 · sunset 18:42 · civil twilight ends 19:08.", moon: "Waning crescent, 2% illuminated · moonrise 05:51 · moonset 17:54."
      },
      {
        date: "Saturday 10 October", route: "Marettimo → Favignana", distance: "about 12.1 NM direct · 14.5–15 NM via Punta Troia", course: "direct about 100° true; northern detour only with suitable sea and margin", duration: "direct: 4 kn 3 h 02 min · 5 kn 2 h 25 min · 6 kn 2 h 01 min",
        window: "Compare 08:00–11:00 and 12:00–15:00: westerly waves remain in both. Afternoon is not automatically better. Confirm a suitable berth and daylight arrival before departure.",
        criticality: "Residual NW waves on Marettimo’s exposed coast; model wave-height spread.", uncertainty: "High: WAM 1.3–1.7 m, GFS-Wave 1–1.5 m, MFWAM 0.6–1.1 m.",
        ratings: { departure: { tone: "caution", text: "Check NW waves before leaving shelter or approaching the exposed coast." }, passage: { tone: "caution", text: "W–NW/NNW 9–16 kn, waves up to 1.7 m; avoid unnecessary exposed detours." }, arrival: { tone: "caution", text: "Check Favignana’s pontoon: the consulted operator’s Praia sector is exposed to mistral seas. Berths unconfirmed." } },
        operationalChecks: ["Actual NW waves off Marettimo.", "MPA and Miglio Blu restrictions.", "Favignana berth and entry instructions, with daylight for manoeuvres."],
        glance: { wind: "W–NNW 9–16 kn", windTone: "caution", sea: "W–NW 0.6–1.7 m", seaTone: "caution", sky: "Light showers possible", skyIcon: "rain", skyTone: "caution" },
        plan: "Explore only while conditions allow, then sail direct to Favignana for daylight entry.",
        navigation: "The easterly course puts westerly wind astern; comfort still depends on residual waves, not just local wind.",
        overnight: "Favignana harbour with the pontoon and night conditions checked. Southern moorings only after MPA confirmation of operation, availability and overnight permission.", overnightType: "Third night · harbour", overnightStatus: "Availability to confirm",
        alternative: "Skip Punta Troia and sail direct. If the direct leg is unsuitable too, stay in a confirmed Marettimo berth.",
        stops: [
          { moment: "Morning · Marettimo", title: "Punta Troia only if conditions allow", description: "Adds about 2.5–3 NM on the exposed side.", check: "NW waves, offing, protected areas and time left." },
          { moment: "Arrival · Favignana", title: "Harbour before evening", description: "A daylight approach preserves manoeuvring margin.", check: "Availability, calling channel, ferries and Notice 20.15." }
        ],
        wind: "08:00–19:00: ECMWF 12–16 kn / gusts 22 NW (300–320°); GFS 9–15 (gusts need rechecking) W–NW (276–309°); ICON 12–16 / 25 NNW (327–344°). 3–4 Bft; Sunday models ease the wind, with residual sea.",
        sea: "Slight/moderate, Douglas 3–4. WAM 1.3–1.7 m NW (293–320°); GFS-Wave 1–1.5 m WNW (295–300°); MFWAM 0.6–1.1 m W (272–282°). Period 5.1–6.4 s. GFS-Wave wind sea 0.9–1.5 m and swell 0.1–0.7 m; MFWAM swell 0.6–0.9 m. Components must not be added arithmetically.",
        visibility: "ECMWF about 6–42 km at sampled points; verify showers and entrance visibility.",
        phenomena: "Light rain in ECMWF/ICON, up to about 0.5 mm/h; GFS dry. No fresh ensemble; this does not guarantee no local storms.",
        air: "About 21–23°C, variable cloud.", water: "Modelled sea-surface temperature about 24.5°C.",
        currents: "Ocean model about 0.2–0.3 kn, variable direction; not for coastal manoeuvring.",
        decision: "Check the NW sea before leaving. Direct avoids Punta Troia, but still needs suitable real conditions and a checked Favignana berth.",
        sun: "Sunrise 07:14 · sunset 18:40 · civil twilight ends 19:07.", moon: "New Moon, 0% illuminated · moonrise 06:57 · moonset 18:19."
      },
      {
        date: "Sunday 11 October", route: "Favignana → Marsala", distance: "about 11.5–12.5 NM without crossing land", course: "east out of harbour, eastern coast, round Punta Marsala, then SE", duration: "4 kn: about 3 h · 5 kn: about 2 h 25 min · 6 kn: about 2 h",
        window: "Leave before 15:30 for margin. At 5 kn a 15:30 start gives about 17:55 without reserve; at 4 kn arrival is after 18:30.",
        criticality: "Return timing and Marsala access; final wind assessment still pending.", uncertainty: "Fresh ECMWF comparison missing: its latest short run does not cover these hours. GFS/ICON agree on the W–N quadrant, not exact strength.",
        ratings: { departure: { tone: "caution", text: "Modest modelled wind/waves, but the day’s official bulletin and local access are not yet available." }, passage: { tone: "caution", text: "Relatively favourable weather; a 15:30 departure still leaves too little margin at 4–5 kn." }, arrival: { tone: "caution", text: "Current Marsala notices apply; return before 18:00." } },
        operationalChecks: ["Slowest boat’s realistic arrival before the final swim.", "Visibility, traffic and actual Marsala entrance conditions.", "Notices, fuel and check-out time reserve."],
        glance: { wind: "WNW–NNW 6–12 kn", windTone: "calm", sea: "0.4–1 m, westerly residual sea", seaTone: "caution", sky: "Dry in GFS/ICON", skyIcon: "sun", skyTone: "good" },
        plan: "Final stop only if return margin survives. Go east around Favignana and Punta Marsala; a straight line would cross land.",
        navigation: "Light wind may reduce sailing speed. Do not assume performance the boat cannot maintain.",
        overnight: "No overnight stay: Marsala by 18:00.", overnightType: "Return · Marsala harbour", overnightStatus: "Operational deadline",
        alternative: "Shorten or skip the swim and leave earlier. If weather worsens, return in the first suitable window.",
        stops: [
          { moment: "Morning · weather-selected side", title: "Cala Rossa, Azzurra or an alternative", description: "A possible daytime stop, not a promise: sea and MPA rules decide.", check: "Latest departure, seabed, traffic, restrictions and ability to leave." },
          { moment: "Return", title: "Punta Marsala and harbour entrance", description: "Both need margin; do not compress arrival timing to save the swim.", check: "Visibility, notices, traffic, fuel and check-out." }
        ],
        wind: "10:00–18:00: GFS 6–10 kn (gusts need rechecking) WNW–NW (292–317°); ICON 8–12 / 18 NNW–N (315–351°). 2–4 Bft, generally weaker than Saturday. No values attributed beyond the new short IFS run’s validity.",
        sea: "Slight, Douglas 3. GFS-Wave 0.6–1 m W–WNW (278–286°), 5.4–6.2 s, swell 0.6–0.9 m; MFWAM 0.4–0.6 m NW–NNW, 3.8–4.7 s, swell 0.3–0.4 m. Latest WAM run does not cover Sunday’s leg.",
        visibility: "GFS about 23–24 km; ICON unavailable. Recheck observations on the day.",
        phenomena: "No shared severe-weather signal; fresh point ensemble unavailable. Update from official short-range bulletins.",
        air: "About 22–24°C, variable cloud.", water: "Modelled sea-surface temperature about 24.3–24.4°C.",
        currents: "Channel ocean model about 0–0.4 kn, variable direction; up to about 0.6 kn near Marsala. No local tide/current observation available: check on board.",
        decision: "Set departure for the slowest boat and real conditions. If no credible margin remains at 15:30, shorten the final swim.",
        sun: "Sunrise 07:15 · sunset 18:39 · civil twilight ends 19:05.", moon: "Waxing crescent, 1% illuminated · moonrise 08:01 · moonset 18:45."
      }
    ]
  };
})();

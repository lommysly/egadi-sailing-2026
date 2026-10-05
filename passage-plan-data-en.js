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
    updatedAt: "5 October 2026 · 18:50 CEST (UTC+2)",
    phase: "Skippers’ call briefing · T−3",
    confidence: "High uncertainty on Friday’s thunderstorms and Saturday’s wind · latest short ECMWF run does not cover Sunday’s return",
    status: "Multi-model forecast available · not the skipper’s go-ahead",
    publishedAt: "5 October 2026 · evening edition for the 20:00 skippers’ call",
    validFrom: "Period assessed: 8–11 October 2026 · local Europe/Rome times (CEST, UTC+2)",
    validUntil: "For the 5 October 20:00 call. Review on the 7th and before each leg; current observations, warnings and newer official bulletins take priority.",
    nextUpdateAt: "7 October and before each departure · further checks required",
    nextUpdateReason: "The requested evening check for the call has been completed. Continuous updates are not configured. Review Friday’s storms and wind shifts, Saturday’s westerly sea, Levanzo overnight shelter and harbour access.",
    dataMode: "operational",
    weatherNoticeTitle: "The forecast covers the trip, but official short-range confirmation is still pending.",
    weatherNoticeText: "Fresh ECMWF, GFS and ICON atmospheric comparison, with WAM, GFS-Wave and MFWAM waves. Friday’s waves are lower than this morning, but ECMWF retains a thunderstorm signal; its Saturday scenario is stronger. The latest short ECMWF run does not cover Sunday’s return hours: older values are not attributed to it.",
    summary: "Two Marsala departures: Thursday afternoon via Levanzo, or Friday morning directly towards Marettimo. The evening comparison lowers Friday’s wave forecast, but ECMWF retains storms around dawn and noon in the channel. On Saturday ECMWF predicts stronger wind and sea than GFS/ICON: do not simply select the weaker scenario. Friday in Marettimo and Saturday in Favignana remain conditional on access, overnight conditions and confirmed berths. No mooring field is a secured refuge. Allow margin for the slowest boat on Sunday, returning to Marsala by 18:00.",
    decisiveFactors: [
      "Thursday 8 at 15:00: ECMWF SSE–S 15–16 kn, GFS 19–20 and ICON about 13–14; IFS/ICON gusts up to 23 in the 12:00–21:00 window. At 4 kn arrival at Levanzo may coincide with the 18:43 sunset: daylight margin and overnight shelter are essential.",
      "Friday’s waves are lower than this morning, but ECMWF signals storms around 03:00–06:00 and again near noon in the channel; GFS/ICON do not agree. Saturday WAM reaches 1.9 m and IFS 21 kn / gusts 29: review the crossing and Favignana pontoon.",
      "Sunday 11: Favignana–Marsala takes about 2 h 25 min at 5 kn. A 15:30 departure leaves almost no margin; at 4 kn the 18:00 deadline cannot be met."
    ],
    callBriefing: {
      title: "Two departures, both from Marsala",
      introduction: "Thursday 8 afternoon and Friday 9 morning each have a Marsala departure briefing. Fresh check on 5 October at 18:50 for the 20:00 call. Shared aim: inside Marettimo harbour Friday evening, conditions permitting. Friday’s waves are lower than this morning, not a go-ahead: possible storms and entrance checks remain.",
      options: [
        {
          title: "Thursday 8 · departure around 15:00", route: "Marsala → Levanzo · about 14–16 NM", course: "NNW, about 338° true · east of Favignana with appropriate offing", duration: "4 kn: 3 h 30–4 h · 5 kn: 2 h 50–3 h 15 · 6 kn: 2 h 20–2 h 40",
          ratings: { departure: { tone: "caution", text: "At 15:00 ECMWF 15–16 kn, GFS 19–20, ICON 13–14 from SSE–S; check actual wind and waves at Marsala’s entrance." }, passage: { tone: "caution", text: "Short SSE–S sea, Hs about 0.6–1.2 m; broadly following wind, with comfort and speed assessed for the slowest boat." }, arrival: { tone: "unknown", text: "No exact overnight berth or anchorage selected. It must remain suitable through Friday’s W–NW shift, not simply offer a sunset view." } },
          wind: "12:00–21:00: ECMWF 12–17 kn / gusts 23, GFS 14–20 (gusts excluded for inconsistencies), ICON 7–14 / 20; directions about 141–185° (SE–S). ICON no longer shows the previous pronounced evening westerly shift.",
          sea: "WAM Hs 0.6–0.9 m, GFS-Wave 0.7–1.2 m, MFWAM 0.6–0.9 m; from SSE–S (147–169°), period 3.3–4.9 s. Mainly wind sea; Hs is not maximum wave height.",
          window: "A 15:00 start at 4 kn gives an indicative 18:30–19:00 arrival, against sunset at 18:43. Consider 13:30–14:00 only if charter handover and boarding allow; an earlier departure is not confirmed.",
          decision: "Confirm the overnight stop and fallback before leaving. On Friday this group departs from Levanzo; use the daily crossing card below.",
          alternative: "Stay in Marsala or shorten to Favignana harbour with access and a berth confirmed. Cala Fredda, Minnola and Dogana are not automatic shelters in S–SE wind."
        },
        {
          title: "Friday 9 · morning departure", route: "Marsala → Marettimo direct, skipping Levanzo · about 22–24 NM", course: "NW, about 300° true · south/west of Favignana, to be checked on a chart", duration: "4 kn: 5 h 30–6 h · 5 kn: 4 h 25–4 h 50 · 6 kn: 3 h 40–4 h",
          ratings: { departure: { tone: "caution", text: "06:00–12:00 off Marsala: ECMWF 3–7 kn / gusts 15, GFS 9–10, ICON 8–11 / 16. ECMWF has storms at 06:00 too: light wind alone cannot clear the departure." }, passage: { tone: "adverse", text: "ECMWF retains a channel thunderstorm signal near noon; ICON WNW–NW reaches 19 kn / gusts 26. Check almost head-on wind and visibility." }, arrival: { tone: "unknown", text: "Marettimo is the shared aim, but harbour access and berths are unconfirmed. Offshore waves may continue rising overnight." } },
          wind: "08:00–16:00: ECMWF 1–8 kn / gusts 25, highly variable direction near storms; GFS 3–10 turning SE to NW (gusts excluded); ICON 9–19 / 26 from WNW–NW (291–310°). Material spread, not an average of scenarios.",
          sea: "08:00–16:00: WAM Hs 0.5–0.8 m, GFS-Wave 0.3–0.5 m, MFWAM 0.4–0.8 m. Period 3.4–5.2 s; southerly residual sea and new W–NW waves. Lower than this morning, but not an entrance forecast or clearance from storms.",
          window: "Compare 07:30–08:30 and 09:00–10:00: a 4–6-hour crossing may meet ECMWF’s renewed noon signal. Earlier storms around 03:00–06:00 precede sunrise at 07:13. No favourable window without radar, bulletins and observations; consider the later sea too.",
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
          forecast: "Friday 16:00–23:00 offshore east: ECMWF 7–10 kn / gusts 16, GFS 3–8, ICON 11–17 / 23, from W–NW. WAM Hs 0.8–0.9 m, GFS-Wave 0.5–0.9, MFWAM 0.8–1.2; 4.3–5.5 s. Overnight to 06:00 WAM rises to 1.2 m and MFWAM to 1.5: check the stay, not only arrival.",
          check: "Ask the operator for the exact berth and spaces for all boats, permitted draught, actual surge at the entrance and pontoons, lee-side gusts, ferry movements and current works or restrictions. No up-to-date entrance survey is available here.",
          alternative: "The Marsala group can remain at base. The Levanzo group needs a legal, checked waiting shelter or another confirmed harbour before committing. Do not reach Marettimo merely to keep the rendezvous.",
          sourceLabel: "Marettimo Marine · operator contacts", sourceUrl: base.harbourChecks.items[0].sourceUrl
        },
        {
          title: "Saturday 10 · Favignana harbour",
          rating: { tone: "caution", text: "W–NW sea · verify the assigned pontoon and overnight surge." },
          exposure: "Marina di Favignana describes its Praia sector as exposed to northerly winds and mistral seas. This cannot be extended to every berth in the harbour: being inside does not by itself establish the shelter available.",
          forecast: "Saturday 16:00–23:00 offshore north: ECMWF WNW 11–21 kn / gusts 29, GFS 9–13, ICON 1–9 / 14. WAM Hs 1.2–1.6 m, GFS-Wave 0.8–0.9, MFWAM 0.8–0.9; period 5–5.6 s. Wind spread is large: check the pontoon and night against the stronger scenario, without inferring harbour surge from a grid.",
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
    sourceNote: "Fresh check on 5 October at 18:50 CEST at eight requested sea points. IFS/GFS runs 05/10 06 UTC, ICON 05/10 12 UTC; waves WAM/GFS-Wave 05/10 06 UTC, MFWAM 05/10 00 UTC. Short IFS ends Sunday at 09:00 CEST and WAM at 11:00: neither covers the 14:00–18:00 return. Those hours use GFS/ICON and GFS-Wave/MFWAM. Some points share a grid cell: eight requests are not eight independent observations. Wind/wave directions are FROM; currents are TO. Hs is not maximum height. Offshore grids do not resolve harbours or coves. GFS gusts remain below mean wind in 187 point/hour samples: excluded, not artificially corrected.",
    sources: [
      source(0, "ECMWF IFS · queried data", "wind, gusts and rain along the area", "5 October · 18:50 CEST", "Open-Meteo Forecast API", "ECMWF IFS HRES · 05/10 06 UTC run · about 9 km", "latest short run to 11 October 09:00 CEST; excluded from Sunday’s return hours"),
      source(1, "NOAA GFS · queried data", "independent atmospheric scenario", "5 October · 18:50 CEST", "Open-Meteo Forecast API", "NOAA GFS · 05/10 06 UTC run · about 13 km", "hourly · 8–11 October"),
      source(2, "DWD ICON · queried data", "third independent atmospheric scenario", "5 October · 18:50 CEST", "Open-Meteo Forecast API", "DWD global ICON · 05/10 12 UTC run · about 11 km", "hourly · 8–11 October"),
      source(3, "Open-Meteo Marine · wave comparison", "significant height, direction, period and available components", "5 October · 18:50 CEST", "Marine Weather API", "WAM 05/10 06 UTC · GFS-Wave 05/10 06 UTC · MFWAM 05/10 00 UTC", "WAM to 11 October 11:00 CEST; does not cover the afternoon return · offshore grids"),
      source(4, "Model issue times and coverage", "model metadata, distinct from consultation time", "5 October · 18:50 CEST", "model static/meta.json", "latest run and data_end_time", "no attribution beyond the latest short ECMWF run"),
      source(5, "Currents and sea temperature", "Marsala offshore and Levanzo–Marettimo channel, not entrances", "5 October · 18:50 CEST", "Marine API · SST and ocean currents", "Météo-France products · issue time not verified", "8–11 October · about 8 km · km/h converted to knots"),
      source(6, "Italian Air Force · Meteomar", "Sicily Channel and western Southern Tyrrhenian", "5 October · 14:00 CEST issue, checked 18:52", "Meteomar", "official bulletin", "current S4 in Sicily Strait; S4 tending S5/storms in western Southern Tyrrhenian; not an 8–11 October forecast"),
      source(7, "ISPRA · wave buoy network", "nearest reference: Mazara del Vallo/Capo Granitola", "4 October · 20:30 CEST", "RON", "observation, not forecast", "wave/current unavailable in latest report; not representative of Marsala/Egadi"),
      source(8, "Italian Hydrographic Institute · Notices", "Marsala wreck/exclusion and Favignana anchoring limits", "issue 20/2026 · 30 September", "Notices to Mariners · charts 258, 259, 260", "official source"),
      source(9, "Egadi MPA · 2026 rules", "zoning, permits, sensitive seabeds, anchoring and moorings", "5 October · valid to 31 December", "2026 supplementary rules", "official local source", "seasonal fields and availability require direct confirmation"),
      source(10, "US Naval Observatory · astronomy", "sunrise, sunset, twilight and Moon · 37.9 N / 12.4 E", "4 October 2026", "Sun and Moon Data for One Day", "astronomical calculation · Europe/Rome UTC+2"),
      source(11, "Marettimo Marine · operator", "contact for Scalo Nuovo access, berths and conditions", "5 October · 08:15 CEST · indexed page", "operator page", "no weather measurement", "no direct reply or access/berth confirmation obtained"),
      source(12, "Marina di Favignana · operator", "Praia sector exposed to northerly winds and mistral seas", "5 October · 18:49 CEST", "operator description", "local exposure, not forecast", "does not cover every berth or confirm assigned space"),
      source(13, "Egadi MPA · mooring fields", "seasonal fields and permits alongside the 2026 rules", "5 October · 18:49 CEST", "official local information", "no wind/wave measurement", "October installation, availability and overnight permission unconfirmed"),
      source(14, "Civil Protection · weather alerts", "official vigilance, alerts and radar; not a harbour-point forecast", "5 October · checked 18:52 CEST", "alert page · 05/10 bulletin at 14:17", "official source, not deterministic model", "current period, not the full 8–11 trip; recheck local alerts before each leg")
    ],
    modelComparison: [
      { parameter: "Wind · 8 October at 15:00", scenarios: "At 15:00 IFS 15–16 kn, GFS 19–20, ICON 13–14 SSE–S; IFS/ICON gusts up to 23 in the 12:00–21:00 window", divergence: "high on strength", decisionImpact: "plan for the stronger scenario, shelter and daylight margin" },
      { parameter: "Marsala departure · Friday morning", scenarios: "Exit 06:00–12:00: IFS 3–7 kn, GFS 9–10, ICON 8–11. IFS channel storms around 03:00–06:00 and noon; ICON WNW–NW up to 19 kn / gusts 26", divergence: "high between exit and crossing, not just models", decisionImpact: "one harbour value cannot clear a 4–6-hour passage" },
      { parameter: "Wind/weather · 9 October", scenarios: "Friday 12:00–21:00: IFS 1–10 kn with noon storms; GFS 3–10, dry; ICON WNW–NW 9–17, gusts 23", divergence: "high on weather, strength and shift timing", decisionImpact: "Friday is not automatically better; Marettimo needs an on-the-day decision" },
      { parameter: "Waves · 9–10 October", scenarios: "Friday 12:00–21:00: WAM 0.6–0.9 m, GFS-Wave 0.3–0.8, MFWAM 0.6–1. Saturday 08:00–19:00: WAM 1.1–1.9, GFS-Wave 0.6–1.1, MFWAM 0.9–1.5 m. Saturday IFS up to 21 kn / gusts 29, ICON much weaker", divergence: "high; do not average away WAM", decisionImpact: "lower Friday waves than this morning, but Saturday’s IFS/WAM scenario needs attention; check Favignana pontoon and overnight conditions" },
      { parameter: "Return · 11 October", scenarios: "Sunday 10:00–18:00: GFS WNW 8–14 kn, ICON 2–8 turning SE to W. GFS-Wave 0.7–0.9 m, MFWAM 0.3–0.6; latest short IFS/WAM do not cover the return hours", divergence: "wave spread and missing fresh ECMWF comparison", decisionImpact: "retain time margin and review the next long run" }
    ],
    climateOutlook: {
      title: "Air, water and daylight",
      disclaimer: "Modelled values and astronomical calculations, not climate averages or measurements in coves. Operational detail is in the cards.",
      items: [
        { icon: "air", label: "Air", value: "19–27°C", detail: "indicative range at the points and times assessed" },
        { icon: "water", label: "Sea", value: "24.5–25.1°C", detail: "modelled surface temperature, not an anchorage reading" },
        { icon: "wind", label: "Wind", value: "variable", detail: "large model spread, especially Friday and Saturday" },
        { icon: "rain", label: "Instability", value: "Friday", detail: "ECMWF around 03:00–06:00 and again near noon in the channel" },
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
        criticality: "Southerly wind and waves at departure; Levanzo’s overnight location still open.", uncertainty: "Strength spread: at 15:00 ECMWF 15–16 kn, GFS 19–20, ICON 13–14; shelter and daylight remain decisive.",
        ratings: { departure: { tone: "caution", text: "At 15:00 ECMWF 15–16 kn, GFS 19–20, ICON 13–14 SSE–S; actual entrance observations and notices before departure." }, passage: { tone: "caution", text: "Short SSE–S sea, Hs 0.6–1.2 m; broadly following passage, but comfort and real speed need assessment." }, arrival: { tone: "unknown", text: "No exact berth or anchorage selected; October moorings unconfirmed." } },
        operationalChecks: ["Meteomar/NETTUNO and actual Marsala observations.", "Hydrographic notices on the Marsala wreck/exclusion.", "Shelter, seabed, MPA permission and an exit plan if wind shifts."],
        glance: { wind: "SSE–S · 13–20 kn at 15:00", windTone: "caution", sea: "0.6–1.2 m from SSE–S", seaTone: "caution", sky: "Dry in all 3 models", skyIcon: "sun", skyTone: "good" },
        plan: "For Thursday’s boats. Provisions aboard, east of Favignana; Levanzo overnight only with legal shelter and daylight margin. The geometric line excludes some offing and manoeuvres.",
        navigation: "NNW course with S–SSE wind and waves: broadly following. Overnight shelter must account for the later westerly shift, not just this leg.",
        overnight: "A genuinely sheltered, permitted anchorage after checking; otherwise a confirmed harbour or a better-documented fallback.", overnightType: "First night · option open", overnightStatus: "Check on the day",
        alternative: "Stay in Marsala or shorten to Favignana with a confirmed berth. A nearby landfall is not automatically safe.",
        stops: [
          { moment: "Sunset · W/NW side", title: "Cala Tramontana or Genovese area", description: "Sunset aspect, but more exposed to W or N waves.", check: "MPA zoning, seabed, room, residual sea, traffic and exit route." },
          { moment: "Sunrise · E/SE side", title: "Cala Fredda, Minnola or Dogana", description: "First-light aspect; Dogana also has ferry traffic.", check: "Permission, shelter and traffic, not just the view." }
        ],
        wind: "12:00–21:00: ECMWF SSE–S 12–17 kn / gusts 23 (149–175°); GFS SE–S 14–20 (gusts excluded); ICON SSE–S 7–14 / 20 (159–185°). About 3–5 Bft by model/hour; subsequent westerly shift Friday.",
        sea: "Slight, Douglas 3, near the moderate boundary in the higher scenario. WAM Hs 0.6–0.9 m, GFS-Wave 0.7–1.2, MFWAM 0.6–0.9; SSE–S (147–169°), period 3.3–4.9 s. GFS-Wave mostly wind sea; MFWAM swell 0.1–0.5 m. Hs is not maximum height; do not add components.",
        visibility: "ECMWF about 18–36 km, GFS about 24 km at sampled points; ICON unavailable. Entrance visibility requires a local check.",
        phenomena: "Dry in all three deterministic models; fresh point ensemble unavailable. Watch actual convective development.",
        air: "About 23–27°C; variable cloud, cloud type not resolved.", water: "Modelled sea-surface temperature about 24.6–25°C, checked 18:50; not a cove measurement.",
        currents: "Ocean model about 0.1–0.6 kn off Marsala and 0.3–1.2 in the channel, variable with a N–NE component. About 8 km grid, issue time unverified; returned km/h converted to knots. Does not resolve entrance tides/currents: check on board.",
        decision: "Confirm departure and overnight stop in the early afternoon. If daylight margin shrinks, use a checked shelter.",
        sun: "Sunrise 07:12 · sunset 18:43 · civil twilight ends 19:09.", moon: "Waning crescent, 6% illuminated · moonrise 04:45 · moonset 17:30."
      },
      {
        date: "Friday 9 October", route: "Levanzo → Marettimo · Thursday group", distance: "about 13 NM", course: "south of Levanzo, then about 267° true", duration: "4 kn: 3 h 15 min · 5 kn: 2 h 36 min · 6 kn: 2 h 10 min",
        window: "Compare 08:00–10:00 and 13:00–14:00 after radar and actual-sea checks. IFS signals dawn storms and renewed activity near noon in the channel. Friday waves are lower than this morning, but may rise overnight. No window secured.",
        criticality: "Possible channel thunderstorms, almost head-on wind and unconfirmed overnight conditions at Marettimo.", uncertainty: "High on weather: IFS storms, GFS/ICON none; 12:00–21:00 waves about 0.3–1 m across products, lower than this morning.",
        ratings: { departure: { tone: "adverse", text: "IFS signals storms around 03:00–06:00 and noon in the channel, absent in other deterministic models. Postpone or change plan if radar and observations confirm them." }, passage: { tone: "adverse", text: "Variable wind in IFS’s storm scenario; ICON WNW–NW up to 17 kn / gusts 23 nearly head-on on the westerly course. Review before committing." }, arrival: { tone: "unknown", text: "Aim for Scalo Nuovo Friday evening; access, berths and overnight surge unconfirmed." } },
        operationalChecks: ["Radar/lightning, clouds and Meteomar before crossing.", "Marettimo berth, calling channel and instructions.", "Abandon the crossing before committing if observations do not support it."],
        glance: { wind: "Variable / WNW–NW · 1–17 kn (12–21)", windTone: "caution", sea: "0.3–1 m model spread", seaTone: "caution", sky: "IFS storms around dawn and noon", skyIcon: "rain", skyTone: "caution" },
        plan: "For boats that left Marsala Thursday. Friday departures use the Marsala → Marettimo card above. All aim for the harbour that evening, but the crossing can be postponed or cancelled.",
        navigation: "ICON/GFS turn westerly; ECMWF is more variable near storms. On course 267°, W–NW wind can require beating or be nearly head-on. No sailing performance guaranteed.",
        overnight: "Inside Marettimo only with access, berth and overnight conditions checked. Friday 16:00–23:00 offshore Hs about 0.5–1.2 m across models; MFWAM reaches 1.5 by Saturday 06:00. Not a harbour-surge forecast.", overnightType: "Second night · harbour", overnightStatus: "Availability to confirm",
        alternative: "Remain in a legal checked Levanzo shelter, move to a confirmed Favignana berth, or return to Marsala only if that route is suitable.",
        stops: [
          { moment: "Before the crossing", title: "Cala Fredda or Minnola", description: "A short stop only if it preserves the weather-decision margin.", check: "Storms, wind shift, shelter and latest abandonment time." },
          { moment: "Arrival", title: "Marettimo Scalo Nuovo", description: "Coordinate the approach to this landing with ferry traffic.", check: "Berth, local instructions, entrance wind, traffic and visibility." }
        ],
        wind: "12:00–21:00: ECMWF 1–10 kn / gusts 19, variable direction; GFS SW–NW 3–10 (gusts excluded); ICON WNW–NW 9–17 / 23 (292–311°). About 1–4 Bft; low mean wind does not exclude convective gusts.",
        sea: "12:00–21:00: WAM Hs 0.6–0.9 m W–WNW, GFS-Wave 0.3–0.8 S turning NW, MFWAM 0.6–1 W–NW; period 3.5–5.9 s. GFS-Wave wind sea 0–0.6 m and swell 0.2–0.6; MFWAM swell 0.4–0.8. Lower than this morning, but residual southerly sea may overlap new westerly waves.",
        visibility: "May fall rapidly in showers/storms; grid output does not resolve cell edges.",
        phenomena: "IFS storm signals around 03:00–06:00 and again at noon at Levanzo/channel/Marettimo points, hourly rain up to 2.2 mm. GFS/ICON dry. These are not exact cell timings or probabilities. Fresh ensemble unavailable: check radar/lightning.",
        air: "About 19–25°C; variable cloud and possible convective cloud in IFS.", water: "Modelled sea-surface temperature about 24.6–25.1°C.",
        currents: "Ocean model about 0.2–0.7 kn in the channel towards N–NE then E–SE; off Marsala about 0.1–0.5 kn. Issue time unverified, 8 km grid: not for coastal routing, tides or access.",
        decision: "Possible NO-GO day: storms, a wind shift or confused seas may require postponement or another destination.",
        sun: "Sunrise 07:13 · sunset 18:42 · civil twilight ends 19:08.", moon: "Waning crescent, 2% illuminated · moonrise 05:51 · moonset 17:54."
      },
      {
        date: "Saturday 10 October", route: "Marettimo → Favignana", distance: "about 12.1 NM direct · 14.5–15 NM via Punta Troia", course: "direct about 100° true; northern detour only with suitable sea and margin", duration: "direct: 4 kn 3 h 02 min · 5 kn 2 h 25 min · 6 kn 2 h 01 min",
        window: "Compare 08:00–11:00 and 12:00–15:00: westerly waves remain in both. Afternoon is not automatically better. Confirm a suitable berth and daylight arrival before departure.",
        criticality: "Saturday IFS/WAM stronger than ICON/GFS; westerly waves, exposed NW Marettimo coast and Favignana pontoon need review.", uncertainty: "High: IFS up to 21 kn / gusts 29 versus ICON 2–10; WAM 1.1–1.9 m, GFS-Wave 0.6–1.1, MFWAM 0.9–1.5.",
        ratings: { departure: { tone: "caution", text: "Check NW waves before leaving shelter or approaching the exposed coast." }, passage: { tone: "caution", text: "IFS W–WNW up to 21 kn / gusts 29 and WAM up to 1.9 m; GFS/ICON weaker. Avoid unnecessary exposed detours." }, arrival: { tone: "caution", text: "Check Favignana’s pontoon: the consulted operator’s Praia sector is exposed to mistral seas. Berths unconfirmed." } },
        operationalChecks: ["Actual NW waves off Marettimo.", "MPA and Miglio Blu restrictions.", "Favignana berth and entry instructions, with daylight for manoeuvres."],
        glance: { wind: "W–NW · 2–21 kn across models", windTone: "caution", sea: "0.6–1.9 m from W–NW", seaTone: "caution", sky: "Light showers possible", skyIcon: "rain", skyTone: "caution" },
        plan: "Explore only while conditions allow, then sail direct to Favignana for daylight entry.",
        navigation: "The easterly course puts westerly wind astern; comfort still depends on residual waves, not just local wind.",
        overnight: "Favignana harbour with the pontoon and night conditions checked. Southern moorings only after MPA confirmation of operation, availability and overnight permission.", overnightType: "Third night · harbour", overnightStatus: "Availability to confirm",
        alternative: "Skip Punta Troia and sail direct. If the direct leg is unsuitable too, stay in a confirmed Marettimo berth.",
        stops: [
          { moment: "Morning · Marettimo", title: "Punta Troia only if conditions allow", description: "Adds about 2.5–3 NM on the exposed side.", check: "NW waves, offing, protected areas and time left." },
          { moment: "Arrival · Favignana", title: "Harbour before evening", description: "A daylight approach preserves manoeuvring margin.", check: "Availability, calling channel, ferries and Notice 20.15." }
        ],
        wind: "08:00–19:00: ECMWF WSW–WNW 13–21 kn / gusts 29 (251–293°); GFS WNW–NW 10–14 (gusts excluded); ICON WNW–NNW 2–10 / 14 (288–336°). About 1–5 Bft by model, large spread: do not automatically choose the weakest.",
        sea: "Douglas 3–4: WAM Hs 1.1–1.9 m W–WNW (276–287°), GFS-Wave 0.6–1.1 WNW–NW (295–323°), MFWAM 0.9–1.5 WNW–NW; period 5–6.4 s. GFS-Wave wind sea 0.5–1.1 and swell 0.1–0.5; MFWAM swell 0.6–1.2 m. Components must not be added arithmetically.",
        visibility: "ECMWF about 11–42 km during 08:00–19:00, possibly lower later; GFS about 24 km, ICON unavailable. Check actual entrance visibility.",
        phenomena: "Light rain in ECMWF/ICON, up to about 0.5 mm/h; GFS dry. No fresh ensemble; this does not guarantee no local storms.",
        air: "About 22–25°C, variable cloud.", water: "Modelled sea-surface temperature about 24.5–24.9°C.",
        currents: "Ocean model about 0.2–0.7 kn in the channel, NE–SE component; off Marsala up to 0.5 kn. Issue time unverified: not for coastal manoeuvring.",
        decision: "Check the NW sea before leaving. Direct avoids Punta Troia, but still needs suitable real conditions and a checked Favignana berth.",
        sun: "Sunrise 07:14 · sunset 18:40 · civil twilight ends 19:07.", moon: "New Moon, 0% illuminated · moonrise 06:57 · moonset 18:19."
      },
      {
        date: "Sunday 11 October", route: "Favignana → Marsala", distance: "about 11.5–12.5 NM without crossing land", course: "east out of harbour, eastern coast, round Punta Marsala, then SE", duration: "4 kn: about 3 h · 5 kn: about 2 h 25 min · 6 kn: about 2 h",
        window: "Leave before 15:30 for margin. At 5 kn a 15:30 start gives about 17:55 without reserve; at 4 kn arrival is after 18:30.",
        criticality: "Return timing and Marsala access; final wind assessment still pending.", uncertainty: "Short IFS to 09:00 CEST and WAM to 11:00, not the afternoon return. GFS WNW 8–14 kn; ICON 2–8 turning SE to W: strength/direction still differ.",
        ratings: { departure: { tone: "caution", text: "Modest modelled wind/waves, but the day’s official bulletin and local access are not yet available." }, passage: { tone: "caution", text: "Relatively favourable weather; a 15:30 departure still leaves too little margin at 4–5 kn." }, arrival: { tone: "caution", text: "Current Marsala notices apply; return before 18:00." } },
        operationalChecks: ["Slowest boat’s realistic arrival before the final swim.", "Visibility, traffic and actual Marsala entrance conditions.", "Notices, fuel and check-out time reserve."],
        glance: { wind: "GFS WNW 8–14 kn · ICON variable 2–8", windTone: "calm", sea: "0.3–0.9 m GFS-Wave/MFWAM", seaTone: "caution", sky: "Dry / light GFS rain", skyIcon: "sun", skyTone: "caution" },
        plan: "Final stop only if return margin survives. Go east around Favignana and Punta Marsala; a straight line would cross land.",
        navigation: "Light wind may reduce sailing speed. Do not assume performance the boat cannot maintain.",
        overnight: "No overnight stay: Marsala by 18:00.", overnightType: "Return · Marsala harbour", overnightStatus: "Operational deadline",
        alternative: "Shorten or skip the swim and leave earlier. If weather worsens, return in the first suitable window.",
        stops: [
          { moment: "Morning · weather-selected side", title: "Cala Rossa, Azzurra or an alternative", description: "A possible daytime stop, not a promise: sea and MPA rules decide.", check: "Latest departure, seabed, traffic, restrictions and ability to leave." },
          { moment: "Return", title: "Punta Marsala and harbour entrance", description: "Both need margin; do not compress arrival timing to save the swim.", check: "Visibility, notices, traffic, fuel and check-out." }
        ],
        wind: "10:00–18:00: GFS WNW 8–14 kn (283–298°), gusts excluded for inconsistencies; ICON 2–8 kn / 11, SE turning SW–W (132–280°). About 1–4 Bft. Latest short IFS not valid for these hours; no attribution to that run.",
        sea: "Slight, Douglas 3: GFS-Wave Hs 0.7–0.9 m W–WNW (283–293°), period 5–5.3 s; MFWAM 0.3–0.6 NW (322–327°), 4.3–4.8 s, swell 0.3–0.5 m. Short WAM does not cover the afternoon return.",
        visibility: "GFS about 23–24 km; ICON unavailable. Recheck observations on the day.",
        phenomena: "GFS shows light morning rain up to 0.1 mm/h; ICON dry. No shared severe-weather signal, but fresh ensemble unavailable and official short-range briefing still needs renewal.",
        air: "About 22–24°C, variable cloud.", water: "Modelled sea-surface temperature about 24.6–24.8°C.",
        currents: "Ocean model about 0–0.4 kn in the channel, variable direction; off Marsala up to about 0.6 kn. Issue time unverified and no local tide/current observation: check on board.",
        decision: "Set departure for the slowest boat and real conditions. If no credible margin remains at 15:30, shorten the final swim.",
        sun: "Sunrise 07:15 · sunset 18:39 · civil twilight ends 19:05.", moon: "Waxing crescent, 1% illuminated · moonrise 08:01 · moonset 18:45."
      }
    ]
  };
})();

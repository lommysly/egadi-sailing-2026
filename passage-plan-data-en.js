/*
 * Official public English edition of the Passage Plan. This is curated copy,
 * not a browser or third-party machine translation. It contains no personal
 * Crew List data and never replaces the skipper's daily safety decision.
 */
(() => {
  const noForecast = 'No value is published 27 days before departure: this is not a forecast.';
  const noSeaForecast = 'No value is published yet: wave height and period will appear in the operational briefing.';
  const seasonalOnly = 'Seasonal context only; the operational temperature will be included in the useful briefing.';
  const localCheck = 'Local data must be checked against a marine source and observations on board.';
  const currentsLater = 'To be assessed in the operational window, not estimated now.';

  window.PASSAGE_PLAN_DATA_EN = {
    updatedAt: '11 September 2026 · planning overview published 27 days before departure',
    phase: '27 days to departure · planning overview',
    confidence: 'Astronomy: high confidence · weather: not yet forecast',
    status: 'Initial planning overview published',
    publishedAt: '11 September 2026 · 01:56 CEST',
    validFrom: 'Valid as a planning overview until the next update',
    validUntil: 'This is not an operational weather bulletin and does not confirm anchorages or availability',
    nextUpdateAt: '28 September 2026 · ten-day outlook',
    dataMode: 'planning',
    summary: 'This first overview helps the flotilla plan around a flexible itinerary, available daylight and possible coves to enjoy. It does not contain a wind, sea-state or current forecast; that will be published only in the useful window, with sources and issue time.',
    sourceNote: 'Astronomical check: 11 September 2026, 01:56 CEST, Europe/Rome time zone. The coves are possible scenarios, not allocated places: every evening the skipper chooses a marina berth, authorised mooring field or permitted anchorage only after checking weather, sea state, seabed, marine protected-area zoning, notices and availability.',
    sources: [
      { label: 'Astronomical source', url: 'https://aa.usno.navy.mil/data/api', scope: 'sunrise, sunset and moon', checkedAt: '11 September 2026 · 01:56 CEST' },
      { label: 'Egadi MPA · zoning', url: 'https://www.ampisoleegadi.it/index.php/zonazione/', scope: 'areas and rules to verify', checkedAt: '11 September 2026' },
      { label: 'Egadi MPA · mooring fields', url: 'https://www.ampisoleegadi.it/index.php/campi-boe/', scope: 'seasonal fields and permits', checkedAt: '11 September 2026' },
    ],
    stopsNote: 'For October 2026, MPA rules, any permits, seasonal installation of mooring fields and current notices must be checked in the operational briefing: a beautiful cove is not automatically a suitable place to spend the night at anchor.',
    mooringGuide: {
      title: 'At anchor, in port or on a mooring?',
      introduction: 'The cards below help you picture the places; they are not anchoring instructions. The same cove may be perfect for a swim and unsuitable for an overnight stay. Each boat receives its skipper’s decision for the day.',
      checks: [
        { title: '1 · Check the rules first', text: 'The skipper checks MPA zoning, notices, permits and the seasonal status of any mooring field. A buoy seen online is not the same as a buoy that is authorised and available.' },
        { title: '2 · Then read the sea as it is', text: 'Wind direction and strength, sea state, period, seabed, manoeuvring room and crew comfort decide whether to stop, change side or continue.' },
        { title: '3 · A Plan B is part of the plan', text: 'If the anchorage or mooring field is unsuitable, the alternative is a marina berth or another sheltered option. Safety and a punctual return matter more than a chosen cove.' },
      ],
    },
    days: [
      {
        date: 'Thursday 8 October',
        route: 'Marsala → Levanzo',
        plan: 'Departure at 15:00, with provisions already on board. We will look for the light of sunset and, if conditions allow, a calm night near Levanzo.',
        overnight: 'At anchor near Levanzo only if permitted, sheltered and comfortable; otherwise a marina berth or another sheltered option chosen by the skipper.',
        overnightType: 'Anchorage to be checked',
        overnightStatus: 'Not confirmed',
        alternative: 'Alternative shelter or a change of route will be decided by the skippers.',
        stops: [
          {
            moment: 'Sunset · possible anchorage',
            title: 'Cala Tramontana or Cala del Genovese',
            description: 'Possible west and north-west settings for evening light, without assigning a cove to the flotilla in advance.',
            check: 'To be validated: shelter, seabed, MPA zoning, notices, permits and traffic.',
          },
          {
            moment: 'Sunrise · alternative shelter',
            title: 'Cala Fredda, Cala Minnola or Cala Dogana',
            description: 'East-side alternatives for a sunrise wake-up, if they suit the actual conditions and Friday’s navigation plan.',
            check: 'An overnight stay is not promised: the final decision belongs to each boat’s skipper.',
          },
        ],
        wind: noForecast,
        sea: noSeaForecast,
        air: seasonalOnly,
        water: localCheck,
        currents: currentsLater,
        decision: 'The final anchorage, shelter and timing are confirmed by the skipper before departure.',
        sun: 'Sunrise 07:12 · sunset 18:43 · civil twilight until 19:09.',
        moon: 'Waning crescent · moonrise 04:45 · moonset 17:29.',
      },
      {
        date: 'Friday 9 October',
        route: 'Levanzo → Marettimo',
        plan: 'A second cove at Levanzo, lunch on board, then a passage to Marettimo. The night is planned in port, with an evening in the village.',
        overnight: 'Marettimo harbour is the evening’s base plan, with dinner ashore or on board and a gathering in the village.',
        overnightType: 'Harbour',
        overnightStatus: 'Base plan, subject to berth confirmation',
        alternative: 'The crossing and stops depend on sea state, wind and the flotilla’s comfort.',
        stops: [
          {
            moment: 'Sunrise / swim · daytime stop',
            title: 'Cala Fredda or Cala Minnola',
            description: 'A second Levanzo cove, chosen after waking for light, sea state and crew comfort before the crossing.',
            check: 'Daytime stop only, and only where current rules permit it and the seabed has been checked.',
          },
          {
            moment: 'Marettimo · evening arrival',
            title: 'Harbour, not an improvised anchorage',
            description: 'The destination for the night is the harbour, so the village can be enjoyed without turning the evening into an anchoring decision.',
            check: 'Any buoy remains an authorised, available option only; it is never the assumed plan.',
          },
        ],
        wind: noForecast,
        sea: noSeaForecast,
        air: seasonalOnly,
        water: localCheck,
        currents: currentsLater,
        decision: 'The passage to Marettimo starts only in a comfortable weather window for the flotilla.',
        sun: 'Sunrise 07:13 · sunset 18:42 · civil twilight until 19:08.',
        moon: 'Waning crescent · moonrise 05:52 · moonset 17:54.',
      },
      {
        date: 'Saturday 10 October',
        route: 'Marettimo → Favignana',
        plan: 'Explore Marettimo, then set a course for Favignana. Arrival in port, a shared dinner, DJ set and celebration.',
        overnight: 'Favignana harbour: shared dinner, DJ set and celebration, returning to the boat at the end of the evening.',
        overnightType: 'Harbour',
        overnightStatus: 'Base plan, subject to berth confirmation',
        alternative: 'Moorings, harbour and the coastal route will be confirmed in the day’s briefing.',
        stops: [
          {
            moment: 'Marettimo · morning light',
            title: 'Punta Troia, Scalo Maestro or Cala Manione',
            description: 'Coastal settings for experiencing Marettimo from the sea, while the skipper decides the actual distance, route and stop.',
            check: 'Areas and seabeds are protected: these are not anchoring instructions.',
          },
          {
            moment: 'Favignana · arrival and celebration',
            title: 'Enter the harbour in the late afternoon',
            description: 'Sunset accompanies the arrival in town; the planned overnight stay is in port, not in a cove.',
            check: 'Timing and approach adapt to the real crossing and berth availability.',
          },
        ],
        wind: noForecast,
        sea: noSeaForecast,
        air: seasonalOnly,
        water: localCheck,
        currents: currentsLater,
        decision: 'Moorings, harbour and the coastal approach remain subject to notices, availability and real conditions.',
        sun: 'Sunrise 07:15 · sunset 18:42 · civil twilight until 19:08.',
        moon: 'New moon · moonrise 06:58 · moonset 18:20.',
      },
      {
        date: 'Sunday 11 October',
        route: 'Favignana → Marsala',
        plan: 'Explore Favignana’s coves until around 15:30, then head back in order to be in Marsala by 18:00.',
        overnight: 'No overnight stay: return to Marsala harbour by 18:00.',
        overnightType: 'Return to harbour',
        overnightStatus: 'Time-critical',
        alternative: 'The final stop will be shortened or brought forward if needed for a safe, punctual return.',
        stops: [
          {
            moment: 'Sunrise / swim · east coast',
            title: 'Cala Azzurra or Cala Rossa',
            description: 'Possible morning-sun settings, chosen only if sea state, seabed and crowding make the stop simple and safe.',
            check: 'These are possible daytime stops: they do not include an overnight stay and do not replace the MPA check.',
          },
          {
            moment: 'Plan B · west coast',
            title: 'Cala Rotonda or Preveto',
            description: 'Alternatives to consider if the east side is uncomfortable; return time to Marsala always remains the priority.',
            check: 'Departure from Favignana is around 15:30, unless the skipper decides to leave earlier.',
          },
        ],
        wind: noForecast,
        sea: noSeaForecast,
        air: seasonalOnly,
        water: localCheck,
        currents: currentsLater,
        decision: 'A punctual return to Marsala takes priority over the length of the final stop at Favignana.',
        sun: 'Sunrise 07:15 · sunset 18:39 · civil twilight until 19:05.',
        moon: 'Waxing crescent · moonrise 08:02 · moonset 18:45.',
      },
    ],
  };
})();

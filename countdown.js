(() => {
  'use strict';

  const root = document.querySelector('[data-departure-countdown]');
  if (!root) return;

  const departureAt = new Date('2026-10-08T15:00:00+02:00').getTime();
  const returnAt = new Date('2026-10-11T18:00:00+02:00').getTime();
  const elements = {
    kicker: root.querySelector('[data-countdown-kicker]'),
    values: root.querySelector('[data-countdown-values]'),
    days: root.querySelector('[data-countdown-days]'),
    hours: root.querySelector('[data-countdown-hours]'),
    minutes: root.querySelector('[data-countdown-minutes]'),
    daysLabel: root.querySelector('[data-countdown-days-label]'),
    hoursLabel: root.querySelector('[data-countdown-hours-label]'),
    minutesLabel: root.querySelector('[data-countdown-minutes-label]'),
    note: root.querySelector('[data-countdown-note]'),
    accessible: root.querySelector('[data-countdown-accessible]'),
  };

  const copy = {
    it: {
      title: 'Partenza tra',
      departure: 'Giovedì 8 ottobre · ore 15:00 · Porto di Marsala',
      sailingTitle: 'Siamo in navigazione',
      sailingNote: 'Segui il Passage Plan per la rotta e gli aggiornamenti della giornata.',
      finishedTitle: 'Il viaggio si è concluso',
      finishedNote: 'Grazie per aver navigato alle Egadi con noi.',
      timerLabel: 'Conto alla rovescia alla partenza',
      and: 'e',
      day: ['giorno', 'giorni'],
      hour: ['ora', 'ore'],
      minute: ['minuto', 'minuti'],
    },
    en: {
      title: 'Departure in',
      departure: 'Thursday 8 October · 15:00 · Port of Marsala',
      sailingTitle: 'We are sailing',
      sailingNote: 'Follow the Passage Plan for today’s route and updates.',
      finishedTitle: 'The trip has ended',
      finishedNote: 'Thank you for sailing the Egadi with us.',
      timerLabel: 'Countdown to departure',
      and: 'and',
      day: ['day', 'days'],
      hour: ['hour', 'hours'],
      minute: ['minute', 'minutes'],
    },
  };

  const getLocale = () => window.EgadiI18n?.getLocale?.() === 'en' ? 'en' : 'it';
  const plural = (value, words) => words[value === 1 ? 0 : 1];

  const render = () => {
    const now = Date.now();
    const text = copy[getLocale()];

    if (now >= returnAt) {
      root.dataset.state = 'finished';
      elements.kicker.textContent = text.finishedTitle;
      elements.values.hidden = true;
      elements.note.textContent = text.finishedNote;
      elements.accessible.textContent = `${text.finishedTitle}. ${text.finishedNote}`;
      return;
    }

    if (now >= departureAt) {
      root.dataset.state = 'sailing';
      elements.kicker.textContent = text.sailingTitle;
      elements.values.hidden = true;
      elements.note.textContent = text.sailingNote;
      elements.accessible.textContent = `${text.sailingTitle}. ${text.sailingNote}`;
      return;
    }

    const remaining = departureAt - now;
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);

    root.dataset.state = 'countdown';
    elements.kicker.textContent = text.title;
    elements.values.hidden = false;
    elements.days.textContent = String(days);
    elements.hours.textContent = String(hours).padStart(2, '0');
    elements.minutes.textContent = String(minutes).padStart(2, '0');
    elements.daysLabel.textContent = plural(days, text.day);
    elements.hoursLabel.textContent = plural(hours, text.hour);
    elements.minutesLabel.textContent = plural(minutes, text.minute);
    elements.note.textContent = text.departure;
    elements.values.setAttribute('aria-label', text.timerLabel);
    elements.accessible.textContent = `${text.title} ${days} ${plural(days, text.day)}, ${hours} ${plural(hours, text.hour)} ${text.and} ${minutes} ${plural(minutes, text.minute)}.`;
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });
  window.addEventListener('egadi:localechange', render);
  render();
  window.setInterval(render, 15000);
})();

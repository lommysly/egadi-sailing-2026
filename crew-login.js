import { crewAccessErrorMessage, personalAreaUrl, signInCrew, startCrewAreaSession } from './crew-session.js?v=20260911-live';

const form = document.querySelector('#crewLoginForm');
const message = document.querySelector('#crewLoginMessage');

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('is-error', isError);
}

function setFormAvailability(enabled) {
  form.querySelectorAll('input, button').forEach((control) => {
    control.disabled = !enabled;
  });
}

startCrewAreaSession({
  onOpening: (text, isError) => {
    setMessage(text, isError);
    setFormAvailability(!isError);
  },
  onInvalid: () => setFormAvailability(true),
  onReady: () => window.location.replace(personalAreaUrl()),
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage('Verifico il tuo accesso personale…');
  try {
    await signInCrew({ phone: fields.get('phone').trim(), pin: fields.get('pin').trim() });
    window.location.replace(personalAreaUrl());
  } catch (error) {
    setMessage(crewAccessErrorMessage(error), true);
    submitButton.disabled = false;
  }
});

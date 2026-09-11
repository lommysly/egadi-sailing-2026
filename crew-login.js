import { crewAccessErrorMessage, personalAreaUrl, signInCrew, startCrewAreaSession } from './crew-session.js';

const form = document.querySelector('#crewLoginForm');
const message = document.querySelector('#crewLoginMessage');

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('is-error', isError);
}

startCrewAreaSession({
  onOpening: (text, isError) => setMessage(text, isError),
  onInvalid: () => {},
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

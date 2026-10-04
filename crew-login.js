import { crewAccessErrorMessage, personalAreaUrl, signInCrew, startCrewAreaSession, watchForStaleScript } from './crew-session.js?v=20261004-messaggi-sinceri-v1';
import { collegaCampiNumero, numeroInternazionale } from './phone-prefix.js?v=20261004-prefisso-ovunque-v1';

watchForStaleScript(import.meta.url);

const form = document.querySelector('#crewLoginForm');
const message = document.querySelector('#crewLoginMessage');
const translate = (key, fallback) => {
  const translated = window.EgadiI18n?.t?.(key);
  return translated && translated !== key ? translated : fallback;
};

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
  setMessage(translate('crew.login.checking', 'Verifico il tuo accesso personale…'));
  try {
    const phone = numeroInternazionale(
      String(fields.get('phonePrefix')) === 'altro' ? fields.get('phonePrefixCustom') : fields.get('phonePrefix'),
      fields.get('phone'),
    );
    await signInCrew({ phone, pin: fields.get('pin').trim() });
    window.location.replace(personalAreaUrl());
  } catch (error) {
    setMessage(crewAccessErrorMessage(error), true);
    submitButton.disabled = false;
  }
});

// I due campi del numero vanno collegati anche qui: chi torna per entrare
// con numero e codice deve scriverlo esattamente come quando si e' attivato.
collegaCampiNumero(document.querySelector('#crewLoginForm'));

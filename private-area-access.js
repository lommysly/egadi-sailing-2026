/*
 * Interruttore di sicurezza per le pagine che trattano dati personali.
 * Attivato dal titolare per l'uso operativo dell'evento. Per chiuderlo in
 * emergenza, riportare questo valore a false e chiudere anche il flag Firebase.
 */
export const PRIVATE_AREA_ENABLED = true;

function hasSecureTransport() {
  const hostname = window.location.hostname;
  const isLocalPreview = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  return window.location.protocol === 'https:' || isLocalPreview;
}

export function canUsePrivateArea() {
  return PRIVATE_AREA_ENABLED && hasSecureTransport();
}

export function privateAreaBlockMessage() {
  if (!hasSecureTransport()) {
    return 'L’area privata è temporaneamente chiusa: per proteggere i dati personali serve prima un collegamento HTTPS valido. Non inserire dati qui.';
  }
  return 'L’area privata è in preparazione: l’informativa privacy definitiva deve essere completata prima di raccogliere dati personali.';
}

const PHONE_FINGERPRINT_PREFIX = 'egadi-crew-phone-v1:';
const LOGIN_ALIAS_PREFIX = 'egadi-crew-login-v1:';
const CREW_LOGIN_DOMAIN = 'crew.egadi.thatsablast.it';

export function isInviteCode(value) {
  return /^[a-f0-9]{48}$/.test(String(value || ''));
}

export function normalizeCrewPhone(value) {
  const normalized = String(value || '').trim().replace(/[ .()\-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : '';
}

export function isCrewPin(value) {
  return /^\d{6}$/.test(String(value || ''));
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('La protezione del browser non è disponibile. Apri il sito in HTTPS aggiornato.');
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function phoneFingerprintFor(phone) {
  const normalizedPhone = normalizeCrewPhone(phone);
  if (!normalizedPhone) throw new Error('Inserisci il numero WhatsApp con prefisso internazionale.');
  return sha256Hex(`${PHONE_FINGERPRINT_PREFIX}${normalizedPhone}`);
}

export async function createCrewInviteIdentity({ phone, accessKey }) {
  if (!isInviteCode(accessKey)) throw new Error('L’invito non è valido.');
  const normalizedPhone = normalizeCrewPhone(phone);
  if (!normalizedPhone) throw new Error('Inserisci il numero WhatsApp con prefisso internazionale.');
  const phoneFingerprint = await phoneFingerprintFor(normalizedPhone);
  const loginAlias = await sha256Hex(`${LOGIN_ALIAS_PREFIX}${phoneFingerprint}:${accessKey}`);
  return {
    normalizedPhone,
    phoneFingerprint,
    loginEmail: `${loginAlias}@${CREW_LOGIN_DOMAIN}`,
  };
}

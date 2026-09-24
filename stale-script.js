// Una scheda rimasta aperta da prima di una pubblicazione continua a
// eseguire il JavaScript vecchio anche a lungo (in background su mobile non
// viene mai ricaricata da sola). Il numero di versione nell'URL dello script
// serve a niente finché il browser non rilegge la pagina: caso reale del
// 23/09/2026, Mirella Miccio ha confermato un volo alle 18:25 su una scheda
// aperta prima delle 13:12, quindi senza il controllo introdotto quella
// stessa mattina, ottenendo un salvataggio valido per il codice vecchio ma
// incompleto per quello nuovo. Ogni pagina (equipaggio o skipper) chiama
// watchForStaleScript passando `import.meta.url` (che contiene la propria
// versione) per accorgersi da sola quando è superata. Se non c'è nulla da
// perdere (scheda nascosta, o nessun campo ancora toccato) si ricarica da
// sola; altrimenti mostra un avviso con un tocco esplicito, per non
// cancellare dati non ancora salvati. Condiviso tra crew-session.js e
// area.js: non dipende da nessuno dei due tipi di sessione.
function parseVersionedScriptUrl(scriptUrl) {
  try {
    const parsed = new URL(scriptUrl);
    const scriptPath = parsed.pathname.split('/').pop();
    const currentVersion = parsed.searchParams.get('v');
    return scriptPath && currentVersion ? { scriptPath, currentVersion } : null;
  } catch (error) {
    return null;
  }
}

// Controllo puntuale, usabile subito prima di una scrittura importante (una
// conferma di viaggio, il salvataggio della Crew List): a differenza del
// banner di watchForStaleScript, qui la risposta serve per decidere se far
// partire o no il salvataggio, non solo per avvisare più tardi.
export async function isScriptStale(scriptUrl) {
  const parsed = parseVersionedScriptUrl(scriptUrl);
  if (!parsed) return false;
  try {
    const response = await fetch(`${window.location.pathname}${window.location.search}`, { cache: 'no-store' });
    if (!response.ok) return false;
    const html = await response.text();
    const escapedPath = parsed.scriptPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(`${escapedPath}\\?v=([A-Za-z0-9._-]+)`));
    return Boolean(match && match[1] !== parsed.currentVersion);
  } catch (error) {
    // Rete assente o instabile: non blocchiamo un salvataggio solo perché
    // non siamo riusciti a verificare la versione.
    return false;
  }
}

export function watchForStaleScript(scriptUrl) {
  const parsed = parseVersionedScriptUrl(scriptUrl);
  if (!parsed) return;
  let checking = false;
  let banner = null;
  let userHasEdited = false;
  document.addEventListener('input', () => { userHasEdited = true; }, { capture: true });
  document.addEventListener('change', () => { userHasEdited = true; }, { capture: true });
  async function check() {
    if (checking || banner) return;
    checking = true;
    try {
      if (await isScriptStale(scriptUrl)) handleStale();
    } finally {
      checking = false;
    }
  }
  function handleStale() {
    // Niente da perdere (scheda nascosta, o nessun campo ancora toccato in
    // questo caricamento): ricarica subito da sola, così nessuno interagisce
    // mai col codice vecchio. Con qualcosa già scritto in un modulo, invece,
    // non ricarichiamo di nascosto: meglio un avviso con un tocco esplicito,
    // per non cancellare dati non salvati.
    if (document.visibilityState === 'hidden' || !userHasEdited) {
      window.location.reload();
      return;
    }
    showBanner();
  }
  function showBanner() {
    if (banner) return;
    banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;padding:12px 16px;background:#0b2e35;color:#fff;font:600 .85rem "DM Sans",sans-serif;box-shadow:0 -6px 18px rgba(0,0,0,.18);';
    const text = document.createElement('span');
    text.textContent = 'È disponibile una versione aggiornata di questa pagina. Aggiorna prima di continuare a compilare.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Aggiorna ora';
    button.style.cssText = 'background:#e8734a;color:#fff;border:none;border-radius:999px;padding:8px 16px;font:700 .8rem "DM Sans",sans-serif;cursor:pointer;';
    button.addEventListener('click', () => window.location.reload());
    banner.append(text, button);
    document.body.appendChild(banner);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  setInterval(check, 5 * 60 * 1000);
  check();
}

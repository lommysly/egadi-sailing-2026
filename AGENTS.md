# AGENTS.md — Egadi Sailing Experience

Istruzioni permanenti per qualunque agente (Codex, Claude, o altro) che lavora su questo repository. Scritte il 22 settembre 2026 dopo un audit completo del progetto (22 branch, tutta la documentazione, il codice di main). Leggerle PRIMA di scrivere codice.

## 0. Il repository in una frase

Sito Firebase (Spark, no server proprio) per l'evento velico "Egadi Sailing Experience" (8-11 ottobre 2026, Marsala → Levanzo → Marettimo → Favignana), con sito pubblico + area riservata skipper/equipaggio. Dominio: `egadi.thatsablast.it`. Lavoro reale quasi tutto già su `origin/main` (GitHub): 21 dei 22 branch locali risultano già mergiati lì. Il problema non è "troppe funzionalità mancanti", è **igiene Git** e **leggibilità per utenti non tecnici**.

## 1. Regole anti-regressione (obbligatorie)

Queste regole esistono perché sono già successe, non per teoria:

1. **Prima di iniziare qualunque lavoro, verifica lo stato reale con `git fetch origin` + `git status` + `git log main..origin/main --oneline | wc -l`.** Non fidarti mai del branch locale `main` per giudicare cosa è "nuovo": al 22/9/2026 il main locale era indietro di 101 commit rispetto a `origin/main` e questo ha reso illeggibili tutti i confronti `git diff main...<branch>` per giorni. Se `main` locale è indietro, il primo passo è allinearlo (`git pull`), non creare un nuovo branch sopra una base vecchia.

2. **Mai lasciare lavoro non committato per più di una sessione.** Trovato un worktree con modifiche non salvate da giorni, sparse su 20 file (`my-area.js`, `firestore.rules`, `passage-plan.js`, `flotta.html`, `index.html`, doc di specifica), senza un commit né un branch dedicato. Se stai modificando qualcosa che non è ancora pronto per un commit "pulito", crea un branch con nome esplicito e committa spesso, anche WIP — mai lasciare la working copy del branch `main` sporca.

3. **Prima di creare un nuovo branch/worktree per una feature, cerca se esiste già.** Sono stati trovati 3 branch diversi (`codex/deploy-passage-countdown`, `codex/partial-profile-saves`, e la parte "countdown" di `codex/deploy-briefing-acceptance`) che implementano la STESSA funzione (countdown alla partenza) in modo indipendente, con commit message quasi identici. Prima di scrivere una feature, `git log --all --oneline --grep="<parola chiave>"` e controlla i branch esistenti (`git branch -a`).

4. **Un worktree = un branch attivo, mai più worktree sullo stesso lavoro.** Se un worktree ha già fuso a monte il lavoro di un altro (verificabile con `git merge-base --is-ancestor`), il worktree più vecchio va rimosso (`git worktree remove`), non lasciato lì a generare confusione.

5. **File "caldi" da trattare con cautela**: `area.js`, `my-area.js`, `firestore.rules`, `styles.css`, `participant.js`, `index.html`. Sono toccati da quasi ogni branch. Prima di modificarli, verifica che nessun altro worktree attivo li stia modificando in parallelo (`git worktree list` + controllo branch), e se possibile isola la modifica in un file nuovo invece di espandere ulteriormente questi monoliti (es. `area.js` ha superato le 1200 righe).

6. **`firestore.rules` e `storage.rules` non si toccano senza aggiornare `FIRESTORE_RULES_TEST_MATRIX.md`** e senza eseguire i test lì descritti (`firebase emulators:exec --only firestore`) prima di pubblicare. Nessuna regola di sicurezza va in produzione senza essere passata dalla matrice di test.

7. **Non duplicare una funzionalità "cognitiva" già esistente — riusala.** Il progetto ha già uno stile UI validato per le viste complesse: hub a card cliccabili con 2-3 passi (es. dashboard economica skipper: Imposta/Richiedi/Controlla) e timeline di stato con marcatori visivi (✓ completo, ! attenzione, • in attesa) (es. "La mia attività" equipaggio). Ogni nuova vista rivolta a un utente non tecnico deve seguire questo stesso pattern invece di inventarne uno nuovo — vedi sezione 2.

8. **Ogni documento di stato (`CHECKLIST_PUBBLICAZIONE.md`, `README.md`) va aggiornato nello stesso commit/PR della feature.** Trovato più volte codice nuovo consistente (es. l'intero portale Transfer con Cloud Functions) senza che la checklist di pubblicazione venisse anche solo menzionata — rende impossibile capire lo stato reale del progetto leggendo la documentazione.

9. **Mai esporre riferimenti tecnici (ID Firestore, UID Firebase, hash SHA-256) nelle viste pensate per la lettura umana** (proprietario o utente finale). I riferimenti tecnici vanno in una vista/foglio separato, chiaramente etichettato come tecnico, mai mescolati con i dati che una persona deve leggere per organizzarsi.

10. **Ogni volta che modifichi `styles.css`, `travel.js`, `area.js`, `my-area.js`, `transfer.js`, `passage-plan.js`/`passage-plan-data*.js` o qualunque file linkato da `<link>`/`<script src>`, aggiorna SUBITO il parametro `?v=...` in TUTTI i file HTML che lo referenziano, nello stesso commit.** Il sito gira su GitHub Pages con CDN Fastly davanti (`cache-control: max-age=600`); senza cambiare la stringa di versione, chi ha già visitato il sito continua a vedere il file vecchio anche dopo il deploy, e sembra un bug quando invece è solo cache. Successo il 22/9/2026: tre round di modifiche a `styles.css` di fila con lo stesso `?v=`, il titolare vedeva la struttura nuova (dal JS, versione aggiornata) ma i colori vecchi (dal CSS, versione ferma). Un solo comando per farlo su tutti i file insieme:
    ```
    for f in *.html; do sed -i '' -E 's/styles\.css\?v=[^"]*/styles.css?v=NUOVA-VERSIONE/' "$f"; done
    ```
    (ripetere per ogni file JS toccato, cambiando il nome del file nel comando).

11. **Prima di aprire l'area privata o pubblicare Rules nuove a dati reali**, la sezione "Security Rules e test fittizi obbligatori" della checklist deve essere completamente spuntata. Non è mai stata eseguita per intero finora — non è più accettabile lasciarla indietro mentre si aggiungono funzionalità sopra.

12. **`firestore.rules` ha un tetto reale di 1000 sotto-espressioni valutabili per richiesta: superarlo produce `PERMISSION_DENIED: Unable to evaluate the expression...`, indistinguibile lato utente da un problema di connessione.** Scoperto il 23/09/2026: la transizione proiezione→invito con un gruppo cabina profondo (`cabinGroupId: "double-4"`) veniva rifiutata in silenzio, e la stessa scrittura per andata/ritorno equipaggio rischiava lo stesso per `hasCurrentBriefingAcceptance` (richiamata da quasi ogni scrittura, con `get()`/`getAfter()` sullo stesso documento ripetuti 4-8 volte in un'unica funzione). Se un'azione dell'interfaccia sembra completarsi ma il documento non cambia — soprattutto con un messaggio d'errore che nomina la connessione — sospettare per primo questo limite prima della rete: cercare `get()`/`getAfter()`/`exists()` ripetuti sullo stesso percorso e raccoglierli con un binding `let` (`let doc = exists(path) ? get(path).data : null;`, poi riusare `doc` invece di richiamare `get()` di nuovo), ed eliminare controlli duplicati già coperti più a fondo da un'altra funzione chiamata nello stesso punto. Verificare sempre nell'emulatore con la scrittura batch reale (non solo con `assertSucceeds`/`assertFails` isolati) prima e dopo la correzione — vedi la nota omonima in `FIRESTORE_RULES_TEST_MATRIX.md`.

## 2. Prompt di ingegneria e design — da usare per ogni nuova funzionalità o modifica UI

Questo è il prompt/contesto da dare a un agente (Codex incluso) quando lavora su questo sito. Copiare e adattare all'attività specifica.

---

**Ruolo**: sei un ingegnere full-stack senior specializzato in applicazioni Firebase per eventi reali (non demo), e un designer UX specializzato in utenti che non hanno familiarità con il web.

**Ingegneria — livello richiesto per un progetto di questa portata:**
- Prima di scrivere codice, verifica lo stato reale del repo (vedi Regole anti-regressione sopra). Non presumere che `main` locale sia aggiornato.
- Ogni nuova collezione/campo Firestore richiede regole di sicurezza esplicite (mai `allow read, write: if true`) e una riga nuova in `FIRESTORE_RULES_TEST_MATRIX.md` con almeno un test positivo e uno negativo.
- Non introdurre dati sensibili (IBAN, targhe, documenti, numeri di telefono) in punti nuovi senza controllare `PRIVACY_DA_COMPLETARE.md` e aggiornarlo se il nuovo dato non è già previsto.
- Preferisci sempre estendere un pattern esistente (hub a card, timeline di stato, Cloud Function `materialize*`) invece di inventarne uno nuovo per lo stesso tipo di problema.
- Ogni funzione di matching/aggregazione fra utenti diversi (es. chi arriva nella stessa fascia oraria) va progettata pensando che Firestore non può nascondere singoli campi di un documento leggibile da un utente: se serve nascondere dati fra utenti, la logica va lato server (Cloud Function) o via segnali anonimi — mai delegata solo alle Security Rules su un documento condiviso.
- Commit piccoli e frequenti, messaggio in italiano chiaro (stile già in uso: "feat: ...", "fix: ...", "aggiorna: ..."), mai un commit che mescola più funzionalità slegate.

**Design — l'utente finale di questo sito è spesso una persona che non usa siti complessi regolarmente, si blocca facilmente e va in ansia se non capisce cosa fare.** Ogni schermata, form o messaggio deve rispettare questi principi:

1. **Un passo alla volta, mai una pagina con tutto insieme.** Se una schermata richiede più di 3-4 decisioni, spezzala in step numerati con un solo obiettivo ciascuno e un pulsante "avanti" chiaro. Modello di riferimento già presente nel sito: l'hub "Quote e conti" (Imposta → Richiedi → Controlla).
2. **Dì sempre all'utente dove si trova e cosa succederà dopo.** Titoli di sezione chiari, indicatore del passo corrente, mai un form che si apre senza spiegare a cosa serve.
3. **Zero gergo tecnico visibile.** Niente ID, UID, timestamp grezzi, nomi di campi Firestore, codici di stato interni (`prepared`/`verified` va tradotto in linguaggio umano: "in attesa", "confermato"). Se un dato tecnico deve esistere per forza, va in una vista separata esplicitamente etichettata "dati tecnici", mai mescolato.
4. **Messaggi d'errore rassicuranti e utili, mai criptici.** Non "Errore 403" ma "Non riesco a salvare, il tuo invito potrebbe essere scaduto — scrivi allo skipper su WhatsApp" con un'azione concreta da fare, sempre con un modo di chiedere aiuto a portata di click (link WhatsApp diretto allo skipper/organizzatore).
5. **Niente vicoli ciechi.** Ogni schermata deve avere un modo ovvio per tornare indietro, ricominciare o chiedere aiuto — mai un form che si blocca senza uscita.
6. **Mobile-first, sempre.** L'utente compila da telefono, spesso in movimento o con connessione debole: campi grandi, tap-target ampi, autosalvataggio dove possibile, nessuna azione che richiede di scrollare per capire cosa fare dopo.
7. **Progressive disclosure**: mostra prima la sintesi/il riepilogo leggibile a colpo d'occhio (stato: fatto/da fare/attenzione), il dettaglio tecnico solo su richiesta esplicita — mai il contrario.
8. **Conferme visive immediate.** Dopo ogni azione (salvataggio, invio), un feedback chiaro e immediato ("Salvato ✓"), mai un'azione che lascia l'utente incerto se ha funzionato.

---

## 3. Documenti collegati

- `STATO_PROGETTO_2026-09-22.md` — fotografia completa dello stato reale del progetto (branch, cosa è già mergiato, cosa manca) e audit delle 4 priorità concordate con il titolare (form Arrivi/Partenze, foglio di backup, vista proprietario, vista utenti per fascia oraria).
- `ARRIVI_PARTENZE_SPEC.md`, `CHECKLIST_PUBBLICAZIONE.md`, `PRIVACY_DA_COMPLETARE.md`, `FIRESTORE_RULES_TEST_MATRIX.md` — documenti di specifica/stato già esistenti nel progetto, ancora validi e da tenere aggiornati.

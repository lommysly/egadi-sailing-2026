# Stato del progetto Egadi — fotografia al 22 settembre 2026

Documento di allineamento tra Silvio (titolare) e gli agenti (Claude/Codex) che lavorano sul progetto. Prodotto da un audit completo: 22 branch analizzati, 11 documenti di progetto letti, codice di `main` letto, tutto in sola lettura (nessun comando distruttivo eseguito).

## 1. La scoperta principale: non è un problema di funzionalità mancanti, è igiene Git

Il repository locale ha 4 cartelle worktree (`2026-10-08-11-egadi`, `-deploy-briefing`, `-deploy-passage`, `-visual-release`) e 22 branch `codex/*` non mergiati nel `main` **locale**. Sembrava un caos di lavoro parallelo scoordinato. Non lo è:

- **`origin/main` su GitHub è già allineato con 21 dei 22 branch locali.** Sono stati mergiati via Pull Request (#1 → #32) nell'arco dell'11-21 settembre.
- **L'unico problema è che il `main` locale in `2026-10-08-11-egadi` non ha mai fatto `git pull`**: è fermo al commit dell'11 settembre, **101 commit indietro** rispetto a `origin/main`. Questo ha reso illeggibile ogni confronto fatto finora contro quel `main` locale (diff enormi e fuorvianti).
- **L'unico branch con lavoro realmente non mergiato è `codex/partial-profile-saves`** (worktree `2026-10-08-11-egadi-visual-release`): 3 commit avanti rispetto a `origin/main`, e **mai pushati su GitHub** — quindi a rischio se questo Mac ha un problema.
- **Il worktree principale (`2026-10-08-11-egadi`, branch `main`) ha inoltre lavoro non committato**: 20 file modificati (758 righe inserite) + 7 file nuovi non tracciati, mai salvati in un commit. Riguardano soprattutto `my-area.js` (+301 righe), `firestore.rules` (+111), `passage-plan.js` (+127), `flotta.html`, `index.html`, e modifiche a `ARRIVI_PARTENZE_SPEC.md`. Non è chiaro se questo lavoro sia già presente altrove (in `origin/main` o in `partial-profile-saves`) o sia unico — **va controllato prima di qualunque `pull`, per non perderlo**.

### Cosa consiglio (nessuna azione eseguita, in attesa di tua conferma)

1. Mettere in sicurezza le modifiche non committate nel worktree `main` (commit su un branch dedicato, es. `local-wip-22-09`), così non si perdono.
2. Fare `git pull` sul `main` di `2026-10-08-11-egadi` (fast-forward pulito, verificato sicuro).
3. Pushare `codex/partial-profile-saves` su GitHub subito (salvaguardia), poi valutare cosa tenerne: la parte "bozze viaggio partecipante + dichiarazione pagamento" è utile, la parte "countdown" è doppione di quello già in `origin/main` (stesso identico codice, sviluppato due volte in parallelo) e va scartata in fase di merge.
4. Una volta allineato il `main` locale, i worktree `2026-10-08-11-egadi-deploy-briefing` e `2026-10-08-11-egadi-deploy-passage` diventano ridondanti (i loro branch sono già interamente contenuti in `origin/main`) e possono essere rimossi per tornare a una struttura pulita: `main` + un worktree per il lavoro attivo su `partial-profile-saves`.

Nessuno di questi passaggi è stato eseguito: toccano commit, push e worktree, quindi aspetto un tuo sì prima di procedere.

## 2. Cosa contiene davvero il progetto oggi (da `origin/main`)

- **Sito pubblico**: home con countdown dinamico alla partenza, pagina Flotta pubblica (barche visibili di default, posti disponibili), Meteo & Passage Plan, storyboard video, pagina Privacy (ancora bozza).
- **Accesso equipaggio**: primo accesso via link WhatsApp + codice a 6 cifre, accessi successivi senza Google/email/SMS, link con scadenza 14 giorni.
- **Area riservata skipper**: gestione equipaggio e inviti, cabine (doppie condivise incluse), piano quote automatico (Preventivo barca v7, 10 voci fisse), profilo di incasso (PayPal/Satispay/Revolut/IBAN), archivio documenti skipper (patente, certificato radio, su Firebase Storage), bacheca/regole di bordo con accettazione obbligatoria.
- **Area riservata equipaggio**: dati personali, briefing di sicurezza con lettura obbligatoria, richieste di pagamento (messaggi WhatsApp precompilati, mai pagamenti reali sul sito), timeline "La mia attività".
- **Sito bilingue IT/EN** editoriale su gran parte delle pagine.
- **Modulo Arrivi & Partenze** (`travel.js`/`travel.html`): 4 tratte facoltative per persona (casa→aeroporto andata, aeroporto→Marsala, Marsala→aeroporto rientro, aeroporto→casa), catalogo città/aeroporti/compagnie con autocomplete.
- **Portale Transfer** (`transfer.js`/`transfer.html` + Cloud Functions): per operatori esterni che gestiscono i trasferimenti aeroporto↔Marsala, con provisioning account, sincronizzazione automatica delle tratte (`materializeCrewTravel`/`materializeSkipperTravel`), **e una sincronizzazione verso un Google Sheet esterno (`syncTravelBackupToGoogleSheet`) — quasi certamente il "foglio di backup" di cui parlavi, quello che mostra riferimenti tecnici invece di dati leggibili.**
- Prima dipendenza da Firebase Storage (piano Blaze, non più solo Spark gratuito) per l'archivio documenti skipper.

Stato di pubblicazione secondo `CHECKLIST_PUBBLICAZIONE.md`: sito pubblico e area privata **attivi**, ma la sezione sicurezza (test Firestore Rules con dati fittizi) **non è mai stata eseguita per intero**, la privacy policy è **ancora da completare**, e i contenuti media definitivi **mancano**. Sono condizioni che il documento stesso segnala come bloccanti prima di estendere l'uso a tutta la flotta.

## 3. Audit delle 4 priorità concordate

### 3.1 Form Arrivi/Partenze (percorso casa→aeroporto, per organizzare transfer condivisi)

**Esiste ed è abbastanza sofisticato**: 4 tratte indipendenti, catalogo guidato (città/aeroporto/compagnia), orario obbligatorio, bagagli, disponibilità (cerco/offro passaggio). La finestra di compatibilità per il matching è fissata **a ±120 minuti — esattamente le "2 ore" di cui mi hai parlato**, quindi la logica di fondo che avevi in mente è già nella specifica.

**Perché la compilazione sembra complessa**: è un form con molti campi tutti su una schermata (non è ancora stato riorganizzato con il pattern "hub a step" che il progetto usa già altrove per la dashboard economica). È anche il modulo più recentemente modificato: l'ultimo commit del branch più avanzato (21 settembre) era ancora un fix su un bug delle regole di sicurezza che bloccava la lettura/scrittura delle proprie tratte — segno che il modulo era instabile fino all'ultimo giorno di lavoro.

**Raccomandazione concreta**: applicare all'inserimento delle tratte lo stesso pattern "hub a card" già validato nella dashboard economica (una card per tratta, un passo alla volta, riepilogo finale prima di salvare) invece del form attuale presumibilmente a schermata unica.

### 3.2 Il "foglio" con l'elenco persone (troppo tecnico)

**Identificato**: quasi certamente la funzione Cloud `syncTravelBackupToGoogleSheet`, che sincronizza le tratte verso un Google Sheet esterno per la società di transfer/backup offline. Non ho potuto leggere il contenuto esatto delle colonne generate (la funzione vive nel branch, il codice completo non era nel set analizzato in dettaglio), ma la lamentela — riferimenti Firebase invece di dati leggibili — è coerente con come tipicamente si esporta un documento Firestore "as-is" verso un foglio, senza un livello di traduzione per la lettura umana.

**Raccomandazione concreta, esattamente come richiesto**: separare l'export in due fogli/viste:
- **Foglio Arrivi**: nome persona, data, orario, provenienza (città/aeroporto), volo/compagnia, bagagli, chi cerca/offre passaggio — niente altro.
- **Foglio Partenze**: stessa struttura, per le tratte di rientro.
- **Foglio tecnico separato** (solo per chi lo deve consultare davvero): ID Firestore, UID, riferimenti interni — mai mescolato con i due sopra.

### 3.3 Vista proprietario (creazione account, elenco) — deve essere cognitiva

**Il pattern esiste già e funziona**: la dashboard economica dello skipper è già stata riorganizzata (branch `egadi-dashboard-cognitiva` + `egadi-dashboard-cognitive-refinement`, entrambi già in produzione) in un hub a 3 passi con card cliccabili (Imposta → Richiedi → Controlla) e una timeline di stato per l'equipaggio ("La mia attività", con marcatori ✓/!/•). Questo pattern **non è ancora stato applicato alla gestione Arrivi/Partenze né alla vista "elenco persone"** — è il gap principale da colmare, ma non si parte da zero: si riusa uno stile già collaudato nello stesso sito.

### 3.4 Vista utente: chi altro è nella mia stessa fascia oraria (~2h) per organizzarsi

**Questo è il punto dove il progetto è più indietro, ed è documentato esplicitamente come tale**: `ARRIVI_PARTENZE_SPEC.md` descrive la finestra di compatibilità ±120 minuti e il meccanismo di "proposta anonima di match con doppia accettazione prima di mostrare il WhatsApp reciproco" — ma la segna esplicitamente come funzionalità **"in seguito"**, non ancora costruita. Il `README.md` conferma: "la proposta anonima e la doppia accettazione saranno aggiunte prima di mostrare WhatsApp tra equipaggi".

C'è anche un **problema tecnico già individuato ma non risolto** nella specifica stessa: Firestore non può nascondere singoli campi di un documento leggibile dall'utente, quindi il matching fra persone diverse **deve** passare da una Cloud Function server-side (o usare solo segnali anonimi) — non si può implementare in modo sicuro solo con le Security Rules attuali. Questo è il punto tecnico da risolvere per primo prima di costruire la UI.

**In sintesi su questo punto**: non manca l'idea né la specifica (c'è già, ed è precisa: ±2h, doppia conferma, niente numeri esposti prima del consenso reciproco) — manca l'implementazione, e serve una funzione server-side dedicata.

## 4. Prossimi passi possibili (da concordare, nessuno ancora eseguito)

1. Mettere in sicurezza il lavoro Git (sezione 1) — commit, push, pull, pulizia worktree.
2. Costruire la Cloud Function di matching anonimo per la fascia ±2h (il pezzo mancante di 3.4).
3. Riorganizzare il form Arrivi/Partenze con il pattern hub-a-step già collaudato (3.1).
4. Ridisegnare l'export verso il foglio esterno in due viste leggibili + un foglio tecnico separato (3.2).
5. Applicare il pattern cognitivo alla vista proprietario per Arrivi/Partenze (3.3).
6. Completare la sezione "Security Rules e test fittizi" della checklist, mai eseguita per intero, prima di considerare qualunque nuova regola pronta per dati reali.

Vedi anche `AGENTS.md` per le regole operative permanenti da seguire durante questo lavoro.

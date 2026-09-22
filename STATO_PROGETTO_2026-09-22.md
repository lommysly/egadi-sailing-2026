# Stato del progetto Egadi — fotografia al 22 settembre 2026

Documento di allineamento tra Silvio (titolare) e gli agenti (Claude/Codex) che lavorano sul progetto. Prodotto da un audit completo: 22 branch analizzati, 11 documenti di progetto letti, codice di `main` letto, tutto in sola lettura (nessun comando distruttivo eseguito).

## 1. La scoperta principale: non è un problema di funzionalità mancanti, è igiene Git

Il repository locale ha 4 cartelle worktree (`2026-10-08-11-egadi`, `-deploy-briefing`, `-deploy-passage`, `-visual-release`) e 22 branch `codex/*` non mergiati nel `main` **locale**. Sembrava un caos di lavoro parallelo scoordinato. Non lo è:

- **`origin/main` su GitHub è già allineato con 21 dei 22 branch locali.** Sono stati mergiati via Pull Request (#1 → #32) nell'arco dell'11-21 settembre.
- **L'unico problema è che il `main` locale in `2026-10-08-11-egadi` non ha mai fatto `git pull`**: è fermo al commit dell'11 settembre, **101 commit indietro** rispetto a `origin/main`. Questo ha reso illeggibile ogni confronto fatto finora contro quel `main` locale (diff enormi e fuorvianti).
- **L'unico branch con lavoro realmente non mergiato è `codex/partial-profile-saves`** (worktree `2026-10-08-11-egadi-visual-release`): 3 commit avanti rispetto a `origin/main`, e **mai pushati su GitHub** — quindi a rischio se questo Mac ha un problema.
- **Il worktree principale (`2026-10-08-11-egadi`, branch `main`) ha inoltre lavoro non committato**: 20 file modificati (758 righe inserite) + 7 file nuovi non tracciati, mai salvati in un commit. Riguardano soprattutto `my-area.js` (+301 righe), `firestore.rules` (+111), `passage-plan.js` (+127), `flotta.html`, `index.html`, e modifiche a `ARRIVI_PARTENZE_SPEC.md`. Non è chiaro se questo lavoro sia già presente altrove (in `origin/main` o in `partial-profile-saves`) o sia unico — **va controllato prima di qualunque `pull`, per non perderlo**.

### Aggiornamento 22/09/2026, pomeriggio — igiene Git completata

Tutti i punti sopra sono stati eseguiti, in quest'ordine:

1. ✅ `codex/partial-profile-saves` pushato su GitHub per sicurezza (nulla più solo-locale).
2. ✅ Lavoro non committato nel worktree `main` messo in sicurezza sul branch `local-wip-2026-09-22` (pushato), poi `main` allineato a `origin/main` con `git pull --ff-only` (fast-forward pulito, nessun conflitto).
3. ✅ Worktree ridondanti `2026-10-08-11-egadi-deploy-briefing` e `2026-10-08-11-egadi-deploy-passage` rimossi (branch già interamente contenuti in `main`, nulla perso).
4. ✅ `codex/partial-profile-saves` analizzato a fondo (vedi sezione 3.2 aggiornata sotto): la parte utile (dichiarazione di pagamento) riconciliata e portata su `main` con un'implementazione coerente con l'architettura esistente (commit `ed6efa0`); la parte "Arrivo e ritorno" scartata (superata da `travel.js`, già in main); il countdown scartato (doppione byte-per-byte).
5. ✅ Worktree `2026-10-08-11-egadi-visual-release` rimosso; branch `codex/partial-profile-saves` eliminato sia in locale sia su GitHub (contenuto utile già in `main`, nessuna perdita).

**Stato attuale**: `~/Sito per Week/` contiene un solo worktree, `2026-10-08-11-egadi`, sul branch `main`, aggiornato e pulito. Nessun branch pendente, nessun lavoro non committato, nessun worktree ridondante.

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

**Perché la compilazione sembra complessa**: era un form con molti campi tutti su una schermata. È anche il modulo più recentemente modificato: l'ultimo commit del branch più avanzato (21 settembre) era ancora un fix su un bug delle regole di sicurezza che bloccava la lettura/scrittura delle proprie tratte — segno che il modulo era instabile fino all'ultimo giorno di lavoro.

#### Aggiornamento 22/09/2026 — implementato

Ogni tratta (andata/rientro) è ora divisa in 3 sezioni navigabili con schede pillola in cima ("Il tuo viaggio" · "Collegamento aeroporto" · "Passaggio auto"), una visibile alla volta — stesso pattern già collaudato per la dashboard economica (`dashboard-view-navigation`), riusato senza inventare nulla di nuovo. Nessun campo è stato spostato o rinominato: i tre fieldset esistenti sono diventati i tre step, più la sezione "persone compatibili" agganciata allo step "Passaggio auto". Verificato visivamente in un harness isolato (navigazione tra step, contenuto corretto per ciascuno) prima di integrarlo.

**Raccomandazione concreta**: applicare all'inserimento delle tratte lo stesso pattern "hub a card" già validato nella dashboard economica (una card per tratta, un passo alla volta, riepilogo finale prima di salvare) invece del form attuale presumibilmente a schermata unica.

### 3.2 Il "foglio" con l'elenco persone (troppo tecnico)

**Identificato**: quasi certamente la funzione Cloud `syncTravelBackupToGoogleSheet`, che sincronizza le tratte verso un Google Sheet esterno per la società di transfer/backup offline. Non ho potuto leggere il contenuto esatto delle colonne generate (la funzione vive nel branch, il codice completo non era nel set analizzato in dettaglio), ma la lamentela — riferimenti Firebase invece di dati leggibili — è coerente con come tipicamente si esporta un documento Firestore "as-is" verso un foglio, senza un livello di traduzione per la lettura umana.

#### Aggiornamento 22/09/2026 — implementato

`syncTravelBackupToGoogleSheet` riscritta: da un unico foglio "Movimenti" a 18 colonne (con `recordId` in prima colonna) a **tre fogli separati**, creati automaticamente se mancanti nello spreadsheet:
- **Arrivi** (tratte `outbound`): nome, barca, data, ora, aeroporto, mezzo, bagagli, come si muove, stato (etichetta leggibile, non il valore tecnico grezzo), gruppo, ritrovo, telefono, email, note — 14 colonne, zero riferimenti tecnici.
- **Partenze** (tratte `return`): stessa struttura, per il rientro.
- **Tecnico**: `ID record`, nome, barca, direzione, stato interno, traccia, timestamp — solo qui vivono i riferimenti utili a chi deve incrociare un dato con Firestore.

Ogni foglio ha il proprio contatore di riga indipendente (non più uno condiviso). Verificato con test sull'emulatore Firestore + Functions: instradamento corretto per direzione, contatori indipendenti, nessun crash con configurazione assente. La chiamata reale a Google Sheets non è testabile in locale senza toccare lo spreadsheet vero — verificata per lettura del codice e per analogia con il pattern già in produzione.

### 3.3 Vista proprietario (creazione account, elenco) — deve essere cognitiva

**Il pattern esiste già e funziona**: la dashboard economica dello skipper è già stata riorganizzata (branch `egadi-dashboard-cognitiva` + `egadi-dashboard-cognitive-refinement`, entrambi già in produzione) in un hub a 3 passi con card cliccabili (Imposta → Richiedi → Controlla) e una timeline di stato per l'equipaggio ("La mia attività", con marcatori ✓/!/•). Questo pattern **non è ancora stato applicato alla gestione Arrivi/Partenze né alla vista "elenco persone"** — è il gap principale da colmare, ma non si parte da zero: si riusa uno stile già collaudato nello stesso sito.

### 3.4 Vista utente: chi altro è nella mia stessa fascia oraria (~2h) per organizzarsi

**Questo è il punto dove il progetto è più indietro, ed è documentato esplicitamente come tale**: `ARRIVI_PARTENZE_SPEC.md` descrive la finestra di compatibilità ±120 minuti e il meccanismo di "proposta anonima di match con doppia accettazione prima di mostrare il WhatsApp reciproco" — ma la segna esplicitamente come funzionalità **"in seguito"**, non ancora costruita. Il `README.md` conferma: "la proposta anonima e la doppia accettazione saranno aggiunte prima di mostrare WhatsApp tra equipaggi".

C'è anche un **problema tecnico già individuato ma non risolto** nella specifica stessa: Firestore non può nascondere singoli campi di un documento leggibile dall'utente, quindi il matching fra persone diverse **deve** passare da una Cloud Function server-side (o usare solo segnali anonimi) — non si può implementare in modo sicuro solo con le Security Rules attuali. Questo è il punto tecnico da risolvere per primo prima di costruire la UI.

**In sintesi su questo punto**: non mancava l'idea né la specifica (c'era già, ed è precisa: ±2h, doppia conferma, niente numeri esposti prima del consenso reciproco) — mancava l'implementazione.

#### Aggiornamento 22/09/2026 — implementato

Costruita e testata (emulatore Firestore + Functions, 26 casi automatici, tutti superati) la funzione server-side mancante:
- `matchCarpoolLegs` (Cloud Function attivata da ogni scrittura su una tratta): trova le persone compatibili — stessa direzione, stesso aeroporto reale, stessa data, orario entro ±120 minuti, entrambe con `carpoolRole` e `carpoolMatchConsent: true` (campi già previsti nello schema, non ancora usati da nessuna funzione prima d'ora) — ed espone solo una scheda anonima (`matchCandidates`) a ciascun lato, mai una all'altra persona direttamente.
- `respondToTravelMatch` (funzione callable): gestisce l'accettazione/rifiuto; il contatto (nome + WhatsApp) compare nella scheda di ciascun lato solo quando **entrambi** hanno accettato lo stesso abbinamento.
- UI in `travel.js`: sezione "Persone nella tua fascia oraria" sotto ogni tratta con consenso attivo, pulsanti "Mi interessa"/"Non mi interessa", link WhatsApp diretto dopo la rivelazione.
- Regole Firestore dedicate: `matchCandidates` leggibile solo dal proprietario della tratta (riusa `isCrewTravelOwner`), `travelMatchPairs` mai leggibile né scrivibile dal client (solo le Cloud Function, privilegi Admin).

**Deployato in produzione il 22/09/2026** (`firebase deploy --only firestore:rules,firestore:indexes,functions`) — al primo tentativo l'indice collection-group è stato rifiutato ("this index is not necessary, configure using single field index controls"): corretto usando `fieldOverrides` invece di `indexes` in `firestore.indexes.json`, poi deploy riuscito. `matchCarpoolLegs` e `respondToTravelMatch` sono ora live insieme alle 7 funzioni preesistenti (ridistribuite senza modifiche di codice). **Ancora da fare**: il test con account fittizi reali su HTTPS previsto da `FIRESTORE_RULES_TEST_MATRIX.md` (caso 12) — l'emulatore conferma la logica, non sostituisce quel passaggio.

## 4. Prossimi passi possibili (da concordare, nessuno ancora eseguito)

1. ✅ Mettere in sicurezza il lavoro Git (sezione 1) — fatto.
2. ✅ Costruire la Cloud Function di matching anonimo per la fascia ±2h — fatto (vedi sopra); resta da deployare e testare su HTTPS con dati fittizi.
3. ✅ Riorganizzare il form Arrivi/Partenze con il pattern hub-a-step già collaudato (3.1) — fatto.
4. ✅ Ridisegnare l'export verso il foglio esterno in due viste leggibili + un foglio tecnico separato (3.2) — fatto.
5. Applicare il pattern cognitivo alla vista proprietario per Arrivi/Partenze (3.3).
6. Completare la sezione "Security Rules e test fittizi" della checklist, mai eseguita per intero, prima di considerare qualunque nuova regola pronta per dati reali.

Vedi anche `AGENTS.md` per le regole operative permanenti da seguire durante questo lavoro.

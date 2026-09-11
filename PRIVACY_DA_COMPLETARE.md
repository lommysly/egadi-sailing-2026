# Dati da definire per l'informativa privacy finale

Questa è una scheda operativa, non sostituisce una consulenza legale. `privacy.html` resta una bozza e non va presentata come informativa definitiva finché i punti sotto non sono stati decisi, pubblicati e riletti dal titolare.

## Decisioni necessarie

| Tema | Decisione da registrare prima dell'uso reale |
| --- | --- |
| Titolare | **Lomastro Silvio**. Manca il canale di contatto dedicato per esercitare i diritti e ricevere risposta. |
| Finalità | Gestione inviti, Crew List, sicurezza e organizzazione della barca; distinguere eventuali comunicazioni facoltative. |
| Dati Crew List e contributi | Anagrafica, documento, ruolo/cabina, contatti, consenso di consegna al charter; per le richieste: importo, causale, scadenza, facoltatività, nome di chi raccoglie e tag del metodo. Escludere coordinate/IBAN, carte, credenziali, alias e link dei provider. Verificare se ogni campo è davvero necessario. |
| Dati tecnici di accesso | Numero WhatsApp normalizzato nell'invito; impronta SHA-256 del numero; alias tecnico Firebase `@crew.egadi.thatsablast.it`; UID Firebase; stato, scadenza e revoca dell'invito. L'alias non è l'email reale della persona e non riceve messaggi. |
| Codice personale | Il codice a sei cifre è verificato da Firebase Authentication. Non entra nella Crew List e non va esportato, annotato, salvato in Firestore o inviato su WhatsApp. |
| Indice di ingresso | `crewLoginIndex/{phoneFingerprint}` consente, a chi inserisce il numero esatto, di verificare se esiste un accesso attivo e di recuperare alias tecnico e identificativi tecnici di barca/invito necessari al login. Non contiene nome, numero, documento o dati Crew List, ma comporta un rischio limitato di verifica dell'appartenenza e applica il vincolo un numero / una barca attiva: va motivato e descritto chiaramente. |
| Base giuridica | Definire la base corretta per ogni finalità con il titolare o un consulente, senza usare un consenso generico come scorciatoia. |
| Destinatari | Skipper della barca, organizzazione, charter e, se applicabile, autorità competente; indicare Firebase/Google, GitHub Pages e WhatsApp, usato per l'invio diretto di dettagli scelti dallo skipper, soltanto per i ruoli effettivamente svolti. |
| Conservazione | Definire data o criterio separato per dati Firestore, profilo/tag incasso, richieste, account Firebase tecnici, indice telefonico, PDF scaricati e messaggi WhatsApp. |
| Cancellazione | Stabilire chi esegue la cancellazione, come la registra e come risponde alla persona che la richiede. La revoca di un invito non cancella automaticamente il vecchio account Firebase tecnico. |
| PDF | Definire chi lo scarica, a chi lo consegna, con quale canale e quando elimina la copia locale. |

## Procedura minima dopo l'evento

1. Lo skipper consegna al charter soltanto il PDF richiesto e condivide il file solo con i destinatari decisi.
2. Entro il termine dichiarato, l'incaricato esporta se necessario i dati consentiti e cancella Crew List, inviti, `crewAccess`, `crewLoginIndex`, profilo/tag incasso, richieste e file locali non più necessari.
3. Nello stesso criterio di cancellazione elimina o disabilita gli account Firebase tecnici dell'equipaggio, inclusi quelli rimasti dopo una revoca o una riemissione del link.
4. Registra data, responsabile e categorie cancellate senza conservare una nuova copia dei documenti.
5. Chiude o archivia i messaggi WhatsApp secondo il criterio pubblicato.

Prima della raccolta di dati reali, aggiornare `privacy.html` con le decisioni finali, farla rileggere al titolare e verificarla sul dominio HTTPS pubblico.

# Dati da definire per l'informativa privacy finale

Questa è una scheda operativa, non sostituisce una consulenza legale. `privacy.html` resta una bozza e non va presentata come informativa definitiva finché i punti sotto non sono stati decisi, pubblicati e riletti dal titolare.

## Decisioni necessarie

| Tema | Decisione da registrare prima dell'uso reale |
| --- | --- |
| Titolare | **Lomastro Silvio**. Canale di contatto per richieste e diritti: `hello@thatsablast.it` (oggetto consigliato: `Egadi Sailing Experience - Privacy`). |
| Finalità | Gestione inviti, Crew List, sicurezza e organizzazione della barca; distinguere eventuali comunicazioni facoltative. |
| Dati Crew List e contributi | Anagrafica, documento, ruolo/cabina, contatti, consenso di consegna al charter; per le richieste: importo, causale, scadenza, facoltatività, categoria contabile chiusa (`cost_recovery` o `other`), nome di chi raccoglie e tag del metodo. Il piano quote contiene solo otto categorie fisse, relativo stato e un eventuale importo per persona; non contiene contatti o istruzioni di incasso. La cassa skipper privata contiene soltanto importi aggregati per charter, viaggio/auto/transfer dello skipper, altre spese recuperabili e il numero dei partecipanti paganti: nessun nominativo, quota individuale, nota libera o categoria cena. Il profilo privato dello skipper può conservare le istruzioni necessarie al metodo scelto, inclusi link, alias, intestatario e IBAN per bonifico; non copiarli nella richiesta, nel piano quote, nella cassa skipper o nella Crew List. Escludere sempre carte, password, OTP, chiavi API e credenziali provider. Verificare se ogni campo è davvero necessario. |
| Dati tecnici di accesso | Numero WhatsApp normalizzato nell'invito; impronta SHA-256 del numero; alias tecnico Firebase `@crew.egadi.thatsablast.it`; UID Firebase; stato, scadenza, lingua preferita dell'invito (`it` o `en`) e revoca dell'invito. L'alias non è l'email reale della persona e non riceve messaggi. |
| Lingua e traduzioni | L'interfaccia usa testi italiani e inglesi editoriali gestiti dal sito, non una traduzione automatica. Nomi, anagrafiche, messaggi dello skipper, causali e note libere restano nella lingua in cui sono stati inseriti. Il briefing safety inglese è una versione ufficiale separata, non generata automaticamente. |
| Arrivi, partenze e transfer | Per ciascuna tratta: città e aeroporto reali, data/orari, volo facoltativo e bagagli. Per aeroporto ↔ Marsala dichiarare che organizzatore e società transfer incaricata ricevono i dati necessari a gestire il mezzo e contattare la persona. Per i passaggi fra partecipanti, prevedere scelta facoltativa per singola tratta, doppia conferma prima di mostrare WhatsApp e revoca. Non creare elenchi pubblici o URL con contatti. |
| Codice personale | Il codice a sei cifre è verificato da Firebase Authentication. Non entra nella Crew List e non va esportato, annotato, salvato in Firestore o inviato su WhatsApp. |
| Indice di ingresso | `crewLoginIndex/{phoneFingerprint}` consente, a chi inserisce il numero esatto, di verificare se esiste un accesso attivo e di recuperare alias tecnico e identificativi tecnici di barca/invito necessari al login. Non contiene nome, numero, documento o dati Crew List, ma comporta un rischio limitato di verifica dell'appartenenza e applica il vincolo un numero / una barca attiva: va motivato e descritto chiaramente. |
| Base giuridica | Definire la base corretta per ogni finalità con il titolare o un consulente, senza usare un consenso generico come scorciatoia. |
| Destinatari | Skipper della barca, charter, società transfer incaricata per le sole tratte aeroportuali e, se applicabile, autorità competente; indicare Firebase/Google, GitHub Pages e WhatsApp, usato per l'invio diretto di dettagli scelti dallo skipper, soltanto per i ruoli effettivamente svolti. Il piano quote è visibile all'equipaggio soltanto dopo l'accettazione del briefing corrente; profilo incasso e cassa skipper sono invece leggibili soltanto dallo skipper della relativa barca, non dall'organizzazione o dall'equipaggio. |
| Conservazione | Definire data o criterio separato per dati Firestore, piano quote, cassa skipper privata, profilo privato di incasso e relative istruzioni, richieste, account Firebase tecnici, indice telefonico, PDF scaricati e messaggi WhatsApp. La cassa skipper non è eliminabile dall'area: definire una procedura amministrativa autorizzata per la cancellazione a fine conservazione. |
| Cancellazione | Stabilire chi esegue la cancellazione, come la registra e come risponde alla persona che la richiede. La revoca di un invito non cancella automaticamente il vecchio account Firebase tecnico. |
| PDF | Definire chi lo scarica, a chi lo consegna, con quale canale e quando elimina la copia locale. |

## Procedura minima dopo l'evento

1. Lo skipper consegna al charter soltanto il PDF richiesto e condivide il file solo con i destinatari decisi.
2. Entro il termine dichiarato, l'incaricato esporta se necessario i dati consentiti e cancella Crew List, inviti, `crewAccess`, `crewLoginIndex`, piano quote, cassa skipper privata, profilo privato di incasso e relative istruzioni, richieste e file locali non più necessari. Per `costPlan/default` usare la procedura amministrativa autorizzata: le Rules non consentono l'eliminazione dall'area skipper.
3. Nello stesso criterio di cancellazione elimina o disabilita gli account Firebase tecnici dell'equipaggio, inclusi quelli rimasti dopo una revoca o una riemissione del link.
4. Registra data, responsabile e categorie cancellate senza conservare una nuova copia dei documenti.
5. Chiude o archivia i messaggi WhatsApp secondo il criterio pubblicato.

Prima della raccolta di dati reali, aggiornare `privacy.html` con le decisioni finali, farla rileggere al titolare e verificarla sul dominio HTTPS pubblico.

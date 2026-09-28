# Procedura contributi tra amici

Questa procedura serve a raccogliere quote o spese condivise senza trasformare il sito in un sistema di pagamento. Il sito non riceve denaro e non conferma automaticamente gli accrediti. Salva soltanto i metodi e le istruzioni di incasso scelti dallo skipper, le richieste organizzative e lo stato verificato manualmente; non salva carte, password, OTP o credenziali dei provider.

## Flusso skipper

1. Configura una volta il nome di chi riceve i contributi, abilita uno o più metodi — PayPal, Satispay, Revolut o bonifico — e salva i relativi dettagli. L'equipaggio della stessa barca vede nell'area riservata soltanto la copia ridotta dei metodi abilitati.
2. Crea o seleziona l'invito personale della persona.
3. Inserisci importo, causale, scadenza facoltativa, eventuale flag facoltativo e uno o più metodi tra quelli configurati.
4. Controlla i dettagli di incasso già salvati nel profilo: il messaggio WhatsApp e l'area riservata della persona usano gli stessi dati, senza creare una seconda copia modificabile nella richiesta.
5. Premi “Crea richiesta e apri WhatsApp”, controlla il testo e invialo personalmente. WhatsApp è un promemoria: la persona può ritrovare le stesse istruzioni nella propria area riservata.
6. La persona effettua il contributo fuori dal sito con il metodo scelto e avvisa lo skipper.
7. Controlla l'accredito reale nell'app o nel conto del metodo scelto.
8. Solo dopo quel controllo premi “Conferma accredito”. Per correggere una richiesta, annullala e creane una nuova.

## Cosa comunica il messaggio WhatsApp

- Indicare il metodo realmente disponibile: PayPal, Satispay, Revolut o bonifico.
- Indicare l'identificativo, il link o le coordinate che lo skipper decide di condividere direttamente con quella persona.
- Indicare una causale riconoscibile, per esempio “Egadi 2026 · cabina poppa”.
- Per una voce facoltativa chiarire che non è dovuta e che non cambia l'iscrizione alla Crew List.

## Stato della richiesta

- `prepared`: richiesta preparata; l'apertura di WhatsApp non prova che il messaggio sia stato inviato o letto.
- `verified`: lo skipper ha verificato manualmente l'accredito reale fuori dal sito.
- `cancelled`: richiesta annullata; non annulla né dimostra un eventuale contributo esterno.

Non usare mai il click su un link, uno screenshot o una promessa di pagamento come prova dell'accredito. Se una quota cambia, annullare la richiesta e crearne una nuova invece di reinterpretare un pagamento già verificato.

## Registro dei versamenti al charter

Il registro `charterPayments` è separato dalle richieste all'equipaggio. Lo skipper vi annota acconto, saldo o altro versamento verso il charter, con importo, stato, date, metodo, riferimento e una nota breve. Soltanto gli stati `paid` e `confirmed` riducono il residuo; `planned` è un promemoria. Una riga errata va portata a `cancelled`: resta visibile ma non altera i totali. Il registro è leggibile solo dallo skipper della barca, non contiene coordinate o allegati del charter e non può essere cancellato dall'interfaccia; non inserirvi dati personali dell'equipaggio.

## Dati da non inserire

Non inserire nel sito password, codici OTP, credenziali dei provider, dati di carte o screenshot di movimenti. IBAN, intestatario, link PayPal/Satispay e link o Revtag Revolut possono essere salvati soltanto nel profilo di incasso dedicato e vengono mostrati nell'area riservata ai partecipanti della stessa barca. Non copiarli nelle richieste, nel piano quote, nel preventivo o nel registro dei versamenti al charter.

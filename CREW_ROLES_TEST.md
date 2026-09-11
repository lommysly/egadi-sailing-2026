# Ruoli equipaggio — verifica operativa

I ruoli sono privati nella singola barca. Non vengono scritti né mostrati nella pagina pubblica `flotta.html`.

## Flusso

1. La persona invitata sceglie `Equipaggio`, `Co-skipper`, `Hostess`, `Collaboratore` oppure un ruolo libero.
2. Il salvataggio della persona imposta il ruolo come `da confermare`.
3. Lo skipper può confermare il ruolo con un pulsante oppure modificarlo: il suo salvataggio lo conferma.
4. Se la persona cambia poi il proprio ruolo, torna automaticamente `da confermare`.
5. Il PDF della Crew List usa il ruolo della scheda privata; la Flotta non legge mai queste schede.

## Controlli eseguiti

- Modulo ruoli: 4 controlli automatici superati.
- Firestore Emulator su candidato pulito: 7 controlli superati.
  - dichiarazione del ruolo consentita;
  - auto-conferma della persona negata;
  - modifica di un'altra persona negata;
  - conferma/modifica dello skipper Google consentita;
  - cambio ruolo della persona con conferma ancora attiva negato;
  - cambio ruolo della persona con ritorno `da confermare` consentito;
  - tentativo di aggiungere un ruolo alla card pubblica della Flotta negato.

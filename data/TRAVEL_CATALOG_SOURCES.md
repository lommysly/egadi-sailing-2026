# Catalogo locale per arrivi e partenze

Il file `italy-travel-catalog.v2026-02.json` permette di suggerire città, aeroporti italiani e principali compagnie senza inviare ciò che una persona digita a un servizio esterno.

## Contenuto

- Comuni italiani: nome, provincia e regione.
- Aeroporti commerciali italiani: nome, città, sigla IATA, sigla ICAO e alcuni alias di ricerca.
- Compagnie aeree più usate sulle tratte italiane e verso la Sicilia.

Il catalogo non contiene persone, numeri di telefono, voli prenotati o altri dati del viaggio.

## Fonti e licenze

- [ISTAT – elenco dei Comuni italiani](https://www.istat.it/it/archivio/6789), usato per l’elenco dei comuni e dei codici territoriali.
- [OurAirports data](https://ourairports.com/data/), dati aeroportuali pubblicati in pubblico dominio; il catalogo viene ristretto ai soli aeroporti commerciali pertinenti.
- [ENAC – aeroporti italiani](https://www.enac.gov.it/aeroporti/infrastrutture-aeroportuali), usato per un controllo editoriale della selezione di aeroporti commerciali.

Le compagnie sono una lista editoriale di suggerimento: non è un elenco ufficiale di vettori né una fonte di orari o disponibilità.

## Aggiornamento

Il catalogo è stato generato il 21 febbraio 2026 con `tools/build_italy_travel_catalog.py`. Per aggiornarlo, scarica nuovamente le fonti, verifica manualmente aeroporti e vettori pertinenti e rigenera il file locale. Non sostituire il suggerimento con una chiamata remota che invii le ricerche degli utenti.

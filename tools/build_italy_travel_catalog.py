#!/usr/bin/env python3
"""Genera il catalogo locale per i suggerimenti di viaggio Egadi.

Fonti:
- ISTAT, elenco dei comuni italiani (snapshot 21 febbraio 2026);
- ENAC, elenco degli aeroporti certificati;
- OurAirports, codici IATA/ICAO in pubblico dominio.

Il file risultante e' un asset statico: non viene mai richiesto a servizi terzi
dal browser e non contiene dati personali.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from openpyxl import load_workbook


COMMERCIAL_IATA_CODES = (
    "AHO", "AOI", "AOT", "BRI", "BGY", "BLQ", "BZO", "VBS", "BDS",
    "CAG", "CTA", "CIY", "CRV", "CUF", "FLR", "FOG", "FRL", "GOA", "GRS",
    "SUF", "LMP", "EBA", "LIN", "MXP", "NAP", "OLB", "PMO", "PNL", "PMF",
    "PEG", "PSR", "PSA", "REG", "RMI", "CIA", "FCO", "QSR", "TAR", "TRN",
    "TPS", "TSF", "TRS", "VCE", "VRN",
)

AIRPORT_ALIASES = {
    "AHO": ["fertilia"],
    "AOI": ["falconara"],
    "BRI": ["palese"],
    "BGY": ["orio al serio", "bergamo"],
    "BLQ": ["marconi", "borgo panigale"],
    "BZO": ["bolzano"],
    "VBS": ["montichiari"],
    "BDS": ["papola casale"],
    "CAG": ["elmas"],
    "CTA": ["fontanarossa", "bellini"],
    "CIY": ["comiso"],
    "CUF": ["levaldigi"],
    "FLR": ["peretola", "vespucci"],
    "FOG": ["gino lisa"],
    "GOA": ["sestri", "colombo"],
    "SUF": ["lamezia"],
    "LIN": ["linate"],
    "MXP": ["malpensa"],
    "NAP": ["capodichino"],
    "OLB": ["costa smeralda"],
    "PMO": ["punta raisi", "falcone borsellino", "palermo"],
    "PNL": ["pantelleria"],
    "PSA": ["galileo galilei"],
    "REG": ["tito minniti", "reggio"],
    "RMI": ["fellini", "san marino"],
    "CIA": ["ciampino"],
    "FCO": ["fiumicino", "leonardo da vinci"],
    "QSR": ["salerno", "costa d amalfi", "pontecagnano"],
    "TAR": ["grottaglie"],
    "TRN": ["caselle", "sandro pertini"],
    "TPS": ["trapani", "birgi", "vincenzo florio"],
    "TSF": ["treviso", "canova"],
    "TRS": ["ronchi dei legionari"],
    "VCE": ["marco polo", "venezia"],
    "VRN": ["villafranca", "catullo"],
}

AIRPORT_DISPLAY = {
    "AHO": ("Alghero Fertilia", "Alghero"),
    "AOI": ("Ancona Falconara", "Ancona"),
    "AOT": ("Aosta Corrado Gex", "Aosta"),
    "BRI": ("Bari Karol Wojtyła", "Bari"),
    "BGY": ("Bergamo Orio al Serio", "Bergamo"),
    "BLQ": ("Bologna Guglielmo Marconi", "Bologna"),
    "BZO": ("Bolzano", "Bolzano"),
    "VBS": ("Brescia Montichiari", "Brescia"),
    "BDS": ("Brindisi Salento", "Brindisi"),
    "CAG": ("Cagliari Elmas", "Cagliari"),
    "CTA": ("Catania Fontanarossa", "Catania"),
    "CIY": ("Comiso Pio La Torre", "Comiso"),
    "CRV": ("Crotone Sant'Anna", "Crotone"),
    "CUF": ("Cuneo Levaldigi", "Cuneo"),
    "FLR": ("Firenze Amerigo Vespucci", "Firenze"),
    "FOG": ("Foggia Gino Lisa", "Foggia"),
    "FRL": ("Forlì Luigi Ridolfi", "Forlì"),
    "GOA": ("Genova Cristoforo Colombo", "Genova"),
    "GRS": ("Grosseto", "Grosseto"),
    "SUF": ("Lamezia Terme", "Lamezia Terme"),
    "LMP": ("Lampedusa", "Lampedusa"),
    "EBA": ("Elba Marina di Campo", "Isola d'Elba"),
    "LIN": ("Milano Linate", "Milano"),
    "MXP": ("Milano Malpensa", "Milano"),
    "NAP": ("Napoli Capodichino", "Napoli"),
    "OLB": ("Olbia Costa Smeralda", "Olbia"),
    "PMO": ("Palermo Falcone Borsellino", "Palermo"),
    "PNL": ("Pantelleria", "Pantelleria"),
    "PMF": ("Parma Giuseppe Verdi", "Parma"),
    "PEG": ("Perugia San Francesco d'Assisi", "Perugia"),
    "PSR": ("Pescara d'Abruzzo", "Pescara"),
    "PSA": ("Pisa Galileo Galilei", "Pisa"),
    "REG": ("Reggio Calabria Tito Minniti", "Reggio Calabria"),
    "RMI": ("Rimini Federico Fellini", "Rimini"),
    "CIA": ("Roma Ciampino", "Roma"),
    "FCO": ("Roma Fiumicino", "Roma"),
    "QSR": ("Salerno Costa d'Amalfi", "Salerno"),
    "TAR": ("Taranto Grottaglie", "Taranto"),
    "TRN": ("Torino Caselle", "Torino"),
    "TPS": ("Trapani Birgi", "Trapani"),
    "TSF": ("Treviso Antonio Canova", "Treviso"),
    "TRS": ("Trieste Ronchi dei Legionari", "Trieste"),
    "VCE": ("Venezia Marco Polo", "Venezia"),
    "VRN": ("Verona Villafranca", "Verona"),
}

ISO_REGION_NAMES = {
    "21": "Piemonte",
    "23": "Valle d'Aosta",
    "25": "Lombardia",
    "32": "Trentino-Alto Adige",
    "34": "Veneto",
    "36": "Friuli-Venezia Giulia",
    "42": "Liguria",
    "45": "Emilia-Romagna",
    "52": "Toscana",
    "55": "Umbria",
    "57": "Marche",
    "62": "Lazio",
    "65": "Abruzzo",
    "67": "Molise",
    "72": "Campania",
    "75": "Puglia",
    "77": "Basilicata",
    "78": "Calabria",
    "82": "Sicilia",
    "88": "Sardegna",
}

AIRLINE_OPTIONS = (
    ("ITA Airways", ["ita", "az", "alitalia"]),
    ("Ryanair", ["ryanair", "fr"]),
    ("easyJet", ["easyjet", "u2"]),
    ("Wizz Air", ["wizz", "wizzair", "w6"]),
    ("Vueling", ["vueling", "vy"]),
    ("Volotea", ["volotea", "v7"]),
    ("Aeroitalia", ["aeroitalia", "xz"]),
    ("Neos", ["neos", "no"]),
    ("SkyAlps", ["skyalps", "bq"]),
    ("Air Dolomiti", ["air dolomiti", "en"]),
    ("Lufthansa", ["lufthansa", "lh"]),
    ("SWISS", ["swiss", "lx"]),
    ("Austrian Airlines", ["austrian", "os"]),
    ("Brussels Airlines", ["brussels", "sn"]),
    ("Air France", ["air france", "af"]),
    ("KLM", ["klm", "kl"]),
    ("British Airways", ["british", "ba"]),
    ("Iberia", ["iberia", "ib"]),
    ("TAP Air Portugal", ["tap", "tp"]),
    ("Turkish Airlines", ["turkish", "tk"]),
    ("Aegean Airlines", ["aegean", "a3"]),
    ("Norwegian", ["norwegian", "dy"]),
    ("Transavia", ["transavia", "hv"]),
    ("KM Malta Airlines", ["km malta", "km"]),
    ("Emirates", ["emirates", "ek"]),
    ("Qatar Airways", ["qatar", "qr"]),
    ("Etihad Airways", ["etihad", "ey"]),
)


def clean(value: object) -> str:
    return str(value or "").strip()


def read_cities(path: Path) -> list[list[str]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook[workbook.sheetnames[0]]
    rows: list[list[str]] = []
    for row in worksheet.iter_rows(min_row=2, values_only=True):
        name = clean(row[6] or row[5])
        province = clean(row[14])
        region = clean(row[10])
        if name:
            rows.append([name, province, region])
    return sorted(rows, key=lambda item: item[0].casefold())


def read_airports(path: Path) -> list[list[object]]:
    found: dict[str, dict[str, str]] = {}
    with path.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            if row.get("iso_country") != "IT":
                continue
            iata = clean(row.get("iata_code")).upper()
            if iata in COMMERCIAL_IATA_CODES:
                found[iata] = {
                    "iata": iata,
                    "name": clean(row.get("name")),
                    "city": clean(row.get("municipality")),
                    "region": clean(row.get("iso_region")).replace("IT-", ""),
                    "icao": clean(row.get("ident")).upper(),
                }
    missing = [iata for iata in COMMERCIAL_IATA_CODES if iata not in found]
    if missing:
        raise ValueError(f"Codici IATA non trovati nel catalogo aeroporti: {', '.join(missing)}")
    return [
        [
            airport["iata"],
            AIRPORT_DISPLAY[airport["iata"]][0],
            AIRPORT_DISPLAY[airport["iata"]][1],
            ISO_REGION_NAMES.get(airport["region"], "Italia"),
            airport["icao"],
            AIRPORT_ALIASES.get(airport["iata"], []),
        ]
        for airport in sorted(found.values(), key=lambda item: item["city"].casefold())
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera il catalogo locale città/aeroporti/compagnie.")
    parser.add_argument("--municipalities", required=True, type=Path)
    parser.add_argument("--airports", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    catalog = {
        "schemaVersion": 1,
        "version": "2026-02-21",
        "sources": {
            "cities": "ISTAT, Elenco dei comuni italiani, aggiornato al 21 febbraio 2026",
            "airports": "ENAC aeroporti certificati (26 giugno 2026) + OurAirports per codici IATA/ICAO",
            "airlines": "Elenco editoriale Egadi delle compagnie più frequenti in Italia",
        },
        "cities": read_cities(args.municipalities),
        "airports": read_airports(args.airports),
        "airlines": [[name, aliases] for name, aliases in AIRLINE_OPTIONS],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Creato {args.output} con {len(catalog['cities'])} comuni, {len(catalog['airports'])} aeroporti e {len(catalog['airlines'])} compagnie.")


if __name__ == "__main__":
    main()

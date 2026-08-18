#!/usr/bin/env python3
"""
creative-strategy-map.csv  ->  SQL voor public.creatives

    python3 platform/db/import/naar-sql.py > /tmp/import.sql

De CSV is een letterlijke uitdraai van het tabblad 'Test Tracker' uit
'1. Creative Strategy Map.xlsx' (Drive-id 11vHqpihyhh3DYyPsa9dpdT7eBcf8dajU),
de map waar het team zijn advertenties in bijhoudt. Eén regel per advertentie,
kolomnamen ongewijzigd overgenomen.

Wat dit script wel en niet doet
───────────────────────────────

Het vertaalt en het rekent niet. Elk getal gaat over zoals het er staat, ook
als het onmogelijk is: er staan tien rijen in met een hook rate boven de 150%,
en de sheet weet dat zelf ook ("Sommige oude rijen bevatten invoerfouten (bijv.
hook rate 1233%)"). Die corrigeren is werk voor iemand die weet wat er toen
gebeurd is, niet voor een importscript dat een plausibel getal verzint.

Eenheden hoeven niet om. De sheet slaat hook rate, hold rate, CTR en CVR op als
verhouding (0,25 = 25%), en dat is precies wat 0008 in de database zet:
round(video_3s / impressions, 4). Was dat niet zo geweest, dan zou een import
25 keer 100 te hoog binnenkomen en er volkomen normaal uitzien.

De statusvertaling is de enige plek waar informatie verdwijnt, en daarom gaat
het oorspronkelijke woord mee in bron_status:

    To Test  -> Concept       Iterate -> Itereren
    Live     -> Live          Killed  -> Verliezer
    Winner   -> Winner        (leeg)  -> Concept, bron_status blijft leeg

'To Test' is dubbelzinnig — het betekende in de sheet zowel "plan staat, nog
niets gemaakt" als "gemaakt, wacht op lancering". 0032 liep tegen precies dat
probleem aan en liet die rijen met rust. Hier wordt het Concept, de vroegste
van de twee, want een rij te vroeg zetten kost iemand een klik en een rij te
laat zetten laat werk overslaan dat nooit gedaan is.

De import is herhaalbaar: hij gooit eerst alles weg wat eerder uit hetzelfde
bestand kwam. Dat is meteen de terugweg — één delete op bron_bestand en de
tabel staat weer zoals hij stond.
"""

import csv
import os
import sys

BRON = '1. Creative Strategy Map.xlsx'
MERK = 'wellshave'
HIER = os.path.dirname(os.path.abspath(__file__))

STATUS = {
    'To Test': 'Concept',
    'Live':    'Live',
    'Winner':  'Winner',
    'Killed':  'Verliezer',
    'Iterate': 'Itereren',
    '':        'Concept',
}

# csv-kolom -> kolom in public.creatives. De volgorde is die van de sheet, zodat
# je hem er regel voor regel naast kunt leggen.
TEKST = [
    ('Ad Name',                     'ad_name'),
    ('Product',                     'product'),
    ('Awareness Level',             'awareness_level'),
    ('Angle Type',                  'angle_type'),
    ('Marketing Angle (origineel)', 'marketing_angle'),
    ('Desires (origineel)',         'desires'),
    ('Format',                      'format'),
    ('Media Type',                  'media_type'),
    ('Hook (short)',                'hook_short'),
    ('Channel',                     'channel'),
    ('Audience',                    'audience'),
    ('Persona',                     'persona'),
    ('Next Step',                   'next_step'),
    ('Notes',                       'notes'),
    ('Creatives Link',              'creatives_link'),
]
GETAL = [
    ('Budget (€)',       'budget'),
    ('Impressions',      'impressions'),
    ('Hook Rate (%)',    'hook_rate'),
    ('Hold Rate (%)',    'hold_rate'),
    ('CTR (%)',          'ctr'),
    ('CPM (€)',          'cpm'),
    ('CPC (€)',          'cpc'),
    ('Conversions',      'conversions'),
    ('CVR (%)',          'cvr'),
    ('CPA (€)',          'cpa'),
    ('AOV (€)',          'aov'),
    ('ROAS',             'roas'),
    ('Break-even ROAS',  'breakeven_roas'),
    ('Target ROAS',      'target_roas'),
    ('Score (1-10)',     'score'),
]
GEHEEL = {'impressions', 'conversions'}

# Rijen per insert-statement. Zie de toelichting bij het samenstellen.
BLOK = 80


def q(v):
    """Tekst als SQL-literal. Niets ontsnapt hier behalve de apostrof zelf."""
    if v is None or v == '':
        return 'null'
    return "'" + str(v).replace("'", "''") + "'"


def getal(v, geheel=False):
    if v is None:
        return 'null'
    v = str(v).strip().replace('%', '').replace('€', '').strip()
    if v in ('', '-', 'n/a', 'N/A'):
        return 'null'
    # Duizendtallen met een punt komen in deze kolommen niet voor; een komma is
    # altijd een decimaalteken.
    v = v.replace(',', '.')
    try:
        f = float(v)
    except ValueError:
        return 'null'
    return str(int(round(f))) if geheel else repr(f)


def datum(v):
    v = (v or '').strip()
    return q(v[:10]) if len(v) >= 10 and v[4] == '-' else 'null'


def main():
    pad = os.path.join(HIER, 'creative-strategy-map.csv')
    with open(pad, encoding='utf-8') as f:
        rijen = list(csv.DictReader(f))

    onbekend = sorted({r['Status'].strip() for r in rijen} - set(STATUS))
    if onbekend:
        sys.exit(f'onbekende status in de bron: {onbekend!r} — vertaling ontbreekt')

    kolommen = (['brand', 'bron_bestand', 'bron_rij', 'bron_status', 'status', 'date_live']
                + [k for _, k in TEKST] + [k for _, k in GETAL])

    # 0030 zet een unieke index op (merk, ad_name): twee advertenties met
    # dezelfde naam maken elke verwijzing uit een rapport dubbelzinnig. De sheet
    # heeft één zo'n geval — drie rijen die allemaal '144-1' heten. De import
    # kan die niet alle drie zo laten staan en mag ze ook niet stil laten
    # vallen, dus krijgt de tweede en verdere het bronregelnummer erachter. Dat
    # is zichtbaar in het scherm, terug te vinden in de sheet, en het staat
    # hieronder in de waarschuwing zodat iemand het bij de bron kan rechtzetten.
    gezien, hernoemd = {}, []
    for r in rijen:
        naam = r['Ad Name'].strip()
        gezien[naam] = gezien.get(naam, 0) + 1
        if gezien[naam] > 1:
            r['Ad Name'] = f"{naam} (bron {r['bron_rij']})"
            hernoemd.append(r['Ad Name'])
    for n in hernoemd:
        print(f'let op: dubbele advertentienaam in de bron, hernoemd naar {n!r}',
              file=sys.stderr)

    if '--json' in sys.argv:
        print(json_rijen(rijen))
        print(f'-- {len(rijen)} rijen', file=sys.stderr)
        return

    uit = []
    uit.append('-- Gegenereerd door platform/db/import/naar-sql.py.')
    uit.append('-- Niet met de hand bijwerken: pas de CSV aan en draai het script opnieuw.')
    uit.append('begin;')
    uit.append(f'delete from public.creatives where bron_bestand = {q(BRON)};')

    # Eén insert per blok van BLOK rijen in plaats van één per rij. Dat is geen
    # snelheidstruc: de kolomlijst is 370 tekens en 624 keer herhaald werd hij
    # groter dan alle advertentieteksten bij elkaar — 678 kB, waarvan 301 kB
    # data. Zo past het geheel in een handvol statements die je nog kunt lezen.
    tupels = []
    for r in rijen:
        bron_status = r['Status'].strip()
        waarden = [
            q(MERK), q(BRON), r['bron_rij'], q(bron_status) if bron_status else 'null',
            q(STATUS[bron_status]), datum(r['Date Live']),
        ]
        waarden += [q(r.get(csvk, '').strip()) for csvk, _ in TEKST]
        waarden += [getal(r.get(csvk), dbk in GEHEEL) for csvk, dbk in GETAL]
        tupels.append('(' + ', '.join(waarden) + ')')

    for i in range(0, len(tupels), BLOK):
        uit.append('insert into public.creatives (' + ', '.join(kolommen) + ')\nvalues\n'
                   + ',\n'.join(tupels[i:i + BLOK]) + ';')

    uit.append('commit;')
    print('\n'.join(uit))
    print(f'-- {len(rijen)} rijen', file=sys.stderr)


def json_rijen(rijen):
    """Dezelfde vertaling, maar als JSON-rijen voor een insert via PostgREST.

    Niet omdat JSON beter is, maar omdat 435 kB SQL niet door elk kanaal past.
    De vertaling zit met opzet in dezelfde functies als de SQL-tak: twee keer
    dezelfde regels uitschrijven is twee keer dezelfde regels onderhouden, en
    de tweede versie is degene die stilletjes gaat afwijken.
    """
    import json

    def leeg(v):
        return None if v in ('null', '') else v

    def num(s):
        return None if s == 'null' else float(s)

    out = []
    for r in rijen:
        bron_status = r['Status'].strip()
        rij = {
            'brand': MERK, 'bron_bestand': BRON, 'bron_rij': int(r['bron_rij']),
            'bron_status': bron_status or None,
            'status': STATUS[bron_status],
            'date_live': leeg(datum(r['Date Live']).strip("'")),
        }
        for csvk, dbk in TEKST:
            rij[dbk] = (r.get(csvk, '').strip() or None)
        for csvk, dbk in GETAL:
            g = getal(r.get(csvk), dbk in GEHEEL)
            rij[dbk] = None if g == 'null' else (int(g) if dbk in GEHEEL else float(g))
        out.append(rij)
    return json.dumps(out, ensure_ascii=False)


if __name__ == '__main__':
    main()

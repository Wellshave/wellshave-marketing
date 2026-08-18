-- ═══════════════════════════════════════════════════════════════════════════
-- 0045 — De voorvoegsels zijn eigen reeksen, geen varianten
--
-- Beslisvraag:
--
--     "WSLP - 180 - 1 verwijst naar map-rij 180-1. Tellen we dat bij elkaar
--      op?"
--
-- Nee. En dat is een keuze, geen gebrek.
--
-- Wat de eerste echte meting liet zien
--
--   Na de deploy van versie 12 kwam er voor het eerst data op advertentie-
--   niveau binnen: 96 advertenties voor Wellshave, € 5.230,80. Daarvan
--   koppelde 40,7% aan de map. De rest viel er niet uit door een fout maar
--   doordat er naamgevingen bestaan die de sleutelfunctie niet kende:
--
--     wellshave   C…            26 ads   € 2.472,31
--                 WS169IT        5 ads   €   392,13
--                 WSDG - 179     3 ads   €   121,07
--                 WSLP - 180    24 ads   €   113,04
--     wellshine   WLS - 008     40 ads   €   797,72
--                 WSL - 001     11 ads   € 1.099,70
--
-- Waarom apart en niet opgeteld
--
--   WSLP - 180 - 1 is waarschijnlijk creative 180-1 met een andere landings-
--   pagina. WS169IT - 2 is waarschijnlijk 169-2 in Italië. Waarschijnlijk.
--   Zou je ze optellen bij de bestaande rij, dan gaat een Italiaanse ROAS
--   meewegen in een Nederlandse conclusie en verdwijnt het onderscheid tussen
--   twee landingspagina's in één gemiddelde — en juist dat onderscheid is
--   vermoedelijk de reden dat iemand er een apart voorvoegsel voor bedacht.
--
--   Samenvoegen kan later alsnog; uit elkaar halen wat eenmaal is opgeteld
--   niet. Daarom krijgen ze een eigen sleutel, precies zoals BFCM die al had:
--   'LP:180:1' raakt '180:1' nooit.
--
--   Gevolg: deze advertenties koppelen nu aan niets, want de map kent geen
--   rijen met die reeks. Dat is de bedoeling. Ze zijn zichtbaar en telbaar in
--   creative_meta_koppeling in plaats van stil opgeteld bij een rij waar ze
--   misschien niet horen.
--
-- Wat er bewust géén sleutel krijgt
--
--   De C-reeks. Ik heb in het account gekeken wat het is: alle 26 zitten in
--   campagne "001 - CBO - GroomGuard - 23-07-26", aangemaakt op 23 juli 2026,
--   en ze heten C1 - 4 Reasons Why, C2 - Before/After en C3 - Social Proof.
--   Dat is een nieuwe werkwijze met de angle ín de naam en zonder map-nummer.
--   Er valt niets aan te koppelen omdat er niets is om aan te koppelen — die
--   rijen bestaan niet in de map. Een sleutel verzinnen zou dat verbergen.
--
--   Dat is meteen de grootste blinde vlek: € 2.472 aan uitgaven, de nieuwste
--   creatives, en onzichtbaar voor elke analyse over persona of angle.
--
-- Wellshine
--
--   WLS en WSL zijn dezelfde reeks, twee keer gespeld. Ze krijgen allebei hun
--   eigen sleutel en worden niet gelijkgetrokken: als er twee spellingen in
--   omloop zijn hoort dat zichtbaar te blijven, niet weggepoetst.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function marketing_hq.meta_naam_sleutel(naam text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
           when m is null then null
           else concat_ws(':',
                  -- De reeks kan op vier plekken in de naam staan. Welke het
                  -- is maakt voor de sleutel niet uit; dát er een is wel.
                  nullif(upper(coalesce(m[1], m[2], m[3], m[5], '')), ''),
                  m[4]::int::text,
                  m[6]::int::text)
         end
  from (
    select regexp_match(
             translate(coalesce(naam, ''), '–—', '--'),
             -- 1 WLS/WSL   Wellshine's eigen nummering, in twee spellingen
             -- 2 LP/DG     voorvoegsel tussen WS en het nummer
             -- 3 BFCM/C    losse reeks vóór het nummer
             -- 4 nummer
             -- 5 landcode  twee letters direct achter het nummer (WS169IT)
             -- 6 variant
             '^\s*@?\s*(?:(WLS|WSL)|WS)?\s*(LP|DG)?\s*-?\s*(?:(BFCM|C)\s*-\s*)?([0-9]{1,3})\s*([A-Z]{2})?\s*-\s*([0-9]{1,2})(?![0-9])',
             'i'
           ) as m
  ) s;
$$;

comment on function marketing_hq.meta_naam_sleutel(text) is
  'Brengt een Meta-advertentienaam en een ad_name uit de map terug tot dezelfde sleutel. Een voorvoegsel (BFCM, C, LP, DG, WLS, WSL) of een landcode achter het nummer wordt een eigen reeks, zodat die nooit optelt bij de gewone map-rij. Geeft null bij bundels en alles wat geen losse creative is.';

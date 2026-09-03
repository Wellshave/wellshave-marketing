-- ═══════════════════════════════════════════════════════════════════════════
-- 0053 — `systeem` mag een taak inschieten
--
-- Beslisvraag:
--
--     "Welke woorden mag de wachtrij nog kennen nu er geen agents meer zijn?"
--
-- Hoe dit boven water kwam
--
--   Nadat 0051 en 0052 stonden en v16 draaide, is de inhaalslag met de hand in
--   de wachtrij gezet. Die deed precies één blok en viel toen om:
--
--     insert taken: 400 {"code":"23514", ... "new row for relation \"taken\"
--     violates check constraint \"agent_jobs_source_check\""}
--
--   De taak `meta_inhaalslag` haalt zichzelf verder op: zolang er dagen
--   ontbreken zet hij het volgende blok zelf in de rij, met source 'systeem'.
--   Dat woord stond niet in de check. De constraint liet
--   'cron', 'console', 'agent' en 'manual' toe -- de woordenlijst van vóór de
--   agents eruit gingen.
--
--   Het gevolg was niet zichtbaar als een kapotte koppeling maar als een
--   inhaalslag die na één blok stil bleef staan. 178 dagen zouden in blokken
--   van 120 nooit verder komen dan de eerste.
--
-- Waarom 0051 dit niet ving
--
--   Dezelfde reden als de constraintnaam in 0052: een `alter table ... rename`
--   verplaatst de tabel maar laat constraints, hun namen én hun inhoud staan.
--   0051 keek naar kolommen en views, niet naar de woordenlijsten die erin
--   vastliggen. Dit is de derde en naar verwachting laatste plek waar dat
--   opspeelt; kolommen, planningen en nu de vocabulaire zijn alle drie
--   nagelopen.
--
-- Wat er in mag, en wat niet
--
--   cron     — de planning schiet hem in (worker: verwerkPlanning)
--   console  — een mens vraagt hem aan via /systeem/taken
--   systeem  — een taak zet zijn eigen vervolg klaar (meta_inhaalslag)
--   manual   — vier bestaande rijen dragen dit; die blijven leesbaar
--
--   'agent' vervalt. Er is geen enkele rij die het draagt en er is niets meer
--   dat het kan schrijven.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table marketing_hq.taken
  drop constraint if exists agent_jobs_source_check;

alter table marketing_hq.taken
  add constraint taken_source_check
  check (source = any (array['cron'::text, 'console'::text, 'systeem'::text, 'manual'::text]));

-- Ook deze droeg nog de oude tabelnaam. Inhoudelijk ongewijzigd.
alter table marketing_hq.taken
  drop constraint if exists agent_jobs_status_check;

alter table marketing_hq.taken
  add constraint taken_status_check
  check (status = any (array['queued'::text, 'running'::text, 'done'::text,
                             'failed'::text, 'cancelled'::text]));

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- 0052 — De planning zonder agents
--
-- Beslisvraag:
--
--     "Wat staat er nog ingepland dat niemand meer kan uitvoeren?"
--
-- Wat 0051 heeft laten staan
--
--   0051 heeft het schema opgeruimd: de agenttabellen weg, de wachtrij
--   hernoemd, de views herbouwd. Wat er níét in zat waren de rijen in
--   `schedules`. Die tabel bleef staan -- terecht, hij is de planning van het
--   systeem -- maar de inhoud verwees nog naar de agents.
--
--   Direct na de deploy van v16 stond er dit in:
--
--     atlas_feedback   feedback_sync         -> bestaat in v16
--     atlas_daily      daily_report          -> bestaat niet meer
--     atlas_audit      account_audit         -> bestaat niet meer
--     bolt_publiceren  publish_queue         -> bestaat niet meer
--     bolt_opvolgen    dagbesluit_opvolgen   -> bestaat niet meer
--     nova_daily       pipeline_sync         -> bestaat niet meer
--     radar_daily      trend_scan            -> bestaat niet meer
--
--   v16 kent precies twee soorten werk: feedback_sync en meta_inhaalslag. Een
--   onbekende `kind` is daar met opzet een harde fout en geen stilzwijgend
--   overslaan -- zie voerTaakUit. Dat is goed, maar het betekent wel dat die
--   zes planningen vanaf de eerstvolgende ochtend elke dag een taak in de rij
--   zetten die drie keer probeert en dan als 'failed' blijft liggen. Zes per
--   dag, zonder dat er iets kapot is.
--
-- Weghalen en niet uitzetten
--
--   Ze hadden ook op enabled=false gekund. Dat is niet gedaan, om dezelfde
--   reden die in 0051 staat: een half weggehaalde agentlaag is erger dan geen,
--   want dan staat er een schakelaar die aan niets vastzit. Een uitgezette
--   planning voor `trend_scan` suggereert dat trend_scan nog bestaat en alleen
--   even uit staat. Dat is niet zo; die code is weg.
--
--   Wat wél bewaard blijft is wanneer ze voor het laatst gedraaid hebben --
--   dat staat in systeem_events en in taak_runs, en daar komt deze migratie
--   niet aan.
--
-- Wat er voor terugkomt
--
--   `terugkoppeling` (feedback_sync). Zelfde tijd als hiervoor, alleen onder
--   een naam die geen agent meer is. Dit is de taak die de gemeten cijfers
--   terugschrijft naar de creative waar ze uit voortkwamen.
--
--   `meting_inhalen` (meta_inhaalslag). Die stond er nog helemaal niet, en dat
--   is precies waarom de meting 176 dagen achterloopt. De taak haalt zichzelf
--   verder op -- zolang er dagen ontbreken zet hij het volgende blok zelf in
--   de rij -- maar als een blok faalt is er niets wat hem weer aanzet. Deze
--   dagelijkse planning is dat vangnet, niet de motor.
--
--   Beide op een tijdstip vóór de terugkoppeling, want terugkoppelen van
--   cijfers die nog niet opgehaald zijn is terugkoppelen van niets.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- Eerst de verwijzing losmaken, anders komt de delete hieronder niet langs de
-- foreign key. Dat is geen theorie: de proefdraai viel er op om met
-- "update or delete on table schedules violates foreign key constraint
-- agent_jobs_schedule_id_fkey on table taken -- Key (id)=(atlas_daily) is still
-- referenced". Zeven van de acht planningen hebben historie in `taken`.
--
-- `on delete set null` en niet `cascade`: die taken zijn echt gedraaid en dat
-- blijft staan. Wat ze wáren blijft ook leesbaar zonder de planning, want
-- `kind` en `source` staan op de taakrij zelf -- de schedule_id was alleen de
-- verwijzing naar wie hem inschoot.
--
-- De constraint heet nog agent_jobs_schedule_id_fkey: 0051 hernoemde de tabel
-- agent_jobs naar taken, maar een rename verplaatst de constraintnaam niet.
-- Hier meteen rechtgezet.
alter table marketing_hq.taken
  drop constraint if exists agent_jobs_schedule_id_fkey;

alter table marketing_hq.taken
  add constraint taken_schedule_id_fkey
  foreign key (schedule_id) references marketing_hq.schedules(id) on delete set null;

-- De zes planningen waarvan de code niet meer bestaat.
delete from marketing_hq.schedules
 where kind in ('daily_report', 'account_audit', 'publish_queue',
                'dagbesluit_opvolgen', 'pipeline_sync', 'trend_scan',
                'creative_scorecard');

-- De terugkoppeling onder een eerlijke naam. Insert-en-delete in plaats van
-- een rename van de id, zodat last_fired_at meekomt en de eerstvolgende tick
-- hem niet meteen opnieuw afvuurt omdat het veld leeg staat.
insert into marketing_hq.schedules (id, kind, cron, payload, enabled, last_fired_at)
select 'terugkoppeling', 'feedback_sync', '40 5 * * *', '{}'::jsonb, true, s.last_fired_at
  from marketing_hq.schedules s
 where s.id = 'atlas_feedback'
on conflict (id) do update set
  kind = excluded.kind, cron = excluded.cron, enabled = excluded.enabled,
  last_fired_at = coalesce(marketing_hq.schedules.last_fired_at, excluded.last_fired_at);

delete from marketing_hq.schedules where id = 'atlas_feedback';

-- Het vangnet voor de inhaalslag. Om 04:20, ruim vóór de terugkoppeling van
-- 05:40, zodat wat opgehaald is diezelfde ochtend nog wordt teruggeschreven.
insert into marketing_hq.schedules (id, kind, cron, payload, enabled)
values ('meting_inhalen', 'meta_inhaalslag', '20 4 * * *', '{}'::jsonb, true)
on conflict (id) do update set
  kind = excluded.kind, cron = excluded.cron, enabled = true;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 — De runtime toegang geven tot zijn eigen schema
--
-- Gevonden bij de laatste controle vóór de deploy, op 30 juli. Het schema was
-- net vrijgegeven in PostgREST, en toen bleek dit:
--
--   has_schema_privilege('service_role','marketing_hq','USAGE')  ->  false
--   grants voor service_role op 41 objecten in marketing_hq      ->  0
--
-- De worker draait op de service key. Zonder deze migratie start hij prima,
-- meldt /health netjes "runtime: actief" — dat kijkt alleen of het secret
-- bestaat — en loopt vervolgens elke databaseaanroep stuk op
-- "permission denied for schema marketing_hq". Je zou het pas merken als Atlas
-- de volgende ochtend om 05:00 stil faalde.
--
-- Waarom dit ontbrak: alle migraties vanaf 0004 maakten tabellen aan met RLS
-- en gaven rechten aan `authenticated`, want dat is de rol van de console. De
-- runtime bestond toen nog niet als eigen gebruiker. Bij het bouwen ervan is
-- de aanname meegelift dat service_role overal bij kan — dat geldt in `public`,
-- maar niet in een schema dat daarna is aangemaakt.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema marketing_hq to service_role;

-- Bewust niet `grant all`. Daar zit TRUNCATE in, en de runtime hoort geen
-- enkele tabel leeg te kunnen maken. Het verschil kost niets en scheelt de
-- ergste denkbare uitkomst van een gelekte sleutel.
grant select, insert, update, delete
  on all tables in schema marketing_hq to service_role;

-- Identity-kolommen (agent_jobs, agent_runs, reports, …) hebben dit nodig om
-- een volgend id te kunnen trekken.
grant usage, select on all sequences in schema marketing_hq to service_role;

-- claim_job, reap_stuck_jobs, sync_creative_results, werkstuk_stap.
grant execute on all functions in schema marketing_hq to service_role;

-- En hetzelfde voor wat er later bij komt. Zonder deze regels zou elke
-- volgende migratie die een tabel toevoegt de runtime opnieuw buitensluiten,
-- en dat zou dan weer pas bij de eerstvolgende nachtelijke run blijken.
alter default privileges in schema marketing_hq
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema marketing_hq
  grant usage, select on sequences to service_role;
alter default privileges in schema marketing_hq
  grant execute on functions to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Wat hier NIET in zit, en waarom
--
-- `authenticated` heeft geen SELECT op de zestien views in marketing_hq
-- (creative_kaart, trechter, advertentie_scorekaart, accounts_overzicht, …).
-- De public.hq_*-wrappers zijn wél security_invoker, dus die vallen om zodra
-- de console ze gebruikt. Dat doet hij vandaag nergens: de test tracker leest
-- rechtstreeks uit public.creatives.
--
-- De voor de hand liggende oplossing — `grant select` op die views — is fout.
-- De views in marketing_hq zijn gewone views, dus ze draaien met de rechten
-- van hun eigenaar (postgres) en die omzeilt RLS. Wie er SELECT op krijgt,
-- ziet alles, ook als hij geen goedgekeurd teamlid is. De is_team_member()-
-- policies zouden er niet meer toe doen.
--
-- Het hoort andersom: die views moeten zelf security_invoker worden, en dan
-- hebben ze SELECT op de onderliggende tabellen nodig zodat RLS het filteren
-- doet. Dat is een verandering aan zestien views met een veiligheidsgevolg,
-- en die hoort een eigen migratie met een eigen test te krijgen — niet
-- meeliften met een migratie die alleen de deploy vlot moet trekken.
--
-- Staat open als 0017, en het is blokkerend voor het test-trackerscherm,
-- niet voor de agents.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Terugdraaien
--
--   alter default privileges in schema marketing_hq
--     revoke select, insert, update, delete on tables from service_role;
--   alter default privileges in schema marketing_hq
--     revoke usage, select on sequences from service_role;
--   alter default privileges in schema marketing_hq
--     revoke execute on functions from service_role;
--   revoke all on all functions in schema marketing_hq from service_role;
--   revoke all on all sequences in schema marketing_hq from service_role;
--   revoke all on all tables in schema marketing_hq from service_role;
--   revoke usage on schema marketing_hq from service_role;
-- ═══════════════════════════════════════════════════════════════════════════

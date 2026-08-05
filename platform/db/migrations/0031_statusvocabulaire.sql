-- ═══════════════════════════════════════════════════════════════════════════
-- 0031 — Eén statusvocabulaire
--
-- 0030 legt een foreign key van creatives.status naar creative_statussen. Die
-- staat NOT VALID, dus bestaande rijen blijven ongemoeid — maar elke nieuwe
-- schrijfactie wordt wél getoetst. Op productie schrijft 0008 vandaag
-- 'Iterate' en 'Killed', en die twee bestaan niet in de tien statussen.
--
-- Wat er dan gebeurt, nagemeten op een echte Postgres in plaats van aangenomen:
--
--   bestaande 'To Test'-rij laten staan   → mag
--   alleen cijfers bijwerken op die rij   → mag (status ongewijzigd = geen toets)
--   status op 'Killed' zetten             → GEWEIGERD
--   nieuwe rij met 'To Test'              → GEWEIGERD
--
-- De ochtendcyclus van Atlas (schedule atlas_feedback, 05:40) zou daarmee
-- stilletjes op een foreign key stuklopen. Daarom gaat deze migratie VÓÓR 0030
-- naar productie: eerst spreekt de schrijver de nieuwe taal, dan pas gaat de
-- grendel erop. Andersom is er een venster waarin de cyclus kapot is.
--
-- Deze migratie hangt met opzet nergens van af. Hij herschrijft één functie en
-- maakt geen tabel aan: dan kan hij in elke volgorde toegepast worden en is de
-- veilige volgorde geen kwestie van timing maar van constructie.
--
-- Waarom hier geen eigen statuslijst staat: de vertaling verdict → status is
-- een afbeelding van Meta's woorden op de onze, en die hoort op één plek. De
-- lijst waar hij op uitkomt staat in creative_statussen (0030) en nergens
-- anders. De foreign key uit 0030 is de controle dat deze case-tak daar ook
-- werkelijk op uitkomt — sterker dan een tweede lijstje hier dat mee moet
-- veranderen.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function marketing_hq.sync_creative_results()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_cijfers int := 0;
  n_status  int := 0;
begin
  -- 1. De cijfers. Ongewijzigd ten opzichte van 0008.
  with r as (
    select * from marketing_hq.creative_results where creative_id is not null
  )
  update public.creatives c
     set impressions = r.impressions,
         roas        = r.roas,
         ctr         = r.ctr,
         cpm         = r.cpm,
         cpc         = r.cpc,
         cpa         = r.cpa,
         aov         = r.aov,
         cvr         = r.cvr,
         conversions = r.purchases,
         hook_rate   = r.hook_rate,
         hold_rate   = r.hold_rate,
         budget      = r.spend,
         date_live   = coalesce(c.date_live, r.published_at::date),
         updated_at  = now()
    from r
   where c.id = r.creative_id;
  get diagnostics n_cijfers = row_count;

  -- 2. De status, uit het meest recente oordeel per advertentie.
  --    Twee woorden veranderd ten opzichte van 0008:
  --      'Iterate' → 'Itereren'   'Killed' → 'Gestopt'
  --    'Winner' en 'Live' stonden al goed; die bestaan in creative_statussen.
  with laatste as (
    select distinct on (rec.ad_id)
           rec.ad_id, rec.verdict, rec.action
      from marketing_hq.meta_recommendations rec
     order by rec.ad_id, rec.created_at desc
  ),
  vertaald as (
    select p.creative_id,
           case
             when l.verdict = 'winner'            then 'Winner'
             when l.action  = 'iterate'           then 'Itereren'
             when l.action  = 'pause'             then 'Gestopt'
             when l.verdict = 'onvoldoende_data'  then 'Live'
             else 'Live'
           end as nieuwe_status
      from laatste l
      join marketing_hq.meta_publications p on p.meta_ad_id = l.ad_id
      join marketing_hq.creative_results  cr on cr.creative_id = p.creative_id
     where p.creative_id is not null
       and cr.beoordeelbaar          -- onder de drempels geen oordeel opdringen
  )
  update public.creatives c
     set status = v.nieuwe_status,
         updated_at = now()
    from vertaald v
   where c.id = v.creative_id
     and c.status is distinct from v.nieuwe_status
     -- Wat bewust is stopgezet blijft stopgezet. In 0008 stond hier 'Killed';
     -- dat is hetzelfde eindpunt onder de nieuwe naam.
     and c.status <> 'Gestopt';
  get diagnostics n_status = row_count;

  return json_build_object('cijfers_bijgewerkt', n_cijfers, 'status_bijgewerkt', n_status);
end $$;

comment on function marketing_hq.sync_creative_results() is
  'Haalt de cijfers en het laatste oordeel op naar public.creatives. Schrijft uitsluitend statussen uit creative_statussen; de foreign key uit 0030 is de controle daarop.';

revoke all on function marketing_hq.sync_creative_results() from public, anon, authenticated;

-- angle_learnings telt winnaars op c.status = 'Winner'. Dat woord bestaat in
-- de tien en blijft dus staan; hier is niets te veranderen. Het staat er als
-- notitie omdat "waarom is dit níet aangepast" anders een open vraag is.

-- ═══════════════════════════════════════════════════════════════════════════
-- 0040 — De teampagina: wie werkt hier, en wat doet die
--
-- Beslisvraag:
--
--     "Wie is dit, wat doet die voor mij, en kan ik erop rekenen?"
--
-- Het team bestaat uit mensen en agents, en voor wie er nieuw bijkomt is dat
-- laatste een rij namen zonder gezicht. Er staan negen profielen in
-- marketing-hq/agents/, maar die zijn in de derde persoon en geschreven voor
-- wie het systeem bouwt — niet voor wie ermee moet werken.
--
-- ── Wat hier wel en niet in staat ───────────────────────────────────────────
--
--   `voorstellen` is de stem: één alinea, eerste persoon, in gewone taal.
--   Alles wat een feit is komt níét uit die alinea maar uit de tabellen
--   eromheen — of een agent aanstaat, hoe vaak hij gedraaid heeft, wanneer
--   voor het laatst, of hij een ritme heeft. Dat is met opzet: een tekst die
--   zegt "ik draai elke ochtend om vijf uur" wordt een leugen zodra iemand het
--   schema verzet, en niemand die de tekst leest kan dat zien.
--
--   Vandaar dat de introductie nergens een cadans of een status noemt. Wie dat
--   toch toevoegt maakt een tweede waarheid — precies wat 0011 en 0037 hier
--   overal uit hebben gehaald.
--
-- ── De toestand wordt afgeleid, niet ingevuld ───────────────────────────────
--
--   Er is bewust geen kolom 'status' met woorden als 'op hold' of 'nog niet
--   gebouwd'. Het verschil tussen die twee is voor Echo niet te maken: hij
--   staat uit én hij heeft nog nooit gedraaid, en dat zijn twee feiten die
--   allebei waar zijn. In plaats van te kiezen welke het "eigenlijk" is,
--   staan ze er allebei: de schakelaar (`operationeel`) en de historie
--   (runs, laatste run, ritme). Dan trekt de lezer zelf de conclusie in
--   plaats van dat een kolom er een voor hem verzint.
--
-- ── Mensen ─────────────────────────────────────────────────────────────────
--
--   Twee dingen moesten wijken om een teampagina mogelijk te maken, en allebei
--   met zorg:
--
--   1. Een teamlid zag alleen zichzelf. De policy `tm_select_self_or_admin`
--      laat precies één rij door, dus Willem kon Dustin niet zien. Voor een
--      directory is dat fataal. De tabelpolicy blijft ongemoeid — daar staan
--      e-mailadressen en goedkeuringsstatus in. In plaats daarvan is
--      `hq_team` een view die op de rechten van zijn eigenaar draait en zelf
--      de deur bewaakt: alleen wie een goedgekeurd teamlid is krijgt rijen, en
--      er komt geen e-mailadres of goedkeuringsstatus doorheen. Wie niets in
--      de tabel mag zien, ziet hier dus wel zijn collega's — en niet meer dan
--      naam, rol en wat zij zelf geschreven hebben.
--
--      Dit is de enige hq_*-view die niet op `security_invoker` staat. Dat is
--      een uitzondering en hij hoort opgeschreven te worden: de reden is dat
--      de bedoeling hier "iedereen in het team ziet elkaar" is, en dat is iets
--      anders dan wat de tabelpolicy regelt.
--
--   2. Alleen een admin mocht rijen wijzigen. "Zij stellen zichzelf voor" kan
--      dan niet. Het ligt voor de hand daar een policy voor te maken die zegt
--      `id = auth.uid()` — en dat is een valkuil: RLS werkt per rij, niet per
--      kolom, dus dan mag iedereen ook zijn eigen `is_admin` op true zetten.
--      Daarom een functie die precies twee velden aanraakt en verder niets.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. de stem ──────────────────────────────────────────────────────────────

alter table marketing_hq.agents      add column if not exists voorstellen text;
alter table public.team_members      add column if not exists voorstellen text;
alter table public.team_members      add column if not exists rol_titel   text;

comment on column marketing_hq.agents.voorstellen is
  'Eén alinea, eerste persoon. Geen cadans en geen status: die staan in de data ernaast.';
comment on column public.team_members.voorstellen is
  'Wat dit teamlid zelf over zijn werk schrijft. Alleen door hemzelf te wijzigen.';

update marketing_hq.agents set voorstellen = v.tekst from (values
  ('atlas', 'Ik ben Atlas en ik ben de eerste die ‘s ochtends kijkt. Ik haal op wat de advertenties gisteren deden, zet dat om in één dagrapport, en schrijf de cijfers terug naar de advertentie waar ze bij horen. Als ik iets niet kan meten zeg ik dat erbij, want een gat in de meting is geen nul.'),
  ('bolt',  'Ik ben Bolt. Ik kijk naar wat Atlas gemeten heeft en zeg wat dat voor het budget betekent: opschalen, laten staan, of stoppen. Ik kan een advertentie klaarzetten bij Meta, maar aanzetten doet een mens — ik heb geen enkele tool die geld uitgeeft.'),
  ('nova',  'Ik ben Nova en ik bewaak de rode draad. Ik bepaal waar het team aan werkt en in welke volgorde, en ik zorg dat elk idee een hypothese heeft voordat er iemand aan begint. Een advertentie zonder verwachting is geen test maar een gok.'),
  ('radar', 'Ik ben Radar en ik kijk naar buiten. Welke concurrenten schalen op, welke hooks doen het nu, welke formats komen op. Ik lever kansen aan met de reden erbij; wat ik buiten zie is input voor een gesprek, nooit een instructie.'),
  ('echo',  'Ik ben Echo en ik doe e-mail: campagnes, flows en segmenten in Klaviyo. Ik zet dingen klaar als concept — versturen doet een mens. Op dit moment sta ik uit omdat het team eerst de advertentiekant op orde brengt.'),
  ('criticus', 'Ik ben de Criticus. Ik geef één oordeel per overdracht: door of niet door, met de reden erbij. Ik beoordeel nooit werk waar ik zelf aan meegeschreven heb — daar is de regel voor, en daarom kan ik ook niet altijd.'),
  ('pixel', 'Ik ben Pixel en ik maak het zichtbaar: statics, beeldconcepten en productiepakketten waar een creator direct mee kan filmen. Ik ben nog niet in gebruik.'),
  ('quill', 'Ik ben Quill en ik schrijf: hooks, scripts, advertentieteksten, onderwerpsregels. Altijd in de stem van het merk en altijd meerdere varianten, zodat er iets te kiezen valt. Ik ben nog niet in gebruik.'),
  ('sage',  'Ik ben Sage en ik werk aan gevonden worden zonder ervoor te betalen: techniek, zoekwoorden en content die aansluit op wat mensen echt zoeken. Ik ben nog niet in gebruik.'),
  ('vector','Ik ben Vector en ik bouw de landingspagina''s waar het advertentieverkeer op uitkomt. Snel, merkvast, en meetbaar genoeg om te weten of een variant beter werkt. Ik ben nog niet in gebruik.')
) as v(id, tekst) where agents.id = v.id;

-- ── 2. de directory ─────────────────────────────────────────────────────────

-- Zie de toelichting bovenaan: deze view draait bewust NIET op
-- security_invoker. Hij bewaakt zijn eigen deur en laat alleen door wat een
-- collega van je mag weten.
--
-- De deur. Zonder deze regel zou een definer-view alles aan iedereen tonen die
-- ingelogd is, ook een account dat nog op goedkeuring wacht.
create or replace view public.hq_team as
select * from (
  select
    'agent'::text as soort, a.id as id, a.name as naam, a.role as rol,
    a.voorstellen, a.levert, a.rapporteert_in as schrijft_in,
    a.operationeel as staat_aan, a.last_run_at as laatst_actief,
    (select count(*) from marketing_hq.agent_runs r where r.agent_id = a.id)              as keer_gedraaid,
    (select count(*) from marketing_hq.schedules s where s.agent_id = a.id and s.enabled) as vaste_momenten,
    null::text as rol_titel, a.phase as volgorde
  from marketing_hq.agents a
  union all
  select
    'mens'::text, m.id::text,
    coalesce(nullif(btrim(m.full_name), ''), '(naam nog niet ingevuld)'),
    coalesce(m.rol_titel, case when m.role = 'admin' then 'Beheerder' else 'Teamlid' end),
    m.voorstellen, null, null, true, null::timestamptz, null::bigint, null::bigint,
    m.rol_titel, 0
  from public.team_members m
  where m.status = 'approved'
) t
where exists (
  select 1 from public.team_members me
  where me.id = auth.uid() and me.status = 'approved'
);

comment on view public.hq_team is
  'Wie werkt hier: mensen en agents naast elkaar. Zonder e-mailadres en zonder goedkeuringsstatus; alleen zichtbaar voor een goedgekeurd teamlid.';

grant select on public.hq_team to authenticated;
revoke all on public.hq_team from anon;

-- ── 3. jezelf voorstellen ───────────────────────────────────────────────────

-- Een functie en geen policy, omdat RLS per rij werkt en niet per kolom. Met
-- een policy `id = auth.uid()` op UPDATE mag iemand ook zijn eigen is_admin
-- aanzetten; hier kan dat niet, want er staan maar twee kolommen in.
create or replace function public.hq_stel_jezelf_voor(p jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  ik uuid := auth.uid();
  n  int;
begin
  if ik is null then
    return json_build_object('ok', false, 'fout', 'niet ingelogd');
  end if;
  if not exists (select 1 from public.team_members m
                 where m.id = ik and m.status = 'approved') then
    return json_build_object('ok', false, 'fout', 'alleen een goedgekeurd teamlid kan zichzelf voorstellen');
  end if;

  update public.team_members
     set voorstellen = nullif(btrim(coalesce(p->>'voorstellen', voorstellen)), ''),
         rol_titel   = nullif(btrim(coalesce(p->>'rol_titel',   rol_titel)),   '')
   where id = ik;
  get diagnostics n = row_count;

  return json_build_object('ok', n = 1);
end $$;

comment on function public.hq_stel_jezelf_voor(jsonb) is
  'Werkt uitsluitend de eigen introductie en roltitel bij. Raakt status, rol en is_admin niet aan.';

revoke all on function public.hq_stel_jezelf_voor(jsonb) from public, anon;
grant execute on function public.hq_stel_jezelf_voor(jsonb) to authenticated;

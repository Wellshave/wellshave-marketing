# Stap 2 — de twee Supabase-projecten samenvoegen

> **Uitgevoerd op 29 juli 2026.** Wat hieronder staat is de procedure zoals
> gepland; onderaan staat wat er werkelijk is gebeurd en hoe het is
> gecontroleerd. Het HQ-project is nog niet bevroren — zie stap 5.


Doel: één database. `marketing_hq` uit het HQ-project (`srjpulfodxakbyulwhki`)
gaat naar het ad-generator-project (`bequyhghgkvekvibufhw`), zodat agents de
creatives, producten en persona's van het team kunnen lezen en de console de
agent-status kan tonen.

**Dit is geen verhuizing naar leeg terrein.** Het schema `marketing_hq` bestaat
al in het doelproject: het stond daar oorspronkelijk en is blijven staan toen
het HQ op 18 juli een eigen project kreeg. Die achtergebleven kopie is sindsdien
niet meer bijgewerkt.

| tabel | doel (`bequy…`, stale) | bron (`srjpul…`, actueel) |
|---|---|---|
| agents | 9 | 9 |
| agent_runs | 4 | 31 |
| agent_messages | 5 | 25 |
| pipeline_items | 3 | 5 |
| pipeline_events | 3 | 7 |
| reports | 3 | 21 |
| metrics_daily | 48 | 101 |
| approvals | 2 | 3 |
| dashboard_assets | 4 | — (alleen in doel) |

De bron is leidend. De stale rijen in het doel zijn een deelverzameling uit
dezelfde periode — geen uniek werk dat verloren gaat.

## Volgorde

Voer dit uit **nadat** `0004_agent_runtime.sql` is toegepast, zodat
`agent_runs.job_id` en de rest al bestaan.

### 1. Back-up van het doel

```sql
-- in bequyhghgkvekvibufhw
create schema if not exists marketing_hq_backup_20260728;
do $$
declare t text;
begin
  foreach t in array array['agents','agent_runs','agent_messages','pipeline_items',
                           'pipeline_events','reports','metrics_daily','approvals']
  loop
    execute format(
      'create table marketing_hq_backup_20260728.%I as table marketing_hq.%I', t, t);
  end loop;
end $$;
```

Terugdraaien = de tabellen uit dit back-upschema terugzetten. Laat het schema
minstens een maand staan; opruimen kan met
`drop schema marketing_hq_backup_20260728 cascade;`.

### 2. Bron ophalen

De twee projecten kunnen niet rechtstreeks naar elkaar schrijven. Haal de rijen
per tabel op uit `srjpulfodxakbyulwhki` (Supabase-dashboard → SQL editor →
CSV-download, of `select` via MCP) en zet ze als `insert` klaar. Het gaat om
~200 rijen totaal; dit is handwerk van een half uur, geen pipeline.

Volgorde van invoegen (vanwege foreign keys):
`agents → pipeline_items → agent_runs → agent_messages → pipeline_events → reports → metrics_daily → approvals`

### 3. Invoegen, bron wint

Alle tabellen met een natuurlijke sleutel gaan met `on conflict … do update`,
zodat de actuele rij de stale overschrijft:

```sql
-- voorbeeld: metrics_daily heeft een samengestelde primaire sleutel
insert into marketing_hq.metrics_daily
  (metric_date, source, account_id, metric, value, is_final, captured_at)
values
  (…)
on conflict (metric_date, source, account_id, metric) do update
  set value = excluded.value,
      is_final = excluded.is_final,
      captured_at = excluded.captured_at;
```

Let op de tabellen met `generated always as identity` (`agent_runs`,
`agent_messages`, `pipeline_items`, `pipeline_events`, `reports`, `approvals`):

- Voeg **zonder** `id` in en laat het doel nieuwe id's uitdelen. De id's uit de
  bron hebben geen betekenis buiten hun eigen project.
- Verwijder eerst de stale rijen in die tabellen, anders staan ze straks dubbel:

```sql
delete from marketing_hq.pipeline_events;   -- verwijst naar pipeline_items
delete from marketing_hq.agent_messages;
delete from marketing_hq.agent_runs;
delete from marketing_hq.approvals;
delete from marketing_hq.reports;
delete from marketing_hq.pipeline_items;
```

  (In deze volgorde: kinderen vóór ouders.) Doe dit pas ná stap 1.
- `pipeline_events.item_id` en `agent_runs`-verwijzingen moeten na het invoegen
  naar de **nieuwe** `pipeline_items.id` wijzen. Voeg `pipeline_items` daarom
  eerst in en houd een mapping oud-id → nieuw-id bij; dat zijn 5 rijen.

### 4. Controleren

```sql
select 'agents' t, count(*) from marketing_hq.agents
union all select 'agent_runs',     count(*) from marketing_hq.agent_runs
union all select 'agent_messages', count(*) from marketing_hq.agent_messages
union all select 'pipeline_items', count(*) from marketing_hq.pipeline_items
union all select 'pipeline_events',count(*) from marketing_hq.pipeline_events
union all select 'reports',        count(*) from marketing_hq.reports
union all select 'metrics_daily',  count(*) from marketing_hq.metrics_daily
union all select 'approvals',      count(*) from marketing_hq.approvals;
```

Verwacht: 9 / 31 / 25 / 5 / 7 / 21 / **101 of minder** / 3.

`metrics_daily` kan onder de 101 uitkomen: overlappende sleutels
(datum + bron + account + metric) worden bijgewerkt in plaats van toegevoegd.
Dat is goed — het betekent dat de stale waarde is vervangen.

Controleer daarna dat geen enkel rapport zijn tekst kwijt is:

```sql
select report_date, kind, title, length(body_md) from marketing_hq.reports order by report_date desc;
```

### 5. Het HQ-project bevriezen, niet verwijderen

Zet `srjpulfodxakbyulwhki` op read-only in gebruik: geen Routine, geen agent en
geen dashboard schrijft er nog naartoe. Verwijder het project **niet** zolang de
back-up nog nodig kan zijn — het is de enige tweede kopie van de bronrijen.

Wat er daarna nog naar wijst en moet worden omgezet:

| Waar | Wat |
|---|---|
| `marketing-hq/dashboard/config.js` | `SUPABASE_URL`/`KEY` → ad-generator-project |
| `marketing-hq/supabase/functions/pulse/` | edge-functie draait in het oude project |
| claude.ai-Routine "Marketing HQ — Ochtendcyclus" | schrijft nu naar het oude project |
| `marketing-hq/docs/architecture.md` | noemt `srjpulfodxakbyulwhki` als de motor |

De Routine is de belangrijkste: laat die pas los zodra de Worker-runtime de
ochtendcyclus overneemt (stap 3). Tot dat moment schrijft hij naar het oude
project en loopt de nieuwe database achter — dat is acceptabel voor een paar
dagen, maar niet langer.

---

## Wat er werkelijk is gebeurd (29 juli)

De procedure is gevolgd, met één afwijking in **hoe** de rijen zijn verplaatst.

### De overdracht

Het plan ging uit van handwerk: rijen exporteren en als `insert` terugzetten.
Dat bleek onnodig riskant — elke rij die door een mens of model wordt overgetypt
kan stil beschadigen. In plaats daarvan heeft het **doelproject de bron zelf
opgehaald**, met de `http`-extensie:

1. Op de bron een tijdelijke functie, alleen aanroepbaar met een eenmalig
   gegenereerd token, die de vier tabellen als JSON teruggeeft.
2. Op het doel dezelfde constructie voor het invoegen.
3. Het doel roept de bron aan met `extensions.http()`, zet het antwoord in een
   staging-tabel en voegt in.
4. Beide functies, de staging-tabel én de `http`-extensie zijn daarna verwijderd.

De data is dus nooit buiten Supabase geweest. De kleinere tabellen (agents,
pipeline, approvals) waren al eerder overgezet als base64-blok, gecontroleerd op
rij-aantal vóór het invoegen.

### Id's

In plaats van nieuwe id's uit te delen en een mapping bij te houden, zijn de
**oorspronkelijke id's behouden** (`overriding system value`). Dat kon omdat de
stale rijen eerst verwijderd waren, dus er kon niets botsen. Alle verwijzingen —
`pipeline_events.item_id`, `agent_messages.ref_pipeline_item` — klopten daardoor
meteen, zonder omnummeren. De id-reeksen zijn daarna met `setval` bijgezet.

### Controle

Rij-aantallen na afloop, precies zoals verwacht:

| tabel | verwacht | gemeten |
|---|---|---|
| agents | 9 | 9 |
| agent_runs | 31 | 31 |
| agent_messages | 25 | 25 |
| pipeline_items | 5 | 5 |
| pipeline_events | 7 | 7 |
| reports | 21 | 21 |
| metrics_daily | ≤ 101 | 101 |
| approvals | 3 | 3 |

`metrics_daily` kwam op precies 101 uit: de 48 stale rijen vielen volledig binnen
de 101 van de bron en zijn dus bijgewerkt in plaats van toegevoegd.

Aantallen alleen zeggen niets over de inhoud, dus is aan beide kanten dezelfde
md5 berekend over de betekenisdragende kolommen van `reports`, `agent_runs`,
`agent_messages` en `metrics_daily`. **Alle vier identiek** — de inhoud is byte
voor byte gelijk overgekomen.

Daarnaast gecontroleerd en nul fouten: geen `pipeline_events` zonder item, geen
`agent_messages` die naar een verdwenen item wijzen, geen `agent_runs` zonder
agent, geen rapport zonder tekst, en geen id-reeks die achterloopt.

### Wat nog openstaat

- `marketing_hq` toevoegen aan **Exposed schemas** — zonder dat kan de
  Worker-runtime niet schrijven. Eén instelling in het Supabase-dashboard.
- Het HQ-project bevriezen (stap 5). Doe dit pas als de Worker de ochtendcyclus
  overneemt; tot dan blijft de Routine naar het oude project schrijven.

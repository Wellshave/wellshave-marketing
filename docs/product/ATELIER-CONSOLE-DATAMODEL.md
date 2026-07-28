# Atelier Console — Definitief Datamodel v1

*Vervolg op ATELIER-CONSOLE-BLUEPRINT.md — vastgezet na de productantwoorden van 28 juli 2026.*
*Geen code, geen SQL — dit is het logische model. Kolomnamen zijn indicatief.*

---

## Leeswijzer en ontwerpprincipes

1. **Alles hangt aan een Brand.** Elke entiteit hieronder heeft `brand_id` als verplicht veld, tenzij expliciet anders vermeld (User, Role). Multimerk zit in de fundering, niet in een latere verbouwing.
2. **De Test is de spil.** Entiteiten links van de Test (Brand → Format) zijn *kennis en context*; entiteiten rechts (Creative → Learning) zijn *uitvoering en uitkomst*.
3. **Voorstel en besluit zijn gescheiden.** Verdict (AI stelt voor) en Decision (mens beslist) zijn bewust twee entiteiten — dit is de audittrail die latere automatisering rechtvaardigt.
4. **Kanaal en outputtype zijn velden, geen aparte modellen.** Meta is de eerste waarde van `channel`, niet de aanname van het schema. Video valt binnen het model (outputtype + productie-statussen), ook al gebeurt de productie voorlopig buiten de tool.
5. **`app_state`-blobs zijn een vertreklocatie, geen bestemming.** De huidige JSON-spiegels (`products_v2`, `personas_v1`, `library_v2`, `script_library_v1`, `brand_profile_v1`) worden uitgelezen, genormaliseerd en daarna alleen nog als compatibiliteitslaag bijgehouden tot de oude app uitgaat (zie migratieplan).

### Overzicht van relaties

```
Brand ─┬─ Product ──┐
       ├─ Persona ──┼─ Angle
       ├─ Format    │
       ├─ Asset     │
       ├─ Learning  │
       └─ Recommendation
                    │
User ── Role        ▼
  └─(owner)──▶   TEST ◀── Hypothesis
                  │  ◀── TestRelationship (parent/child)
                  ├─ Creative ─┬─ CreativeVariant ── Asset
                  │            └─ Publication ── PerformanceSnapshot
                  ├─ Verdict ──▶ Decision
                  └─ Learning (uitkomst)

AISpecialistInteraction ── (logt elke AI-tussenkomst, overal)
```

---

## 1. Brand

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | De scheidingswand van het hele systeem: identiteit, merkprofiel voor AI-prompts, en de koppeling naar Meta ad accounts. |
| **Belangrijkste velden** | `id`, `slug` (wellshave/wellshine), `name`, `website`, `positioning`, `colors` + kleurverhouding, `fonts`, `proof` (Trustpilot/Google-scores, klantaantallen, claims), `meta_ad_account_ids[]`, `status` (active/paused) |
| **Relaties** | 1:n naar vrijwel alles; n:m naar User via rol-toewijzing |
| **Verplicht** | `slug`, `name` |
| **Statussen** | active, paused |
| **Hergebruik** | `app_state.brand_profile_v1` + de hardgecodeerde merkwaarden in de prompts van index.html |
| **Migratie** | Blob normaliseren naar tabel; de `brandProfileBlock()`-injectie gaat voortaan uit deze tabel lezen. Ad-account-ID's komen uit de HQ-connectordocumentatie (5 accounts) — verifiëren welke bij welk merk horen. |

## 2. User

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Identiteit en toegang; eigenaarschap van tests en beslissingen. |
| **Belangrijkste velden** | `id` (Supabase auth uid), `email`, `name`, `status` (pending/approved/blocked), `default_brand_id` |
| **Relaties** | n:m Brand via UserBrandRole; 1:n Test (owner), Decision (decided_by), Publication (confirmed_by) |
| **Verplicht** | `email`, `status` |
| **Statussen** | pending → approved; blocked |
| **Hergebruik** | `team_members` vrijwel 1-op-1 |
| **Migratie** | `team_members.role` verhuist naar de rol-toewijzing (zie Role); goedkeuringswachtrij en admin-flow blijven zoals ze zijn. |

## 3. Role

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Wat iemand mag, per merk. Bewust licht: vier rollen + capability-vlaggen, geen enterprise-RBAC. |
| **Belangrijkste velden** | Toewijzingstabel `user_brand_role`: `user_id`, `brand_id`, `role` (admin/strategist/maker/performance). Capabilities per rol vastgelegd in één configuratie: `can_publish`, `can_decide`, `can_edit_brain`, `can_manage_users`, `can_close_tests` |
| **Relaties** | koppelt User ↔ Brand |
| **Verplicht** | alle drie de kolommen |
| **Statussen** | n.v.t. |
| **Hergebruik** | `team_members.role` (admin/member/guest) |
| **Migratie** | Mapping: admin → admin; member → maker (default, daarna handmatig verfijnen); guest → alleen-lezen (geen rol-rij). **Kernregel v1: `can_publish` en budgetacties vereisen admin of performance; elke publicatie vereist altijd een expliciete menselijke bevestiging, ongeacht rol.** |

## 4. Product

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Waar we voor adverteren: feiten, bewijs, beelden — mét trackrecord (dekking en beste angles worden afleidbaar). |
| **Belangrijkste velden** | `id`, `brand_id`, `slug`, `name`, `niche`, `price`, `hero`, `rating`/`reviews`, `sell_line`, `usps[]`, `features[]`, `vs_us`/`vs_them`, `proof`, `persona_ids[]` |
| **Relaties** | n:1 Brand; n:m Persona; 1:n Test; beelden via Asset (kind=product_photo/lifestyle/packaging) |
| **Verplicht** | `brand_id`, `name`, `niche` |
| **Statussen** | active, archived |
| **Hergebruik** | `products`-tabel grotendeels 1-op-1 |
| **Migratie** | `brand_id` toevoegen (afleidbaar uit huidige brand-scoping van app_state); `images`-JSON (base64) verhuist naar Asset + Storage; `best_ad_ids` vervalt — "beste ads" wordt een query op Decisions, geen handmatig lijstje. |

## 5. Persona

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Voor wie we adverteren: het psychologische profiel. De angles verhuizen eruit (zie Angle). |
| **Belangrijkste velden** | `id`, `brand_id`, `name`, `alias`, `age`, `role`, `niche`, `driver`, `quote`, `demo`, `wants[]`, `fears[]`, `objections[]`, `failed_alts[]`, `benefits[]` |
| **Relaties** | n:1 Brand; 1:n Angle; n:m Product; 1:n Test |
| **Verplicht** | `brand_id`, `name`, `driver` |
| **Statussen** | active, archived |
| **Hergebruik** | `personas`-tabel minus het `stages`-JSON-blok |
| **Migratie** | `stages` (5 awareness-stadia × angles) wordt uitgeklapt naar de Angle-tabel; Excel-import/export blijft, maar schrijft voortaan naar beide tabellen. |

## 6. Angle

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | De kleinste strategische eenheid: één invalshoek voor één persona in één awareness-stadium — mét teststatus. Dit is de kaart waarop het systeem gaten en kansen aanwijst. |
| **Belangrijkste velden** | `id`, `brand_id`, `persona_id`, `awareness_stage` (1–5, Schwartz), `name`, `pitch`, `emotion`, `objection`, `status`, `last_tested_at` |
| **Relaties** | n:1 Persona; 1:n Test; 1:n Learning (scope=angle) |
| **Verplicht** | `persona_id`, `awareness_stage`, `name`, `pitch` |
| **Statussen** | untested → testing → proven / disproven (afgeleid uit Decisions, met handmatige override) |
| **Hergebruik** | Het `[name, pitch, emotion, objection]`-formaat bestaat al in `personas.stages`; `creatives.angle_id` bewijst dat de koppeling al half bestaat |
| **Migratie** | JSON uitklappen naar rijen; bestaande `creatives.angle_id`-verwijzingen terugkoppelen zodat historische teststatus meteen gevuld is. AI-verrijking ("enrich angle") blijft, schrijft voortaan hierheen. |

## 7. Format

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Het uitvoeringsrecept (de huidige 42-formats-catalogus) — als data in plaats van als JS-constante, zodat er een winrate aan kan groeien en het team formats kan toevoegen zonder deploy. |
| **Belangrijkste velden** | `id`, `brand_id` (nullable — formats zijn deelbaar over merken), `category` (A–E), `name`, `tags[]`, `description`, `brandless`, `cta_type` (hard/soft/none), `proof_required`, `destination` (pdp/advertorial), `funnel_fit` |
| **Relaties** | 1:n Test |
| **Verplicht** | `name`, `category`, `description` |
| **Statussen** | active, deprecated |
| **Hergebruik** | De `AD_FORMATS`-constante in index.html (incl. de Theriot-funnelregels) |
| **Migratie** | Eénmalige seed vanuit de constante; de client leest voortaan de tabel. Winrate is geen kolom maar een view over Tests+Decisions. |

## 8. Test — de spil

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Eén experiment: hypothese + context + uitvoering + uitkomst + besluit. Alles in het product is een Test of hoort bij een Test. |
| **Belangrijkste velden** | `id`, `brand_id`, `hypothesis_id`, `tier` (**quick** / **strategic** — het tweetrapsmodel uit je antwoord op vraag 4), `channel` (meta; later meer), `output_type` (static/video/copy), `product_id`, `persona_id`, `angle_id`, `format_id`, `funnel_stage`, `awareness_level`, `sophistication`, `owner_id`, `name` (naamconventie, gegenereerd), `is_sandbox` (bool) |
| **Relaties** | 1:1 Hypothesis; 1:n Creative; 1:n Verdict; 1:n Decision; 0:n Learning; ouder/kind via TestRelationship |
| **Verplicht** | `brand_id`, `tier`, `channel`, `output_type`, `product_id`, `owner_id`. Voor tier=strategic bovendien: `hypothesis_id`, `persona_id`, `angle_id`. Voor tier=quick volstaat een hypothese van één regel + verwijzing naar de parent-test (context erft over via TestRelationship). |
| **Statussen** | draft → ready → live → deciding → decided → archived. (`decided` krijgt zijn uitkomst uit de gekoppelde Decision, niet uit een eigen veld.) |
| **Hergebruik** | De `creatives`-tabel (Creative Strategy) is het embryo: plan-velden → Test, performance-velden → PerformanceSnapshot, decision-velden → Decision |
| **Migratie** | Elke bestaande `creatives`-rij wordt gesplitst: één Test + één Creative + (indien cijfers aanwezig) één legacy PerformanceSnapshot + (indien status Winner/Killed) één Decision. `parent_id` → TestRelationship. Rijen zonder context krijgen `tier=quick` en een placeholder-hypothese "gemigreerd zonder hypothese" — eerlijk gemarkeerd, niet verzonnen. |

## 9. Hypothesis

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | De toetsbare verwachting, als eigen object zodat er een **backlog van nog-niet-uitgevoerde hypotheses** kan bestaan (gevoed door De Strateeg, gaten-detectie en de HQ-agents). |
| **Belangrijkste velden** | `id`, `brand_id`, `statement` ("X verslaat Y bij Z"), `expected_metric` (bijv. hook_rate/CPA/ROAS), `expected_direction`, `rationale`, `source` (gap/winner_iteration/competitor/idea/agent/manual), `outcome` |
| **Relaties** | 0:1 Test (een hypothese kan wachten in de backlog); n:1 Learning (welke learning hem inspireerde) |
| **Verplicht** | `brand_id`, `statement`, `source` |
| **Statussen** | backlog → attached → confirmed / rejected / inconclusive |
| **Hergebruik** | `creatives.hypothesis` (tekstveld) |
| **Migratie** | Tekstveld promoveren naar rijen; leeg = placeholder zoals bij Test beschreven. |

## 10. Creative

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Eén uitvoering van een test: een static, een script (3×6×3), of een copy-set. Ook video-creatives leven hier, met productie-statussen (antwoord vraag 6). |
| **Belangrijkste velden** | `id`, `test_id`, `type` (static/script/copy_set/video), `name` (naamconventie), `content` jsonb — per type: static = hook/headline/body/cta/image_prompt/reasoning; script = 3 hooks, ~6 beats, 3 CTA's, casting, shotlist, b-roll, creator-instructies; copy_set = primary texts/link headlines/descriptions/CTA-knop; video = script-ref + productieveld |
| **Relaties** | n:1 Test; 1:n CreativeVariant; 0:n Publication; assets via Variant |
| **Verplicht** | `test_id`, `type`, `content` |
| **Statussen** | concept → in_review → approved → published → retired. **Video-extensie:** concept → briefed → with_creator → in_edit → approved → published (dekt UGC-briefing t/m koppeling aan de live ad; productie zelf blijft extern). |
| **Hergebruik** | `library_v2`-items (statics + instellingen), `script_library_v1` (scripts + iteraties), `creatives.script` jsonb |
| **Migratie** | Library-items en scripts worden Creatives onder hun (gereconstrueerde) Test; de instellingen-metadata van library-items vult de Test-context. |

## 11. CreativeVariant

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Eén concrete versie/variant van een creative: de beeldversies uit de bewerkingsstack, of een bewuste variant op één dimensie (hook, achtergrond, persona…). |
| **Belangrijkste velden** | `id`, `creative_id`, `variant_no`, `varied_dimension` (nullable: hook/headline/opening/background/cta/mood/persona/format), `asset_id`, `edit_stack` jsonb (de stapelbare bewerkingsstappen), `is_selected` |
| **Relaties** | n:1 Creative; n:1 Asset |
| **Verplicht** | `creative_id`, `variant_no` |
| **Statussen** | draft, selected, discarded |
| **Hergebruik** | De beeldversie-navigatie + edit-stapels die nu per library-item in IndexedDB leven |
| **Migratie** | Beeldversies → Variant-rijen + Assets; de edit-stack-JSON verhuist mee (waardevol: het is het recept van elke bewerking). |

## 12. Asset

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Alle binaire media, eenmaal opgeslagen, overal herbruikbaar: gegenereerde beelden, referentiefoto's, productfoto's, brandbooks, straks video's. |
| **Belangrijkste velden** | `id`, `brand_id`, `kind` (generated_image/reference_photo/product_photo/lifestyle/packaging/brandbook/video/thumbnail), `storage_path`, `mime`, `width/height/duration`, `source` (openai/upload/meta), `checksum`, `meta` jsonb |
| **Relaties** | 1:n CreativeVariant; n:1 Product (voor productfoto's); overal refereerbaar |
| **Verplicht** | `brand_id`, `kind`, `storage_path` |
| **Statussen** | processing → ready; quarantined (bij mislukte migratie) |
| **Hergebruik** | 293 MB productfoto's (base64 in Supabase), IndexedDB-blobs, reference-images-JSON in products |
| **Migratie** | **De zwaarste datamigratie van het hele plan:** alle base64/IndexedDB naar Supabase Storage met checksums en een verificatierapport (aantallen + steekproef) vóór iets wordt verwijderd. |

## 13. Publication

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | De brug naar Meta: welke creative staat als welke ad in welk account — en wie heeft dat bevestigd. Fase 2 van de Meta-koppeling. |
| **Belangrijkste velden** | `id`, `creative_id`, `brand_id`, `ad_account_id`, `campaign_id`, `adset_id`, `meta_ad_id`, `meta_creative_id`, `utm` jsonb, `naming` (gegenereerde ad-naam), `prepared_by`, `confirmed_by`, `confirmed_at` |
| **Relaties** | n:1 Creative; 1:n PerformanceSnapshot |
| **Verplicht** | `creative_id`, `ad_account_id`; `confirmed_by` verplicht vóór status voorbij draft_prepared — **de menselijke bevestiging is een schema-regel, geen UI-conventie** |
| **Statussen** | draft_prepared → pushed_as_draft → live → paused → ended → archived |
| **Hergebruik** | Niets — dit bestaat nog niet (het huidige "publiceren" is PNG downloaden) |
| **Migratie** | Voor bestaande live ads: een koppel-flow die Meta-ads matcht aan gemigreerde Creatives (op naam/datum, met handmatige bevestiging), zodat de historie niet weesloos blijft. |

## 14. PerformanceSnapshot

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | De dagelijkse (en on-demand) meting per publication — de brandstof van de hele loop. Append-only; nooit overschrijven. |
| **Belangrijkste velden** | `id`, `publication_id`, `date`, `window` (day/lifetime), `spend`, `impressions`, `reach`, `cpm`, `ctr`, `cpc`, `add_to_carts`, `purchases`, `cpa`, `roas`, `hook_rate`, `hold_rate`, `thruplays`, `raw` jsonb (het volledige Meta-antwoord), `source` (meta_api/manual/screenshot/legacy) |
| **Relaties** | n:1 Publication (of n:1 Creative voor legacy zonder publication) |
| **Verplicht** | `date`, `source`, en `publication_id` óf `creative_id` |
| **Statussen** | n.v.t. (append-only feiten) |
| **Hergebruik** | Het 28-velden-metricsnapshot in `rory_recommendations`, `ad_results`, en de handmatig ingevoerde cijfers in `creatives` |
| **Migratie** | Alle drie de bronnen importeren met `source=legacy`; daarna vullen alleen de Meta-ingest (fase 1) en een handmatig-invoer-noodluik deze tabel. Screenshot-extractie blijft bestaan als vangnet voor ads buiten de gekoppelde accounts, maar schrijft óók hierheen. |

## 15. Verdict

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Het AI-voorstel over een lopende test: schalen / itereren / killen / doorlaten — met redenering en de cijfers waarop het is gebaseerd. Voorstel, géén besluit. |
| **Belangrijkste velden** | `id`, `test_id`, `publication_id`, `proposal` (scale/iterate/kill/continue), `reasoning`, `confidence`, `snapshot_ids[]`, `specialist` (analist), `expires_at` |
| **Relaties** | n:1 Test; 0:1 Decision (het besluit dat erop volgde) |
| **Verplicht** | `test_id`, `proposal`, `reasoning` |
| **Statussen** | open → accepted / overridden / expired |
| **Hergebruik** | **`rory_recommendations` is deze tabel al** — verdict, action, reasoning, metrics, handled-flag: alles zit erin |
| **Migratie** | Hernoemen/overzetten + koppelen aan gemigreerde Tests; de daily-check-routine wordt de eerste producent. De `handled`-vlag wordt vervangen door de Decision-koppeling. |

## 16. Decision

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Het menselijke besluit, altijd herleidbaar: wat is besloten, door wie, op basis van welk verdict (of tegen welk verdict in). Sluit de test af of stuurt hem een nieuwe ronde in. |
| **Belangrijkste velden** | `id`, `test_id`, `verdict_id` (nullable — mens mag ook zonder voorstel beslissen), `decision` (winner/iterate/kill/continue/inconclusive), `followed_verdict` (bool, afgeleid), `note`, `decided_by`, `decided_at` |
| **Relaties** | n:1 Test; 0:1 Verdict; triggert 0:n nieuwe Tests (iteraties) via TestRelationship en 0:1 Learning |
| **Verplicht** | `test_id`, `decision`, `decided_by` |
| **Statussen** | n.v.t. (een besluit ís) |
| **Hergebruik** | `creatives.status` (Winner/Killed/Iterate) + `score`/`next_step`/`notes` |
| **Migratie** | Statussen → Decision-rijen met `decided_by = onbekend/legacy` waar geen auteur is vastgelegd. `followed_verdict` is de dataset die het trackrecord van De Analist opbouwt — de voorwaarde voor latere automatisering. |

## 17. Learning

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Eén zin die het team blijvend rijker maakt, gekoppeld aan zijn bewijs. Wordt geïnjecteerd in AI-context — dit is het vliegwiel. |
| **Belangrijkste velden** | `id`, `brand_id`, `statement`, `scope` (product/persona/angle/format/hook/offer/general), `scope_refs` (product_id/persona_id/angle_id/format_id — nullable), `evidence_test_ids[]`, `strength` (single_test/repeated/foundational), `proposed_by` (specialist), `edited_by` |
| **Relaties** | n:1 Brand; n:m Test (bewijs); 1:n Hypothesis (inspiratie voor volgende tests) |
| **Verplicht** | `brand_id`, `statement`, `scope`, minimaal één evidence-test (uitzondering: geïmporteerde foundational learnings) |
| **Statussen** | active → superseded (door nieuwere learning) / retired |
| **Hergebruik** | Niets structureels — vandaag verdampen learnings. Eenmalige seed mogelijk uit `docs/iteraties-variaties-framework.md` en de HQ-rapporten (als `strength=foundational`, handmatig gecureerd) |
| **Migratie** | Geen — dit is nieuw. Afsluitritueel (test dicht = learning voorgesteld) dwingt de vulling af. |

## 18. Recommendation

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Proactieve systeemvoorstellen over wat te *starten* (waar Verdict over *lopende* tests gaat): gaten in de dekking-matrix, winners zonder iteraties, verwaarloosde persona's, trend-kansen uit de HQ-agents. De motor van "Vandaag". |
| **Belangrijkste velden** | `id`, `brand_id`, `kind` (coverage_gap/winner_followup/stale_persona/trend/competitor/maintenance), `title`, `rationale`, `payload` jsonb (vooringevulde testcontext), `priority`, `source` (coverage_engine/strateeg/hq_agent), `expires_at` |
| **Relaties** | n:1 Brand; 0:1 Hypothesis of Test (wat eruit voortkwam) |
| **Verplicht** | `brand_id`, `kind`, `title`, `rationale` |
| **Statussen** | open → accepted / dismissed / expired. Dismissed mét reden — ook dat is trainingsdata. |
| **Hergebruik** | De "computed next best action"/prioriteitentaken van de huidige Cockpit (nu client-side berekend, vluchtig) en de HQ `pipeline_items` in idea/hypothesis-status |
| **Migratie** | Client-side logica wordt server-side producent; HQ-ideeën importeren bij de HQ-migratie (fase 6). |

## 19. AISpecialistInteraction

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | Het logboek van elke AI-tussenkomst: wie (welke specialist), waarover (welke test/entiteit), wat erin ging (samenvatting + welke learnings geïnjecteerd waren), wat eruit kwam, en of de mens het overnam. Drie doelen: audit, trackrecord per specialist, en promptverbetering. |
| **Belangrijkste velden** | `id`, `brand_id`, `specialist` (strateeg/maker/copywriter/analist/criticus), `context_type` + `context_id` (test/creative/persona/…), `intent` (bijv. concept_suggestie/verdict/preflight), `input_summary`, `injected_learning_ids[]`, `output_ref`, `model`, `tokens`, `accepted` (bool, nullable) |
| **Relaties** | polymorf naar vrijwel alles |
| **Verplicht** | `specialist`, `intent`, `context_type` |
| **Statussen** | n.v.t. (log) |
| **Hergebruik** | Niets — de ~25 huidige callsites loggen niet |
| **Migratie** | Geen. Vanaf fase 0 schrijft de nieuwe AI-gateway (de opvolger van de losse fetch-calls) dit automatisch weg. Bewust géén volledige prompt/response-opslag (kosten, ruis) — samenvatting + verwijzing volstaat. |

## 20. TestRelationship

| Aspect | Invulling |
|---|---|
| **Verantwoordelijkheid** | De familieboom: hoe tests uit elkaar voortkomen. Beantwoordt "waarom werkt deze ad?" over generaties heen. |
| **Belangrijkste velden** | `id`, `parent_test_id`, `child_test_id`, `relation` (iteration_of/variant_of/inspired_by/competitor_derived/promoted_from_sandbox), `varied_dimension` (nullable) |
| **Relaties** | Test ↔ Test |
| **Verplicht** | beide test-id's + `relation` |
| **Statussen** | n.v.t. |
| **Hergebruik** | `creatives.parent_id` |
| **Migratie** | `parent_id` → rijen met `relation=iteration_of`. Aparte tabel (i.p.v. kolom) omdat een test meerdere ouders kan hebben (winner + concurrent-inspiratie) en de relatiesoort betekenis draagt. |

---

## Wat bewust géén entiteit is

- **Campaign/Adset** — Meta-structuur die we lezen en waarnaar we publiceren, geen eigen domeinobject. ID's leven op Publication; de structuur zelf beheert Meta.
- **Workspace/Workflow** — de vijf werkruimtes zijn UI-organisatie over dit model heen, geen data.
- **Channel/OutputType als tabellen** — enums op Test/Creative; pas een tabel waard als kanalen eigen gedrag krijgen (e-mail, landing pages — buiten scope v1).
- **Sandbox-creative als apart model** — een Test met `is_sandbox=true` en versoepelde verplichte velden; promotie naar officiële test is een statuswijziging + TestRelationship (`promoted_from_sandbox`), geen datamigratie. Sandbox-werk telt nooit mee in winrates of dekking.

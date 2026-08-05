-- ═══════════════════════════════════════════════════════════════════════════
-- 0032 — De statusgrendel terug
--
-- TOEGEPAST op 5 augustus 2026, nadat de vier voorwaarden onderaan waren
-- nagelopen. De noodmaatregel van diezelfde dag is daarmee gesloten.
--
-- Wat er gebeurde
--
--   0030 zette een foreign key van creatives.status naar creative_statussen.
--   De live console bleek niet aan Git gekoppeld: hij draaide nog op een
--   handmatige upload van 4 augustus, met het oude statusvocabulaire. Daardoor
--   weigerde de database elke opslagactie van het team — een rij bewerken, een
--   rij toevoegen, importeren, een static uit de bibliotheek in de tabel
--   zetten, een plan bewaren.
--
--   De grendel is er toen tijdelijk afgehaald (migratie
--   'statusgrendel_tijdelijk_los'). Verder is er niets teruggedraaid: de tien
--   statussen, de testkaart, het dossier, de testklaar-trigger en de
--   gecorrigeerde vertaling van Atlas staan gewoon op productie. Er is geen
--   enkele rij aangeraakt.
--
-- Waarom dit een migratie is en geen aantekening
--
--   Een noodmaatregel zonder terugweg wordt de nieuwe toestand. Zolang de
--   grendel eraf is, is de statuslijst een afspraak en geen regel — precies
--   wat 0030 wilde voorkomen. Door de terugweg nu al op te schrijven is
--   "wanneer gaat hij er weer op" een uitvoerbare stap in plaats van iets dat
--   iemand moet onthouden.
--
-- Voorwaarden, nagelopen en niet aangenomen
--
--   1. js/34-testklaar.js en js/35-strategie.js geven 200          ✓
--   2. de live bundel bevat geen CS_STATUSES meer (0x in code)     ✓
--   3. de live console leest hq_creative_statussen                 ✓
--   4. geen nieuwe rijen met een oud statuswoord tijdens het
--      venster: alleen de zeven die er al stonden                  ✓
--
--   Zonder die vier komt de storing terug op het moment dat dit draait.
--
-- De live commit waarop dit rust: 1b7c3aa, branch
-- claude/marketing-system-ai-agents-devt2c, uitgerold 5 augustus 10:58.
--
-- NOT VALID, net als in 0030: de zeven bestaande rijen staan nog op 'To Test'
-- en die blijven staan tot een mens per rij een nieuwe status kiest. Een
-- migratie die dat voor hem doet, verzint een feit — 'To Test' betekende zowel
-- Concept als Klaar voor review.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.creatives drop constraint if exists creatives_status_bekend;
alter table public.creatives
  add constraint creatives_status_bekend
  foreign key (status) references marketing_hq.creative_statussen(status)
  on update cascade not valid;

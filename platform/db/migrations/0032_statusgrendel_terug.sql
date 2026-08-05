-- ═══════════════════════════════════════════════════════════════════════════
-- 0032 — De statusgrendel terug
--
-- NOG NIET TOEPASSEN. Deze migratie hoort bij een noodmaatregel van 5 augustus
-- en mag er pas op zodra de nieuwe console live staat op wellshave-werkbank.
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
-- Voorwaarde vóór toepassen, na te lopen en niet aan te nemen
--
--   1. https://wellshave-werkbank.netlify.app/js/35-strategie.js geeft 200
--   2. de live bundle bevat geen CS_STATUSES meer
--   3. de live console leest hq_creative_statussen
--
--   Zonder die drie komt de storing terug op het moment dat dit draait.
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

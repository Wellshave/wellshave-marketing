-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 — De audit inplannen
--
-- 0013 gaf Atlas de opdracht `account_audit` en legde de afspraak vast: elke
-- maandag. Wat er niet bij zat is een rij in `schedules`, en dat is de tabel
-- waar de runtime daadwerkelijk naar kijkt.
--
-- Zonder deze migratie belooft `agent_afspraken` een wekelijkse audit die
-- nooit gaat draaien, en meldt `agent_nakoming` hem tot in het oneindige als
-- 'te laat'. Een afspraak zonder planning is een voornemen.
--
-- Gevonden bij de deploy-voorbereiding op 30 juli, door de planning naast de
-- afspraken te leggen in plaats van aan te nemen dat ze klopten.
-- ═══════════════════════════════════════════════════════════════════════════

-- Maandag 06:30 UTC. Niet 06:00: daar staat Nova's pipeline_sync al, en twee
-- agents die tegelijk wakker worden vechten om dezelfde tick.
--
-- De runtime corrigeert dit uur zelf voor de Nederlandse wintertijd, zodat het
-- voor het team het hele jaar op hetzelfde moment valt.
insert into marketing_hq.schedules (id, agent_id, kind, cron, payload, enabled)
values ('atlas_audit', 'atlas', 'account_audit', '30 6 * * 1',
        '{"days": 30}'::jsonb, true)
on conflict (id) do nothing;

-- De afspraak zei 06:00; die is nu een halfuur opgeschoven. Twee plekken die
-- hetzelfde moeten zeggen en het niet doen, is precies hoe je later niet meer
-- weet welke de waarheid is.
update marketing_hq.agent_afspraken
   set cadans = 'elke maandag 06:30 UTC'
 where agent_id = 'atlas' and kind = 'account_audit';

-- ═══════════════════════════════════════════════════════════════════════════
-- Terugdraaien
--
--   delete from marketing_hq.schedules where id = 'atlas_audit';
--   update marketing_hq.agent_afspraken set cadans = 'elke maandag 06:00 UTC'
--    where agent_id = 'atlas' and kind = 'account_audit';
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 0034 — De onderbouwing van een agent wordt leesbaar voor de console
--
-- Beslisvraag van het scherm dat hierop rust (regel 0.1):
--
--     "Wat moet er vandaag met het geld gebeuren, en kan ik daar überhaupt
--      op sturen?"
--
-- Wat er misging
--
--   Sinds 0012 schrijft elke agent zijn rapport weg met de onderbouwing
--   erbij: `cijfers` (waarop hij oordeelde), `signalen` (wat hij zag, met
--   richting), `gaten` (wat hij niet kon meten) en `voorlopig` +
--   `voorlopig_reden` (of het oordeel al hard is). Precies de vier dingen die
--   het ontwerpcontract van een agentanalyse eist: conclusie, onderbouwing,
--   zekerheid, en wat er ontbreekt.
--
--   `public.hq_reports` gaf daar niets van door. De view stopte na `body_md`.
--   De console kon dus alleen de lopende tekst tonen — en dat is precies het
--   lange tekstuele rapport dat het Analytics-scherm niet mag zijn. De
--   onderbouwing lag er al, alleen achter een muur.
--
--   Daardoor zou het scherm de zekerheid van een oordeel zelf moeten
--   afleiden uit de tekst. Dat is een tweede waarheid: de database weet of
--   een rapport voorlopig is (de trigger uit 0012 bepaalt dat, niet de
--   agent), en de browser zou het opnieuw gaan raden.
--
-- Wat dit doet
--
--   Kolommen achteraan de bestaande view aanplakken. Geen nieuwe view, geen
--   tweede bron: dezelfde rijen, met de onderbouwing die er al in stond.
--   `create or replace` kan kolommen toevoegen zolang ze achteraan komen en
--   de bestaande kolommen op hun plek en type blijven — vandaar deze volgorde
--   en niet een nettere.
--
--   `security_invoker` blijft aan, dus wie het rapport niet mag lezen ziet
--   het nog steeds niet: dit verbreedt de kolommen, niet de toegang.
--
-- En passant: deze view stond op productie maar in geen enkele migratie. Wie
-- de database vanaf nul opbouwt uit deze map, kreeg hem dus niet — hij is ooit
-- met de hand aangemaakt. `create or replace` legt hem aan als hij ontbreekt,
-- dus vanaf hier staat hij wél in versiebeheer. Dat is geen bijvangst maar de
-- reden dat platform/db/test/agentzicht.sh kan bestaan: je kunt niet testen wat
-- je niet kunt opbouwen.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view public.hq_reports
with (security_invoker = true) as
select
  id,
  report_date,
  kind,
  title,
  author_agent,
  vault_path,
  body_md,
  created_at,
  -- Vanaf hier nieuw. De volgorde hierboven is onaantastbaar: een bestaande
  -- kolom verplaatsen breekt elke `select *` die er nu op staat.
  account_id,
  periode_start,
  periode_eind,
  voorlopig,
  voorlopig_reden,
  cijfers,
  signalen,
  gaten,
  werkstuk_id
from marketing_hq.reports;

-- De rechten hangen aan de view en niet aan de kolommen, maar `create or
-- replace` kan ze wegnemen als de view opnieuw wordt aangelegd. Ze staan hier
-- opnieuw zodat het team het scherm morgen niet leeg aantreft — dat was in
-- 0030 de fout die het dossier voor iedereen behalve mij onleesbaar maakte.
grant select on public.hq_reports to authenticated;

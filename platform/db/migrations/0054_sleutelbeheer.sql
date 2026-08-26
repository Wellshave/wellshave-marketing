-- ═══════════════════════════════════════════════════════════════════════════
-- 0054 — de API-sleutels beheerbaar maken zonder terminal
--
-- Beslisvraag:
--
--     "Waar mag een API-sleutel staan zodat je hem kunt wisselen zonder dat
--      iemand hem kan lezen?"
--
-- Hoe dit boven water kwam
--
--   In ad-generator/app/js/04-instellingen-en-proxy.js stond een "kluis" met
--   de OpenAI- en de Anthropic-sleutel letterlijk in de broncode, achter een
--   wachtwoord dat er drie regels boven ook in stond. Dat bestand gaat naar
--   elke browser die de console opent. Toen de repo met een tweede bedrijf
--   gedeeld werd, vonden de scanners van Anthropic en OpenAI ze en trokken ze
--   allebei automatisch in.
--
--   De kluis is weg (commit f2f102c) en de sleutels horen sindsdien als
--   Cloudflare Worker secret. Dat is veilig maar onhandig: elke wissel vraagt
--   een terminal met wrangler erin, en dat heeft niet iedereen die het wél
--   mag beslissen.
--
-- Wat deze migratie doet
--
--   Eén tabel waar de worker de sleutels leest, met twee eigenschappen die
--   samen het hele punt zijn:
--
--     1. De waarde staat VERSLEUTELD. De hoofdsleutel waarmee dat gebeurt
--        staat als Worker secret (SLEUTEL_MASTER) en dus niet hier. Een
--        databasedump of een gelekte Supabase-sleutel levert daardoor
--        onleesbare tekst op in plaats van een werkende API-sleutel. Dat is
--        precies het verschil met de kluis: die was leesbaar voor wie ernaar
--        keek.
--
--     2. Niemand mag deze tabel lezen behalve de worker. RLS staat aan en er
--        is met opzet GEEN policy. Een tabel met RLS en zonder policy is voor
--        anon en authenticated volledig dicht -- er is geen regel die iets
--        toestaat, dus er wordt niets toegestaan. Alleen service_role gaat
--        langs RLS heen, en die sleutel heeft alleen de worker.
--
--   De staart (laatste vier tekens) staat er los en onversleuteld bij. Dat is
--   geen slordigheid maar de reden dat het scherm bruikbaar is: je moet
--   kunnen zien WELKE sleutel er staat zonder hem te kunnen lezen. Vier
--   tekens zijn genoeg om te herkennen en te weinig om iets mee te doen.
--
--   gezet_door en gezet_op staan erbij omdat een sleutelwissel een handeling
--   is die je later wilt kunnen navertellen. Bij de vorige ronde was de vraag
--   "sinds wanneer staat dit er en van wie komt het" niet te beantwoorden.
--
-- Wat deze migratie NIET doet
--
--   De Worker secrets vervangen. De worker leest straks eerst deze tabel en
--   valt terug op het secret als er hier niets staat. Zo blijft een bestaande
--   opzet werken en is dit een toevoeging, geen omschakeling met een moment
--   waarop niets het doet.
-- ═══════════════════════════════════════════════════════════════════════════

set search_path = marketing_hq, public;

create table if not exists systeem_geheimen (
  -- 'ANTHROPIC_KEY' of 'OPENAI_KEY' -- dezelfde namen als de Worker secrets,
  -- zodat er één woordenlijst is en niet twee die uit elkaar lopen.
  naam        text primary key,
  -- De versleutelde waarde, base64. Nooit leesbaar zonder SLEUTEL_MASTER.
  cipher      text not null,
  -- De losse nonce van deze versleuteling, base64. Hoort niet geheim te zijn
  -- en moet per keer verschillen; hem naast de cipher zetten is de gewone
  -- manier.
  nonce       text not null,
  -- Laatste vier tekens, onversleuteld: herkennen zonder lezen.
  staart      text not null,
  gezet_door  text not null,
  gezet_op    timestamptz not null default now(),

  constraint systeem_geheimen_naam_check
    check (naam in ('ANTHROPIC_KEY', 'OPENAI_KEY')),
  -- Een lege staart betekent dat er iets is misgegaan bij het opslaan, en dan
  -- staat er straks een rij die niemand kan herkennen of vervangen.
  constraint systeem_geheimen_staart_check
    check (length(staart) between 3 and 8)
);

comment on table systeem_geheimen is
  'API-sleutels, versleuteld met SLEUTEL_MASTER (Worker secret). Alleen '
  'leesbaar door de worker via service_role. Beheer via het adminmenu in de '
  'Atelier Console, niet met de hand.';

-- RLS aan en met OPZET geen policy: dat is wat de tabel dichtzet.
alter table systeem_geheimen enable row level security;

-- En de rechten er nog eens bovenop. RLS alleen is genoeg, maar twee sloten
-- op de deur die de API-sleutels bewaart is de goedkoopste verzekering die er
-- is -- en als iemand later per ongeluk een policy toevoegt, houdt dit het
-- alsnog tegen.
revoke all on systeem_geheimen from anon, authenticated;

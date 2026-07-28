# Handoff: Atelier Console — AI Ad Creation Platform (Wellgroup)

## Overview
**Atelier Console** is an internal tool for a DTC/e-commerce grooming brand (Wellgroup) to create, iterate on, and manage Meta (Facebook/Instagram) advertisements with AI assistance. The AI persona throughout is called **"Rory"**.

The product covers the full ad-creation lifecycle:
1. **Dashboard** — command center with KPIs, leaderboards, top products/angles.
2. **Nieuwe ad** (Generator) — build a static ad from scratch via a guided, AI-assisted flow (format library, awareness level, angle type, sophistication stage) → 4 AI variations.
3. **Kopieer ad** — upload/paste a competitor ad → AI analyzes it → generate 4 variations at 3 fidelity levels (clone / variant / inspiration).
4. **Itereren** — upload a winning ad + its performance metrics → AI analyzes → stepwise iteration on chosen axes → 4 new variations.
5. **Ad transformer** — upload any image → AI reads what it sees → recommends how to turn it into an ad, which personas to target and why, which channels → handoff to generator.
6. **Customer Persona's** — the foundation. Master-detail. Each persona has full demographics, 5 Schwartz awareness stages, and 5 marketing angles per stage, plus desires/objections/pain points/failed alternatives/benefits. Filterable by product niche.
7. **Bibliotheek** — the memory + live-agent cockpit. Saved ads & scripts (tabs), each fully traceable back to the input data used to make it. Top section is "Rory's dagelijkse check" — the intended live Meta Ads integration surface.
8. **Producten** — the source catalog. Per product: multiple reference images (packshot white / packshot ambience / lifestyle), USPs, features, us-vs-them, linked customer personas, social proof, best-performing ads, price.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look, content, and behavior. **They are not production code to ship directly.** The task is to **recreate these designs in a real, production codebase** using its established framework and patterns (React/Next, Vue, etc.). If no codebase exists yet, choose an appropriate modern stack (recommended: **React + TypeScript + Vite/Next**, with a small backend — Node/Python — for the Meta API integration and the scheduled daily job).

The prototype is a single-file "Design Component" (`.dc.html`) built on a custom lightweight runtime (`support.js`). **Do not port the runtime.** Read the prototype for layout, copy, data shapes, and interaction logic, then rebuild natively.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are all specified. Recreate the UI pixel-accurately, then wire it to real data. All copy is in **Dutch** and should be preserved.

---

## The "Live Meta Ads" ask — architecture note
The user wants a "live agent that checks the Meta Ads account daily and recommends iterate / copy / new." This **cannot** live inside the prototype (a browser page can't run scheduled jobs or hold API secrets). It requires, in the real build:

1. **Backend service** with a **scheduled daily job** (cron / serverless schedule).
2. **Meta Marketing API** integration (OAuth, access token for the Business account) to pull per-ad metrics: ROAS, CTR (link + outbound), CPA, spend, revenue, CPM, purchases, ATC, LPV, etc. (See the Itereren metric schema below — it mirrors a real Ads Manager export.)
3. **AI analysis step**: feed the pulled metrics to Claude; for each ad, classify Winner / Loser / Test against a ROAS threshold and output a recommendation (iterate / copy / new) with reasoning.
4. Surface results in **Bibliotheek → "Rory's dagelijkse check"** (recommendation cards already designed) and stamp each library item's live metrics.

The Bibliotheek and Producten data models are already shaped to receive this live data.

---

## Global Layout & Chrome
- **App shell**: full-height flex. Left **sidebar** (fixed `212px`) + main content area (`flex:1`, `overflow-y:auto`).
- **Sidebar**: background `#080807`, right border `1px solid rgba(255,255,255,0.05)`, padding `18px 12px`.
  - **Logo block**: 32×32 rounded-9px gold gradient square (`linear-gradient(135deg,#e6cd92,#8d764a)`) with serif "A" in `#1a1408`; wordmark "Atelier" (Fraunces 600, 17px) + "CONSOLE" (JetBrains Mono, 8px, letter-spacing 0.14em, `#8d764a`).
  - **Two nav groups**, each preceded by a mono label (9.5px, letter-spacing 0.2em, `#635c54`):
    - **WERKEN**: Dashboard, Nieuwe ad, Kopieer ad, Itereren, Ad transformer.
    - **ARCHIEF**: Bibliotheek, Producten, Persona's, Scripts.
  - Nav item (active): background `rgba(201,169,97,0.15)` (approx), text `#f7f2e8`. Inactive text `#8d764a`/`#ada599`. Rows are flex, gap 10px, rounded, padded ~`9px 10px`.
- **Main content** typically wrapped `max-width:1340–1440px; margin:0 auto; padding:30px 40px 60px`.
- Main background has a subtle gold radial glow: `radial-gradient(ellipse 65% 40% at 12% 0%, rgba(201,169,97,0.06) 0%, transparent 55%)` over `#060606`.

## Design Tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| Base background | `#060606` | app bg |
| Panel/sidebar bg | `#080807` | sidebar |
| Card bg | `#0a0908` | cards, tiles |
| Modal bg | `#0b0a08` | modals |
| Primary text | `#f7f2e8` | headings |
| Body text | `#d8d0c2` / `#9b9382` | copy |
| Muted text | `#8d764a` (warm) / `#635c54` (cool) | labels, meta |
| Gold accent (bright) | `#e6cd92` | highlights, prices |
| Gold accent (mid) | `#c9a961` | buttons, borders |
| Gold gradient | `linear-gradient(135deg,#e6cd92,#c9a961)` | primary buttons |
| Gold gradient (logo/avatars) | `linear-gradient(135deg,#e6cd92,#8d764a)` | avatars |
| Success / winner green | `#4fe0a8` | winner badges, checks |
| Border subtle | `rgba(255,255,255,0.06–0.08)` | card borders |
| Border gold | `rgba(201,169,97,0.18–0.4)` | accent borders |

Status/result color helper (`libResult(roas)`): Winner (ROAS ≥ ~3.5) green `#4fe0a8`; Test (mid) gold `#e6cd92`; Loser (low) muted/red. Each returns `{label, color, bg, border, roasColor}`.

### Typography
- **Display / headings**: `Fraunces` (serif), weights 400/500/600. Screen titles ~33px/600; card titles 19px/600.
- **Body / UI**: `Hanken Grotesk`, weights 400–800. Body 12.5–14px.
- **Mono / labels / metrics**: `JetBrains Mono`, weights 400–600. Kicker labels 9.5–10px, letter-spacing 0.1–0.2em, uppercase.
- Google Fonts import: `Fraunces:opsz,wght@9..144,400;500;600` + `Hanken Grotesk:400;500;600;700;800` + `JetBrains Mono:400;500;600`.

### Radius & shadow
- Radius: cards 14–16px, modals 18–20px, tiles/inputs 10–13px, pills 20px, small squares 9px.
- Modal shadow: `0 50px 140px rgba(0,0,0,0.7)`.

### Animations (keyframes)
- `toastIn` (translateY 14px + fade), `overlayIn` (fade), `modalIn` (translateY 18px + scale 0.98 → 1, `cubic-bezier(0.16,1,0.3,1)`), `panelIn` (translateX 100%→0 for the right-side iterate panel), `genShimmer` + `.genskel` skeleton loader, `genPulse`, `genUp` (staggered result reveal), `genSpin`.

### Image placeholders
The prototype uses `.adthumb` (dark gold-tinted gradient box) with a giant faint serif label `.adname` for all imagery. In production these become **real image slots / uploads** (see Producten).

---

## Screens

### 1. Dashboard
Command-center. Top: greeting + quick actions. Below: dense grid.
- **Stat cards**: producten, persona's, concepten, scripts counts.
- **Top producten** & **Top invalshoeken** — ranked lists; **clicking a row opens a detail modal** (kicker, name, stats, distribution bars, best-performing ads).
- **Team podium** (leaderboard, most active member) — **clicking a member opens a full detail modal**: full ranking left, rich profile right (ads this month, trend, ROAS), switchable.
- **Leaderboard beste ROAS**, **Recent bewaarde concepten** (image showcase of a top concept).
- All tiles are interactive; clicks open modals or navigate.

### 2. Nieuwe ad (Generator)
Vertical guided flow. Config at top, **formats span full width in a grid**, **4 variations at the bottom** full-width.
- **Brain-dump hero** (full width): free-text brief to Rory + AI suggestion line.
- **Three config cards**: Product, Plaatsing (placement), Beeld-referentie (image reference).
- **Step 1 · Format**: 42 formats in **5 categories** (A Product-led, B Social proof, C Vergelijking/educatie, D Native/lo-fi, E Editorial/advertorial). Each tile has an **"i" info icon** → modal with **WAT HET IS** / **HOE JE HET GEBRUIKT** / **BOUWBLOKKEN** (from the Formats & Angles reference doc).
- **Step 2 · Doelgroep & funnel**: Persona, Funnel (TOF/MOF/BOF), and **Awareness level** (Schwartz: Unaware → Probleembewust → Oplossingsbewust → Productbewust → Meest bewust).
- **Step 3 · Angle**: **Angle-type** cards (8, each with info icon → message-template modal) + **Sophistication stage** selector.
- **Static checklist strip** (toggleable checks) before the generate button.
- **Generate** → skeleton loaders (~2.7s) → **4 variation cards** with headline, format badge, hook badge, sophistication badge, predicted metrics, and actions (save, iterate).
- Steps are collapsible; only relevant step open at a time (`gen.open`).

### 3. Kopieer ad
- **Upload/dump** the source ad: image upload/drag, **paste screenshot (Cmd+V)**, or **paste Meta Ads Library link**.
- **Analyze** (Rory) → detected: format + category, awareness + angle-type, hook pattern, "why it works" paragraph.
- **Fidelity selector**: 3 levels — kloon / variant / inspiratie.
- **Generate** → same 4-variation output as the generator.

### 4. Itereren
For iterating proven winners.
- **Winner dump**: tabbed asset types — **video / static image / script** upload.
- **Performance matrix**: manual entry OR screenshot upload. **Mirrors a real Meta Ads Manager export** — ad name + period header + **5 metric categories** (see schema below), prefilled with sample winner "WS-160-1".
- **Rory analyzes** → **stepwise iteration**: AI walks through axes step-by-step, user picks directions per step (auto-advances; shows "Rory reageert" confirmation).
- **Generate** → 4 new variations.

**Itereren metric schema** (the shape the Meta API must fill — sample values shown):
```
adName: 'WS - 160 - 1', period: 'Laatste 30 dagen (2-31 mei 2026)'
metrics: {
  spend, aov, roas, impressies, cpm,
  linkClicks, clicksOutbound, ctrLink, ctrOutbound, cpcLink, cpcOutbound,
  follows, comments, postEng, engPct, reactions, shares, seeMore,
  clickQuality, clickToAtc, clickToPurchase, atcToPurchase,
  purchases, purchaseValue, cpa, atc, atcValue, lpv
}
```
Grouped in UI as: PERFORMANCE / CLICKS & CTR / ENGAGEMENT / FUNNEL / CONVERSIES (5 categories, ~28 fields).

### 5. Ad transformer
- **Upload image** (packshot / lifestyle-UGC / meme-trend).
- **Rory's reading** of the image: subject & objects, emotional hook / what it evokes, brand & product fit (Wellgroup style), quality/usability for ads.
- **Detected context** (product, funnel) — editable by user.
- **Summary**: which customer personas to target **and why**, plus which marketing channels.
- **3 directions** → **handoff button prefills the generator brief** and navigates to Nieuwe ad.

### 6. Customer Persona's (the foundation)
Master-detail layout: **persona list left, detail right**.
- **Niche filter** (`pNiche`): Body Groomer / Baardtrimmer / Skincare / Scheren / Lady Shave etc.
- **Per persona**: full demographics (name, alias, age, role, niche, etc.), and structured content: **Desires, Objections, Pain Points, Failed Alternatives, Benefits**.
- **5 Schwartz awareness stages** (pills), and **per stage 5 marketing angles**. Each angle card shows: the **emotion/trigger** it hits, **angle name + one-line pitch**, and the **objection it removes**.
- Angle cards have a **"→ Nieuwe ad"** action that prefills the generator brief with the persona + angle.
- Persona data lives in a method returning an array; each persona `{ name, alias, initial, age, role, niche, ... , stages:[{ angles:[{ n, p, ... }] }] }`.

### 7. Bibliotheek
- **Rory's dagelijkse check** (top): live Meta connection status, account stats, **recommendation cards** (overview cards + direct-action buttons to iterate/copy/new). This is the live-agent surface.
- **Tabs**: Advertenties / Scripts (browse separately).
- **Filters**: by product, by status (active/paused), search by name.
- **Item cards**: thumbnail, name, **auto Winner/Loser/Test label** (ROAS threshold), metrics (ROAS, CTR, CPA, spend/revenue, CPM).
- **Click item → full detail modal** with **complete traceability**: Product, Customer persona, Marketing angle, Awareness & sophistication level, Hook pattern, Format, creation date + by whom, Source (generator / copy / transformer / iteration).

### 8. Producten (the source catalog)
- **Grid** of product cards (filterable by niche). Card: packshot placeholder, niche label, "★ HELD" badge for hero products, price, selling line, ad count · persona count, best ROAS.
- **Click → full product detail modal**:
  - **Beeldmateriaal** — 3 groups (**Packshots wit / Packshots sfeer / Lifestyle in gebruik**), each a grid supporting **multiple photos** + "foto toevoegen" slot. (In production: real multi-upload, persisted.)
  - **Unique Selling Points** — numbered list + "＋ USP toevoegen".
  - **Features** — icon + name + description grid + "＋ feature toevoegen".
  - **Wellgroup vs. de rest** — us-vs-them, two columns (checks vs crosses).
  - **Gekoppelde customer persona's** — clickable chips linking to the persona detail screen (niche-matched, e.g. a beard trimmer links to the beard persona).
  - **Garantie & social proof** — reviews, returns, endorsements.
  - **Best presterende ads** — clickable → Bibliotheek.
  - **Actions**: "Maak advertentie met dit product" (→ generator) and "Zoek ads →" (→ bibliotheek).
- Product data: `{ id, tag, name, niche, price, hero, rating, reviews, sell, usps[], features[{icon,name,desc}], vsUs[], vsThem[], personaIdx[], proof[{icon,text}], bestAdIds[] }`.

---

## Interactions & Behavior (global)
- **Navigation**: `setNav(key)` switches the active screen (single-page, state-driven). Non-screen nav items show a toast.
- **Toast**: bottom-center, auto-dismiss ~2.6s (`toastIn`).
- **Modals**: overlay `rgba(3,2,1,0.8)` + `backdrop-filter:blur(4–5px)`; click overlay to close, inner click stops propagation; `modalIn` entrance. Close "✕" top-right (32×32 rounded square).
- **Right-side panel** (iterate on a concept): slides in with `panelIn`.
- **AI "analyze"/"generate" flows**: set `analyzing:true` → skeleton (`.genskel`) → after timeout set `analyzed/generated:true` and reveal results with staggered `genUp`.
- **Hover states**: cards lift (`translateY(-2px)`) and border goes gold (`rgba(201,169,97,0.35–0.6)`).
- **Cross-screen handoffs** prefill target state (e.g. transformer/persona/product → generator brief; product → bibliotheek).

## State Management
Single root component state object. Key slices:
- `nav` — active screen.
- `toast`, `modal`, `panel`, `libDetail`, `prodDetail`, `fmtInfo`, `angInfo`, `team`, `insight` — overlay/selection state.
- `pSel`, `pStage`, `pNiche` — persona selection.
- `copy`, `gen`, `iter`, `transformer`, `lib`, `prodNiche` — per-screen working state (see full `state = {...}` in the source, lines ~2056–2063).

In a real build: lift each screen's working state into its own store slice / context; the AI flows become async API calls (replace the `setTimeout` fakes); persist library, products, and personas server-side.

## Data that must come from a backend / DB
- **Products** catalog (+ uploaded reference images).
- **Personas** (with awareness stages & angles).
- **Format & angle library** (42 formats, 5 categories, message templates — from the Formats & Angles reference doc).
- **Library items** (ads + scripts) with full provenance + live Meta metrics.
- **Meta Ads live data** (daily job) + AI recommendations.

## Assets
No external image assets — all imagery is placeholder (`.adthumb`/`.adname`). Icons are Unicode/emoji glyphs in the prototype; **replace with a proper icon set** (e.g. Lucide/Phosphor) in production. Fonts: Fraunces, Hanken Grotesk, JetBrains Mono (Google Fonts).

## Files in this bundle
- `Dashboard Interactief.dc.html` — the source design (all screens + logic). Primary reference for layout, copy, and interaction logic.
- `Dashboard Interactief - standalone.html` — self-contained, **open this in any browser** to click through the live prototype.
- `support.js` — the prototype runtime (reference only; **do not port**).
- `README.md` — this document.

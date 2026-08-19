---
name: sanwarwala-landing-pages
description: Build, audit, write or spec high-converting landing pages, sales pages and e-commerce product pages. PRIMARY USE — building NEW landing pages from an existing ad creative or marketing message, so the page continues the exact promise, hook, tone and visual language of the ad that earned the click ("the post-click matters more than the pre-click"); one page per creative-angle, matched to how direct the ad is. Also audits existing pages. Primary lens is Arsh Sanwarwala (ThrillX) — 400+ pages built, 1,500+ audited, pages converting 15-20% on cold traffic — extended with Mark (Brand Builder Academy) on DTC sales pages, offers and market sophistication, and Daniel Priestley on scorecard/assessment lead-gen. Covers the psychology (Life Force 8, halo effect, cognitive load, labor illusion, loss aversion, believability), lead-gen page anatomy, e-commerce PDP anatomy, offer structure, the copy-first-design-second workflow, research methods (review mining, user testing, Clarity heat/scroll maps) and the CRO/AB-testing playbook. ALWAYS use this skill when the user wants to create, improve, critique, score, restructure or spec ANY landing page, sales page, product page, PDP, opt-in page, funnel page, buy box or hero section — even if they never mention Arsh or CRO. Trigger on phrasings like "build a landing page", "bouw een landingspagina", "maak een salespagina", "write a hero headline", "schrijf een headline voor mijn pagina", "why isn't my landing page converting", "waarom converteert mijn productpagina niet", "audit this landing page", "review mijn landingspagina", "verbeter mijn productpagina", "which sections should my page have", "welke secties heeft mijn pagina nodig", "make a brief for Lovable/Claude Design", "hoe structureer ik mijn bundels", "improve my conversion rate on this page", "bouw een landingspagina bij deze advertentie", "build a landing page for this creative", "maak een pagina die aansluit op deze ad", "landingspagina voor deze Meta-campagne", "welke pagina hoort bij deze hoek", "page that matches this ad". Works for lead-gen, service, course, SaaS and e-commerce. Bilingual (English/Dutch): always reply in the user's language.
---
> **Spiegel — niet hier bewerken.** De bron staat in Wellshave/design onder
> `.claude/skills/sanwarwala-landing-pages/`. Wijzigingen daar maken en daarna
> `scripts/sync-skill.sh` draaien.


# High-Converting Landing Pages

Primary lens: **Arsh Sanwarwala** (ThrillX / The Relics) — conversion-rate-optimization agency,
400+ landing pages built, 1,500+ audited, dozens of AB tests per month for clients spending from
a few thousand to several million per month on ads. Direct, opinionated, data-first.

Two supporting lenses, used where they add something Arsh doesn't cover:

- **Mark** (Brand Builder Academy) — DTC e-commerce sales pages, offer structure, market
  sophistication, funnel/traffic matching. Running ads since 2018, thousands of split tests.
- **Daniel Priestley** — scorecard/assessment funnels for lead generation. *Note: he
  co-founded ScoreApp, the software his method runs on — weigh the advice accordingly.*

Reply in the user's language (Dutch → Dutch, English → English).

**Never invent principles.** Everything you assert must trace back to the knowledge base (see
bottom). When something isn't covered there, say so and label your reasoning as your own.

## Read this first when the work is for Wellshave

If the page, product or brand is Wellshave, **read `references/wellshave-merklaag.md` in this
skill's folder before writing any copy or CSS.** It is the brand's design system, not a log of
one project: the exact colour, type, shape and gradient tokens; the two-beat headline device
that carries the brand; button, card and section-rhythm rules; how much motion is allowed and
how to switch it off; when to use own photography versus generate an image, and the line
between illustrating and fabricating proof; the three-card offer pattern; and the technical
rules that keep it from breaking.

Do not derive Wellshave styling from the live site by eye and do not invent a palette. The
tokens in that file are copied from the real site, and using them is the difference between a
page that belongs to the brand and one that reads as a generic AI template. For any other
brand, ignore that file and follow the general guidance below.

---

## The one rule everything hangs on

**Copy first. Design second. Always.**

Most businesses and agencies design first and treat messaging as an afterthought — a template,
a competitor clone, or raw LLM output. That is backwards and it is why most pages sit at 1-2%.

Write the messaging first, then build a design that is *strategically wrapped around what that
copy is trying to say*. A layout is an argument, not decoration. Copy says "multiple
transformations at scale" → scrolling before/afters. Copy says "family-run, no subcontractors"
→ show the actual team. Copy says "here's your income progression" → a progression graphic,
not stock-image-beside-text.

Mark's version of the same rule: **every element must have a purpose.** If someone points at
anything on your page and you can't say why it's there, the page isn't finished.

Corollary: AI does not write high-converting copy out of the box and has no strategic context
for design. Generate raw variations with it, then judge and rewrite by hand.

---

## Mode selection

| Mode | Trigger | Output |
|---|---|---|
| **BUILD** | "build/make a landing page for X" | Full page: structure + copy + design rationale + build brief |
| **AUDIT** | "why isn't this converting", a URL, a screenshot | Scored teardown + prioritized fixes + test queue |
| **COPY** | "write headlines / CTA / proof copy" | Headline sets with the formula shown per line |
| **SPEC** | "wireframe / design spec / brief for Lovable" | Layout + hierarchy + component spec |

First decide which **page type** you're working on — the anatomy differs:

- **Lead-gen / service / course landing page** → Part 3
- **E-commerce product page (PDP) or sales page** → Part 4
- **Assessment / scorecard funnel** → Part 5.3

**The most common job here is BUILD from an existing ad creative** — the marketing message
already exists and the page has to continue it. That workflow is Part 0; start there.

---

## Part 0 — From ad creative to landing page

This is the default workflow: creatives and a marketing message already exist (often from the
Theriot creative work or a Meta campaign), and the page must be the second half of that
conversation.

**The governing principle — the post-click matters more than the pre-click.** The ad gets the
click; the page is where the selling actually happens. The page must mirror the *exact*
messaging, tone, copy and design of the ad. A single small disconnect throws visitors off and
they leave. Arsh's most-seen mistake, every day, on both Google and Meta: **what got the click
is not congruent with the page.** His example — an ad promising a specific weight loss in a
specific timeframe, landing on a page headlined with a generic brand slogan. The promise that
earned the click is nowhere above the fold, which is the one section 100% of people see and
50-60% never scroll past.

So: whatever the ad promises, that promise appears above the fold, in the ad's own words.

### Intake — pull these out of the creative before writing anything

1. **The promise.** What exactly did the ad claim? Verbatim. This becomes the spine of the
   headline; do not paraphrase it into something blander.
2. **The hook.** The first three seconds or the first line. The page's opening should feel like
   the next beat of it, not a topic change.
3. **The angle / avatar.** Which desire and which person is this creative aimed at? A page
   serving three angles at once serves none.
4. **Visual language.** Colours, faces, product framing, typography, and the *specific* footage
   or image the ad used. Seeing the same visual on arrival is the fastest possible proof they
   are in the right place.
5. **Directness (Mark).** How direct is the ad?
   - *Direct* — UGC, offer-heavy statics → send straight to the sales page or PDP.
   - *Indirect* — native statics with long copy, long-form VSL → these get cheap clicks and high
     CTR but need an advertorial, listicle or quiz **before** the sales page. Sending indirect
     traffic straight to a sales page and then blaming the page is diagnosing the wrong problem.
6. **Awareness and sophistication.** What has this audience already tried? In a stage 4-5 market
   the mechanism and the "without [what they've tried]" framing carry the page.

### Then build

- **One page per creative-angle, not one page for the campaign.** Arsh segments down to audience
  level and builds separate pages per audience, per offer, per ad creative. Almost nobody does
  it because it is laborious; it produces the best results. If three creatives run three
  different angles, that is three pages — the same skeleton, different spine.
- **Meta traffic is cold and interruption-based**, so section 2 is the pain point (see 3.4) —
  unless the creative already did that job, in which case go to proof.
- **Strip the navigation.** On a paid page every nav link is an exit. The goal is one action.
- **Close the loop.** Winning page tests feed back into ad creative and vice versa; a headline
  that wins on the page is a hook worth testing in the ad.

### Deliverable

Finish with a build brief that a builder can execute without the conversation: numbered
sections, final copy, component notes, image direction, mobile stacking order at 390px, and the
first three AB tests. Then hand it to Claude Code, Claude Design or Lovable.

---

## Part 1 — Research before writing a word

Never write copy from imagination. In order of value:

1. **Discovery call with the owner (1 hour).** Onboarding form (8-10 questions) first, then
   probe and *challenge their assumptions* on the call. Owners routinely dismiss their best
   value props as unremarkable — "we reply within 15 minutes" is headline-worthy when the
   industry standard is three days. Take notes by hand while re-watching the recording; AI
   note-taking misses tonality. Better notes = better copy. Ask about: demographic, what
   triggers someone to reach out, the status quo and what they already tried, awareness level,
   objections, what makes a good vs bad provider, and the brand in three words.
2. **Review mining.** Every review (Google, Trustpilot, Amazon) into an LLM; ask for the most
   frequent words and topics. Re-inject that exact language.
3. **Reddit / forums.** How people talk about the problem unfiltered.
4. **User testing (Userbrain or similar).** Screen for your real demographic. Ask: first
   impressions on landing? Find this specific thing while thinking aloud. Describe the page in
   three words.
5. **Customer interviews.** ~$50 gift card for an hour. Typical day, priorities, financial
   situation, how they decide.
6. **Session recordings (Microsoft Clarity, free).** Watch 100+. Note 10-15 second pauses,
   what's skipped, the path before converting, where people rage-exit.
7. **Ad-platform demographics.** Find the most profitable segment, research how it buys, shift
   positioning toward it.

**Mark's correction on FAQ research — survivorship bias.** Most people mine ad comments for
objections. Those commenters largely never buy. Ask *buyers* "what almost stopped you from
buying?" — that's where the real objections are. (His analogy: armour the parts of the returning
bombers with *no* bullet holes.)

**Objections are usually smokescreens.** People say price and timing. The real objection is
that they can't see a clear path from their problem to your solution. Make the path visible and
price stops mattering — unless they genuinely can't afford it.

**The page is your sales call.** On a good call you don't jump to the solution; you show you
understand the problem first. Replicate that sequence.

---

## Part 2 — Define the offer properly

The offer is not the end result. That's just the output.

**Offer = end result + every inner working that produces it.** A machine: the end result is
what it spits out, the offer is all the gears. Weekly accountability calls. Certified coaches.
Done-for-you meal planning. 1-week free trial. Satisfaction guarantee. 4,000+ people already
got results. Only 4 hours a week.

**Every one of those is a separate reason to buy.** List as many unique, non-repetitive items
as possible. That list *is* your content outline — every value prop section plugs from it.

This also fires the **labor illusion** (Harvard: the flight-comparison site that showed its
work outperformed the instant one at identical prices). Visible effort raises perceived value
and dissolves much of the price objection.

---

## Part 3 — Lead-gen page anatomy

Section types in order:

1. **Hero / above the fold**
2. **Pain point** *or* **social proof** (choice rule below)
3. **Social proof** — 2-4 across the page
4. **Value props / USPs** — 4-8
5. **How it works**
6. **FUD reduction + FAQ** — 1-2
7. **Closer** — a mini above-the-fold

### 3.1 Above the fold — make or break

100% see it. **50-60% never scroll past.** Opinion forms in **50 milliseconds** (halo effect);
stay-or-leave inside **5 seconds**. Spend 80-90% of your effort here.

Required, all fitting above the fold on desktop *and* stacked on mobile:

- **Headline** — the dream outcome / what's in it for me
- **Sub-headline** — how you achieve it
- **Social proof ×2**
- **One CTA** (1-2 on the whole page)
- **FUD reducers directly under the CTA** — guarantee, warranty, "no subcontractors",
  transparent pricing, "reply within 15 minutes"
- **Image or video** showing the thing they get or the outcome they want

Never lead with who you are. Lead with the core promise.

**Dead zones.** Wasted white space that pushes everything below the fold is a conversion leak.
Treat every section as asking permission to keep scrolling — maximise information shown without
overwhelming. Compare a page with a sparse hero against one that fits headline, sub-headline,
proof, CTA, FUDs and image in the same space; the dense one wins.

### 3.2 Headline formula

**End result + time period + emotional payoff.**

- *End result*: what they functionally achieve. Quantify.
- *Time period*: if applicable. Make the gap feel as short as honest — "from the very first
  session" beats "this week" beats "within 6 weeks".
- *Emotional payoff*: how they feel once they get it.

Hit **both sides of the brain**: the logical core desire and the emotional state underneath.

Multipliers:

- **Hyper-specificity.** Numbers are the thing people trust most. Not "make more money" → the
  exact profit figure. Not "trusted by thousands" → "50,400 happy customers". Not "increase
  revenue" → "increase revenue by 185%".
- **Borrowed language.** The customer's own words. Cosmetic dentistry → people hide their smile
  in photos and on Zoom → "Finally feel confident showing off your smile." Pool fencing →
  parents warning parents → "Protect your kids. Don't wait until it's too late." (*Protect* is
  active and visceral; "peace of mind" is not.)

**Mark's variant for DTC:** *outcome + timeframe + mechanism*. The mechanism answers why this
works when everything they've tried failed. And his 7-point headline checklist — curiosity,
pain point, promised solution, timeframe, specificity, simplicity, credibility. You don't need
all seven; aim for **at least four**, and you can hit one of them more than once.

**Clear beats clever.** A confused mind never buys. Clever copy that needs decoding loses to
plain copy that lands instantly.

### 3.3 Sub-headline

Adds the mechanism the headline earned. Pattern: **"Tired of [pain]? [Solution] does X"** plus
the 3-4 value props that make the headline achievable. A promise without a mechanism doesn't
convert.

**In sophisticated markets, use "without".** "[Outcome] without [the three things they've
already tried, in order of actual frequency]." Get the order from research, not from one Reddit
comment.

### 3.4 Second section: pain point or social proof?

Decide on **traffic temperature and offer complexity**:

- **Google Ads / high intent / simple offer** → **social proof**. They already searched; they
  need trust, not education. You can also put the form above the fold.
- **Meta Ads / interruption-based / cold, or a complex offer** → **pain point**. They didn't go
  looking for you; they need a reason to care today.

The more expensive the offer, the more education and value props are needed to justify it.

### 3.5 Pain point section — two executions

- **Graphical**: before/after with downsides overlaid on "before", functional benefits on
  "after". Best for transformational, visual offers.
- **Sales letter**: long-form using **Problem → Agitate → Solve**. Call out the problem, agitate
  what they're missing because of it, then the solution. Best for complex or emotionally deep
  offers.

Example of the structure working: a horse-coaching client where research showed 85% of buyers
came from a *failed previous course*. The section addressed why their last method failed
instead of explaining the program. **66% lift.**

### 3.6 Social proof — believability is the whole game

Trust is at an all-time low and everyone uses social proof, so generic proof now reads as noise.
It is **not about more proof, it's about more of the right proof.**

**The believability ladder** (each rung beats the one before):

text review < text + image of the actual result < + full name and photo < + the visible source
of the review < + a story of what the result did for them < video of them saying it

Authority logos work the same way: logos < logos + the actual quote the publication ran.

Image-plus-text proof alone has produced **60-80% lifts** across dozens of niches.

Other rules:

- **Wall of love, shown up front.** Never hide proof in a carousel — 1-2% click to slide two.
  On mobile, stack vertically and let them scroll past all of it. Volume works even unread.
- **Never use these headlines**: "Our testimonials", "Our reviews", "See what our customers
  say", "Real people, real results". They already know they're looking at reviews.
- **Instead**: "Join [number] [specific group] who [specific benefit]."
- **Video reviews need a scannable headline** summarizing the review, or nobody presses play.
- More is not automatically better — a single testimonial has beaten multiple in testing.
- **Match the demographic.** Faces in proof should match the target avatar in age, gender and
  ethnicity. Mismatched models quietly break believability.
- Proof should be **intentional**: pick reviews that overcome a specific objection or seed a
  specific belief.

### 3.7 Value prop sections

1. **Feature + benefit via the "so that" chain.** Keep asking "so that…" until you reach
   something human. Bypass spam filters *so that* more emails land *so that* you book more
   meetings *so that* you close more deals. Then **front-load the benefit** — swap the order so
   the benefit leads.
2. **Assume they read nothing but headlines.** People read ~20% of the content and scan the
   other 80%. Every value-prop headline must sell alone.

Design: image-beside-text works and is familiar, but the wins come from layouts built around
the specific claim — a progression graphic for income potential, an exercise grid for a flexible
schedule, a mock profile for "you after our program".

### 3.8 How it works

Show A → B and make results feel effortless. **Every step headline carries a benefit** — "Get
your free estimate → We create your plan → We start scheduled treatment → Sit back and enjoy a
great lawn", never "Step 1, 2, 3". The section headline sells too: "Get the lawn you've always
wanted in four simple steps".

### 3.9 FUD reduction + FAQ

Guarantee, warranty, return policy, FAQ dropdowns. Low on the page, after the value props, when
the remaining hesitation needs one nudge.

### 3.10 Closer

A mini above-the-fold: recap headline, sub-headline, CTA, social proof, form or pricing. Anyone
who scrolled this far has a lingering doubt and needs a reason to act today.

---

## Part 4 — E-commerce product page anatomy

**PDP vs sales page** (Mark's distinction): a PDP is the templated Shopify page applied across
products — limited control. A sales page is custom-built (Replo, GemPages, hand-coded) and lets
you control the justification for far longer before revealing price. He prefers sales pages for
exactly that reason; most of the guidance applies to both.

**The purpose is not to sell the product. It's to sell the outcome** — deeper than features,
deeper than benefits: the emotional state after the benefits land.

### 4.1 Above the fold — density wins

50-60% never scroll past. The common e-commerce mistake is vast empty white space. Fit as much
as possible without overwhelming: reviews/proof, product title, description, price, product
thumbnails, variant selectors, add-to-cart, and a sliver of the next section to signal there's
more.

A test that shrank an oversized awards/logo band to a compact scrolling bar — freeing room for
social proof, title, returns policy, image and description above the fold — produced a
**+18.7% conversion lift at 99% confidence.**

### 4.2 Product images carry the sale

Most brands show the same product from different angles. That communicates nothing. **Assume
someone buys from the images alone, having read no body text** — the images must carry the
value proposition.

Mark's carousel cadence (a starting point, not a law):

1. **Hero shot** — clear what the product is
2. **Transformation / before-after** — nothing sells like a before-after; run more than one if
   they attack different pain points
3. **Objection handler** — pre-empt the number one objection before it becomes conscious, and
   list every specific sub-problem ("does it work for *my* situation?" — everyone believes they
   are the exception)
4. **Research / mechanism / comparison** — why this works when the alternatives failed
5. **Risk reversal**
6. **Social proof / testimonial collage** — there is no such thing as too much proof

Also: **expose the thumbnails** instead of pagination dots so people actually click through, and
add a corner tag ("Best seller", "Most popular", "New") to ease the decision.

### 4.3 Description

Big text blocks get skipped. Replace with **value-prop icons** — scannable, benefit-driven.
One such test produced **+25% conversion and +16% revenue per visitor**. Show the savings
amount explicitly so nobody does mental arithmetic.

### 4.4 Buy box

- **Give every choice its own line** — bundle, size, colour, warranty, add-ons. Cramming them
  together to save space reads as clutter.
- **Use guiding verbs**: "Choose your kit", "Choose your warranty", "Complete your kit". It
  makes the user feel they're moving through a process, which raises completion.
- **Bundles drive AOV** — multiples of one product, or cross-sell bundles.
- **Show the saving on every option**, including the single unit. One test kept prices identical
  and only added/re-expressed the savings: **+11.74% conversions**.
- **Paradox of choice is real.** Cutting bundle options from five to three produced **+53%
  conversions, +13.5% AOV** — more people bought *and* they bought bigger.
- **Tags on options** ("Recommended", "For faster results") steer the selection.

**Mark on offer structure:** quantity breaks where more units means a bigger discount; one
option flagged most popular; a **decoy** priced close to the top tier to make the top tier feel
obvious. And every free gift must **overcome an objection or get them to the outcome faster or
easier** — gifts thrown in at random add nothing.

### 4.5 Around the add-to-cart

- **FUD reducers directly under the button** — returns window, money-back guarantee, warranty,
  shipping. Proximity to the point of action is what matters. One test: **+16% conversions,
  +16% revenue per visitor.**
- **Dropdowns under the button** answering the real anxieties (how fast will I see results, is
  it safe, how do I use it, what's in it).
- **Social proof near the cart button.** UGC, video carousels, units sold. One brand's
  cumulative tests here produced **80%+ lift**, with the video carousel alone worth **+30%** —
  and it sat *above* the product image, which most people assume can't work. Test it.

### 4.6 Below the fold — don't stop at reviews

Most brands put product info at the top, a reviews block underneath, and stop. That's a large
miss: conversion often takes multiple visits, and cold traffic knows nothing about you. Keep
going with more proof, more benefits, more value props, use cases, comparisons, guarantee, then
reviews. Expanding a bare page into a full experience produced **+43%**. Use a **sticky
add-to-cart** so interest can be acted on anywhere.

**Mark's addition:** interleave social proof *between* educational sections — the education
stretch is where you lose people, so seed proof through it. And a **comparison table** (us vs
them) matters more the more sophisticated the market.

---

## Part 5 — Conversion mechanics

### 5.1 Forms

- **Pop-up form is the default.** Clicking the CTA blacks out the background and puts all focus
  on the form. Consistently outperforms alternatives — instant feedback, no page load, nothing
  else to look at.
- **Separate form page** for high-ticket B2B, where you need room for proof and reassurance.
- **Scroll-to-form** works too: changing a button from "Book a call" to "Learn more" which
  scrolls to the form produced **+200%**.
- **Every 1-2 extra fields costs 10-25%.** Merge first+last into full name. Drop company name
  (it's in the email domain). Collect only what you need.
- **Order fields low-friction → high-friction.** Name and email first; phone and address last.
- **The form headline must never repeat the button label.** "Contact us" under a Contact button
  is dead space. Carry the page's core promise into it.
- **Add proof and a FUD-reducer to the form itself** — worth ~20% on completion.
- **Progressive disclosure**: ask for one easy thing first (email or first name), then reveal
  the rest. Having completed one action, people are far more likely to complete the next.
- **The contact section deserves the same rigour as the hero**: benefit-driven headline, 3-5
  selling points, an explicit description of *what happens next*, and proof at the point of
  entry.

### 5.2 Quiz / multi-step flows

The job of a quiz is to make people feel constant progress.

- Always show a progress bar; never expose "step 3 of 14".
- **Never start the bar at 0% — start at 25-30%.** Zero makes the task feel enormous.
- Benefit-driven headline inside the flow, not "Fill out this form".
- Icons for options — faster to process, feels interactive.
- Gamify: micro-animations, progress celebrations.
- **Blurred preview of the result** before completion creates the sense of unlocking something.

**Arsh's caveat:** quiz funnels often produce *cheap but low-quality* leads. People fill them
expecting a result, not a sales conversation — spam rates around 19-25%, prospects who don't
remember opting in, sales teams calling people who feel ambushed. A dedicated landing page
produces fewer, better, higher-intent leads because people know what they signed up for. In a
real head-to-head on a virtual therapy business, the landing page had a higher cost per lead but
**zero spam** and materially better lead quality.

### 5.3 Scorecard / assessment funnels (Priestley)

A different animal from both: the assessment *is* the lead magnet.

**Landing page structure:**

- **Hook**, one of two kinds:
  - *Frustration hook* — "Frustrated that [X] even though you [do the right thing]?"
  - *Readiness hook* — "Are you ready to [result]?" (people who aren't sure take the test to
    find out)
- **Sub-heading** directs to the assessment: answer ~15 questions to find out why, and what to
  do about it
- **Value proposition** — we'll measure and improve these three specific areas
- **Credibility** — who built this, their background, the research behind it
- **CTA** — start the quiz, takes ~3 minutes, free, immediate recommendations

Benchmark: **20-40% of landing page visitors start the quiz** when this is right.

**Question structure:** name and email required, location from IP, phone optional. Then **10
best-practice questions** (are they doing the ten things they should be?) which generate the
score, then **5 qualifying questions**: current situation; desired outcome in the next 90 days;
biggest obstacle or what they've already tried; which solution type suits them (this implies
budget — a book is a different buyer than done-for-you); and an open box ("anything else we
should know?") which routinely surfaces the single most useful sales fact.

**Dynamic results page:** the big reveal (score/gauge), three insights, then next steps that
differ by qualification — a one-to-one meeting for the highly qualified, a group event for the
middle, content for those who aren't a fit.

### 5.4 Buy sections for courses / digital products

Bonus stack with original values struck out and shown free. Two tiers (quarterly vs annual)
with annual framed as the saving. Benefit-driven headline answering "why buy today". 3-8 bullets
of stacked value. Testimonials. Guarantee above the buy section. Then optimize the checkout the
same way.

---

## Part 6 — The psychological principles

1. **Sell the core desire, not the outcome.** Outcomes say what they get and skip *why they
   want it*. More money → security and peace of mind. Weight loss → feeling attractive again,
   or playing with your kids in twenty years. **Life Force 8** (Drew Whitman), the eight
   biologically wired desires:
   1. Care and protection of loved ones
   2. Freedom from fear, pain and danger
   3. Social approval
   4. Superiority, winning, status
   5. Sexual companionship / feeling desired
   6. Comfortable living
   7. Survival, enjoyment of life, longevity
   8. Enjoyment of food and drink

   Pool fence → "Protect your kids" (1) + "Don't wait until it's too late" (2).
   Lawn care → "Get a lawn your neighbours will envy" (3).

2. **Cognitive fluency.** The easier something is to process, the more it's trusted. Jargon and
   long paragraphs make people trust you *less* even when the claims are solid. Write so a
   12-year-old understands it.

3. **Labor illusion.** Visible effort raises perceived value. Spell out what's included.

4. **Loss aversion.** Losing feels roughly twice as bad as winning feels good. Show what they
   lose by not acting, not only what they gain.

5. **Halo effect.** 50ms first impression, 5s stay-or-leave. Clean layout, breathing room,
   clear hierarchy, consistent type and colour.

Plus the two that govern everything:

- **Emotion first, logic second.** People buy emotionally and justify logically. The brain
  processes images ~60,000× faster than text.
- **Cognitive load / cognitive threshold.** Exceed it and people leave. Aim for cognitive ease:
  scannable headings, icons and bullets instead of text walls; remove anything not critical;
  strip navigation on paid-traffic pages; 1-2 CTAs; hierarchy through size, weight, colour.

**Market sophistication** (Mark, via Eugene Schwartz). Most markets are now stage 4-5: every
competitor already claims the outcome *and* has a mechanism, so you compete on the mechanism
itself and on pre-handling objections. This is why "without [what they've tried]" copy,
comparison tables and unique mechanisms carry so much weight — and why a page that would have
worked five years ago now reads as one more identical claim.

**Authority is not automatic.** Don't default to the doctor or the expert. In some markets there
is active resentment toward the institutional authority figure, and the credible voice is
someone who says "I tried everything and built my own way out". Research decides.

---

## Part 7 — Outdated advice to stop following

- **"Shorter pages always convert better."** Wrong. People read and scroll *if you give them a
  reason* — they read Reddit for hours and every review before choosing a dentist. A 3,000-word
  page with almost no CTAs produced $66 leads, 6.2% conversion and 6× ROAS, beating a VSL
  funnel. Length should scale with price, risk, trust required and traffic temperature. This is
  not permission to make pages hard to read — short paragraphs, clear sections, imagery.
- **"More social proof equals more trust."** Volume without believability is noise now. See the
  believability ladder.
- **"Ugly pages convert fine."** They convert *badly*. Design quality drives **lead quality**.
  A law firm targeting executives got ~900 leads/month at 12%, of which only ~9% were qualified,
  because the page didn't look like a firm that serves executives. Ugly pages hit a ceiling and
  rarely survive scale or high-ticket offers.
- **"A beautiful page is enough."** The opposite camp, equally wrong — gorgeous pages with
  neglected copy don't convert either. You need both: design builds trust, copy builds motivation.
- **"Follow best practices / copy your competitor."** If that worked everyone would convert at
  30%. Best practices have a ceiling; as you scale, CPL and CPA climb and lead quality drops.
  Not if, when. CRO is the only counter.
- **"Test button colours."** Only Google has the traffic to justify 200 shades of blue.

**Other hard truths:**

- **Revenue is the KPI, not conversion rate.** 30% conversion is worthless if 29 points of it is
  junk. Always ask how many leads were actually qualified.
- **Nobody cares what you do until they believe you can solve their problem.** Don't open with
  your process.
- **Say "you", never "we".** One SaaS founder went from 0 leads to 4 over a weekend, then 14 the
  next week, from two changes: fifth-grade reading level, and "we" → "you". Design untouched.
- **Segment.** Separate pages per audience, per offer, per ad creative. Almost nobody does it
  because it's laborious; it produces the best results.
- **Subtraction often beats addition** (Mark). More elements means a heavier, slower page and a
  higher cognitive load. Ask what you can remove, not only what you can add.

---

## Part 8 — CRO and testing

### Which regime are you in?

- **Traditional CRO (real AB tests):** needs ≥40-50k visitors/month to a single page and
  ≥300-400 conversions/month. Test small and controlled — one headline, one image, one CTA.
- **Non-traditional CRO (below that):** you can't reach significance in reasonable time. Make
  bold sweeping changes — headline + sub-headline + proof + CTA together — and measure over a
  few weeks. Lean much harder on qualitative data.

### The 80/20 priority order

1. **Above the fold — headline.** Always first: lowest effort, highest upside, and wins compound
   — once an angle wins, generate more variants of that angle.
2. **Above the fold — hero image/video.** Some clients spend the first 2-3 months on nothing but
   headline and image.
3. **The whole above-the-fold block** — proof formats, urgency, check-marks, form placement,
   single vs multi-step, navigation vs none, pain-led vs outcome-led.
4. **The first section below the fold** — the last chance to catch everyone who didn't convert
   up top. Choose from pain point / social proof / conversion action / value props.
5. **The conversion action** — form, quiz, buy box, checkout.
6. **Entirely new page versions** — highest risk, 30-60% lifts typical and 90-100%+ at the high
   end, in either direction. Start at **10% traffic allocation** and ramp as results hold. A
   month-6-to-12 move for high-traffic clients, not a starting move.

### Test hygiene

- Run **1-2 weeks minimum** to absorb daily and algorithmic fluctuation.
- Aim for **85-90% statistical significance**. 100% doesn't exist.
- Conversion rate swings daily — that's why you measure in a controlled split.
- **Extrapolate wins to a year.** A 6.3% → 7.1% lift looks small monthly and reads as ~4,300
  extra registrations annually.
- **Losing tests are as valuable as winners.** An image test that lifted video clicks 21% but
  conversions 1% proved the VSL was the problem, not the thumbnail. That insight beat a win.
- Roll winning insights outward — ad creative, emails, sales scripts, pre-call sequences.

### Reading the data

- **GA4** baselines: conversion rate, engagement time (**benchmark 35-45s**; 11s is a red flag),
  bounce (**target 30-50%**), most common device width (**390px** — design and test at that frame).
- **Microsoft Clarity** (free) for heat maps, area maps, scroll maps, recordings. Two questions:
  *are people clicking where I want, and scrolling where I want?* If not, reorganize.
- **CTA click-through target: 3-5%.**
- If a section people love sits at 50% scroll depth, move it up. If people click a
  non-clickable element, make it clickable.

---

## Part 9 — Where the sources disagree

Surface these rather than smoothing them over. Which side to take depends on the user's traffic,
scale and business model.

**Quiz funnels.** Arsh: often cheap leads of poor quality, high spam, low intent — prefers a
dedicated page. Priestley: an assessment is *the* lead-gen system, and the 15 questions are
exactly what makes leads qualified. Mark: a legitimate funnel type, correct when the traffic is
indirect. *Reconciliation that fits the evidence:* the quality problem Arsh describes comes from
quizzes used as a bait mechanic with no clear opt-in promise; Priestley's version qualifies
hard, sets expectations, and segments the follow-up. The design of the quiz decides which one
you get.

**Split-testing the page ads point at.** Arsh AB-tests the primary landing page continuously.
Mark refuses to test the first page Meta crawls — changing it disturbs optimization and can
corrupt both the test and the control; he launches new post IDs to a new URL with the same
creative instead, and only splits traffic on *downstream* pages. Worth flagging on any Meta-heavy
account.

**Primary metric.** Arsh: revenue and lead quality over conversion rate. Mark: **EPV (earnings
per view)**, or profit per view, because changes often trade conversion rate against AOV — a
variant can convert worse and still earn more. Mark's metric is the sharper instrument; the
underlying point is the same.

**CTA placement.** Arsh: a clear CTA above the fold, and the form early for high-intent traffic.
Mark: experiments with removing every CTA except the final one to force consumption and raise
perceived value before price appears — and says himself this is contrarian and still under test.
Treat as a hypothesis for cold, indirect traffic, not a default.

**Traffic matching (Mark, no counterpart in Arsh).** How direct the ad is should determine the
funnel. Native statics and long-form VSLs are indirect — cheap clicks, high CTR, naturally lower
conversion — and need an advertorial, listicle or quiz *before* the sales page. Sending indirect
traffic straight to a sales page and then blaming the page is diagnosing the wrong problem.

---

## Part 10 — Working modes

### BUILD

**If a creative or marketing message exists, run Part 0 first** — ask for the ad (copy, hook,
visual, angle) rather than starting from a blank brief. The page is the second half of that
conversation, and congruency with it outranks every other decision on this list.

1. **Intake.** From the creative: the promise, the hook, the angle/avatar, the visual language,
   how direct the ad is, and the awareness/sophistication level. Without a creative: what's
   sold, to whom, price, traffic source, conversion action. If the user won't be interviewed,
   state assumptions and proceed.
2. **Check the funnel match** before designing anything. Indirect ad → the sales page is the
   wrong next step; propose the advertorial/listicle/quiz in front of it.
3. Run the offer breakdown (Part 2) — output the full list of inner workings.
4. Write the copy top to bottom before any layout talk. The ad's promise, in the ad's own words,
   goes above the fold.
5. Pick the anatomy: lead-gen (Part 3), e-commerce (Part 4) or assessment (5.3). Choose section
   2 by traffic temperature and by what the creative already did.
6. Each section: headline, sub-headline/body, proof element, and **one line of design rationale
   explaining why this layout serves this copy**.
7. Close with a **build brief** — numbered sections with copy, component notes, image direction,
   mobile stacking order at 390px — ready to paste into Claude Code, Claude Design or Lovable.
8. Add the **test queue**: the first three things to AB test, in 80/20 order. On Meta-heavy
   accounts, flag the new-post-ID caveat from Part 9 before anyone tests on the live page.

### AUDIT

Score worst-first with the specific fix:

1. Above the fold — passes the 5-second test? All components present? Dead zones?
2. Headline — formula? Specific? Customer's language? ≥4 of the 7 checklist items?
3. Sub-headline — explains the *how*? Uses "without" if the market is sophisticated?
4. Social proof — where on the believability ladder? Carousel? Generic headline? Demographic match?
5. Section 2 — right choice for the traffic source? Is the traffic even matched to this page type?
6. Value props — feature+benefit? Benefit in the headline? Would headlines alone sell?
7. Cognitive load — text walls, too many CTAs, navigation on a paid page, no hierarchy?
8. Emotion — real people, or stock/AI slop?
9. FUD reduction — anything at the point of action?
10. Conversion action — field count and order, form headline, pop-up vs page; or for e-commerce:
    buy box lines, savings shown, option count, proof and FUDs around add-to-cart.
11. Below the fold — does the page stop at reviews?
12. Closer — present at all?

Then a prioritized fix list (impact × effort) and what to test first. Ground everything in
Clarity/GA4 data where available rather than opinion.

### COPY

Produce sets, not single lines. Show the formula breakdown per headline (end result / time /
emotional payoff, or outcome / timeframe / mechanism). Generate broad angles first — emotional,
anger, social proof, curiosity, loss-framed, hyper-specific-number — then shortlist. Kill vague
words in favour of visceral, active ones.

### SPEC

Section order, component inventory, visual hierarchy, image direction, mobile stacking,
breakpoints (design at 390px), what must fit above the fold. Flag if the existing copy can't
support the layout.

---

## Knowledge base

Transcripts live under
`/Users/dustingibson/Library/CloudStorage/GoogleDrive-dustin@wellshave.com/Mijn Drive/4. CLAUDE/YouTube-Kennis/`

- `arsh-sanwarwala/` — 61 of his 62 videos
- `Mark Builds Brands/` — DTC sales page template
- `Daniel Priestley/` — scorecard funnel

**Consult these for detail, exact wording and client examples before answering anything
specific.** Files are large single-paragraph markdown; read with
`fold -w 200 "<file>" | sed -n '<start>,<end>p'` and locate topics with `grep -n` on the folded
output. Do not use unbounded regex with `grep -oE` on these files — it backtracks badly.

Useful entry points in `arsh-sanwarwala/`:

- `02`, `17` — section-by-section anatomy
- `03`, `23` — copy-first workflow, offer definition (23 is the longest and most complete)
- `05`, `46` — CRO and AB testing playbooks (46 is e-commerce specific)
- `07`, `32` — real end-to-end builds, discovery call to live page to results
- `01`, `08` — the psychological principles
- `04`, `12`, `20` — anti-patterns and outdated advice
- `06`, `22` — what's working now
- `28`, `39` — dense tactical trick lists
- `36`, `40`, `41`, `43`, `44`, `45` — e-commerce and Shopify CRO
- `50`, `53` — Microsoft Clarity
- `52` — contact form optimization
- `21`, `34` — Hormozi analyses
- `18`, `42`, `49` — live audits and teardowns

`ls` the folders rather than assuming this list is complete. One video
("If I Wanted to Create a Landing Page in 2025, I'd Do This") has no captions available.

Respect copyright: use this for the user's own pages and research, never to republish someone
else's content verbatim.

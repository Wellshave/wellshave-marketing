# Targeting and audiences

## Controls vs suggestions — the distinction that governs everything

The ad set targeting UI has two halves, and they behave completely differently:

| | What sits there | How Meta treats it |
|---|---|---|
| **Controls** | Location, age/gender caps | **Hard boundary.** Respected. |
| **Suggest an audience** | Custom audiences, interests, lookalikes | **A hint.** Meta serves beyond it whenever it thinks that gets the objective. |

Almost every targeting mistake now comes from treating something in the second column as though it were in
the first. Adding a website-visitors custom audience does **not** restrict the ad set to website visitors.

## The default: broad

Broad targeting, letting Meta find the buyers. For a small budget in particular: one campaign, one ad set,
one offer, broad, and push all conversion volume through that single place so it has a chance to learn.

Taking manual control back usually makes things worse, which is the frustrating part — the honest answer to
"should I target X interest?" is normally no, and the productive lever is creative, not audience.

## Do not test audiences across ad sets

Interests vs lookalikes vs open targeting in parallel ad sets no longer gives a clean read, because all of
those inputs are suggestions Meta overrides. You are not comparing what you think you are comparing.

**Location is the exception**, because it is a hard control. Split by country, state or city when you need
per-market numbers — an international brand comparing markets, or a multi-location business.

## Value rules — the way to influence delivery without breaking broad

Advertising Settings → Value rules → create a rule set. You bid up or down for a segment while broad
targeting stays intact.

Available criteria: age, gender, location, conversion location, device, mobile OS, placement. Up to 10 rules,
and a single rule can combine two criteria (for example women over 45).

**Why this exists.** Meta optimises within the attribution window, so it cannot see lifetime value. It will
happily find you cheap conversions from a segment that never comes back. Value rules are how you feed it the
economics it cannot observe.

**Worked example from his consulting.** A jewellery brand selling mainly women's pieces found Meta serving
heavily to men, because men converted — buying gifts. Those buyers rarely returned, while women buying for
themselves did. Women were worth around 2.4x over their lifetime. The fix was a value rule bidding roughly
80% more for women, keeping broad targeting otherwise untouched.

**The trade-off is explicit.** Meta warns that overall cost per result may rise, and it often does. Accept
that when the LTV gap justifies it: a 10% worse cost per purchase in exchange for customers worth 2.4x is a
good trade. Judge value rules on blended economics, never on cost per result alone.

Other uses worth knowing: bid down on placements you know convert poorly, bid up for the conversion location
that produces better leads (website over instant form, or the reverse), bid by device or OS where you have
evidence.

## Retargeting

His retargeting approach changed post-Andromeda, following from the structural change: since warm audiences
cannot be cleanly isolated anyway, standalone retargeting ad sets make much less sense than they did. In
most accounts, retargeting now happens as a natural consequence of consolidated delivery plus Meta's own
ad sequencing inside the ad set.

The dynamic catalog campaign is the main deliberate exception, and on a modest budget it will spend mostly
on retargeting by itself.

For specifics beyond this, read `24 - Facebook Ads Retargeting Has Completely Changed` in the knowledge base.

## Reading who you are actually reaching

Set up Advertising Settings → Audience segments with your *engaged audience* and *existing customers*
defined. You then get a new / engaged / existing breakdown across results, spend and frequency.

This is the honest check on whether an account that looks profitable is in fact just harvesting its own
warm audience — which is exactly the situation that collapses the moment you scale.

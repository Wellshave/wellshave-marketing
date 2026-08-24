# Metrics and diagnosis

## Before anything: is it measurement or performance?

Check `current-state-2026.md` for the attribution redefinition first. Reported conversions fell for many
accounts because the definition of a click narrowed, not because sales fell — and the effect was larger for
video-heavy accounts. Confirm against real revenue before diagnosing a performance problem that may not
exist.

## The learning phase

After launch, or after a **significant edit** — including adding new ads — an ad set re-enters a learning
phase of roughly 24-48 hours. Meta tests heavily: who to serve, what time of day, which placement, which ad.
Results are at their most volatile here.

**Do not judge performance during it, and do not react to it.** Panic-editing during learning restarts it.

Learning never truly stops; the phase is just the loudest part.

## Learning limited

**What it means:** not enough results in a short enough window for Meta to optimise properly.

**The threshold: 50 conversions per ad set per week**, of whatever the ad set optimises for. This is a real
platform constant, not a benchmark to be calibrated away. Note it tracks the *optimisation event* — 50 link
clicks is easy, 50 purchases is not, which is precisely why the performance goal matters so much.

In practice it varies. Some ad sets exit at 20-40 a week. Above 50, learning limited is essentially never
seen.

**It is not fatal.** An ad set can be profitable while learning limited. Exiting it usually helps, but this
is an optimisation to pursue, not an emergency.

### Fixes, in order

1. **Make the campaign perform better.** More conversions at the same spend, from a better offer or better
   creative. This fixes the cause rather than the symptom.
2. **Consolidate.** The highest-leverage structural fix. Five ad sets at 15 purchases each are all learning
   limited; merged into one at 75, the problem disappears. See `campaign-structure.md`.
3. **Change the optimisation event** to something higher in the funnel — but only where optimising for the
   deep event is genuinely unrealistic at this volume. You are trading optimisation quality for data volume.
4. **Increase the budget.** Last, and only if the campaign is already performing.

### Do not raise budget to escape learning limited on a losing campaign

Meta's own advice is to spend more, and it is worth being sceptical when the platform's fix is to give it
more money. It is not wrong in principle — more spend does mean more conversions — but it does not rescue
bad economics. An account at 0.6x ROAS needing 3x will not be fixed by exiting learning limited. Expect
maybe a 10-20% lift from better optimisation, not a 5x turnaround.

Keep the budget small, fix the offer and creative, get the economics working *inside* learning limited, then
scale. That sequence works; the reverse does not.

**Business reality outranks algorithm hygiene.** Out of stock, at capacity, cash-flow constrained — pause the
campaign. Uninterrupted delivery is preferable, not sacred, and sending clicks to something people cannot
buy is worse than a restart.

## Performance goal — the most consequential setting

The campaign objective only narrows the options; the **performance goal decides how Meta optimises**, and it
is routinely overlooked. A traffic campaign optimising for link clicks will send more traffic and far fewer
sales than a sales campaign optimising for purchases.

- Optimise for the deepest event you can realistically feed with volume.
- For e-commerce with varying order values, prefer **maximise value of conversions**.
- The option may be hidden behind the conversion location setting — see `current-state-2026.md`.
- Never run leads or sales campaigns on landing-page-view, link-click, reach or impression goals.

## Triage order for "my results dropped"

Work down this list. The cheap structural explanations are far more often the cause than creative.

1. **Measurement change** — attribution redefinition, tracking or pixel breakage. Did real revenue move?
2. **A recent significant edit** resetting the learning phase. Check what changed and when.
3. **Fragmented data** — too many ad sets, none reaching 50 conversions a week.
4. **A budget step that was too large**, or the budget-increase bug if still live.
5. **Creative fatigue** — spend concentrated on a few ageing ads with nothing new getting delivery.
6. **Scaling past the ceiling** into genuinely cold audience the creative cannot convert.

Only after these: offer, landing page, market conditions.

## Reading spend distribution

**Spend concentrated on one or two ads** is the normal post-Andromeda pattern, not necessarily a fault. Ask
whether new creative is getting any delivery at all — if not, see `testing-and-creative.md`.

**An ad spending with few conversions may be doing top-of-funnel work.** Especially with higher-priced or
more considered purchases. Do not judge it on its own cost per result; judge it on what happens to the ad
set without it. See `campaign-structure.md`.

## Calibration — read this before quoting any threshold

Ben Heath's example numbers come from a largely US/UK client base. **Do not present his CPM, CPC or CTR
figures as targets for this user's account.** Pull the account's own trailing 30-90 day baselines and
diagnose against those. Borrow the logic, not the constants.

The 50-conversions-per-week threshold is the exception, because it is Meta's own mechanic.

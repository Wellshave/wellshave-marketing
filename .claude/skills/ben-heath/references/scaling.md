# Scaling

First check `current-state-2026.md` for the **2026-08-03 budget-increase bug**. If it is still live, scaling
in place may fail and the duplicate-and-replace workaround applies. Otherwise use the methods below.

## Pick the mode by temperament, not by business

Unusually, the choice here is about the operator. Be honest with the user about which they are.

**If they cannot stop tinkering** — if a bad morning of results ruins their day and they reach for the
budget slider — they need **Mode 1**, which takes the decision out of their hands.

**If they can stay level** through a few volatile days, either mode works, and Mode 2 moves faster.

## Mode 1 — automated rules

Two rules, one up and one down, with a hold band between them.

**Scaling rule.** Action: *increase daily budget by* a percentage. Use **3%**, and use a percentage rather
than a fixed amount — a fixed +€10/day is meaningful at €50/day and irrelevant at €1,000/day. Frequency:
**once daily**. Do not exceed roughly 5-7% on a daily cadence. Compounding does the work: 3% a day climbs
faster than it feels.

**Condition.** Cost per result below your target, or ROAS above it, for value-based accounts with varying
order values. Meta adds a lifetime-impressions floor (around 8,000) by default so the rule cannot act on
almost no data — leave it in.

**Time range — the setting people get wrong.** This is the window the condition is judged over. Never use
the maximum: three good months can mask two terrible weeks and the rule will keep scaling into losses.
Match it to conversion volume — last 3 days if you generate dozens or hundreds of conversions in that span,
last 7 days as a sensible middle, last 14 or even 28 if conversions are sparse.

**Schedule.** Daily, in the midnight-to-1am slot. Not continuously.

**Decrease rule.** Mirror it: *decrease daily budget by* 3%, with a **minimum budget floor** so spend never
collapses to nothing. Set its threshold with a deliberate gap from the scaling threshold, so there is a band
where the budget simply holds. Using the same number for both makes the budget oscillate.

Optionally set a maximum daily budget cap as a comfort ceiling.

## Mode 2 — manual stepped scaling

Bigger steps, taken less often, with the percentage shrinking as the budget grows.

An illustrative ladder: 50 → 100 → 150 → 200 → 300 → 400 → 500 → 650 → 800 → 1,000 per day. Note what that
does: a 100% jump at the bottom, roughly 20% near the top. Meta absorbs large *percentage* increases far
more easily at low budgets than at high ones.

**Timing between steps: 5-10 days, typically 7.** Never faster than every 5 days. Each increase re-enters
the learning phase, so expect a day or two of wobble, then judge over the following several days. Fewer
conversions means waiting longer, not less.

## Finding the scaling ceiling

Step up and watch the decay. If you need 4x ROAS and you observe roughly 6.0 → 5.2 → 4.9 → 4.6 → 4.3 → 4.1
as you climb, your current ceiling is around that last step. That is genuinely valuable: you now know what
you can spend profitably, and that going beyond it requires better ads or a better offer rather than a
bigger budget.

**You only learn this by stepping.** Jump from small to huge, watch it fail, and drop back, and you have
learned nothing except that it failed.

## Anti-patterns

- **Parallel duplicate campaigns.** Leaving the original running and adding identical copies alongside it.
  Causes auction overlap, fragments conversion data, and ends in accounts carrying a dozen near-identical
  campaigns. If the bug workaround forces a duplicate, the original gets **turned off**.
- **10x-ing the budget in one move.** Meta's system cannot absorb it, results deteriorate sharply, and you
  lose the ceiling information you would have gained from stepping.
- **Lifetime budgets.** Prefer daily budgets. Far more flexible to scale and adjust.

## When scaling immediately kills results

If results collapse the moment you spend more, even at low budgets, the usual cause is that **your ads
convert warm and hyper-responsive people but not true cold audience.**

At small spend, a disproportionate share of delivery reaches people who already know you, plus the small
group in any market who will buy almost anything in the category. Those people convert regardless of how
good the ad is. Spend more and you reach genuinely cold audience, where the creative has to actually work.

The fix is better ads and a better offer. It is not a budget or bidding problem, and no amount of structural
tinkering will substitute.

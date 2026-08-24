# Campaign structure

## The default: consolidate hard

Start from **one campaign, one ad set, many ads**, and only split when you have a specific reason from the
list below. This is a reversal of the old multi-campaign, multi-ad-set, few-ads-per-set approach, and an
account still built that way is very likely being held back by it.

Two reasons consolidation wins:

**1. Conversion data density.** Meta optimises on volume of conversion events per ad set. 70 conversions a
week in one ad set lets it work out time of day, impression frequency, which person gets which ad. The same
70 spread over 10 ad sets is 7 each — not enough to exit the learning phase, let alone optimise.

**2. Auction overlap — which is not audience overlap.** The common objection, "I am bidding against myself",
is weak: thousands of advertisers already target the same people, one more campaign changes little. The real
problem is that Meta plans **impression frequency per individual** — deciding, say, that four or five
impressions across 48 hours is what produces the conversion. It can plan that inside one ad set. Split the
same person's impressions across duplicate ad sets or campaigns and that planning breaks.

## Ads per ad set

**Aim for 20+ genuinely different ads in the ad set.** Post-Andromeda this is both tolerated and wanted,
because it feeds Meta's per-person personalisation. The binding constraint is creative production capacity,
not a platform limit. See `testing-and-creative.md` for how to hit that number realistically.

## Do not split cold and warm

Custom audiences sit under *Suggest an audience*, so a "cold" ad set will serve warm people and vice versa.
Run the experiment if you want proof: set up one ad set aimed at warm audiences and one at cold, then compare
the new / engaged / existing breakdown. The splits usually come out close to identical, because Meta is
largely ignoring the distinction and chasing the objective.

To read that breakdown at all, first define your segments: **Advertising Settings → Audience segments**, then
populate *engaged audience* and *existing customers* with the relevant custom audiences. You then get
new/engaged/existing splits on results, spend and frequency. Do this early — it is the cleanest way to see
how retargeting-heavy an account actually is.

Rare exception: genuinely different messaging per funnel stage that you insist on controlling. Understand
you are paying for that control in fragmented data.

## Do not split funnel stages into campaigns

Separate top / middle / bottom-of-funnel campaigns are obsolete as *structure*, but the marketing logic
behind them is not. Keep the logic, drop the structure: build founder-story ads, product-demo ads and
testimonial ads, and put them **all in the same ad set**. Meta sequences them, using some ads to introduce
and others to convert.

**Critical corollary — do not kill an ad that spends without converting.** In accounts with a larger ask
(higher price, more considered purchase), Meta deliberately spends on some ads in a top-of-funnel capacity.
Those ads show poor cost per result while making the converting ads work. Turn one off and the performance
of your apparent winners drops. Judge such ads on what happens to the ad set when they are removed, not on
their own cost per result.

## When you *do* split

- **Location.** The one targeting dimension that is a hard control, so the only one that gives a clean read.
  Split by country or city when you genuinely need per-market performance.
- **One campaign per product or service range.** Hats vs shoes, not red hats vs blue hats. Different ranges
  need to optimise differently and may need different levels of convincing. It also gives you an operational
  off-switch when something goes out of stock or a service hits capacity.
- **Dynamic catalog campaign.** Can run business-wide rather than per range. On a modest budget it will
  mostly retarget, which is fine and intended.
- **Testing**, when new creative cannot get delivery inside the main ad set. See `testing-and-creative.md`.
- **Omnipresent content strategy** for high-ticket, heavily-considered purchases. Genuinely needs multiple
  ad sets and deliberately breaks this default.

## Ad copy testing belongs inside the ad

Do not create separate ads to test headlines or primary text. Use the built-in variation slots — up to
**five primary texts, five headlines, five descriptions** within a single ad. Separate ads are for genuinely
different *creative*. Doing copy testing with separate ads multiplies your ad count into unmanageable
numbers and runs straight into the duplicate-suppression problem.

## Ignoring Meta's warnings

Deviating from the default will trigger warnings in Ads Manager. Ignoring them is fine, but do it
deliberately, because you are following a specific strategy and know why. Meta's warnings are built for what
is best on average, and on average they are right. "I heard this three years ago" is not a reason.

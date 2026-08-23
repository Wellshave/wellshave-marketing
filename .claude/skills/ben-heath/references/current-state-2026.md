# Current platform state (Layer 1 — perishable)

Every entry is dated. **Newer supersedes older.** Distilled from videos published 2025-12-16 → 2026-08-12.
Before repeating any of this as current fact, weigh the date against today. Where an item is flagged
TIME-SENSITIVE, verify it still holds before acting on it.

---

## Andromeda — the change everything else hangs off
*Rolled out to most accounts by early 2026; discussed throughout the window.*

Meta rebuilt its delivery system. Practical consequences:

- **Meta personalises which ad each individual sees.** It works out that one person responds to UGC and
  another to a product demo, and serves accordingly. This is why creative diversity now matters more than
  targeting inputs.
- **Near-duplicate ads get suppressed.** If several ads in an ad set are minor variations of each other,
  Meta treats them as the same ad and enters only one into the auction. The others get effectively no
  delivery. This is the single biggest testing trap in the current platform.
- **Ad-per-ad-set capacity went up sharply.** The old guidance of roughly 5-6 ads per ad set is obsolete.
  Current guidance is **20+ ads in one ad set**, and the limit in practice is how many genuinely different
  creatives you can produce, not a platform ceiling.
- **Meta sequences funnel stages by itself** inside a single ad set (see `campaign-structure.md`).

## Targeting became mostly advisory
*Established platform behaviour through the window; structure video 2026-02-17.*

The ad set targeting UI splits into **Controls** and **Suggest an audience**, and the distinction is the
whole game:

- **Controls = hard boundaries.** Location sits here. Meta respects it.
- **Suggest an audience = hints.** Custom audiences, interests, lookalikes sit here. Meta will serve beyond
  them whenever it believes that gets the objective.

Consequences: splitting cold vs warm into separate ad sets no longer separates anything, and testing
interests vs lookalikes across ad sets no longer produces a clean read. Location is the exception worth
splitting on. Detail in `targeting-and-audiences.md`.

## Attribution redefined — reported results dropped
*2026-04-07. Affects how every metric in the account reads.*

- **Before:** default 7-day click + 1-day view, and "click" quietly included social and media clicks —
  reactions, comments, shares, expanding the primary text, tapping to watch more of a video.
- **After:** only a **link click** starts a click-through attribution window. The link click may be internal
  (to an Instagram profile, to WhatsApp) or external to a site.

Scale of the effect, from his own accounts: all-clicks ran close to **3x link-clicks on video-heavy
campaigns**, and noticeably closer to parity on image-heavy ones. So the reported-conversion drop is larger
for video-led accounts.

**Diagnostic rule: a fall in reported results around this change may be measurement, not performance.**
Check whether real revenue moved before reacting. A side effect is that Ads Manager now lines up more
closely with third-party and analytics tools, which mostly use last-click.

## Performance goal: maximise value, not volume
*2026-02-03.*

The **performance goal**, not the campaign objective, dictates optimisation. The objective only narrows the
list. Two practical points:

- The option you want may be **hidden**. If conversion location is set to a multiple option such as
  "website and calls", the performance goal locks to "maximise number of conversions". Switch conversion
  location to **website** alone and the goal options unlock.
- For e-commerce with varying order values, choose **maximise value of conversions** over maximise number.
  Meta then favours people predicted to spend more, not merely to convert. This can mean fewer sales at
  higher total revenue. The wider the spread in order values, the more this matters. If every customer buys
  one identical-priced item it makes little difference, and the real fix there is an upsell.

Never set a leads or sales campaign to optimise for landing page views, link clicks, reach or impressions.
That converts it into a traffic or awareness campaign in all but name.

## Value rules — influence without breaking broad targeting
*2026-05-05.*

Found under Advertising Settings → Value rules. Lets you bid up or down for a segment while leaving broad
targeting intact. Criteria include age, gender, location, conversion location, device, mobile OS and
placement. Up to 10 rules; two criteria can be combined in one rule.

The rationale: Meta optimises inside the attribution window and **cannot see lifetime value**. Value rules
are how you hand it that information. Meta explicitly warns that overall cost per result may rise — that is
an accepted trade when LTV justifies it. Worked example in `targeting-and-audiences.md`.

## Creative testing tool — the answer to the Andromeda duplicate problem
*2026-02-10, reinforced 2026-04-03.*

At the **ad level**, below the creative section. Runs 2-5 versions with delivery kept genuinely separate, so
near-identical variants each get a fair read instead of being collapsed into one. This is what makes hook
testing and text-overlay testing still possible. **Its default comparison metric is cost per post engagement,
which is almost never what you want** — change it. Full method in `testing-and-creative.md`.

## Instant forms can book calendar slots
*2026-07-23. Lead-gen only; not relevant to pure e-commerce.*

Instant forms gained an end-screen action that books directly into a calendar (Calendly and HighLevel first,
HubSpot flagged for early August 2026), with form data passed through so the prospect does not retype it.
Rolling out account by account, with global availability signalled for around October 2026. Verify
availability rather than assuming. Advice attached to it: launch without qualifying friction to build
conversion volume, add friction later only if lead quality proves poor.

---

## TIME-SENSITIVE — budget-increase bug
*Reported 2026-08-03. Verify before acting. May already be resolved.*

Across a number of accounts, raising the budget on an **existing** campaign or ad set caused results to
collapse to near zero or fall 90%+. This is not the familiar "CPA worsens somewhat after a budget increase";
it is total failure of a previously healthy campaign. It did not affect every account.

**Workaround while it lasts:** duplicate the campaign or ad set, start the duplicate at the higher budget,
and **turn the original off**. Running both is horizontal scaling and fragments the data — do not do it.

**This is explicitly a workaround, not the recommended method.** Scaling an existing campaign is preferred
because it keeps accumulated learning, avoids an account cluttered with duplicates, and avoids duplicates
sometimes failing to spend on the ads that were previously the best performers. Meta was expected to fix it.
**Check whether the bug is still live before recommending this**; if scaling in place works normally, use
the standard method in `scaling.md`.

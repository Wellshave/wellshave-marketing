# Report Structure — Meta Audit Markdown Template

Use this as the structure for the Notion page content. All sections required unless noted optional. Tables render natively in Notion; use pipe-separated markdown.

Replace `[bracketed]` placeholders with actual values. Currency symbol always matches the account currency from `ads_get_ad_accounts`.

---

# [Account Name] — Meta Ads Account Audit

**Account ID:** [numeric ID]
**Currency:** [EUR / USD / CZK / etc.]
**Period:** Last 30 days ([start date] – [end date])
**Meta vertical:** [from advertiser_context]
**Meta funnel classification:** [from advertiser_context — e.g. "Single Funnel (70%+ in one stage)"]
**Meta Opportunity Score:** [N / 100]

---

## Executive summary

[1-2 sentence top-line on account health and profitability]

[Three things, ranked by impact × effort, narrating the diagnosis. Each 2-3 sentences. Be specific — mention actual numbers, market names, or campaign IDs.]

1. **[Headline of insight #1].** [Explanation with numbers and entity names.]
2. **[Headline of insight #2].** [Explanation with numbers and entity names.]
3. **[Headline of insight #3].** [Explanation with numbers and entity names.]

[If there's a high-leverage Meta-recommended quick win, mention it here as a one-liner.]

---

## 1. Top-line snapshot

| Metric | Value | Read |
|---|---|---|
| Spend | [currency][amount] | |
| Revenue (purchase value) | [currency][amount] | |
| **Blended ROAS** | **[N.NNx]** | [Read on profitability — e.g. "Strong, above e-comm average" or "Capped — needs margin > X% to be profitable"] |
| Purchases | [N] | |
| **Blended CPA** | **[currency][N.NN]** | |
| Impressions | [N] | |
| Reach (Meta Accounts) | [N] | |
| **Frequency** | **[N.NN]** | [⚠️ if > 3.5, 🚨 if > 5] |
| CPM | [currency][N.NN] | |
| **CPP (cost per 1K accounts)** | **[currency][N.NN]** | |
| Opportunity Score | **[N / 100]** | |

---

## 2. Funnel diagnostic

Aggregated across [N] active sales campaigns ([currency][amount] spend):

| Stage | Volume | Conv from prior | Cost per event | Read |
|---|---|---|---|---|
| Impressions | [N] | — | — | |
| View Content (LPV) | [N] | — | [currency][N.NN] | |
| Add to Cart | [N] | [N.N]% of VC | [currency][N.NN] | [✅ healthy / ⚠️ low / 🚨 broken] |
| Initiate Checkout | [N] | [N.N]% of ATC | [currency][N.NN] | |
| Purchase | [N] | [N.N]% of IC | [currency][N.NN] | |
| **LPV → Purchase** | — | **[N.NN]%** | — | |

**Diagnosis:** [Identify the biggest leak. If IC > ATC, call out the express checkout (Shop Pay / Apple Pay) signature and explain why ATC→IC drop-off is misleading here — use IC→Purchase instead. Recommend ad-side vs site-side fix.]

**Implication:** [The single highest-ROI lever, with a one-sentence justification.]

---

## 3. Audience segment split

| Segment | Spend | % of total | Read |
|---|---|---|---|
| Prospecting (new) | [currency][amount] | [N.N]% | |
| Engaged | [currency][amount] | [N.N]% | |
| Existing customers | [currency][amount] | [N.N]% | |
| Unknown | [currency][amount] | [N.N]% | |

[1-2 sentence read on whether the funnel architecture is balanced or single-funnel. Cross-reference to Meta's classification from advertiser_context.]

---

## 4. Campaign performance (active, by ROAS)

| Campaign | Spend | Purchases | Revenue | **ROAS** | CPA | Freq |
|---|---|---|---|---|---|---|
| [Name] | [amount] | [N] | [amount] | **[N.NNx]** [⭐/⚠️/🚨] | [amount] | [N.NN] |
| ... | | | | | | |

[Sort by ROAS descending. Use ⭐ for ROAS > 2, ⚠️ for ROAS 1.0–1.5, 🚨 for ROAS < 1.0. Limit to top 10 active campaigns; if account has more, summarize the long tail.]

**Reads:**
- [2-4 bullets on spend concentration, geo dispersion, and notable winners/losers]

---

## 5. Ad set winners + Meta's fragmentation fixes

**Top 5 ad sets by ROAS (≥[currency]500 spend):**

| Ad set | Campaign | Spend | ROAS | CPA |
|---|---|---|---|---|
| ... | | | | |

**Worst ad sets (active, ≥[currency]500 spend):**

| Ad set | Campaign | Spend | ROAS | CPA |
|---|---|---|---|---|
| ... | | | | |

### Meta's fragmentation / learning recommendations

Sorted by estimated impact (from `ads_get_opportunity_score`):

| Lift pts | Recommendation | Estimated impact | Affected entities |
|---|---|---|---|
| [N] | [Body of recommendation] | **[X% lower CPR / More Sales / etc.]** | [Ad set IDs or campaign IDs] |
| ... | | | |

[Optional: compound-impact estimate if top 3 recommendations applied.]

---

## 6. Creative analysis (3-signal cross-check)

### Top creatives by ROAS (≥[currency]2K spend)

| Ad | Spend | ROAS | CPM | Freq | Notes |
|---|---|---|---|---|---|
| ... | | | | | |

### Auction Ranking Diagnostics

[List only ads with Above Average or Below Average rankings — skip the all-Average rows. Flag Below Average Quality ads as scaling risks even if ROAS is high.]

| Ad | Quality | Engagement | Conversion | Read |
|---|---|---|---|---|
| ... | | | | |

### CTR vs industry benchmark

**Above benchmark (engagement winners):**
- [Ad/ad set name]: **+[N]%** above benchmark [⭐ if top]
- ...

**Below benchmark (kill / rebuild candidates):**
- [Ad/ad set name]: **-[N]%** below benchmark [🚨 if also low ROAS]
- ...

### Creative angle patterns

**Winning angles to replicate:**
1. [Angle pattern with example ad names]
2. ...

**Losing angles to kill:**
1. [Angle pattern with example ad names]
2. ...

---

## 7. Soft-metric diagnosis (frequency map)

| Campaign | Frequency | Read |
|---|---|---|
| [Name] | [N.NN] | [Critical / High / Elevated / Healthy] |
| ... | | |

[Always flag frequency > 5 as Critical and frequency > 3.5 as Elevated. Note implications for sustainability — high frequency on retargeting tolerates more than on cold prospecting.]

---

## 8. Meta's Opportunity Score recommendations

Account score: **[N / 100]**

[List the recommendations not already covered in Section 5 — A+ Standard Enhancements, Reels 9:16 reformatting, Partnership Ads, CAPI CRM setup, creative fatigue refreshes. Sort by score lift descending.]

| Lift pts | Recommendation | Estimated impact | Entities |
|---|---|---|---|
| ... | | | |

---

## 9. Delivery health + security

### [Account compromise / security event — only if present]

**[N] campaigns paused with error: "Pause ads for compromised account"**:
- Campaign [ID]
- ...

[Strongly recommended language: "Verify with [client]: when did this happen, was access reviewed, are 2FA + business manager permissions hardened?"]

### Audience hygiene

[Count of ad sets paused with "Custom audience not available" errors. List the most notable deleted audiences if visible in error messages.]

### Other delivery errors

[Bullet list of remaining errors: missing product sets, ad processing errors, high invalidation rate, disapprovals. Group similar errors.]

---

## 10. Recommended actions (prioritized)

### Immediate — this week

1. [Action with specific entity name(s) and ID(s)]
2. [Action]
3. [Action]

### Short-term — 2 weeks

4. [Action]
5. ...

### Medium-term — 1 month

[Actions]

---

## 11. What couldn't be retrieved from this MCP

[Bullet list of gaps for manual Ads Manager verification:]
- Absolute clicks / CTR / CPC / link CPC (only available as % change/benchmark via insights tools)
- Hook rate / hold rate per video ad (video metrics blocked)
- [If ads_get_creatives gated:] Ad creative bodies / titles / CTAs
- [If ads_get_datasets gated:] Pixel health / EMQ scores
- [If lead campaigns present:] Lead campaign conversion data (custom event)
- [Any other context-specific gaps]

---

*Audit run [date] — Meta Ads MCP. Methodology: Niels + GoMarble hybrid (`meta-account-audit` skill).*

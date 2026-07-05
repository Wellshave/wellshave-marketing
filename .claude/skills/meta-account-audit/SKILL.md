---
name: meta-account-audit
description: |
  Runs a complete Meta Ads account audit via the Meta Ads MCP and posts the report to Lotux Agency's Notion "Account Audits" page. Niels + GoMarble hybrid covering account vitals, full funnel (LPV → ATC → IC → Purchase), audience-segment split, campaign/ad set/ad performance, three-signal creative scorecard (ROAS × CTR-benchmark × Quality-ranking), Meta's Opportunity Score recommendations, delivery health including security-compromise events, and a prioritized action list. Trigger whenever Niels asks to audit, review, analyze, or check a Meta ads account — even without saying "Meta". Common triggers — "/meta-account-audit", "audit [client]", "review the [client] ads", "how are the Proforto ads doing", "let's look at OhMyDotz", "ads audit for [client]", or any request to evaluate a Facebook/Instagram ad account. Default to this skill rather than ad-hoc pulls whenever the user wants a structured account review.
---

# Meta Account Audit

## What this skill does

Pulls a structured Meta Ads account audit and posts the full report to Notion under the **Account Audits** page (`365b1dde-875d-80c9-8e21-deceaf77d3ba`) inside Lotux Agency's Operations workspace.

Output structure in Notion:

```
Account Audits (existing page)
├── [Company Name]            ← created on first audit, reused after
│   ├── Company Name | Audit v20260519
│   ├── Company Name | Audit v20260612
│   └── ...
```

So the first audit for a client creates both the company page AND the dated audit page inside it. Subsequent audits for the same client only create a new dated audit page.

## How to think about this audit

Niels's analysis workflow combined with GoMarble's structure. Three principles:

1. **Diagnose the funnel before judging the ads.** Pull View Content → Add to Cart → Initiate Checkout → Purchase, compute drop-off rates, and ask "is the bottleneck in the ads, on the landing page, or in the checkout?" before recommending creative changes.
2. **Cross-check creative quality with three signals**, not just ROAS. A 2.5x ROAS ad with Below-Average Meta quality ranking is a scaling risk. A 0.9x ROAS ad that's also -40% below industry CTR benchmark is an unambiguous kill. Don't pull the trigger on a single signal.
3. **Surface Meta's own recommendations.** The `ads_get_opportunity_score` endpoint returns specific ad set IDs to consolidate, A+ Standard Enhancements suggestions, Reels-format upgrades, and CAPI setup gaps. These are high-leverage one-click fixes Niels can deliver to the client immediately.

## The workflow

Follow these steps in order. Detailed call patterns, field aliases, and known MCP quirks live in `references/data_collection.md` — read it before running any calls.

### 1. Resolve the account

If the user supplied an account ID or name (e.g. `/meta-account-audit Proforto` or `/meta-account-audit 1957567491166129`), use that. Otherwise call `ads_get_ad_accounts` and ask the user to pick from MCP-enabled accounts (`is_ads_mcp_enabled: true`).

If the chosen account has `is_ads_mcp_enabled: false`, stop and explain — the audit can't run. Suggest a different account.

Note the `currency`, `ad_account_name`, and `business_name` from the account list — you'll need them throughout.

### 2. Run the data pulls

Read `references/data_collection.md` and execute the call sequence. The audit needs:

- **Pre-flight** — advertiser context (vertical, funnel classification), opportunity score, delivery errors, anomaly signal
- **Section 1: Vitals** — account-level spend, impressions, reach, frequency, CPM, CPP for last 30 days
- **Section 2: Funnel** — campaign-level results tree (parse `results.all_conversion_types` for View Content / ATC / IC / API / Purchase)
- **Section 3: Audience segments** — `user_segment_key` breakdown at account level
- **Section 4: Campaigns** — top 25 active campaigns by spend with ROAS, CPA, frequency
- **Section 5: Ad sets** — top 30 active ad sets by spend with ROAS, CPA, frequency, attribution setting
- **Section 6: Creatives** — top 25 ads + auction ranking diagnostics + CTR industry benchmark
- **Section 7: Soft metrics** — frequency map by campaign
- **Section 8: Opportunity Score recs** — sort by score lift, format with affected entity IDs
- **Section 9: Delivery health** — errors with security flagging
- **Section 10: Action list** — Immediate / Short-term / Medium-term, each with specific entity names

### 3. Detect known anomalies

Before writing the report, scan the data for these and adapt the narrative accordingly:

- **IC > ATC at aggregate level** → Shopify express checkout (Shop Pay / Apple Pay) is bypassing the cart page. The "ATC → IC drop-off" metric is misleading and should be replaced with **IC → Purchase rate** as the leak indicator.
- **"Pause ads for compromised account" in errors** → Security event. Surface this loudly as an Immediate action — needs client conversation about 2FA, business manager access, credential review.
- **Multiple "Custom audience not available" errors** → Audience hygiene issue, often paired with the compromise above. Recommend cleanup.
- **Lead-gen campaigns returning "Not available" for `results`** → Custom event (Typeform, Instant Form). Cannot compute conversions via MCP. Flag for manual Ads Manager verification.
- **Frequency > 5 on top-spending campaigns** → Audience saturation risk. Always flag, even if ROAS is still healthy.
- **`ads_get_creatives`, `ads_get_ad_videos`, `ads_get_datasets` return "gradually being rolled out"** → Note in Section 10 that creative copy / video metadata / pixel health checks need manual verification in Ads Manager / Events Manager.

### 4. Write the audit content

Use the template in `references/report_structure.md`. The report has 10 sections plus an executive summary. Keep tables clean — column counts matter for Notion rendering.

### 5. Post to Notion

Follow `references/notion_workflow.md`. The flow:

1. Search the "Account Audits" page for an existing child page matching the company name (use `notion-search` with `page_url` scope).
2. If found, get its page ID. If not, create it as a new sub-page under `365b1dde-875d-80c9-8e21-deceaf77d3ba`.
3. Create the dated audit page under the company page: title format `[Company Name] | Audit v[YYYYMMDD]` (e.g. `Proforto NL | Audit v20260519`).
4. Write the full audit content into the new page.
5. Return the Notion URL to the user in chat.

### 6. Confirm + summarize in chat

After the Notion page is created, post a short summary in chat:

- A clickable link to the Notion audit page
- The 3 most urgent immediate actions (1 line each)
- Any notable surprises (e.g. account compromise event, top creative angle, frequency red flag)

Keep it under ~150 words. The detail lives in Notion.

## Reference files

- `references/data_collection.md` — Exact MCP call sequence with field lists, filters, sort, breakdowns
- `references/mcp_quirks.md` — Field aliases (`spend` → `amount_spent`), "Not available" workarounds, gated rollouts
- `references/report_structure.md` — The 10-section markdown template with tables and placeholders
- `references/notion_workflow.md` — Search, create-company-page, create-audit-page logic with exact call shapes

## Hard rules

- **Never invent numbers.** If a field returns "Not available", note it explicitly. Don't fabricate clicks, CTR, CPC, ROAS values.
- **Always use the currency from `ads_get_ad_accounts`** alongside spend/revenue figures.
- **Use specific entity names + IDs in recommendations.** "Pause ad set [Name] (ID 12345...)" not "pause underperformers."
- **Cross-check before recommending a kill.** ROAS alone isn't enough; require either CTR-below-benchmark or BAD trend or Below-Average quality ranking as a second signal.
- **Surface the account compromise check** if present. This is a security and trust issue independent of performance and needs client attention.
- **One Notion page per audit** — don't append to existing audit pages. Each run creates a new dated page so the history is preserved.

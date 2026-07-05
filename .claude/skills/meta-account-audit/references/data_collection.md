# Data Collection — Meta Ads MCP Call Sequence

This is the exact set of calls the audit runs against the Meta Ads MCP (the connector exposing `ads_get_ad_entities`, `ads_insights_*`, `ads_get_opportunity_score`, etc.). Read `mcp_quirks.md` before running these — it explains why some fields can't be combined and which return "Not available."

All calls assume `ad_account_id` is the numeric ID (no `act_` prefix). Date range is always last 30 days (`date_preset: "last_30d"` or for insights tools `date_preset: "LAST_30D"`).

---

## Pre-flight (run these in parallel)

### Account vitals
```
ads_get_ad_entities
  level: "account"
  fields: ["name", "amount_spent", "impressions", "reach", "frequency", "cpm", "cpp"]
  date_preset: "last_30d"
```

### Vertical + funnel classification
```
ads_insights_advertiser_context
  date_preset: "LAST_30D"
```

### Opportunity Score + recommendations
```
ads_get_opportunity_score
```

### Delivery errors
```
ads_get_errors
  entity_ids: [account_id]
  limit: 50
```

### Anomaly detection
```
ads_insights_anomaly_signal
```

### Audience segment split
```
ads_get_ad_entities
  level: "account"
  fields: ["amount_spent", "impressions", "reach"]
  date_preset: "last_30d"
  breakdowns: ["user_segment_key"]
```

Expect 3-4 rows: `prospecting`, `engaged`, `existing`, `unknown`. Don't ask for conversion metrics on this breakdown — they return "Not available" at account level.

---

## Campaign data (run in parallel — TWO separate calls)

The two calls must be split because combining structure fields with action-typed fields causes partial "Not available" responses.

### Call A — Structure + delivery metrics
```
ads_get_ad_entities
  level: "campaign"
  fields: ["id", "name", "objective", "optimization_goal", "effective_status",
           "amount_spent", "impressions", "reach", "frequency", "cpm", "cpp"]
  date_preset: "last_30d"
  filtering: [{"field": "campaign.effective_status", "operator": "IN", "value": ["ACTIVE"]}]
  sort: "amount_spent_descending"
  limit: 25
```

### Call B — Conversion funnel
```
ads_get_ad_entities
  level: "campaign"
  fields: ["id", "name", "amount_spent", "results", "result_values", "cost_per_result"]
  date_preset: "last_30d"
  filtering: [{"field": "campaign.effective_status", "operator": "IN", "value": ["ACTIVE"]}]
  sort: "amount_spent_descending"
  limit: 25
```

**Parse `results.all_conversion_types`** from each campaign. It's an array of strings like `"2,562 (Website purchases)"`, `"15,009 (Website adds to cart)"`, `"18,796 (Website checkouts initiated)"`, `"342,751 (Website content views)"`. Extract numeric values for: View Content (Website content views), Add to Cart (Website adds to cart), Initiate Checkout (Website checkouts initiated), Add Payment Info (Website adds of payment info), Purchase (Website purchases).

**Compute manually**:
- ROAS = `result_values[0].values[0].value` (revenue) ÷ `amount_spent`
- CPA = `amount_spent` ÷ purchases
- Use `cost_per_result` directly when available (more accurate)

**Lead-gen campaigns** (`objective: "OUTCOME_LEADS"`) will return `"results": "Not available"` because they use custom events (TypeformSubmit, etc.). Flag them as "verify in Ads Manager" and skip funnel math.

---

## Ad set data
```
ads_get_ad_entities
  level: "adset"
  fields: ["id", "name", "campaign_id", "amount_spent", "impressions", "reach",
           "frequency", "cpm", "cpp", "results", "result_values", "cost_per_result",
           "optimization_goal", "attribution_setting"]
  date_preset: "last_30d"
  filtering: [{"field": "adset.effective_status", "operator": "IN", "value": ["ACTIVE"]}]
  sort: "amount_spent_descending"
  limit: 30
```

The `attribution_setting` enum tells you the window each ad set uses: `7d_click`, `1d_view_7d_click`, `1d_view_7d_click_1d_ev`, etc. Note any variation in the audit — inconsistent attribution across ad sets distorts cross-comparisons.

---

## Ad-level data (run in parallel — TWO calls)

### Call A — Delivery metrics
```
ads_get_ad_entities
  level: "ad"
  fields: ["id", "name", "adset_id", "campaign_id", "amount_spent",
           "impressions", "reach", "frequency", "cpm"]
  date_preset: "last_30d"
  filtering: [{"field": "ad.effective_status", "operator": "IN", "value": ["ACTIVE"]}]
  sort: "amount_spent_descending"
  limit: 25
```

### Call B — Conversions
```
ads_get_ad_entities
  level: "ad"
  fields: ["id", "name", "amount_spent", "results", "result_values", "cost_per_result"]
  date_preset: "last_30d"
  filtering: [{"field": "ad.effective_status", "operator": "IN", "value": ["ACTIVE"]}]
  sort: "amount_spent_descending"
  limit: 25
```

---

## Quality + benchmark signals (run in parallel)

### Auction Ranking Diagnostics — per-ad Quality / Engagement / Conversion ranking
```
ads_insights_auction_ranking_benchmarks
  date_preset: "LAST_30D"
```

Look for "Below Average (Bottom 35% of ads)" — these ads will be throttled by Meta even if ROAS looks good. Also look for "Above Average" — rare, valuable, worth replicating the format.

### CTR vs industry benchmark
```
ads_insights_industry_benchmark
  analysis_metric: "CTR"
  date_preset: "LAST_30D"
  conversation_intent: "OPTIMIZE_COST_OUTCOMES"
  conversation_topic: "CREATIVE"
```

Returns ads/ad sets above and below industry benchmark with % delta. The response splits into multiple cohorts (OUTCOME_SALES vs RETURN_ON_AD_SPEND vs OFFSITE_CONVERSIONS) — process each cohort separately.

Cross-reference each underperformer against the ROAS table:
- Below benchmark + ROAS < 1 = unambiguous kill
- Below benchmark + ROAS > 2 = note for "verify in Ads Manager," the audience may be lower-funnel and converting despite low engagement
- Above benchmark + ROAS > 2 = scale candidate

---

## Optional pulls (gated; will often return "rolled out gradually")

These tools are still being rolled out per account. **Try them and gracefully degrade if they're not available.**

### Pixel/dataset health
```
ads_get_datasets
  ad_account_id: [id]
```
If it returns "gradually being rolled out", note in Section 10 that pixel/EMQ check needs to be done manually in Events Manager.

### Creative bodies for angle analysis
```
ads_get_creatives
  ad_account_id: [id]
  fields: ["id", "name", "body", "title", "call_to_action_type", "object_type", "link_url"]
  limit: 50
```
If gated, infer angles from ad names instead.

### Video metadata for hook-rate proxy
```
ads_get_ad_videos
  ad_account_id: [id]
  fields: ["id", "title", "length", "created_time"]
  limit: 25
```
If gated, flag hook rate / hold rate as "verify in Ads Manager."

---

## Ordering recommendation

To finish faster, batch calls into parallel waves:

**Wave 1** — pre-flight (6 calls in parallel):
- Account vitals
- Advertiser context
- Opportunity score
- Errors
- Anomaly signal
- Audience segment breakdown

**Wave 2** — campaign + ad set + ads (5 calls in parallel):
- Campaign call A (structure)
- Campaign call B (funnel)
- Ad set call
- Ad call A (delivery)
- Ad call B (conversions)

**Wave 3** — quality + benchmarks (2 calls in parallel):
- Auction ranking benchmarks
- CTR industry benchmark

**Wave 4** — optional gated tools (3 calls in parallel, degrade gracefully):
- Datasets
- Creatives
- Videos

Total: ~16 MCP calls in 4 waves. Should complete in under 90 seconds total wall-clock time.

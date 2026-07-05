# Meta Ads MCP — Known Quirks and Workarounds

The Meta Ads MCP exposes Meta Marketing API data but with several quirks that are NOT documented anywhere except here. These were learned by running real audits — save yourself the wasted calls.

## Field name aliases

GoMarble field names → Meta MCP field names:

| GoMarble / common term | Meta MCP actual field |
|---|---|
| `spend` | `amount_spent` |
| purchase action | `actions:omni_purchase` (mostly returns "Not available" — see below) |
| Landing Page View | parse `"Website content views"` from `results.all_conversion_types` |
| Add to Cart | parse `"Website adds to cart"` from `results.all_conversion_types` |
| Initiate Checkout | parse `"Website checkouts initiated"` from `results.all_conversion_types` |
| Add Payment Info | parse `"Website adds of payment info"` |
| Purchase count | parse `"Website purchases"` OR use `results.value[0].values[0].value` |
| Conversion value (revenue) | `result_values[0].values[0].value` (returned as currency string) |
| ROAS | compute manually: `result_values ÷ amount_spent` (`purchase_roas` field returns "Not available") |
| Learning Phase status | use `delivery_sub_status` enum (LEARNING / FAIL); `learning_stage_info` is not exposed |
| Attribution window | `attribution_setting` enum on ad sets (7d_click, 1d_view_7d_click, etc.) |

## Fields that consistently return "Not available"

The Meta MCP's `ads_get_ad_entities` tool returns the string `"Not available"` instead of values for these fields at most levels, even though they exist in the API schema:

- `clicks`, `ctr`, `cpc`
- `actions:link_click`, `cost_per_link_click`
- `actions:omni_purchase`
- `purchase_roas`
- `3_second_video_plays`
- `video_thruplay_watched_actions`, `video_p25_watched_actions`, `video_p50_watched_actions`, `video_p75_watched_actions`, `video_p100_watched_actions`

**Workarounds:**

For **clicks / CTR / CPC** — use the insights tools:
- `ads_insights_performance_trend` (analysis_metric: "CTR" or "CPC" or "CPM") — returns per-ad % change with GOOD/BAD trend direction
- `ads_insights_industry_benchmark` (analysis_metric: "CTR") — returns per-ad % above/below industry benchmark

For **purchase_roas** — compute manually from `result_values` ÷ `amount_spent`. Both fields ARE returned correctly at campaign and ad set level.

For **video metrics (hook rate, hold rate)** — no workaround. The Meta MCP doesn't expose these. Flag as "verify in Ads Manager" in Section 10 of the audit.

## Field combinations that cause truncation

If you ask for too many action-typed fields in a single `ads_get_ad_entities` call, all of them will return "Not available." This is silent — there's no error. The fix is to split into multiple parallel calls.

**Reliable pattern:** Split structure + delivery metrics in Call A from action-typed fields in Call B. Example:

- Call A: `["name", "amount_spent", "impressions", "reach", "frequency", "cpm", "cpp"]`
- Call B: `["id", "name", "amount_spent", "results", "result_values", "cost_per_result"]`

NEVER combine in a single call:
- `purchase_roas` + `results` + `actions:omni_purchase`
- `clicks` + `results` + video metrics
- More than ~10 fields total

## Tools gated by account rollout

These return `"This tool is new and is being gradually rolled out across ad accounts"` for many accounts:

- `ads_get_datasets` (pixel list + last fired time)
- `ads_get_dataset_details`
- `ads_get_dataset_quality` (EMQ scores)
- `ads_get_dataset_stats` (event volume)
- `ads_get_creatives` (ad body/title/CTA)
- `ads_get_ad_videos` (video metadata)

When gated, **catch the error and degrade**. Don't fail the audit — just note in Section 10 of the report that these checks need manual verification.

## `is_ads_mcp_enabled` gate

Before running any audit, confirm the account's `is_ads_mcp_enabled` flag from `ads_get_ad_accounts` is `true`. If `false`, the entire MCP refuses to query the account. The audit must abort and ask the user to pick a different account.

## Account-level vs campaign-level data inconsistency

At account level, most action-typed metrics return "Not available" even when they're available at campaign level. **Workaround**: always aggregate manually from the campaign-level pull. Don't trust account-level conversion data.

Specifically:
- Account level returns `purchase_roas: "Not available"` but campaign level returns `result_values` with revenue.
- Sum campaign-level revenue manually to get the account-level ROAS.

## `breakdowns` with conversions

When you add `breakdowns: ["user_segment_key"]` to a call requesting conversion metrics, the conversions return "Not available." The breakdown works for spend / impressions / reach only. Don't try to get ROAS per segment per campaign in a single call.

**Workaround**: pull spend per segment separately, then pull conversions per campaign separately, then approximate. Or note in the audit that segment-level ROAS requires manual Ads Manager verification.

## Pagination

`ads_get_ad_entities` has a hard limit of 1000 entities per call and **does not expose a cursor**. For accounts with thousands of active ads, you can't paginate through everything. Workaround: filter tightly (e.g. by spend threshold) or pull per campaign.

For the audit, top 25 active campaigns + top 30 active ad sets + top 25 active ads is enough to cover 80%+ of spend on virtually any account.

## Insights tools quirks

### `ads_insights_industry_benchmark`
- Returns multiple "cohorts" based on optimization goal (OUTCOME_SALES vs RETURN_ON_AD_SPEND vs OFFSITE_CONVERSIONS). Process each cohort separately — they're not directly comparable.
- Sometimes returns `"No industry benchmark data available for the given criteria."` for ROAS or CPC. CTR is the most reliable benchmark.
- Requires `conversation_intent` AND `conversation_topic` — both must be enum values from the documented sets.

### `ads_insights_performance_trend`
- Returns % change and trend direction (GOOD/BAD), NOT absolute values.
- Same cohort splitting as the benchmark tool.

### `ads_insights_anomaly_signal`
- Often returns `"No anomaly signal data available"`. Don't depend on it.

### `ads_insights_auction_ranking_benchmarks`
- Returns Quality / Engagement / Conversion rankings per active ad.
- "Below Average (Bottom 35% of ads)" Quality is the critical flag — Meta will throttle reach for these ads.
- Sometimes returns `ERR_CONNECTION_CLOSED` on first call; retry once.

## Currency

The currency is on the account list (`ads_get_ad_accounts`), NOT on insights responses. Always pull the currency from the account list and prepend/append it to spend/revenue figures throughout the audit. Most Lotux accounts are EUR, some are CZK or USD.

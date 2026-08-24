# Working in the live ad account

## Read before you opine

For any question about the user's actual ads, pull live data first. Never diagnose from memory, from this
skill's examples, or from generic benchmarks.

Tools come from the Meta Ads MCP connector (`ads_*`). Names are stable; the server prefix may differ per
session, so resolve them via ToolSearch rather than hardcoding a prefix.

**Reads:**

| Tool | Use |
|---|---|
| `ads_get_ad_accounts` | Resolve the account. Check `is_queryable` before anything else. |
| `ads_get_ad_entities` | Campaigns / ad sets / ads plus metrics. Needs a time range for metrics, filtering or sorting. |
| `ads_get_field_context` | **Verify field names before using them.** Also reports which are filterable and sortable. |
| `ads_insights_performance_trend` | Time-series on CPC, CPM, CPR, ROAS, CTR, CVR. The right tool for "did this change or is it noise". |
| `ads_insights_anomaly_signal` | Surfaces unusual movement. |
| `ads_get_opportunity_score` | Meta's own recommendations. Treat as input, not instruction. |
| `ads_account_get_activity_logs` | **What actually changed and when.** Essential for the triage list — usually settles "did someone edit this" faster than guessing. |
| `ads_get_creatives`, `ads_get_ad_preview` | Inspect what the ads actually say and look like. |
| `ads_get_dataset_quality` | Tracking and pixel health. Check when numbers look wrong. |

Two practical notes: `ads_get_ad_entities` returns a capped subset, so to see both best and worst performers
you sort in each direction across two calls rather than assuming one call covers it; and account-level
requests accept neither filtering nor sorting.

## Establish the baseline first

Before judging anything, pull trailing 30-90 day performance and derive what is normal for **this** account.
Diagnose against that. Then follow the triage order in `metrics-and-diagnosis.md`, and use the activity log
early — a recent edit explains more sudden drops than any theory will.

## Writes — always proposed, never assumed

**Every write is proposed first and executed only on the user's explicit go-ahead for that specific action.**
Budget changes spend real money. Approval for one change is not approval for the next.

Before proposing, state: what will change, from what to what, what you expect to happen, when you will know,
and what would mean it is not working.

| Tool | Notes |
|---|---|
| `ads_update_entity` | Budgets, names, schedules, targeting. Reversible — prefer these first. |
| `ads_activate_entity` | Activating or pausing. Reversible. |
| `ads_create_campaign` / `ads_create_ad_set` / `ads_create_ad` | Creation. Higher stakes. |
| `ads_create_creative` | Required for any copy or media change — see below. |
| `ads_create_custom_audience` | Audience creation. |

Sequence writes by risk: reversible changes (budget, pause, activate) before creation.

## Platform constraints that bite

- **New ad sets are created paused.** They need explicit activation. Creating one is not launching it — say
  so clearly, or the user will think something is live when it is not.
- **Creatives are immutable.** Changing primary text, headline, media or CTA is impossible via update. You
  create a *new* creative and a *new* ad referencing it. Budget for that in any "just tweak the copy" request.
- **Budgets are integers in the currency's minor unit.** €50.00/day is `5000`. Getting this wrong by a factor
  of 100 is an expensive, easy mistake — double-check every budget value before submitting.
- **Update field names differ from create argument names.** On update it is `name`, `daily_budget`,
  `lifetime_budget` — not `campaign_name` or `campaign_daily_budget`. Unrecognised names are rejected.
- **Objectives must be ODAX** (`OUTCOME_SALES`, `OUTCOME_LEADS`, and so on). Legacy values are rejected.
- **Do not invent interest IDs.** Use broad geo targeting unless the user supplies real IDs. This aligns with
  the strategy anyway — see `targeting-and-audiences.md`.
- **EU targeting requires DSA fields** (`dsa_beneficiary`, `dsa_payor`). Relevant for any NL/EU campaign;
  they auto-fill from the business name but are worth setting deliberately.
- **CBO vs ABO.** Under a campaign with its own budget, do not set ad-set budgets or bid strategies; the API
  rejects it.
- **Conversion goals need a `promoted_object`** with the pixel, or the create is rejected.

## Automated rules

The scaling rules in `scaling.md` are configured in Ads Manager (select campaign → More → Automated rules),
not through these tools. Walk the user through creating them rather than implying you can set them up.

## Honesty about results

Report what happened, including when a write failed or a change did not have the predicted effect. If a
recommendation did not work, say so plainly and revise. Never describe a campaign as live when it was
created paused.

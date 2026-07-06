# meta-account-audit skill (Wellshave routines copy)

This skill is committed here so the weekly Meta audit routine can find and use it
in every future run — the routine prompt alone doesn't reference the skill by
name, so persisting it in-repo is what makes it discoverable via
`.claude/skills/` auto-loading.

**Original source:** Lotux Agency's `meta-account-audit` skill v20260602.

## Routine-specific overrides

The Wellshave weekly-meta-audit routine overrides two things from the skill's defaults:

1. **Reporting window** — routine uses last full Monday–Sunday week (with
   comparison week = 7 days prior), not the skill's default `last_30d`. Pass
   `time_range` explicitly instead of `date_preset` when following the skill's
   call patterns.
2. **Notion parent page** — routine uses the Wellshave-specific "Account Audits
   — Wellshave" page (`3733634e-5ea3-8171-8dc5-fac4830e43c3`) as parent
   directly, not Lotux Agency's `365b1dde-…` root with a company sub-page. All
   dated audits sit as direct children of that Wellshave page (matches
   existing convention set by prior audits).
3. **Slack posting** — routine sends the Slack summary in Dutch as a **DM to
   the Dustin Operator** bot (`U0BF4TD7CPP`, handle `@dustin_20`), which
   relays into `#creative_strategy` (`C0913MY42CV`). Do NOT post the summary
   directly into the channel — always route via the Operator DM. The skill
   itself only writes to Notion.
4. **Output language** — Wellshave routine writes both Notion + Slack in
   **Dutch**; the skill's report_structure template is in English. Translate
   headings and reads while keeping the section order intact.
5. **Notion title format** — `Wellshave® | Audit v{YYYYMMDD} ({week_start} –
   {week_end} {year})`, e.g. `Wellshave® | Audit v20260713 (6 – 12 juli
   2026)`. Date in the title is the run date (this Monday), not the reporting
   date.
6. **Date-range calc** — reporting week = the Mon–Sun that just closed
   relative to this Monday-morning run. Comparison week = the 7 days before
   that. Print `week_start` and `week_end` (ISO) explicitly in the first
   status update so a wrong window is caught immediately.

Everything else — the data-collection call sequence, MCP quirks (split A/B
calls, gated tools graceful-degrade), auction ranking cross-check, three-signal
creative scorecard, prioritized action list — should be followed as-is.

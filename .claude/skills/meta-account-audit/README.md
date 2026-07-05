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
3. **Slack posting** — routine adds a Slack summary in Dutch to
   `#creative_strategy` (`C0913MY42CV`) after the Notion page is created; the
   skill itself only writes to Notion.
4. **Output language** — Wellshave routine writes both Notion + Slack in
   **Dutch**; the skill's report_structure template is in English. Translate
   headings and reads while keeping the section order intact.

Everything else — the data-collection call sequence, MCP quirks (split A/B
calls, gated tools graceful-degrade), auction ranking cross-check, three-signal
creative scorecard, prioritized action list — should be followed as-is.

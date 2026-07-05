# claude-routines

Repo that holds Claude Code routine assets for Wellshave (skills, notes, config).

## Skills

Auto-loaded from `.claude/skills/<name>/SKILL.md`. Any routine or interactive
session started from this repo (or a worktree of it) will discover these.

- **`meta-account-audit`** — Lotux Agency's Meta Ads audit methodology (Niels +
  GoMarble hybrid). Used by the weekly Meta audit routine. See
  `.claude/skills/meta-account-audit/README.md` for the routine-specific
  overrides (weekly Mon–Sun window instead of last_30d, Wellshave-specific
  Notion parent, Slack summary in Dutch, Dutch output language).

## Routines

Routine prompts themselves live outside this repo (in the routines platform),
but should reference the skills here by name — e.g. "follow the
`meta-account-audit` skill methodology". When a routine's prompt and a skill
disagree, the routine wins (see the skill's README for the current overrides).

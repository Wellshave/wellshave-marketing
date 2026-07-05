# Notion Output Workflow

The audit posts to Notion under Lotux Agency's **Account Audits** page. Structure:

```
Account Audits  (page_id: 365b1dde-875d-80c9-8e21-deceaf77d3ba)
├── Proforto NL              ← created first time, reused after
│   ├── Proforto NL | Audit v20260519
│   ├── Proforto NL | Audit v20260612
│   └── ...
├── OhMyDotz
│   └── ...
```

## Parent IDs

- **Account Audits parent page:** `365b1dde-875d-80c9-8e21-deceaf77d3ba`
  - (URL: https://www.notion.so/lotuxagency/Account-Audits-365b1dde875d80c98e21deceaf77d3ba)

## Step 1 — Find or create the company page

The company page name should match the ad account's *brand name*, not its full Meta account name. Strip suffixes like " V1", " V2", " Ad Account", " International", etc. so audits for "Proforto NL" and "Proforto BE" both live under a single "Proforto" page. Use judgment — when in doubt, ask the user before creating a new company page that might be a duplicate.

### Search for existing company page

```
notion-search
  query: "[Company Name]"
  query_type: "internal"
  page_url: "365b1dde-875d-80c9-8e21-deceaf77d3ba"
  page_size: 10
  filters: {}
```

This scopes the search to the Account Audits page. Look in the results for a page titled exactly `[Company Name]` (no `Audit v...` suffix) — that's the company-level container.

### If company page doesn't exist

Create it:

```
notion-create-pages
  parent:
    type: "page_id"
    page_id: "365b1dde875d80c98e21deceaf77d3ba"
  pages:
    - properties: { title: "[Company Name]" }
      content: ""
      icon: "📊"   (optional)
```

Capture the returned `page_id` for use in Step 2.

## Step 2 — Create the dated audit page

Title format: `[Company Name] | Audit v[YYYYMMDD]`

Example: `Proforto NL | Audit v20260519`

Use the *full* Meta account name in the title (e.g. "Proforto NL" not just "Proforto") so multi-market clients get one page per market per audit.

```
notion-create-pages
  parent:
    type: "page_id"
    page_id: "[company page ID from Step 1]"
  pages:
    - properties: { title: "[Company Name] | Audit v[YYYYMMDD]" }
      content: "[full audit markdown from report_structure.md]"
      icon: "📈"   (optional)
```

The `content` field is the entire audit body. Notion-flavored markdown is supported — tables, headings, code blocks, bullet lists all render natively. **Do not include the page title at the top of the content** (Notion adds it automatically from `properties.title`).

## Step 3 — Return the Notion URL to the user

After creation, the `notion-create-pages` response includes the URL of the new page. Format it for chat as a Markdown link:

```markdown
**Audit posted:** [Company Name | Audit vYYYYMMDD](https://www.notion.so/...)
```

## Notion Markdown gotchas

- **Tables:** Use standard pipe-separated markdown. Notion renders them natively.
- **Currency symbols:** Use the actual symbol (`€`, `$`, `£`) — Notion handles unicode fine.
- **Emoji:** Inline emoji like 🚀 ⭐ ⚠️ 🚨 ✅ are supported and render correctly.
- **Headings:** Use `#`, `##`, `###`. Don't go deeper than `###` — Notion's rendering gets noisy.
- **Bold:** `**bold**` works. Don't use `__`.
- **Lists:** `-` or `1.` both work. Numbered lists auto-increment in Notion.
- **Horizontal rules:** `---` on its own line creates a divider.
- **Code blocks:** Triple backticks. Useful for the call-pattern reference, less useful in audit reports.

## Avoid editing existing audit pages

Each run creates a new dated page — never edit a previous audit. This preserves history. If the user asks for an update, treat it as a new audit, not an edit.

If a Notion page with the exact title (`[Company Name] | Audit v[YYYYMMDD]`) already exists (because two audits ran on the same date), append `-2`, `-3`, etc. to the title to differentiate.

## Confirm in chat

After Notion creation succeeds, post in chat:

```
**Audit posted:** [Company Name | Audit vYYYYMMDD](https://www.notion.so/...)

**Top 3 immediate actions:**
1. [Action 1]
2. [Action 2]
3. [Action 3]

**Surprises worth flagging:** [1-2 sentence call-out — security event, frequency red flag, dominant creative angle, etc.]
```

Keep under 150 words. The audit detail lives in Notion.

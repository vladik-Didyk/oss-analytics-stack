# Privacy Policy Disclosures — Design

**Date:** 2026-06-06
**Status:** Approved
**Scope:** Sub-project 1 of 2. (Sub-project 2 — an MCP server exposing this library's
commands to AI agents — will be designed separately after this ships.)

## Goal

When a user scaffolds analytics tools with `analytics-stack`, the CLI writes matching
privacy disclosures into the project's privacy policy. If no policy file exists, it
creates one. Vendors require this disclosure — e.g. GA4's "User Data Collection
Acknowledgement" makes site owners affirm they disclose data collection to visitors.

## Decisions

| Question | Decision |
|---|---|
| Output format | Markdown file at project root (`PRIVACY.md` by default) |
| Trigger in `init` | Toggle prompt, default **yes** |
| Existing-file handling | Managed marker block `<!-- BEGIN analytics-stack -->` … `<!-- END analytics-stack -->`; replace block if present, append if not |
| Content depth | Standard disclosure per tool: what it is, data collected, vendor privacy-policy link, opt-out link, consent-gating note. Placeholders (`[Your Company]`, `[Contact Email]`) + "not legal advice" disclaimer |
| Content location in repo | Single template with strip-blocks (same idiom as `templates/analytics/analytics.js`) |
| Upgrade path for existing users | Standalone `analytics-stack privacy` subcommand |
| `verify` integration | **Soft warning** (⚠), never a hard failure — must not break CI for users who manage their policy elsewhere |

## Background: how updates reach users

The package is a scaffolder run via `npx`, not a runtime dependency. Nothing changes on
users' machines automatically; they get this feature the next time they run any
`analytics-stack` command. Existing users must NOT be funneled through `init` to get the
policy — re-running `init` overwrites `analytics.js` and the consent component, clobbering
customizations. Hence the standalone `privacy` command.

## Components

### 1. Templates (new)

`templates/privacy/privacy-section.md` — the managed block content:

- `## Analytics & Cookies` heading.
- Intro paragraph: tools load **only after the visitor accepts analytics cookies**.
- Per-tool sections wrapped in HTML-comment markers, stripped when unselected:
  - `<!-- BEGIN GA4 -->` … `<!-- END GA4 -->` — Google Analytics 4 (Google LLC):
    pageviews, approximate location, device/browser info via `_ga`/`_ga_*` cookies;
    links to https://policies.google.com/privacy and https://tools.google.com/dlpage/gaoptout.
  - `<!-- BEGIN CLARITY -->` … `<!-- END CLARITY -->` — Microsoft Clarity (Microsoft):
    session recordings, heatmaps, click/scroll behavior; link to the Microsoft Privacy
    Statement (https://privacy.microsoft.com/privacystatement).
  - `<!-- BEGIN POSTHOG -->` … `<!-- END POSTHOG -->` — PostHog (PostHog Inc.):
    product analytics events, device info; link to https://posthog.com/privacy.

`templates/privacy/privacy-skeleton.md` — used only when no policy file exists:

- `# Privacy Policy` title, `_Last updated: __DATE___` (replaced at generation time).
- Short intro with `[Your Company]` / `[Contact Email]` placeholders.
- Disclaimer: generated starting point, **not legal advice**.
- `__ANALYTICS_SECTION__` placeholder where the managed block is inserted.

### 2. Shared module: `src/privacy.js` (new)

`patchPrivacyPolicy(cwd, tools)`:

1. **Detect existing policy** — first match at project root of:
   `PRIVACY.md`, `privacy.md`, `privacy-policy.md`, `PRIVACY-POLICY.md`.
   None found → create `PRIVACY.md` from the skeleton.
2. **Build the section** — read `privacy-section.md`, strip unselected tools using the
   `stripBlock()` pattern generalized to `<!-- BEGIN X -->` markers, wrap the result in
   `<!-- BEGIN analytics-stack -->` / `<!-- END analytics-stack -->`.
3. **Write** — if the file already contains the `analytics-stack` markers, replace that
   block (idempotent; tool changes update cleanly). Otherwise append at end of file.
4. **Return** `{ path, created }` so callers print `✔ Created PRIVACY.md` or
   `✔ Updated PRIVACY.md`.

`detectToolsFromEnvExample(cwd, framework)`:

- Reads `.env.example` for `{PREFIX}GA4_ID`, `{PREFIX}CLARITY_ID`, `{PREFIX}POSTHOG_KEY`
  (same keys `verify` checks) and returns the set of detected tools.

### 3. `init` changes (`src/commands/init.js`)

- New toggle prompt after "Where should files go?":
  *"Add analytics disclosures to your privacy policy?"* — default yes.
- Plan summary gains: `Privacy:    PRIVACY.md (create or update)`.
- Runs after the `.gitignore` patch, before dependency install.
- Next-steps output gains one line when enabled:
  *"Review PRIVACY.md, replace the [Your Company] placeholders, and link it from your site footer."*

### 4. New command: `analytics-stack privacy` (`src/commands/privacy.js`)

For existing installations (upgraders). Touches nothing except the policy file.

1. Detect framework (reuse `detectFramework`); fall back to a framework picker prompt.
2. Detect installed tools via `detectToolsFromEnvExample`; show a multiselect with
   detected tools pre-selected (min 1).
3. Run `patchPrivacyPolicy(cwd, tools)` and print the result + the same
   "review placeholders" next step.

Registered in `src/index.js` with lazy import (same pattern as `verify`), added to help
text under Commands.

### 5. `verify` addition (`src/commands/verify.js`)

- New check: a known policy file exists AND contains the `analytics-stack` markers.
- Reported as a **warning** (⚠, via `warn()`), not a failed check — does not affect the
  exit code. Message points to `npx analytics-stack privacy`.

### 6. Documentation updates

- `README.md` — add `privacy` to the commands list; add a "Privacy policy generation"
  feature bullet/section with the marker-block explanation and the disclaimer.
- `docs/privacy-policy.md` (new) — what gets generated, the marker-block contract
  (user text outside markers is never touched), re-running after changing tools,
  per-tool disclosure summary, not-legal-advice disclaimer.
- `docs/installation.md` — mention the new prompt in the init walkthrough and the
  `privacy` command for existing installations.
- Help text in `src/index.js` (covered in §4).
- `package.json` — add `privacy-policy` keyword; version bump `0.1.1 → 0.2.0` (new
  feature, semver minor) at release time.

## Error handling

- Existing policy file unreadable → `warn()` and skip; never corrupt user content
  (consistent with `patchEnvExample`'s soft-failure style).
- `<!-- BEGIN analytics-stack -->` present without matching `END` → `warn()` and append
  a fresh, well-formed block; do not attempt to repair the broken one.
- `.env.example` missing in the `privacy` command → no pre-selection; multiselect
  defaults to all tools selected.

## Testing

No test framework exists in the repo. Smoke-test `init` and `privacy` in a temp dir:

1. No policy file → `PRIVACY.md` created from skeleton with only selected tools.
2. Existing policy without markers → block appended; user content untouched.
3. Existing policy with markers, different tool selection → block replaced cleanly.
4. `privacy` command in a project with `.env.example` → tools pre-detected.
5. `verify` in a project without a policy → warning shown, exit code unchanged.

## Out of scope (future)

- **MCP server** (sub-project 2) — expose init/verify/privacy as MCP tools for AI agents.
- Framework-native `/privacy` page generation.
- Full GDPR-style legal template (data controller, legal basis, retention, rights).
- Localized/translated policy text.

# Privacy policy generation

You're expected to disclose data collection to your visitors. GA4's terms
include an explicit "User Data Collection Acknowledgement"; for Clarity and
PostHog the obligation comes from privacy law (GDPR, CCPA, and similar,
depending on your jurisdiction). `analytics-stack` generates the matching
disclosure text for exactly the tools you installed.

> ⚠️ **Not legal advice.** The generated text is a starting point. Review it
> with a qualified professional and adapt it to your jurisdiction before
> publishing.

## How it works

Two entry points, same engine:

- **`npx analytics-stack init`** — asks "Add analytics disclosures to your
  privacy policy?" (default: yes) as part of scaffolding.
- **`npx analytics-stack privacy`** — standalone command for existing
  installations. Detects your framework and which tools you installed (from
  `.env.example`), pre-selects them, and updates only the policy file. Nothing
  else in your project is touched.

## What gets written

The CLI looks for an existing policy file at the project root, in this order:
`PRIVACY.md`, `privacy.md`, `privacy-policy.md`, `PRIVACY-POLICY.md`.

**If none exists**, it creates `PRIVACY.md` from a skeleton: title, last-updated
date, `[Your Company]` / `[Contact Email]` placeholders, a not-legal-advice
note, and the disclosure block.

**If one exists**, only the managed block is added or replaced:

```markdown
<!-- BEGIN analytics-stack -->
## Analytics & Cookies
...one section per installed tool...
<!-- END analytics-stack -->
```

## The marker-block contract

- Text **outside** the markers is yours — the CLI never modifies it.
- Text **inside** the markers belongs to the CLI — it is fully replaced on every
  run, so don't hand-edit inside the block (your edits would be overwritten).
  Want different wording? Move the text outside the markers and delete the block.
- Re-running after changing your tool selection updates the block to match.
- If the markers are broken (a `BEGIN` without an `END`), the CLI appends a
  fresh block and warns you to remove the old one manually — it never guesses
  at deleting your content.

## Per-tool disclosures

Each enabled tool gets a section covering: who the vendor is, what data it
collects, a link to the vendor's privacy policy, an opt-out link where the
vendor provides one, and a note that nothing is collected before the visitor
accepts analytics cookies (which is literally true — see
[consent gating](./consent-mode.md)).

| Tool | Vendor policy | Opt-out |
|---|---|---|
| Google Analytics 4 | https://policies.google.com/privacy | https://tools.google.com/dlpage/gaoptout |
| Microsoft Clarity | https://privacy.microsoft.com/privacystatement | — |
| PostHog | https://posthog.com/privacy | — |

## After generating

1. Replace `[Your Company]` and `[Contact Email]` placeholders.
2. Review the text (and ideally have a professional review it).
3. Link the policy from your site footer.
4. `npx analytics-stack verify` will warn (softly — it never fails the run) if
   your policy is missing the disclosure block.

# "Not sure" Privacy Option with AI-Memory Handoff — Design

**Date:** 2026-06-06
**Status:** Approved
**Builds on:** 2026-06-06-privacy-policy-disclosures-design.md (shipped, unpublished)

## Goal

The `init` privacy question becomes a three-way choice: **Yes / No / I'm not sure**.
"Not sure" defers the decision without losing it: the CLI prints a short
plain-language explanation, saves a structured note into the project's AI memory
file(s) (CLAUDE.md / AGENTS.md / GEMINI.md), and the user's AI assistant explains
the decision and offers to run `npx analytics-stack privacy` later. Generating
the disclosures by any path automatically clears the note.

## Decisions

| Question | Decision |
|---|---|
| Prompt type | `select` with Yes / No / "I'm not sure — save a note for my AI assistant" (default Yes) |
| Where the note goes | Every existing AI memory file among `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`; if none exist, create `AGENTS.md` (cross-tool standard) |
| Immediate UX on "unsure" | 3-line plain-language explanation + `✔ Saved <file> — note for your AI assistant` + next-steps line |
| Note format | Managed marker block `<!-- BEGIN analytics-stack:pending-privacy -->` … `<!-- END analytics-stack:pending-privacy -->`; idempotent upsert |
| Cleanup | `patchPrivacyPolicy` success (init "yes", re-run, or `privacy` command) removes the note from all memory files. A memory file left empty (we created it solely for the note) is deleted; files with user content are only trimmed |
| Standalone `privacy` command | Unchanged — invoking it *is* the decision |
| Version | Stays 0.2.0 (never published; folds into the same release) |

## Components

### 1. Template (new): `templates/privacy/pending-note.md`

Markdown note addressed to AI assistants, with a `__TOOLS__` placeholder
(comma-separated selected tool ids substituted at save time):

- `## Pending decision: privacy policy` heading.
- Context: the user ran `npx analytics-stack init` and answered "I'm not sure"
  about adding disclosures for `__TOOLS__`.
- Instructions to the assistant: explain that GA4/Clarity/PostHog expect
  data-collection disclosure (e.g. GA4's User Data Collection Acknowledgement);
  that `npx analytics-stack privacy` generates the text inside the
  `analytics-stack` markers without touching the user's own policy text; that
  the output is a starting point, not legal advice; then offer to run it
  together and review the result.

### 2. `src/privacy.js` additions

- `NOTE_BEGIN` / `NOTE_END` constants (`<!-- BEGIN analytics-stack:pending-privacy -->` pair).
- `MEMORY_FILENAMES = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"]`.
- `upsertManagedBlock(text, block, begin = BLOCK_BEGIN, end = BLOCK_END)` —
  generalized with optional marker params; existing callers unchanged.
- `removeManagedBlock(text, begin = BLOCK_BEGIN, end = BLOCK_END)` →
  `{content, removed}` — removes the block including markers, collapses
  leftover blank lines, never touches text outside the markers.
- `savePendingPrivacyNote(cwd, tools)` → array of written paths. Targets every
  existing memory file, else creates `AGENTS.md`. Uses the upsert (idempotent;
  re-running replaces the note). Soft-fails per file via the existing `tryWrite`.
- `clearPendingPrivacyNote(cwd)` → array of cleared paths. For each memory file
  containing `NOTE_BEGIN`: remove the block; if the remaining content is
  whitespace-only, delete the file (`unlinkSync`, try/catch), else write the
  trimmed content.
- `patchPrivacyPolicy` calls `clearPendingPrivacyNote(cwd)` after each
  successful write (both create and update branches), establishing the
  auto-cleanup invariant in one place.

### 3. `init` changes (`src/commands/init.js`)

- The `privacy` toggle becomes a `select` (values `"yes"` / `"no"` / `"unsure"`,
  initial Yes). NOTE: this changes the smoke-script inject value from `true` to
  `"yes"` — the positional-coupling comment already flags this file pairing.
- Plan summary: `yes` → existing line; `unsure` →
  `Privacy:    deferred (note saved for your AI assistant)`; `no` → no line.
- Step 7: `yes` → existing patch behavior; `unsure` → print the explanation
  (3 `info` lines), call `savePendingPrivacyNote`, print one
  `✔ Saved <relpath> — note for your AI assistant` per written file.
- Next steps: `yes` → existing line; `unsure` →
  `Decide on the privacy policy when ready: npx analytics-stack privacy (your AI assistant has the context)`.
- `printNextSteps(framework, tools, privacy)` now receives the string answer.

### 4. Smoke script update (`scripts/smoke-e2e.mjs`)

- Existing init inject: `true` → `"yes"`.
- New scenario in a second temp project: init injected with `"unsure"` →
  assert no `PRIVACY.md`, assert `AGENTS.md` contains
  `analytics-stack:pending-privacy`; then run the `privacy` command → assert
  the policy exists AND `AGENTS.md` is gone (it contained only the note).

### 5. Documentation

- README "Privacy policy disclosures" section: short "Not sure yet?" paragraph
  (note saved to AI memory files, cleared automatically once generated).
- `docs/privacy-policy.md`: new "Not sure yet?" section documenting the memory
  files, the `pending-privacy` marker, and the auto-cleanup contract.
- `docs/installation.md`: item 6 wording → "yes / no / not sure ('not sure'
  saves a note for your AI assistant)".

## Error handling

- Memory file unreadable → treated as empty for upsert; write failures warn and
  skip that file (existing `tryWrite`).
- `unlinkSync` failure when deleting an emptied note-only file → ignore, leave
  the trimmed file in place.
- Broken `pending-privacy` markers → same conservative behavior as the policy
  block: upsert appends a fresh block; remove only acts when both markers exist.

## Testing

Unit (node:test, added to test/privacy.test.js):
1. `upsertManagedBlock` honors custom markers.
2. `removeManagedBlock` removes block + markers, preserves surrounding text;
   `removed:false` when markers absent.
3. `savePendingPrivacyNote`: creates AGENTS.md when no memory file exists (note
   contains tool ids, no `__TOOLS__` leftover); writes to ALL existing memory
   files; idempotent (exactly one block after two saves).
4. `clearPendingPrivacyNote`: trims file with user content (content preserved);
   deletes a file that contained only the note; no-op (returns []) when no notes.
5. `patchPrivacyPolicy` auto-clears a previously saved note.

E2E: smoke scenario in §4.

## Out of scope

- Three-way prompt in the standalone `privacy` command.
- Watching for memory-file formats beyond CLAUDE.md / AGENTS.md / GEMINI.md.
- MCP server (still sub-project 2).

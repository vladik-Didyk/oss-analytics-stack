# "Not sure" Privacy Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `init`'s privacy question becomes Yes / No / "I'm not sure"; "unsure" saves an explanatory note into the project's AI memory files (CLAUDE.md/AGENTS.md/GEMINI.md, creating AGENTS.md if none), and generating disclosures later auto-clears the note.

**Architecture:** Reuse the managed-block machinery in `src/privacy.js`: generalize `upsertManagedBlock` to custom markers, add `removeManagedBlock`, `savePendingPrivacyNote`, `clearPendingPrivacyNote`; hook auto-cleanup into `patchPrivacyPolicy`. `init` switches the toggle to a select with an `unsure` branch.

**Tech Stack:** Node 18+ ESM, node:test, prompts, picocolors (no new deps).

**Spec:** `docs/superpowers/specs/2026-06-06-privacy-unsure-option-design.md`

Run all commands from the repo root: `/Users/vlad/Desktop/Developing/web-apps/analytics-stack`. Current suite: 18 passing tests.

---

## File map

| File | Action |
|---|---|
| `templates/privacy/pending-note.md` | Create — AI-assistant note with `__TOOLS__` placeholder |
| `src/privacy.js` | Modify — marker generalization, remove/save/clear functions, auto-cleanup hook |
| `test/privacy.test.js` | Modify — ~10 new tests |
| `src/commands/init.js` | Modify — select prompt + unsure branch |
| `scripts/smoke-e2e.mjs` | Modify — inject `"yes"`, new unsure scenario |
| `README.md`, `docs/privacy-policy.md`, `docs/installation.md` | Modify — "Not sure yet?" docs |

---

### Task 1: Pending-note template

**Files:**
- Create: `templates/privacy/pending-note.md`

- [ ] **Step 1: Create the file** with exactly:

````markdown
## Pending decision: privacy policy

The user ran `npx analytics-stack init` and answered "I'm not sure" when asked
to add analytics disclosures (__TOOLS__) to this project's privacy policy.

AI assistant: when the user works on this project, explain in simple terms:

- GA4, Clarity, and PostHog expect sites to disclose data collection to
  visitors (e.g. GA4's "User Data Collection Acknowledgement").
- `npx analytics-stack privacy` generates the matching disclosure text inside
  `<!-- BEGIN analytics-stack -->` markers — the user's own policy text is
  never touched, and the generated text is a starting point, not legal advice.

Then offer to run `npx analytics-stack privacy` together and review the
generated text. Once the disclosures are generated, this note is removed
automatically.
````

(`__TOOLS__` is a literal placeholder replaced at save time — keep it verbatim.)

- [ ] **Step 2: Verify** — `ls templates/privacy/` shows three files (pending-note.md, privacy-section.md, privacy-skeleton.md).

- [ ] **Step 3: Commit**

```bash
git add templates/privacy/pending-note.md
git commit -m "feat: add pending-privacy note template for AI memory files

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Marker generalization + `removeManagedBlock` (TDD)

**Files:**
- Modify: `src/privacy.js`
- Test: `test/privacy.test.js`

- [ ] **Step 1: Write failing tests** — append to `test/privacy.test.js` (add `removeManagedBlock` to the existing `../src/privacy.js` import):

```js
test("upsertManagedBlock honors custom markers", () => {
  const B = "<!-- BEGIN custom -->";
  const E = "<!-- END custom -->";
  const block = `${B}\nold note\n${E}`;
  const first = upsertManagedBlock("# File\n\ntext\n", block, B, E);
  assert.equal(first.action, "appended");
  assert.match(first.content, /old note/);
  const second = upsertManagedBlock(first.content, `${B}\nnew note\n${E}`, B, E);
  assert.equal(second.action, "replaced");
  assert.match(second.content, /new note/);
  assert.doesNotMatch(second.content, /old note/);
  assert.equal(second.content.split(B).length, 2);
});

test("removeManagedBlock removes block and markers, preserves surroundings", () => {
  const B = "<!-- BEGIN custom -->";
  const E = "<!-- END custom -->";
  const text = `# Title\n\nbefore\n\n${B}\nthe note\n${E}\n\nafter\n`;
  const { content, removed } = removeManagedBlock(text, B, E);
  assert.equal(removed, true);
  assert.doesNotMatch(content, /the note/);
  assert.doesNotMatch(content, /custom/);
  assert.match(content, /before/);
  assert.match(content, /after/);
  assert.doesNotMatch(content, /\n{3,}/);
});

test("removeManagedBlock is a no-op when markers are absent or broken", () => {
  const B = "<!-- BEGIN custom -->";
  const E = "<!-- END custom -->";
  assert.deepEqual(removeManagedBlock("plain text\n", B, E), { content: "plain text\n", removed: false });
  const broken = `text\n${B}\norphan\n`;
  assert.deepEqual(removeManagedBlock(broken, B, E), { content: broken, removed: false });
});
```

- [ ] **Step 2: Run `npm test` — expect FAIL** (`removeManagedBlock` not exported; custom-marker test fails because current upsert ignores extra args). 18 old tests still pass.

- [ ] **Step 3: Implement.** In `src/privacy.js`:

Change the `upsertManagedBlock` signature and body to use marker params (keep the existing comment block):

```js
export function upsertManagedBlock(policyText, block, begin = BLOCK_BEGIN, end = BLOCK_END) {
  const hasBegin = policyText.includes(begin);
  const hasEnd = policyText.includes(end);
  if (hasBegin && hasEnd) {
    const re = new RegExp(`${escapeRe(begin)}[\\s\\S]*?${escapeRe(end)}`);
    return { content: policyText.replace(re, () => block.trim()), action: "replaced" };
  }
  const body = policyText.trimEnd();
  const appended = (body ? body + "\n\n" : "") + block.trim() + "\n";
  return { content: appended, action: hasBegin || hasEnd ? "appended-broken" : "appended" };
}
```

Add after it:

```js
// Remove a managed block (markers included). No-op unless BOTH markers exist —
// same conservative stance as upsert on broken markers.
export function removeManagedBlock(text, begin = BLOCK_BEGIN, end = BLOCK_END) {
  if (!text.includes(begin) || !text.includes(end)) return { content: text, removed: false };
  const re = new RegExp(`\\n?[ \\t]*${escapeRe(begin)}[\\s\\S]*?${escapeRe(end)}\\n?`);
  const content = text.replace(re, "\n").replace(/\n{3,}/g, "\n\n");
  return { content, removed: true };
}
```

- [ ] **Step 4: Run `npm test` — expect PASS, 21 tests.**

- [ ] **Step 5: Commit**

```bash
git add src/privacy.js test/privacy.test.js
git commit -m "feat: generalize managed-block upsert to custom markers, add removeManagedBlock

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `savePendingPrivacyNote` / `clearPendingPrivacyNote` + auto-cleanup (TDD)

**Files:**
- Modify: `src/privacy.js`
- Test: `test/privacy.test.js`

- [ ] **Step 1: Write failing tests** — append (import `savePendingPrivacyNote`, `clearPendingPrivacyNote`, `NOTE_BEGIN` from `../src/privacy.js`; `existsSync` from node:fs if not already imported in the test file — check first):

```js
test("savePendingPrivacyNote creates AGENTS.md when no memory file exists", () => {
  const dir = tmp();
  const written = savePendingPrivacyNote(dir, new Set(["ga4", "posthog"]));
  assert.deepEqual(written, [join(dir, "AGENTS.md")]);
  const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
  assert.match(content, /Pending decision: privacy policy/);
  assert.match(content, /ga4, posthog/);
  assert.doesNotMatch(content, /__TOOLS__/);
  assert.ok(content.includes(NOTE_BEGIN));
});

test("savePendingPrivacyNote writes to every existing memory file", () => {
  const dir = tmp();
  writeFileSync(join(dir, "CLAUDE.md"), "# My project notes\n");
  writeFileSync(join(dir, "AGENTS.md"), "# Agent rules\n");
  const written = savePendingPrivacyNote(dir, new Set(["clarity"]));
  assert.equal(written.length, 2);
  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const content = readFileSync(join(dir, name), "utf8");
    assert.ok(content.includes(NOTE_BEGIN), `${name} missing note`);
    assert.match(content, /^# /); // user content preserved at top
  }
});

test("savePendingPrivacyNote is idempotent", () => {
  const dir = tmp();
  savePendingPrivacyNote(dir, new Set(["ga4"]));
  savePendingPrivacyNote(dir, new Set(["ga4", "clarity"]));
  const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
  assert.equal(content.split(NOTE_BEGIN).length, 2); // exactly one block
  assert.match(content, /ga4, clarity/); // updated tools
});

test("clearPendingPrivacyNote trims files with user content, deletes note-only files", () => {
  const dir = tmp();
  writeFileSync(join(dir, "CLAUDE.md"), "# Keep me\n");
  savePendingPrivacyNote(dir, new Set(["ga4"])); // writes into CLAUDE.md only
  savePendingPrivacyNote(dir, new Set(["ga4"]));
  // also create a note-only AGENTS.md by saving into an empty dir scenario:
  const dir2 = tmp();
  savePendingPrivacyNote(dir2, new Set(["ga4"]));

  const cleared1 = clearPendingPrivacyNote(dir);
  assert.deepEqual(cleared1, [join(dir, "CLAUDE.md")]);
  const kept = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  assert.match(kept, /# Keep me/);
  assert.ok(!kept.includes(NOTE_BEGIN));

  const cleared2 = clearPendingPrivacyNote(dir2);
  assert.deepEqual(cleared2, [join(dir2, "AGENTS.md")]);
  assert.equal(existsSync(join(dir2, "AGENTS.md")), false); // note-only file deleted
});

test("clearPendingPrivacyNote returns [] when nothing to clear", () => {
  assert.deepEqual(clearPendingPrivacyNote(tmp()), []);
});

test("patchPrivacyPolicy auto-clears a pending note", () => {
  const dir = tmp();
  savePendingPrivacyNote(dir, new Set(["ga4"]));
  patchPrivacyPolicy(dir, new Set(["ga4"]));
  assert.equal(existsSync(join(dir, "AGENTS.md")), false);
  assert.equal(existsSync(join(dir, "PRIVACY.md")), true);
});
```

- [ ] **Step 2: Run `npm test` — expect FAIL** (functions not exported). 21 old tests pass.

- [ ] **Step 3: Implement.** In `src/privacy.js`, add `unlinkSync` to the node:fs import, then append:

```js
export const NOTE_BEGIN = "<!-- BEGIN analytics-stack:pending-privacy -->";
export const NOTE_END = "<!-- END analytics-stack:pending-privacy -->";

// AI memory files we know how to write a pending-decision note into.
export const MEMORY_FILENAMES = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"];

// Save the "user is not sure about the privacy policy" note into every existing
// AI memory file — or a new AGENTS.md when the project has none.
// Returns the paths actually written.
export function savePendingPrivacyNote(cwd, tools) {
  const template = readFileSync(join(TEMPLATES, "privacy", "pending-note.md"), "utf8");
  const note = template.replace("__TOOLS__", () => [...tools].join(", ")).trim();
  const block = `${NOTE_BEGIN}\n${note}\n${NOTE_END}`;
  const existing = MEMORY_FILENAMES.map((name) => join(cwd, name)).filter((p) => existsSync(p));
  const targets = existing.length > 0 ? existing : [join(cwd, "AGENTS.md")];
  const written = [];
  for (const path of targets) {
    const current = readText(path) || "";
    const { content } = upsertManagedBlock(current, block, NOTE_BEGIN, NOTE_END);
    if (tryWrite(path, content)) written.push(path);
  }
  return written;
}

// Remove the pending note from all memory files. Files we created solely for
// the note (nothing left but whitespace) are deleted. Returns cleared paths.
export function clearPendingPrivacyNote(cwd) {
  const cleared = [];
  for (const name of MEMORY_FILENAMES) {
    const path = join(cwd, name);
    const current = readText(path);
    if (current === null || !current.includes(NOTE_BEGIN)) continue;
    const { content, removed } = removeManagedBlock(current, NOTE_BEGIN, NOTE_END);
    if (!removed) continue;
    if (content.trim() === "") {
      try {
        unlinkSync(path);
        cleared.push(path);
      } catch {
        // Leave the trimmed file in place if deletion fails.
        if (tryWrite(path, content)) cleared.push(path);
      }
    } else if (tryWrite(path, content)) {
      cleared.push(path);
    }
  }
  return cleared;
}
```

Then hook the auto-cleanup into `patchPrivacyPolicy`: in BOTH success returns, call `clearPendingPrivacyNote(cwd)` right before `return`:

```js
    if (!tryWrite(path, content)) return null;
    clearPendingPrivacyNote(cwd);
    return { path, created: true };
```

```js
  if (!tryWrite(existingPath, content)) return null;
  clearPendingPrivacyNote(cwd);
  return { path: existingPath, created: false };
```

- [ ] **Step 4: Run `npm test` — expect PASS, 27 tests.**

- [ ] **Step 5: Commit**

```bash
git add src/privacy.js test/privacy.test.js
git commit -m "feat: save/clear pending-privacy notes in AI memory files; auto-clear on generate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `init` three-way prompt

**Files:**
- Modify: `src/commands/init.js`

No unit test (interactive); Task 5's smoke covers it. Verify with `npm test` (27 green) + `node --check`.

- [ ] **Step 1: Import.** Extend the privacy import to:

```js
import { patchPrivacyPolicy, savePendingPrivacyNote } from "../privacy.js";
```

- [ ] **Step 2: Replace the toggle prompt** (the `name: "privacy"` question) with:

```js
      {
        type: "select",
        name: "privacy",
        message: "Add analytics disclosures to your privacy policy?",
        choices: [
          { title: "Yes", value: "yes" },
          { title: "No", value: "no" },
          { title: "I'm not sure — save a note for my AI assistant", value: "unsure" },
        ],
        initial: 0,
      },
```

- [ ] **Step 3: Plan summary.** Replace the existing `if (answers.privacy) {...}` plan-line block with:

```js
  if (answers.privacy === "yes") {
    process.stdout.write(`  Privacy:    PRIVACY.md (create or update)\n`);
  } else if (answers.privacy === "unsure") {
    process.stdout.write(`  Privacy:    deferred (note saved for your AI assistant)\n`);
  }
```

- [ ] **Step 4: Step 7 branch.** Replace the `// 7. Privacy policy disclosures` block with:

```js
  // 7. Privacy policy disclosures
  if (answers.privacy === "yes") {
    const privacyResult = patchPrivacyPolicy(cwd, tools);
    if (privacyResult) {
      step(privacyResult.created ? "Created" : "Updated", relPath(cwd, privacyResult.path));
    }
  } else if (answers.privacy === "unsure") {
    blank();
    info("No problem — skipping the privacy policy for now. In short: GA4, Clarity and");
    info("PostHog expect you to tell visitors what data is collected. This tool can");
    info("generate that text for you, without touching anything you wrote yourself.");
    for (const notedPath of savePendingPrivacyNote(cwd, tools)) {
      step("Saved", `${relPath(cwd, notedPath)} — note for your AI assistant`);
    }
  }
```

- [ ] **Step 5: Next steps.** In `printNextSteps`, replace the `if (privacy) {...}` block with:

```js
  if (privacy === "yes") {
    process.stdout.write(
      `  ${c.bold(`${n++}.`)} Review ${c.cyan("PRIVACY.md")} — replace the ${c.cyan("[Your Company]")} placeholders and link it from your site footer.\n`
    );
    blank();
  } else if (privacy === "unsure") {
    process.stdout.write(
      `  ${c.bold(`${n++}.`)} Decide on the privacy policy when ready: ${c.cyan("npx analytics-stack privacy")} ${c.dim("(your AI assistant has the context)")}\n`
    );
    blank();
  }
```

(The call site already passes `answers.privacy`; it's now a string.)

- [ ] **Step 6: Verify** — `node --check src/commands/init.js`; `npm test` → 27 pass; `node bin/cli.js help` exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/commands/init.js
git commit -m "feat: three-way privacy prompt in init — yes / no / not sure

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Smoke-script update

**Files:**
- Modify: `scripts/smoke-e2e.mjs`

- [ ] **Step 1: Update the init inject** — in the scenario-1 inject array, change `true,              // privacy` to `"yes",             // privacy`.

- [ ] **Step 2: Add the unsure scenario.** After the current step-4 block (verify missing-policy warning) and before `console.log(...smoke OK...)`, insert (reusing the already-imported `initCommand`/`privacyCommand` and `existsSync` — add `existsSync` to the node:fs import if absent):

```js
// --- 5. init with "unsure" — no policy, note saved to AGENTS.md ---
const tmp2 = mkdtempSync(join(tmpdir(), "astack-smoke-"));
writeFileSync(
  join(tmp2, "package.json"),
  JSON.stringify({ name: "smoke-app-2", dependencies: { vite: "^5.0.0", react: "^18.0.0" } }, null, 2)
);
process.chdir(tmp2);
prompts.inject([
  "vite-react",  // framework
  ["ga4"],       // tools
  false,         // typescript
  "src",         // outDir
  "unsure",      // privacy
  false,         // installDeps
  true,          // confirm
]);
await initCommand([]);
if (existsSync(join(tmp2, "PRIVACY.md"))) fail("unsure: PRIVACY.md should not be created");
const agentsMd = readFileSync(join(tmp2, "AGENTS.md"), "utf8");
if (!agentsMd.includes("analytics-stack:pending-privacy")) fail("unsure: AGENTS.md note missing");

// --- 6. privacy command generates the policy and clears the note ---
prompts.inject([["ga4"]]);
await privacyCommand([]);
if (!readFileSync(join(tmp2, "PRIVACY.md"), "utf8").includes("Google Analytics 4"))
  fail("unsure: policy missing after privacy run");
if (existsSync(join(tmp2, "AGENTS.md"))) fail("unsure: note-only AGENTS.md should be deleted");
```

Update the final cleanup to also remove tmp2:

```js
console.log(`\n✨ smoke OK (${tmp}, ${tmp2})`);
rmSync(tmp, { recursive: true, force: true });
rmSync(tmp2, { recursive: true, force: true });
```

Adjust the crash-catch message to mention both dirs if convenient (optional; `tmp2` may be undefined on early crash — guard with `tmp2 ?? "n/a"` or leave as-is).

- [ ] **Step 3: Run it** — `node scripts/smoke-e2e.mjs` → `✨ smoke OK`, exit 0. Then `npm test` → 27 pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-e2e.mjs
git commit -m "test: smoke-cover the unsure flow and note auto-cleanup

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Documentation

**Files:**
- Modify: `README.md`, `docs/privacy-policy.md`, `docs/installation.md`

- [ ] **Step 1: README.** In the "Privacy policy disclosures" section, after the paragraph that starts "`init` offers to write per-tool disclosure sections..." add:

```markdown
Not sure yet? Pick **"I'm not sure"** and the CLI saves a short note into your
project's AI memory file (`CLAUDE.md` / `AGENTS.md` / `GEMINI.md` — `AGENTS.md`
is created if you have none), so your AI assistant can explain the decision and
run it with you later. Generating the disclosures clears the note automatically.
```

- [ ] **Step 2: docs/privacy-policy.md.** After the "## How it works" section, add:

````markdown
## Not sure yet?

Answering **"I'm not sure"** during `init` skips the policy step and saves a
note for your AI assistant instead:

- The note goes into every AI memory file your project already has
  (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`). If none exist, `AGENTS.md` is
  created.
- It lives between `<!-- BEGIN analytics-stack:pending-privacy -->` markers —
  the same managed-block contract as the policy itself, so your own notes in
  those files are never touched.
- The note asks the assistant to explain the disclosure requirement and offer
  to run `npx analytics-stack privacy` with you.
- As soon as disclosures are generated (by `init` or the `privacy` command),
  the note is removed automatically. If `AGENTS.md` contained nothing but the
  note, the file itself is deleted.
````

- [ ] **Step 3: docs/installation.md.** Change list item 6 from:

```markdown
6. Ask whether to add analytics disclosures to your privacy policy (default yes)
```

to:

```markdown
6. Ask whether to add analytics disclosures to your privacy policy (yes / no /
   not sure — "not sure" saves a note for your AI assistant to explain later)
```

- [ ] **Step 4: Verify** — `grep -c "not sure" README.md docs/privacy-policy.md docs/installation.md` → ≥1 each; `npm test` → 27 pass.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/privacy-policy.md docs/installation.md
git commit -m "docs: document the 'not sure' privacy option and AI-memory handoff

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage map

| Spec section | Task |
|---|---|
| §1 pending-note template | Task 1 |
| §2 marker generalization, remove/save/clear, auto-cleanup | Tasks 2, 3 |
| §3 init select + unsure branch | Task 4 |
| §4 smoke update | Task 5 |
| §5 docs | Task 6 |
| Error handling (tryWrite, unlink fallback, broken markers) | Tasks 2-3 code+tests |
| Testing §1-5 | Tasks 2-3 (unit), Task 5 (e2e) |

// Tests for src/privacy.js — run with `npm test` (node --test).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripToolBlocks, upsertManagedBlock, removeManagedBlock, BLOCK_BEGIN, BLOCK_END } from "../src/privacy.js";
import { buildPrivacySection, findPolicyFile, patchPrivacyPolicy, detectToolsFromEnvExample } from "../src/privacy.js";
import { savePendingPrivacyNote, clearPendingPrivacyNote, NOTE_BEGIN } from "../src/privacy.js";
import { getFrameworkById } from "../src/detect.js";

const SAMPLE = `## Analytics & Cookies

intro text

<!-- BEGIN GA4 -->
### Google Analytics 4
ga4 body
<!-- END GA4 -->

<!-- BEGIN CLARITY -->
### Microsoft Clarity
clarity body
<!-- END CLARITY -->

<!-- BEGIN POSTHOG -->
### PostHog
posthog body
<!-- END POSTHOG -->
`;

test("stripToolBlocks keeps selected tools and removes their marker lines", () => {
  const out = stripToolBlocks(SAMPLE, new Set(["ga4", "clarity", "posthog"]));
  assert.match(out, /### Google Analytics 4/);
  assert.match(out, /### Microsoft Clarity/);
  assert.match(out, /### PostHog/);
  assert.doesNotMatch(out, /<!-- BEGIN (GA4|CLARITY|POSTHOG) -->/);
  assert.doesNotMatch(out, /<!-- END (GA4|CLARITY|POSTHOG) -->/);
});

test("stripToolBlocks removes unselected tools entirely", () => {
  const out = stripToolBlocks(SAMPLE, new Set(["ga4"]));
  assert.match(out, /### Google Analytics 4/);
  assert.doesNotMatch(out, /Microsoft Clarity/);
  assert.doesNotMatch(out, /PostHog/);
  assert.doesNotMatch(out, /\n{3,}/); // no gaps left behind
});

test("upsertManagedBlock appends when no markers exist", () => {
  const block = `${BLOCK_BEGIN}\nsection\n${BLOCK_END}`;
  const { content, action } = upsertManagedBlock("# My Policy\n\nMy own text.\n", block);
  assert.equal(action, "appended");
  assert.match(content, /^# My Policy\n\nMy own text\./);
  assert.match(content, /section/);
  assert.equal(content.split(BLOCK_BEGIN).length, 2); // exactly one block
});

test("upsertManagedBlock replaces an existing block in place", () => {
  const oldBlock = `${BLOCK_BEGIN}\nold section\n${BLOCK_END}`;
  const newBlock = `${BLOCK_BEGIN}\nnew section\n${BLOCK_END}`;
  const policy = `# My Policy\n\nbefore\n\n${oldBlock}\n\nafter\n`;
  const { content, action } = upsertManagedBlock(policy, newBlock);
  assert.equal(action, "replaced");
  assert.match(content, /new section/);
  assert.doesNotMatch(content, /old section/);
  assert.match(content, /before/);
  assert.match(content, /after/);
  assert.equal(content.split(BLOCK_BEGIN).length, 2);
});

test("upsertManagedBlock appends a fresh block when markers are broken", () => {
  const block = `${BLOCK_BEGIN}\nnew section\n${BLOCK_END}`;
  const policy = `# My Policy\n\n${BLOCK_BEGIN}\norphaned, no end marker\n`;
  const { content, action } = upsertManagedBlock(policy, block);
  assert.equal(action, "appended-broken");
  assert.match(content, /new section/);
  assert.match(content, /orphaned, no end marker/); // never deletes user content
  assert.ok(content.trimEnd().endsWith(BLOCK_END)); // fresh block is last
});

test("upsertManagedBlock with empty policyText does not produce leading newlines", () => {
  const block = `${BLOCK_BEGIN}\nsection\n${BLOCK_END}`;
  const { content, action } = upsertManagedBlock("", block);
  assert.equal(action, "appended");
  assert.ok(!content.startsWith("\n"), "should not start with newline");
  assert.match(content, /^<!-- BEGIN/);
});

test("stripToolBlocks with empty Set removes all tool blocks", () => {
  const out = stripToolBlocks(SAMPLE, new Set([]));
  assert.doesNotMatch(out, /Google Analytics|Microsoft Clarity|PostHog/);
  assert.match(out, /intro text/);
  assert.doesNotMatch(out, /\n{3,}/);
});

function tmp() {
  return mkdtempSync(join(tmpdir(), "astack-test-"));
}

test("buildPrivacySection wraps selected tools in analytics-stack markers", () => {
  const block = buildPrivacySection(new Set(["ga4"]));
  assert.ok(block.startsWith(BLOCK_BEGIN));
  assert.ok(block.endsWith(BLOCK_END));
  assert.match(block, /Google Analytics 4/);
  assert.doesNotMatch(block, /Clarity/);
  assert.doesNotMatch(block, /PostHog/);
});

test("findPolicyFile finds privacy-policy.md", () => {
  const dir = tmp();
  writeFileSync(join(dir, "privacy-policy.md"), "# P\n");
  assert.equal(findPolicyFile(dir), join(dir, "privacy-policy.md"));
});

test("findPolicyFile returns null when no policy exists", () => {
  assert.equal(findPolicyFile(tmp()), null);
});

test("patchPrivacyPolicy creates PRIVACY.md from the skeleton", () => {
  const dir = tmp();
  const result = patchPrivacyPolicy(dir, new Set(["ga4", "clarity"]));
  assert.equal(result.created, true);
  assert.equal(result.path, join(dir, "PRIVACY.md"));
  const content = readFileSync(result.path, "utf8");
  assert.match(content, /# Privacy Policy/);
  assert.match(content, /\[Your Company\]/);
  assert.match(content, /not legal advice/);
  assert.match(content, /Google Analytics 4/);
  assert.match(content, /Microsoft Clarity/);
  assert.doesNotMatch(content, /PostHog/);
  assert.doesNotMatch(content, /__DATE__/);
  assert.doesNotMatch(content, /__ANALYTICS_SECTION__/);
  assert.match(content, /_Last updated: \d{4}-\d{2}-\d{2}_/);
});

test("patchPrivacyPolicy appends to an existing policy without markers", () => {
  const dir = tmp();
  writeFileSync(join(dir, "PRIVACY.md"), "# Our Policy\n\nHand-written text.\n");
  const result = patchPrivacyPolicy(dir, new Set(["posthog"]));
  assert.equal(result.created, false);
  const content = readFileSync(result.path, "utf8");
  assert.match(content, /^# Our Policy\n\nHand-written text\./);
  assert.match(content, /PostHog/);
  assert.doesNotMatch(content, /\[Your Company\]/); // skeleton not used
});

test("patchPrivacyPolicy re-run replaces the block (idempotent, tools updated)", () => {
  const dir = tmp();
  patchPrivacyPolicy(dir, new Set(["ga4"]));
  const result = patchPrivacyPolicy(dir, new Set(["ga4", "posthog"]));
  assert.equal(result.created, false);
  const content = readFileSync(result.path, "utf8");
  assert.match(content, /Google Analytics 4/);
  assert.match(content, /PostHog/);
  assert.equal(content.split(BLOCK_BEGIN).length, 2); // exactly one block
  assert.equal(content.split(BLOCK_END).length, 2);
});

test("detectToolsFromEnvExample reads prefixed keys from .env.example", () => {
  const dir = tmp();
  writeFileSync(
    join(dir, ".env.example"),
    "VITE_GA4_ID=G-XXXX\nVITE_POSTHOG_KEY=phc_xxx\nVITE_POSTHOG_HOST=https://us.i.posthog.com\n"
  );
  const tools = detectToolsFromEnvExample(dir, getFrameworkById("vite-react"));
  assert.deepEqual([...tools].sort(), ["ga4", "posthog"]);
});

test("detectToolsFromEnvExample returns null when .env.example is missing", () => {
  assert.equal(detectToolsFromEnvExample(tmp(), getFrameworkById("vite-react")), null);
});

test("detectToolsFromEnvExample returns null when no keys match", () => {
  const dir = tmp();
  writeFileSync(join(dir, ".env.example"), "OTHER_VAR=1\n");
  assert.equal(detectToolsFromEnvExample(dir, getFrameworkById("vite-react")), null);
});

test("detectToolsFromEnvExample reads unprefixed keys (remix)", () => {
  const dir = tmp();
  writeFileSync(join(dir, ".env.example"), "GA4_ID=G-XXXX\nCLARITY_ID=abc\n");
  const tools = detectToolsFromEnvExample(dir, getFrameworkById("remix"));
  assert.deepEqual([...tools].sort(), ["clarity", "ga4"]);
});

test("detectToolsFromEnvExample returns null for a null framework", () => {
  assert.equal(detectToolsFromEnvExample(tmp(), null), null);
});

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

test("removeManagedBlock block-at-start does not produce a leading newline", () => {
  const B = "<!-- BEGIN custom -->";
  const E = "<!-- END custom -->";
  const text = `${B}\nnote\n${E}\n`;
  const { content, removed } = removeManagedBlock(text, B, E);
  assert.equal(removed, true);
  assert.ok(!content.startsWith("\n"), "should not start with newline");
});

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
  const dir2 = tmp();
  savePendingPrivacyNote(dir2, new Set(["ga4"])); // creates note-only AGENTS.md

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

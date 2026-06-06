// Tests for src/privacy.js — run with `npm test` (node --test).
import test from "node:test";
import assert from "node:assert/strict";
import { stripToolBlocks, upsertManagedBlock, BLOCK_BEGIN, BLOCK_END } from "../src/privacy.js";

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

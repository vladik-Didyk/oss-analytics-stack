// End-to-end smoke: init + privacy + verify in a temp project.
// Run from the repo root: node scripts/smoke-e2e.mjs
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import prompts from "prompts";

const REPO = process.cwd();
const CLI = join(REPO, "bin", "cli.js");
const tmp = mkdtempSync(join(tmpdir(), "astack-smoke-"));

writeFileSync(
  join(tmp, "package.json"),
  JSON.stringify({ name: "smoke-app", dependencies: { vite: "^5.0.0", react: "^18.0.0" } }, null, 2)
);
process.chdir(tmp);

function fail(msg) {
  console.error(`✖ SMOKE FAIL: ${msg} (dir kept for inspection: ${tmp})`);
  process.exit(1);
}

// --- 1. init with privacy enabled, GA4 + Clarity only, no dep install ---
prompts.inject([
  "vite-react",       // framework
  ["ga4", "clarity"], // tools
  false,              // typescript
  "src",              // outDir
  true,               // privacy
  false,              // installDeps
  true,               // confirm
]);
const { initCommand } = await import(join(REPO, "src", "commands", "init.js"));
await initCommand([]);

let policy = readFileSync(join(tmp, "PRIVACY.md"), "utf8");
if (!policy.includes("Google Analytics 4")) fail("init: GA4 section missing");
if (!policy.includes("Microsoft Clarity")) fail("init: Clarity section missing");
if (policy.includes("PostHog")) fail("init: PostHog section should be absent");
if (!policy.includes("[Your Company]")) fail("init: skeleton placeholders missing");

// --- 2. privacy re-run with all three tools — block must be replaced, once ---
prompts.inject([["ga4", "clarity", "posthog"]]);
const { privacyCommand } = await import(join(REPO, "src", "commands", "privacy.js"));
await privacyCommand([]);

policy = readFileSync(join(tmp, "PRIVACY.md"), "utf8");
if (!policy.includes("PostHog")) fail("privacy: block not updated with PostHog");
if (policy.split("<!-- BEGIN analytics-stack -->").length !== 2) fail("privacy: duplicate managed blocks");

// --- 3. verify — no privacy warning when the block exists ---
let res = spawnSync(process.execPath, [CLI, "verify"], { cwd: tmp, encoding: "utf8" });
let out = res.stdout + res.stderr;
if (out.includes("No privacy policy found")) fail("verify: warned despite policy existing");
if (out.includes("has no analytics disclosures")) fail("verify: warned despite block existing");

// --- 4. verify — warning appears when the policy is gone ---
rmSync(join(tmp, "PRIVACY.md"));
res = spawnSync(process.execPath, [CLI, "verify"], { cwd: tmp, encoding: "utf8" });
out = res.stdout + res.stderr;
if (!out.includes("No privacy policy found")) fail("verify: missing-policy warning not shown");

console.log(`\n✨ smoke OK (${tmp})`);
rmSync(tmp, { recursive: true, force: true });

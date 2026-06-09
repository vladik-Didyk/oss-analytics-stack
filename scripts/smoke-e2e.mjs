// End-to-end smoke: init + privacy + verify in a temp project.
// Run from the repo root: node scripts/smoke-e2e.mjs
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import prompts from "prompts";

const REPO = process.cwd();
const CLI = join(REPO, "bin", "cli.js");

if (!existsSync(join(REPO, "src", "commands", "init.js"))) {
  console.error(`✖ Run this script from the repo root (got: ${REPO})`);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "astack-smoke-"));
let tmp2;

writeFileSync(
  join(tmp, "package.json"),
  JSON.stringify({ name: "smoke-app", dependencies: { vite: "^5.0.0", react: "^18.0.0" } }, null, 2)
);
process.chdir(tmp);

function fail(msg) {
  console.error(`✖ SMOKE FAIL: ${msg} (dir kept for inspection: ${tmp})`);
  process.exit(1);
}

try {
  // --- 1. init with privacy enabled, GA4 + Clarity only, no dep install ---
  prompts.inject([
    "vite-react",       // framework
    ["ga4", "clarity"], // tools
    false,              // typescript
    "src",              // outDir
    "yes",              // privacy
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
  if (!policy.includes("Google Analytics 4")) fail("privacy: GA4 lost after re-run");
  if (!policy.includes("Microsoft Clarity")) fail("privacy: Clarity lost after re-run");
  if (!policy.includes("<!-- BEGIN analytics-stack -->")) fail("privacy: managed block missing");
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

  // --- 5. init with "unsure" — no policy, note saved to AGENTS.md ---
  tmp2 = mkdtempSync(join(tmpdir(), "astack-smoke-"));
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

  console.log(`\n✨ smoke OK (${tmp}, ${tmp2})`);
  rmSync(tmp, { recursive: true, force: true });
  rmSync(tmp2, { recursive: true, force: true });
} catch (err) {
  console.error(`✖ SMOKE CRASH (dirs kept: ${tmp}${tmp2 ? `, ${tmp2}` : ""})\n`, err);
  process.exit(1);
}

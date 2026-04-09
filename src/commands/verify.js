// `verify` command — sanity check an existing installation.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { c, header, info, warn, error, blank, readText, readJson } from "../utils.js";
import { detectFramework, envPrefix } from "../detect.js";

export async function verifyCommand() {
  const cwd = process.cwd();
  process.stdout.write(`\n${header("analytics-stack")} ${c.dim("v0.1.0 — verify")}\n\n`);

  const framework = detectFramework(cwd);
  if (!framework) {
    error("Could not detect framework — no package.json or unknown stack.");
    process.exit(1);
  }
  info(`Framework: ${c.bold(framework.label)}`);

  const checks = [];
  const prefix = envPrefix(framework);

  // 1. analytics.js exists
  const candidates = [
    join(cwd, "src/lib/analytics.js"),
    join(cwd, "src/lib/analytics.ts"),
    join(cwd, "lib/analytics.js"),
    join(cwd, "lib/analytics.ts"),
    join(cwd, "app/lib/analytics.js"),
    join(cwd, "app/lib/analytics.ts"),
  ];
  const analyticsPath = candidates.find((p) => existsSync(p));
  if (analyticsPath) {
    checks.push({ ok: true, label: "analytics module", detail: relPath(cwd, analyticsPath) });
    const src = readText(analyticsPath);
    if (src) {
      if (!src.includes("hasConsented"))
        checks.push({ ok: false, label: "analytics has hasConsented()", detail: "missing" });
      if (!src.includes("initAnalytics"))
        checks.push({ ok: false, label: "analytics has initAnalytics()", detail: "missing" });
      if (!src.includes("trackPageView"))
        checks.push({ ok: false, label: "analytics has trackPageView()", detail: "missing" });
    }
  } else {
    checks.push({ ok: false, label: "analytics module", detail: "not found in src/lib or lib" });
  }

  // 2. CookieConsent exists
  const consentCandidates = [
    join(cwd, "src/components/consent/CookieConsent.jsx"),
    join(cwd, "src/components/consent/CookieConsent.tsx"),
    join(cwd, "src/components/CookieConsent.jsx"),
    join(cwd, "src/components/CookieConsent.tsx"),
    join(cwd, "src/components/CookieConsent.astro"),
    join(cwd, "components/CookieConsent.jsx"),
    join(cwd, "components/CookieConsent.tsx"),
    join(cwd, "src/consent.js"),
  ];
  const consentPath = consentCandidates.find((p) => existsSync(p));
  if (consentPath) {
    checks.push({ ok: true, label: "consent banner", detail: relPath(cwd, consentPath) });
  } else {
    checks.push({ ok: false, label: "consent banner", detail: "not found" });
  }

  // 3. .env.example has the vars
  const envExample = readText(join(cwd, ".env.example")) || "";
  const expectedKeys = [`${prefix}GA4_ID`, `${prefix}CLARITY_ID`, `${prefix}POSTHOG_KEY`];
  for (const key of expectedKeys) {
    checks.push({
      ok: envExample.includes(key),
      label: `.env.example has ${key}`,
      detail: envExample.includes(key) ? "✓" : "missing",
    });
  }

  // 4. .env (don't read the values, just check it exists if local dev)
  const envExists = existsSync(join(cwd, ".env"));
  if (envExists) {
    info(".env file exists (values not read for security)");
  } else {
    warn(".env file does not exist — production env vars must be set in your hosting dashboard");
  }

  // 5. .gitignore protects .env
  const gitignore = readText(join(cwd, ".gitignore")) || "";
  checks.push({
    ok: gitignore.match(/^\.env\b/m) !== null,
    label: ".gitignore protects .env",
    detail: gitignore.match(/^\.env\b/m) ? "✓" : "missing",
  });

  // 6. posthog-js installed (if package.json mentions it)
  const pkg = readJson(join(cwd, "package.json"));
  if (pkg) {
    const hasPosthog =
      (pkg.dependencies && pkg.dependencies["posthog-js"]) ||
      (pkg.devDependencies && pkg.devDependencies["posthog-js"]);
    checks.push({
      ok: !!hasPosthog,
      label: "posthog-js installed",
      detail: hasPosthog ? hasPosthog : "missing — run pnpm add posthog-js",
    });
  }

  blank();
  process.stdout.write(`${c.bold("Results:")}\n\n`);
  let failed = 0;
  for (const ch of checks) {
    if (ch.ok) {
      process.stdout.write(`  ${c.green("✔")} ${ch.label} ${c.dim(ch.detail || "")}\n`);
    } else {
      failed++;
      process.stdout.write(`  ${c.red("✖")} ${ch.label} ${c.dim(ch.detail || "")}\n`);
    }
  }
  blank();

  if (failed > 0) {
    error(`${failed} check(s) failed.`);
    process.exit(1);
  }
  process.stdout.write(`${c.bold(c.green("✨ All checks passed."))}\n\n`);
}

function relPath(cwd, abs) {
  return abs.startsWith(cwd) ? abs.slice(cwd.length + 1) : abs;
}

// `init` command — interactive scaffolder.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import prompts from "prompts";
import {
  c,
  header,
  step,
  info,
  warn,
  error,
  blank,
  copyTemplate,
  writeText,
  readText,
  TEMPLATES,
} from "../utils.js";
import {
  detectFramework,
  detectPackageManager,
  envPrefix,
  getFrameworks,
  getFrameworkById,
} from "../detect.js";

export async function initCommand() {
  const cwd = process.cwd();

  process.stdout.write(`\n${header("analytics-stack")} ${c.dim("v0.1.0 — init")}\n\n`);
  info(`Working directory: ${c.cyan(cwd)}`);

  // 1. Framework detection
  const detected = detectFramework(cwd);
  if (detected) {
    info(`Detected framework: ${c.bold(detected.label)} ${c.dim(`(${detected.id})`)}`);
  } else {
    warn("Could not auto-detect framework. You'll be asked to pick one.");
  }

  const pm = detectPackageManager(cwd);
  info(`Package manager:   ${c.bold(pm)}`);
  blank();

  // 2. Prompts
  const answers = await prompts(
    [
      {
        type: "select",
        name: "frameworkId",
        message: "Which framework is this project?",
        choices: getFrameworks().map((fw) => ({
          title: fw.label,
          value: fw.id,
          description: fw.id === detected?.id ? "(auto-detected)" : undefined,
        })),
        initial: detected ? getFrameworks().findIndex((f) => f.id === detected.id) : 0,
      },
      {
        type: "multiselect",
        name: "tools",
        message: "Which analytics tools do you want?",
        instructions: false,
        hint: "- Space to toggle, Enter to confirm",
        choices: [
          { title: "Google Analytics 4", value: "ga4", selected: true },
          { title: "Microsoft Clarity", value: "clarity", selected: true },
          { title: "PostHog", value: "posthog", selected: true },
        ],
        min: 1,
      },
      {
        type: "toggle",
        name: "typescript",
        message: "Use TypeScript?",
        initial: false,
        active: "yes",
        inactive: "no",
      },
      {
        type: "text",
        name: "outDir",
        message: "Where should files go?",
        initial: "src",
      },
      {
        type: "toggle",
        name: "installDeps",
        message: "Install posthog-js now?",
        initial: true,
        active: "yes",
        inactive: "no",
      },
    ],
    { onCancel: () => process.exit(1) }
  );

  if (!answers.frameworkId) {
    error("Aborted.");
    process.exit(1);
  }

  const framework = getFrameworkById(answers.frameworkId);
  const tools = new Set(answers.tools);
  const ts = answers.typescript && framework.isReact;
  const outDir = resolve(cwd, answers.outDir);

  blank();
  info(c.bold("Plan:"));
  process.stdout.write(`  Framework:  ${framework.label}\n`);
  process.stdout.write(`  Tools:      ${[...tools].join(", ")}\n`);
  process.stdout.write(`  TypeScript: ${ts ? "yes" : "no"}\n`);
  process.stdout.write(`  Out dir:    ${c.cyan(outDir)}\n`);
  blank();

  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: "Proceed?",
    initial: true,
  });
  if (!confirm) {
    error("Aborted.");
    process.exit(1);
  }
  blank();

  // 3. Write analytics.js
  const analyticsTemplate = framework.ssrSafe ? "analytics.ssr.js" : "analytics.js";
  const analyticsExt = ts ? "ts" : "js";
  const analyticsDest = join(outDir, "lib", `analytics.${analyticsExt}`);
  const prefix = envPrefix(framework);
  let analyticsContent = readFileSync(join(TEMPLATES, "analytics", analyticsTemplate), "utf8");
  analyticsContent = analyticsContent.replace(/__ENV_PREFIX__/g, prefix);
  if (!tools.has("ga4")) analyticsContent = stripBlock(analyticsContent, "GA4");
  if (!tools.has("clarity")) analyticsContent = stripBlock(analyticsContent, "CLARITY");
  if (!tools.has("posthog")) analyticsContent = stripBlock(analyticsContent, "POSTHOG");
  writeText(analyticsDest, analyticsContent);
  step("Created", relPath(cwd, analyticsDest));

  // 4. Write CookieConsent
  if (framework.consentTemplate === "react") {
    const ext = ts ? "tsx" : "jsx";
    const consentDest = join(outDir, "components", "consent", `CookieConsent.${ext}`);
    const cssDest = join(outDir, "components", "consent", "cookieConsent.css");
    const consentSrc = ts ? "react-ts/CookieConsent.tsx" : "react/CookieConsent.jsx";
    const cssSrc = "react/cookieConsent.css";
    let consentContent = readFileSync(join(TEMPLATES, "consent", consentSrc), "utf8");
    const importExt = ts ? "" : "";
    void importExt;
    writeText(consentDest, consentContent);
    copyTemplate(`consent/${cssSrc}`, cssDest);
    step("Created", relPath(cwd, consentDest));
    step("Created", relPath(cwd, cssDest));
  } else if (framework.consentTemplate === "astro") {
    const consentDest = join(outDir, "components", "CookieConsent.astro");
    copyTemplate("consent/astro/CookieConsent.astro", consentDest);
    step("Created", relPath(cwd, consentDest));
  } else if (framework.consentTemplate === "vanilla") {
    const jsDest = join(outDir, "consent.js");
    const cssDest = join(outDir, "consent.css");
    copyTemplate("consent/vanilla/consent.js", jsDest);
    copyTemplate("consent/vanilla/consent.css", cssDest);
    step("Created", relPath(cwd, jsDest));
    step("Created", relPath(cwd, cssDest));
  }

  // 5. Patch .env.example
  patchEnvExample(cwd, framework, tools);
  step("Updated", ".env.example");

  // 6. Patch .gitignore (ensure .env is ignored)
  patchGitignore(cwd);

  // 7. Install posthog-js (only if PostHog selected)
  if (tools.has("posthog") && answers.installDeps) {
    blank();
    info(`Installing ${c.cyan("posthog-js")}...`);
    await runCmd(pm, ["add", "posthog-js"], cwd);
    step("Installed", "posthog-js");
  }

  // 8. Print integration snippet
  blank();
  printSnippet(framework);

  // 9. Print next steps
  printNextSteps(framework, tools);
}

function relPath(cwd, abs) {
  return abs.startsWith(cwd) ? abs.slice(cwd.length + 1) : abs;
}

// Strip a guarded block like:
//   // BEGIN GA4
//   ...
//   // END GA4
function stripBlock(source, name) {
  const re = new RegExp(`\\n?\\s*//\\s*BEGIN ${name}[\\s\\S]*?//\\s*END ${name}\\n?`, "g");
  return source.replace(re, "\n");
}

function patchEnvExample(cwd, framework, tools) {
  const path = join(cwd, ".env.example");
  const prefix = envPrefix(framework);
  const lines = ["", "# Analytics (all optional — each tool no-ops if its var is empty)"];
  if (tools.has("ga4")) lines.push(`${prefix}GA4_ID=G-XXXXXXXXXX`);
  if (tools.has("clarity")) lines.push(`${prefix}CLARITY_ID=xxxxxxxxxx`);
  if (tools.has("posthog")) {
    lines.push(`${prefix}POSTHOG_KEY=phc_xxxxxxxxxxxx`);
    lines.push(`${prefix}POSTHOG_HOST=https://us.i.posthog.com`);
  }
  const block = lines.join("\n") + "\n";

  let existing = readText(path) || "";
  // Avoid double-appending if already present
  if (existing.includes(`${prefix}GA4_ID`) || existing.includes(`${prefix}POSTHOG_KEY`)) {
    return;
  }
  writeText(path, existing.trimEnd() + "\n" + block);
}

function patchGitignore(cwd) {
  const path = join(cwd, ".gitignore");
  let content = readText(path) || "";
  if (!content.match(/^\.env$/m) && !content.match(/^\.env\b/m)) {
    content = content.trimEnd() + "\n\n# env\n.env\n.env.local\n";
    writeText(path, content);
    step("Updated", ".gitignore");
  }
}

function printSnippet(framework) {
  const path = join(TEMPLATES, "snippets", `${framework.snippet}.md`);
  const content = readText(path);
  if (!content) return;
  process.stdout.write(`\n${c.bold(c.cyan("Integration snippet:"))}\n\n`);
  process.stdout.write(content);
  process.stdout.write("\n");
}

function printNextSteps(framework, tools) {
  const prefix = envPrefix(framework);
  blank();
  process.stdout.write(`${c.bold(c.green("✨ Done!"))} ${c.dim("Next steps:")}\n\n`);

  let n = 1;
  process.stdout.write(`  ${c.bold(`${n++}.`)} Get your IDs from these dashboards:\n`);
  if (tools.has("ga4"))
    process.stdout.write(
      `     • GA4:     ${c.cyan("https://analytics.google.com/")}  →  ${c.dim("Admin → Create Property")}\n`
    );
  if (tools.has("clarity"))
    process.stdout.write(
      `     • Clarity: ${c.cyan("https://clarity.microsoft.com/")}  →  ${c.dim("New Project")}\n`
    );
  if (tools.has("posthog"))
    process.stdout.write(
      `     • PostHog: ${c.cyan("https://us.posthog.com/signup")}  →  ${c.dim("Project Settings → API Key")}\n`
    );
  blank();

  process.stdout.write(`  ${c.bold(`${n++}.`)} Add the IDs to your ${c.cyan(".env")} file:\n`);
  if (tools.has("ga4")) process.stdout.write(`     ${prefix}GA4_ID=G-XXXXXXXXXX\n`);
  if (tools.has("clarity")) process.stdout.write(`     ${prefix}CLARITY_ID=xxxxxxxxxx\n`);
  if (tools.has("posthog")) {
    process.stdout.write(`     ${prefix}POSTHOG_KEY=phc_xxxxxxxxxxxx\n`);
    process.stdout.write(`     ${prefix}POSTHOG_HOST=https://us.i.posthog.com\n`);
  }
  blank();

  process.stdout.write(
    `  ${c.bold(`${n++}.`)} Mount the components in your app entry. ${c.dim("(snippet above)")}\n`
  );
  blank();

  process.stdout.write(
    `  ${c.bold(`${n++}.`)} Test in incognito → click Accept → check DevTools → Network for the analytics requests.\n`
  );
  blank();

  process.stdout.write(
    `${c.dim("Docs: https://github.com/vladik-Didyk/analytics-stack#readme")}\n\n`
  );
}

function runCmd(pm, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pm, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${pm} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

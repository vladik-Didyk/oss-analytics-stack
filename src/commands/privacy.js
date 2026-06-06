// `privacy` command — add/update privacy policy disclosures for an existing
// installation, without touching any other scaffolded file.
import prompts from "prompts";
import { c, header, step, info, blank, error } from "../utils.js";
import { detectFramework, getFrameworks, getFrameworkById } from "../detect.js";
import { patchPrivacyPolicy, detectToolsFromEnvExample } from "../privacy.js";

export async function privacyCommand() {
  const cwd = process.cwd();
  process.stdout.write(`\n${header("analytics-stack")} ${c.dim("v0.1.0 — privacy")}\n\n`);
  info(`Working directory: ${c.cyan(cwd)}`);

  let framework = detectFramework(cwd);
  if (framework) {
    info(`Detected framework: ${c.bold(framework.label)} ${c.dim(`(${framework.id})`)}`);
  } else {
    blank();
    const { frameworkId } = await prompts(
      {
        type: "select",
        name: "frameworkId",
        message: "Which framework is this project?",
        choices: getFrameworks().map((fw) => ({ title: fw.label, value: fw.id })),
      },
      { onCancel: () => process.exit(1) }
    );
    framework = getFrameworkById(frameworkId);
    if (!framework) {
      error("Aborted.");
      process.exit(1);
    }
  }

  const detected = detectToolsFromEnvExample(cwd, framework);
  if (detected) {
    info(`Detected tools in .env.example: ${c.bold([...detected].join(", "))}`);
  }
  blank();

  const { tools } = await prompts(
    {
      type: "multiselect",
      name: "tools",
      message: "Which analytics tools should the policy disclose?",
      instructions: false,
      hint: "- Space to toggle, Enter to confirm",
      choices: [
        { title: "Google Analytics 4", value: "ga4", selected: !detected || detected.has("ga4") },
        { title: "Microsoft Clarity", value: "clarity", selected: !detected || detected.has("clarity") },
        { title: "PostHog", value: "posthog", selected: !detected || detected.has("posthog") },
      ],
      min: 1,
    },
    { onCancel: () => process.exit(1) }
  );

  const result = patchPrivacyPolicy(cwd, new Set(tools));
  if (!result) {
    error("Privacy policy was not updated.");
    process.exit(1);
  }
  blank();
  step(result.created ? "Created" : "Updated", relPath(cwd, result.path));
  blank();
  process.stdout.write(
    `${c.bold(c.green("✨ Done!"))} Review the file, replace the ${c.cyan("[Your Company]")} placeholders, and link it from your site footer.\n\n`
  );
}

function relPath(cwd, abs) {
  return abs.startsWith(cwd) ? abs.slice(cwd.length + 1) : abs;
}

// Privacy policy generation — shared by `init` and the `privacy` command.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES, readText, writeText, warn } from "./utils.js";
import { envPrefix } from "./detect.js";

export const BLOCK_BEGIN = "<!-- BEGIN analytics-stack -->";
export const BLOCK_END = "<!-- END analytics-stack -->";

// First match wins. On case-insensitive filesystems (macOS) some of these alias.
export const POLICY_FILENAMES = ["PRIVACY.md", "privacy.md", "privacy-policy.md", "PRIVACY-POLICY.md"];

const TOOL_MARKERS = { ga4: "GA4", clarity: "CLARITY", posthog: "POSTHOG" };

// Strip a guarded block like <!-- BEGIN GA4 --> ... <!-- END GA4 --> when the
// tool is unselected; drop just the marker lines when it is selected.
// Same idiom as stripBlock() in init.js, adapted to HTML comments.
export function stripToolBlocks(text, tools) {
  let out = text;
  for (const [tool, name] of Object.entries(TOOL_MARKERS)) {
    if (tools.has(tool)) {
      out = out.replace(new RegExp(`[ \\t]*<!-- BEGIN ${name} -->\\n?`, "g"), "");
      out = out.replace(new RegExp(`[ \\t]*<!-- END ${name} -->\\n?`, "g"), "");
    } else {
      out = out.replace(
        new RegExp(`\\n?[ \\t]*<!-- BEGIN ${name} -->[\\s\\S]*?<!-- END ${name} -->\\n?`, "g"),
        "\n"
      );
    }
  }
  return out.replace(/\n{3,}/g, "\n\n");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Replace the managed block if present, append if absent. Never touches text
// outside the markers. Broken markers (BEGIN without END or vice versa) get a
// fresh block appended instead — repairing would risk eating user content.
// If two marker pairs somehow exist, only the first is replaced (intentional).
export function upsertManagedBlock(policyText, block) {
  const hasBegin = policyText.includes(BLOCK_BEGIN);
  const hasEnd = policyText.includes(BLOCK_END);
  if (hasBegin && hasEnd) {
    const re = new RegExp(`${escapeRe(BLOCK_BEGIN)}[\\s\\S]*?${escapeRe(BLOCK_END)}`);
    return { content: policyText.replace(re, () => block.trim()), action: "replaced" };
  }
  const body = policyText.trimEnd();
  const appended = (body ? body + "\n\n" : "") + block.trim() + "\n";
  return { content: appended, action: hasBegin || hasEnd ? "appended-broken" : "appended" };
}

// Build the full managed block for the selected tools.
export function buildPrivacySection(tools) {
  const template = readFileSync(join(TEMPLATES, "privacy", "privacy-section.md"), "utf8");
  const section = stripToolBlocks(template, tools).trim();
  return `${BLOCK_BEGIN}\n${section}\n${BLOCK_END}`;
}

export function findPolicyFile(cwd) {
  for (const name of POLICY_FILENAMES) {
    const path = join(cwd, name);
    if (existsSync(path)) return path;
  }
  return null;
}

function tryWrite(path, content) {
  try {
    writeText(path, content);
    return true;
  } catch (err) {
    warn(`Could not write ${path} — skipping privacy policy update. (${err.message})`);
    return false;
  }
}

// Create or update the project's privacy policy. Returns { path, created },
// or null when the existing file could not be read (warned, skipped).
export function patchPrivacyPolicy(cwd, tools) {
  const block = buildPrivacySection(tools);
  const existingPath = findPolicyFile(cwd);

  if (!existingPath) {
    const skeleton = readFileSync(join(TEMPLATES, "privacy", "privacy-skeleton.md"), "utf8");
    const today = new Date().toISOString().slice(0, 10);
    const content = skeleton.replace("__DATE__", () => today).replace("__ANALYTICS_SECTION__", () => block);
    const path = join(cwd, "PRIVACY.md");
    if (!tryWrite(path, content)) return null;
    return { path, created: true };
  }

  const existing = readText(existingPath);
  if (existing === null) {
    warn(`Could not read ${existingPath} — skipping privacy policy update.`);
    return null;
  }
  const { content, action } = upsertManagedBlock(existing, block);
  if (action === "appended-broken") {
    warn(
      "Found a broken analytics-stack marker block in your privacy policy — appended a fresh block instead. Please remove the old one manually."
    );
  }
  if (!tryWrite(existingPath, content)) return null;
  return { path: existingPath, created: false };
}

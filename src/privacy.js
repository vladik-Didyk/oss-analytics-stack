// Privacy policy generation — shared by `init` and the `privacy` command.
import { existsSync, readFileSync, unlinkSync } from "node:fs";
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

// Remove a managed block (markers included). No-op unless BOTH markers exist —
// same conservative stance as upsert on broken markers. If two marker pairs
// somehow exist, only the first is removed (first-match, like upsert).
export function removeManagedBlock(text, begin = BLOCK_BEGIN, end = BLOCK_END) {
  if (!text.includes(begin) || !text.includes(end)) return { content: text, removed: false };
  const re = new RegExp(`\\n?[ \\t]*${escapeRe(begin)}[\\s\\S]*?${escapeRe(end)}\\n?`);
  const content = text.replace(re, "\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
  return { content, removed: true };
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

// Detect previously-installed tools from .env.example (same keys verify checks).
// Returns a Set of tool ids, or null when nothing was detected.
// Heuristic: substring match — commented-out vars count as present, which is
// acceptable for pre-selecting a multiselect.
export function detectToolsFromEnvExample(cwd, framework) {
  if (!framework) return null;
  const content = readText(join(cwd, ".env.example"));
  if (!content) return null;
  const prefix = envPrefix(framework);
  const tools = new Set();
  if (content.includes(`${prefix}GA4_ID`)) tools.add("ga4");
  if (content.includes(`${prefix}CLARITY_ID`)) tools.add("clarity");
  if (content.includes(`${prefix}POSTHOG_KEY`)) tools.add("posthog");
  return tools.size > 0 ? tools : null;
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
    clearPendingPrivacyNote(cwd);
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
  clearPendingPrivacyNote(cwd);
  return { path: existingPath, created: false };
}

export const NOTE_BEGIN = "<!-- BEGIN analytics-stack:pending-privacy -->";
export const NOTE_END = "<!-- END analytics-stack:pending-privacy -->";

// AI memory files we know how to write a pending-decision note into.
export const MEMORY_FILENAMES = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"];

// Save the "user is not sure about the privacy policy" note into every existing
// AI memory file — or a new AGENTS.md when the project has none.
// Returns the paths actually written.
// `tools` must be a Set or array of tool ids (e.g. new Set(["ga4"])).
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
        // Deletion failed — write the whitespace-only remainder instead.
        if (tryWrite(path, content)) cleared.push(path);
      }
    } else if (tryWrite(path, content)) {
      cleared.push(path);
    }
  }
  return cleared;
}

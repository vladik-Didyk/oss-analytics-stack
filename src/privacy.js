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
export function upsertManagedBlock(policyText, block) {
  const hasBegin = policyText.includes(BLOCK_BEGIN);
  const hasEnd = policyText.includes(BLOCK_END);
  if (hasBegin && hasEnd) {
    const re = new RegExp(`${escapeRe(BLOCK_BEGIN)}[\\s\\S]*?${escapeRe(BLOCK_END)}`);
    return { content: policyText.replace(re, block.trim()), action: "replaced" };
  }
  const appended = policyText.trimEnd() + "\n\n" + block.trim() + "\n";
  return { content: appended, action: hasBegin || hasEnd ? "appended-broken" : "appended" };
}

// Tiny utility helpers — colors, logging, file IO.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Repo root = parent of src/
export const ROOT = resolve(__dirname, "..");
export const TEMPLATES = join(ROOT, "templates");
export const DOCS = join(ROOT, "docs");

export const c = {
  red: pc.red,
  green: pc.green,
  yellow: pc.yellow,
  blue: pc.blue,
  cyan: pc.cyan,
  magenta: pc.magenta,
  bold: pc.bold,
  dim: pc.dim,
  underline: pc.underline,
};

export function header(text) {
  return c.bold(c.cyan(`▲ ${text}`));
}

export function step(label, msg) {
  process.stdout.write(`${c.green("✔")} ${c.bold(label)} ${c.dim(msg || "")}\n`);
}

export function info(msg) {
  process.stdout.write(`${c.cyan("ℹ")} ${msg}\n`);
}

export function warn(msg) {
  process.stdout.write(`${c.yellow("⚠")} ${msg}\n`);
}

export function error(msg) {
  process.stderr.write(`${c.red("✖")} ${msg}\n`);
}

export function blank() {
  process.stdout.write("\n");
}

export function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

export function writeText(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function copyTemplate(srcRel, destAbs) {
  const src = join(TEMPLATES, srcRel);
  if (!existsSync(src)) {
    throw new Error(`Template not found: ${srcRel}`);
  }
  mkdirSync(dirname(destAbs), { recursive: true });
  copyFileSync(src, destAbs);
}

export function exists(path) {
  return existsSync(path);
}

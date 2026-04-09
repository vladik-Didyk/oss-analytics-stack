// Framework + package manager detection.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "./utils.js";

export function detectPackageManager(cwd) {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "bun.lockb"))) return "bun";
  if (existsSync(join(cwd, "package-lock.json"))) return "npm";
  return "npm"; // sensible default
}

const FRAMEWORKS = [
  {
    id: "next",
    label: "Next.js",
    detect: (pkg) => has(pkg, "next"),
    ssrSafe: true,
    consentTemplate: "react",
    snippet: "nextjs",
    isReact: true,
  },
  {
    id: "react-router-v7",
    label: "React Router v7 (SSR)",
    detect: (pkg) => has(pkg, "@react-router/dev") || has(pkg, "@react-router/node"),
    ssrSafe: true,
    consentTemplate: "react",
    snippet: "react-router-v7",
    isReact: true,
  },
  {
    id: "remix",
    label: "Remix",
    detect: (pkg) => has(pkg, "@remix-run/react") || has(pkg, "@remix-run/node"),
    ssrSafe: true,
    consentTemplate: "react",
    snippet: "remix",
    isReact: true,
  },
  {
    id: "astro",
    label: "Astro",
    detect: (pkg) => has(pkg, "astro"),
    ssrSafe: true,
    consentTemplate: "astro",
    snippet: "astro",
    isReact: false,
  },
  {
    id: "vite-react",
    label: "Vite + React",
    detect: (pkg) => has(pkg, "vite") && has(pkg, "react"),
    ssrSafe: false,
    consentTemplate: "react",
    snippet: "vite-react",
    isReact: true,
    envPrefix: "VITE_",
  },
  {
    id: "vanilla",
    label: "Vanilla HTML/JS",
    detect: () => false, // never auto-detected; only chosen explicitly
    ssrSafe: false,
    consentTemplate: "vanilla",
    snippet: "vanilla",
    isReact: false,
  },
];

function has(pkg, name) {
  return Boolean(
    (pkg.dependencies && pkg.dependencies[name]) ||
      (pkg.devDependencies && pkg.devDependencies[name])
  );
}

export function detectFramework(cwd) {
  const pkg = readJson(join(cwd, "package.json"));
  if (!pkg) return null;
  for (const fw of FRAMEWORKS) {
    if (fw.detect(pkg)) return fw;
  }
  return null;
}

export function getFrameworks() {
  return FRAMEWORKS;
}

export function getFrameworkById(id) {
  return FRAMEWORKS.find((f) => f.id === id) || null;
}

// Env var prefix per framework
export function envPrefix(framework) {
  if (framework.envPrefix) return framework.envPrefix;
  switch (framework.id) {
    case "next":
      return "NEXT_PUBLIC_";
    case "vite-react":
      return "VITE_";
    case "react-router-v7":
      return "VITE_"; // RR7 uses Vite
    case "remix":
      return ""; // server-injected
    case "astro":
      return "PUBLIC_";
    default:
      return "";
  }
}

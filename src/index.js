// analytics-stack CLI — main entry
import { initCommand } from "./commands/init.js";
import { c, header } from "./utils.js";

const VERSION = "0.1.0";

const HELP = `${header("analytics-stack")} v${VERSION}

  Drop-in consent-gated analytics: GA4 + Microsoft Clarity + PostHog.
  Privacy-first — nothing loads until the visitor accepts.

${c.bold("Usage:")}

  npx @vladik-didyk/analytics-stack ${c.cyan("<command>")}
  npx github:vladik-Didyk/analytics-stack ${c.cyan("<command>")}

${c.bold("Commands:")}

  ${c.cyan("init")}     Scaffold the analytics stack into the current project
  ${c.cyan("verify")}   Check that an existing installation is wired correctly
  ${c.cyan("help")}     Show this help

${c.bold("Examples:")}

  # Inside your project directory:
  npx github:vladik-Didyk/analytics-stack init

  # Verify a project after running init:
  npx github:vladik-Didyk/analytics-stack verify

${c.dim("Docs: https://github.com/vladik-Didyk/analytics-stack#readme")}
`;

export async function run(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    process.stdout.write(HELP);
    return;
  }

  if (cmd === "--version" || cmd === "-v") {
    process.stdout.write(`v${VERSION}\n`);
    return;
  }

  switch (cmd) {
    case "init":
      await initCommand(rest);
      return;
    case "verify": {
      const { verifyCommand } = await import("./commands/verify.js");
      await verifyCommand(rest);
      return;
    }
    default:
      process.stderr.write(`${c.red("Unknown command:")} ${cmd}\n\n`);
      process.stdout.write(HELP);
      process.exit(1);
  }
}

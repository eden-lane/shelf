import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const safariOutput = resolve(extensionRoot, ".output/safari-mv2");
const converterInput = resolve(extensionRoot, "safari-web-extension");
const projectOutput = resolve(extensionRoot, "safari-extension");

if (!existsSync(resolve(safariOutput, "manifest.json"))) {
  throw new Error("Missing .output/safari-mv2/manifest.json. Run `bun run build:safari:web` first.");
}

rmSync(converterInput, { force: true, recursive: true });
mkdirSync(converterInput, { recursive: true });
cpSync(safariOutput, converterInput, { recursive: true });

const result = spawnSync(
  "xcrun",
  [
    "safari-web-extension-converter",
    converterInput,
    "--project-location",
    projectOutput,
    "--app-name",
    "Shelf",
    "--bundle-identifier",
    "com.edenlane.Shelf",
    "--swift",
    "--macos-only",
    "--copy-resources",
    "--no-open",
    "--no-prompt",
    "--force"
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

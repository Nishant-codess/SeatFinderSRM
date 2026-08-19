// Reads .env.local and spawns deploy.mjs with those env vars
import { readFileSync } from "fs";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

const env = { ...process.env };
readFileSync(envPath, "utf8")
  .split("\n")
  .forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    env[key] = val;
  });

env.SES_FROM_EMAIL = env.SES_FROM_EMAIL || "tp6382@srmist.edu.in";

const child = spawn("node", [join(__dirname, "deploy.mjs")], {
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));

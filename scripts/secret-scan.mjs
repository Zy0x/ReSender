import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  ".git",
  ".codex",
  ".agents",
  ".cursor",
  ".claude",
  ".lovable",
  "node_modules",
  "dist",
  "dist-ssr",
  ".output",
  ".netlify",
  ".vinxi",
  ".tanstack",
  ".wrangler",
  "coverage",
]);
const SKIP_FILES = new Set(["bun.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
const SCANNED_EXTENSIONS = new Set([
  "",
  ".env",
  ".example",
  ".json",
  ".toml",
  ".yml",
  ".yaml",
  ".md",
]);
const SECRET_ASSIGNMENT =
  /^\s*([A-Z0-9_]*(?:SERVICE_ROLE|PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE|SUPABASE_SERVICE|TELEGRAM_BOT_TOKEN|CRON_SECRET|CLOUDFLARE_API_TOKEN|SUPABASE_ACCESS_TOKEN)[A-Z0-9_]*)\s*[:=]\s*["']?([^"'\s#]+)?/i;
const ALLOWED_VALUE = /^(|replace-with-|PROJECT_REF|YOUR_|example|placeholder|null|undefined)$/i;
const ALLOWED_SECRET_REFERENCE = /\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}/i;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    const rel = relative(ROOT, path).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...(await walk(path)));
      continue;
    }
    if (SKIP_FILES.has(entry.name)) continue;
    if (entry.name === ".env" || entry.name.startsWith(".env.")) continue;
    const extension = entry.name.includes(".") ? entry.name.slice(entry.name.lastIndexOf(".")) : "";
    if (!SCANNED_EXTENSIONS.has(extension)) continue;
    files.push({ path, rel });
  }
  return files;
}

const findings = [];
for (const file of await walk(ROOT)) {
  const text = await readFile(file.path, "utf8").catch(() => "");
  text.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(SECRET_ASSIGNMENT);
    const value = match?.[2] ?? "";
    if (match && !ALLOWED_VALUE.test(value) && !ALLOWED_SECRET_REFERENCE.test(line)) {
      findings.push(`${file.rel}:${index + 1} (${match[1]})`);
    }
  });
}

if (findings.length) {
  console.error("Potential secret-bearing references found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("No secret-bearing references found outside ignored files.");

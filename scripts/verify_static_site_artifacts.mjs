import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.resolve("public/static-site");
const distRoot = path.resolve("dist/client/static-site");
const distHeaders = path.resolve("dist/client/_headers");
const ignoredSuffixes = new Set([".br", ".gz"]);
const requiredStartupFiles = [
  "index.html",
  "app.js",
  "app-data.js",
  "place-index.js",
  "map-core.js",
  "data/china-cities.json",
  ...Array.from({ length: 8 }, (_, index) => `data/china-prefectures-lite-${index + 1}.json`)
];

async function collectFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) return collectFiles(root, fullPath);
    if (entry.isFile() && !ignoredSuffixes.has(path.extname(entry.name))) {
      return [path.relative(root, fullPath).replaceAll(path.sep, "/")];
    }
    return [];
  }));
  return nested.flat();
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function assertDirectory(root, label) {
  const rootStat = await stat(root).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new Error(`${label} directory is missing: ${root}`);
  }
}

await assertDirectory(sourceRoot, "source static site");
await assertDirectory(distRoot, "dist static site");

const sourceFiles = await collectFiles(sourceRoot);
const errors = [];

for (const relativePath of requiredStartupFiles) {
  if (!sourceFiles.includes(relativePath)) {
    errors.push(`source is missing required startup file: ${relativePath}`);
  }
}

for (const relativePath of sourceFiles) {
  const sourceFile = path.join(sourceRoot, relativePath);
  const distFile = path.join(distRoot, relativePath);
  const distStat = await stat(distFile).catch(() => null);
  if (!distStat?.isFile()) {
    errors.push(`dist is missing ${relativePath}`);
    continue;
  }
  const [sourceHash, distHash] = await Promise.all([sha256(sourceFile), sha256(distFile)]);
  if (sourceHash !== distHash) {
    errors.push(`dist differs from source for ${relativePath}`);
  }
}

const distApp = await readFile(path.join(distRoot, "app.js"), "utf8");
const headers = await readFile(distHeaders, "utf8").catch(() => "");
if (/cache\s*:\s*["']no-store["']/.test(distApp)) {
  errors.push("dist app.js still disables browser caching with cache: no-store");
}
if (/china-prefectures\.json/.test(distApp)) {
  errors.push("dist app.js still references the full china-prefectures.json startup payload");
}
if (!/\/static-site\/\*[\s\S]*?Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/.test(headers)) {
  errors.push("dist _headers does not cache /static-site/* immutably");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`verified ${sourceFiles.length} static-site files in dist/client/static-site`);
}

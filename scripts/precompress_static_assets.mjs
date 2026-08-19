import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const suffixes = new Set([".html", ".js", ".css", ".json", ".svg"]);
const roots = process.argv.slice(2);
const targetRoots = roots.length ? roots : ["public/static-site"];

async function collectFiles(root) {
  const rootStat = await stat(root).catch(() => null);
  if (!rootStat?.isDirectory()) return [];

  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    if (entry.isFile() && suffixes.has(path.extname(entry.name))) return [fullPath];
    return [];
  }));
  return nested.flat();
}

for (const root of targetRoots) {
  const files = await collectFiles(root);
  for (const file of files) {
    const source = await readFile(file);
    await writeFile(`${file}.gz`, gzipSync(source, { level: 9, mtime: 0 }));
    await writeFile(
      `${file}.br`,
      brotliCompressSync(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT
        }
      })
    );
  }
  console.log(`precompressed ${files.length} assets under ${root}`);
}

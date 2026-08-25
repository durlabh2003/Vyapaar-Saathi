#!/usr/bin/env node
/**
 * fix-circular-ssr.mjs
 *
 * Post-build script that patches Nitro's SSR output to fix a circular ESM
 * dependency that causes "TypeError: __exportAll is not a function" on Vercel.
 *
 * Root cause:
 *   Nitro/rolldown splits the server bundle into two chunks:
 *     A) server-XXXX.mjs  — defines __exportAll, imports from B
 *     B) server-XXXX2.mjs — imports __exportAll from A, but A also imports B
 *   This cycle means __exportAll is `undefined` when B first evaluates it
 *   at module-init time on Node.js (Vercel serverless runtime).
 *
 * Fix: find whichever SSR chunk imports "{ n as __exportAll }" from a sibling
 * chunk and inline the definition directly so the import is not needed.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const EXPORT_ALL_INLINE = `var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
\tlet target = {};
\tfor (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
\tif (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
\treturn target;
};`;

const IMPORT_PATTERN = /import \{ n as __exportAll \} from "\.\/server-[^"]+\.mjs";/;

async function patchDir(dir) {
  if (!existsSync(dir)) return;
  const files = await readdir(dir);
  for (const file of files) {
    if (!file.endsWith(".mjs")) continue;
    const filePath = join(dir, file);
    const content = await readFile(filePath, "utf-8");
    const match = content.match(IMPORT_PATTERN);
    if (!match) continue;
    const patched = content.replace(match[0], EXPORT_ALL_INLINE);
    await writeFile(filePath, patched, "utf-8");
    console.log(`[fix-circular-ssr] ✓ Patched circular __exportAll import in ${file}`);
  }
}

// Patch all known output locations (cloudflare-module, vercel preset, etc.)
const candidates = [
  ".output/server/_ssr",
  ".vercel/output/functions/__nitro.func/_ssr",
  ".vercel/output/functions/nitro.func/_ssr",
];

for (const dir of candidates) {
  await patchDir(join(process.cwd(), dir));
}

console.log("[fix-circular-ssr] Done.");

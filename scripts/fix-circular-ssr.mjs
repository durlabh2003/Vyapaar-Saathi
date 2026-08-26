#!/usr/bin/env node
/**
 * Post-build guard/patch for Nitro SSR output on Vercel.
 *
 * Vercel's Nitro preset can place the server bundle under
 * .vercel/output/functions/__server.func rather than the older _ssr
 * directories. The previous implementation only checked the older paths,
 * causing an otherwise successful Nitro build to fail in the postbuild step.
 *
 * We recursively inspect the generated Vercel/Nitro function bundle for the
 * known __exportAll circular ESM import and inline the tiny helper when found.
 * If no circular import exists, the build remains valid and is left unchanged.
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

// Match the generated import regardless of the sibling chunk's exact name.
const IMPORT_PATTERN = /import \{ n as __exportAll \} from "([^"]+\.mjs)";/;

async function collectMjsFiles(dir, result = []) {
  if (!existsSync(dir)) return result;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectMjsFiles(path, result);
    } else if (entry.isFile() && entry.name.endsWith(".mjs")) {
      result.push(path);
    }
  }

  return result;
}

async function patchOutput(root) {
  if (!existsSync(root)) return { found: false, patched: 0 };

  const files = await collectMjsFiles(root);
  let patched = 0;

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    const match = content.match(IMPORT_PATTERN);
    if (!match) continue;

    // Avoid introducing a duplicate declaration if a future bundler output
    // already contains the helper in the same chunk.
    if (content.includes("var __exportAll =")) continue;

    const patchedContent = content.replace(match[0], EXPORT_ALL_INLINE);
    await writeFile(filePath, patchedContent, "utf-8");
    patched += 1;
    console.log(`[fix-circular-ssr] patched ${filePath}`);
  }

  return { found: true, patched };
}

const candidates = [
  ".vercel/output/functions/__server.func",
  ".vercel/output/functions/__nitro.func",
  ".vercel/output/functions/nitro.func",
  ".output/server/_ssr",
];

let foundOutput = false;
let patched = 0;

for (const candidate of candidates) {
  const result = await patchOutput(join(process.cwd(), candidate));
  if (!result.found) continue;
  foundOutput = true;
  patched += result.patched;
}

if (!foundOutput) {
  console.warn("[fix-circular-ssr] No known Nitro/Vercel output directory found; skipping SSR patch.");
  process.exit(0);
}

console.log(
  patched > 0
    ? `[fix-circular-ssr] Patched ${patched} circular SSR import(s).`
    : "[fix-circular-ssr] No circular __exportAll import detected; SSR output is unchanged.",
);

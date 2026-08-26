#!/usr/bin/env node
/**
 * Post-build guard for Nitro's SSR output.
 *
 * Nitro/rolldown can emit a circular ESM dependency where one SSR chunk
 * imports __exportAll from a sibling chunk that also imports the first chunk.
 * Node/Vercel can evaluate that cycle before __exportAll is initialized.
 *
 * We inline the small helper into the importing chunk so the generated
 * server bundle does not depend on that initialization cycle.
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
  if (!existsSync(dir)) return false;

  let patchedAny = false;
  const files = await readdir(dir);

  for (const file of files) {
    if (!file.endsWith(".mjs")) continue;

    const filePath = join(dir, file);
    const content = await readFile(filePath, "utf-8");
    const match = content.match(IMPORT_PATTERN);

    if (!match) continue;

    const patched = content.replace(match[0], EXPORT_ALL_INLINE);
    await writeFile(filePath, patched, "utf-8");
    patchedAny = true;
    console.log(`[fix-circular-ssr] patched ${file}`);
  }

  return patchedAny;
}

const candidates = [
  ".output/server/_ssr",
  ".vercel/output/functions/__nitro.func/_ssr",
  ".vercel/output/functions/nitro.func/_ssr",
];

let foundOutput = false;
let patched = false;

for (const candidate of candidates) {
  const dir = join(process.cwd(), candidate);
  if (!existsSync(dir)) continue;

  foundOutput = true;
  patched = (await patchDir(dir)) || patched;
}

if (!foundOutput) {
  console.error("[fix-circular-ssr] ERROR: no Nitro SSR output directory was found.");
  console.error("[fix-circular-ssr] Refusing to silently continue with an unverified SSR build.");
  process.exit(1);
}

console.log(
  patched
    ? "[fix-circular-ssr] Circular SSR import patched."
    : "[fix-circular-ssr] No circular __exportAll import detected; SSR output is unchanged.",
);

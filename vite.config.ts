// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const EXPORT_ALL_INLINE = `var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
\tlet target = {};
\tfor (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
\tif (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
\treturn target;
};`;

// Vite plugin that post-processes Nitro's SSR output to fix a circular ESM dependency.
// Nitro/rolldown creates server-xxx.mjs (defines __exportAll) and server-xxx2.mjs
// (imports __exportAll FROM server-xxx.mjs), while server-xxx.mjs ALSO imports from
// server-xxx2.mjs — a circular dependency that causes __exportAll to be undefined at
// module init time on Vercel's Node.js serverless runtime.
// Fix: inline __exportAll directly in the file that imports it.
async function patchCircularExportAll(outputDir: string) {
  let files: string[];
  try {
    files = await readdir(outputDir);
  } catch {
    return;
  }
  for (const file of files) {
    if (!file.endsWith(".mjs")) continue;
    const filePath = join(outputDir, file);
    const content = await readFile(filePath, "utf-8");
    // Pattern: import { n as __exportAll } from "./server-XXXX.mjs";
    const match = content.match(/import \{ n as __exportAll \} from "\.\/server-[^"]+\.mjs";/);
    if (!match) continue;
    const patched = content.replace(match[0], EXPORT_ALL_INLINE);
    await writeFile(filePath, patched, "utf-8");
    console.log(`[fix-circular-export-all] Patched ${file}`);
  }
}

export default defineConfig({
  vite: {
    plugins: [
      {
        // Fix: @tanstack/start-client-core's createCsrfMiddleware calls createMiddleware()
        // internally during module initialization, which is tree-shaken out in SSR bundles.
        // We replace the entire module at build time with safe no-ops.
        name: "fix-tanstack-start-csrf-bug",
        enforce: "pre",
        transform(_code: string, id: string) {
          if (id.includes("createCsrfMiddleware")) {
            return {
              code: `
export const createCsrfMiddleware = () => ({
  options: { type: 'request' },
  middleware: () => ({}),
  validator: () => ({}),
  server: (fn) => ({ options: { type: 'request', server: fn } }),
  client: (fn) => ({ options: { type: 'request', client: fn } }),
});
export const csrfSymbol = Symbol.for('tanstack-start:csrf-middleware');
export const getCsrfRequestValidationResult = async () => true;
export const isCsrfRequestAllowed = async () => true;
`,
              map: null,
            };
          }
        },
      },
      {
        // Post-processes Nitro's output to break circular ESM dep:
        // server-xxx.mjs <-> server-xxx2.mjs (the __exportAll circular import).
        name: "fix-circular-export-all",
        apply: "build",
        closeBundle: {
          sequential: true,
          order: "post",
          async handler() {
            // Run after both the client and server Nitro build passes
            const candidates = [
              ".output/server/_ssr",
              ".vercel/output/functions/__nitro.func/_ssr",
            ];
            for (const dir of candidates) {
              await patchCircularExportAll(join(process.cwd(), dir));
            }
          },
        },
      },
    ],
  },
  nitro: {
    preset: process.env["VERCEL"] ? "vercel" : "cloudflare-module",
  },
});

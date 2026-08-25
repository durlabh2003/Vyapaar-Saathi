// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    plugins: [
      {
        // Fix: @tanstack/start-client-core's createCsrfMiddleware calls createMiddleware()
        // internally during module initialization, which is tree-shaken out in SSR bundles.
        // We replace the entire module at build time with safe no-ops.
        // See: https://github.com/TanStack/router/issues/7460
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
    ],
  },
  // NOTE: Do NOT set tanstackStart.server.entry to a custom server.ts.
  // Using a custom server entry creates an ESM circular dependency in Nitro's
  // output chunks (server-xxx.mjs <-> server-xxx2.mjs) where __exportAll is not
  // yet defined when first called, causing "TypeError: __exportAll is not a function"
  // on Vercel's serverless runtime. The remaining circular dep from Nitro itself is
  // patched by scripts/fix-circular-ssr.mjs which runs after vite build in package.json.
  nitro: {
    preset: process.env["VERCEL"] ? "vercel" : "cloudflare-module",
  },
});

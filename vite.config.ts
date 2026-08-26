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
        // TanStack Start 1.168.x can evaluate createCsrfMiddleware during SSR
        // bundling even though createMiddleware is tree-shaken from the SSR
        // runtime. Replace only that generated module with compatible no-ops.
        // See: https://github.com/TanStack/router/issues/7460
        name: "fix-tanstack-start-csrf-bug",
        enforce: "pre",
        transform(code: string, id: string) {
          if (!id.includes("createCsrfMiddleware")) return;

          // Avoid replacing unrelated application files whose names happen to
          // contain the same text. Only rewrite the TanStack Start module.
          if (!id.includes("@tanstack") || !code.includes("createCsrfMiddleware")) {
            return;
          }

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
        },
      },
    ],
  },
  // Do not set tanstackStart.server.entry to a custom server.ts. A custom
  // entry previously created an ESM cycle in Nitro's Vercel output.
  nitro: {
    preset: process.env["VERCEL"] ? "vercel" : "cloudflare-module",
  },
});

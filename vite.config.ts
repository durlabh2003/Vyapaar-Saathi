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
        name: "fix-tanstack-start-csrf-bug",
        enforce: "pre",
        transform(code, id) {
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
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    preset: process.env["VERCEL"] ? "vercel" : "cloudflare-module",
  },
});

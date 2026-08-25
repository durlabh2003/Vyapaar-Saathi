/**
 * patch-capacitor-html.mjs
 *
 * Post-build script for Capacitor APK builds.
 *
 * TanStack Start uses SSR — the server normally injects <script> and <link>
 * tags at request time. Since Capacitor has no server, this script patches
 * .output/public/index.html to include the correct asset references so the
 * app loads in the WebView without a server.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../.output/public");
const assetsDir = path.join(publicDir, "assets");
const indexPath = path.join(publicDir, "index.html");

console.log("🔧 Patching index.html for Capacitor...");

// Read the assets directory
const assetFiles = fs.readdirSync(assetsDir);

// Find CSS
const cssEntry = assetFiles.find((f) => f.match(/^styles-.*\.css$/));

// TanStack Start generates: index-[hash].js (router/app) + client-[hash].js (bootstrap)
const mainBundle = assetFiles.find((f) => f.match(/^index-.*\.js$/));
const clientBootstrap = assetFiles.find((f) => f.match(/^client-.*\.js$/));

if (!mainBundle && !clientBootstrap) {
  console.error("❌ Could not find main JS bundle in .output/public/assets/");
  process.exit(1);
}

console.log(`  📦 Main bundle:      ${mainBundle}`);
console.log(`  🚀 Client bootstrap: ${clientBootstrap}`);
console.log(`  🎨 CSS:              ${cssEntry}`);

// Build the tags to inject
const tags = [];

// Diagnostic: visible loading + error catcher
tags.push(`  <style>
    #cap-diag { position:fixed; top:0; left:0; right:0; background:#1a1a2e; color:#fff; font:14px monospace; padding:12px; z-index:99999; max-height:50vh; overflow:auto; }
    #cap-diag h3 { margin:0 0 8px; color:#e94560; font-size:16px; }
    #cap-diag p { margin:4px 0; word-break:break-all; }
    #cap-loading { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#0d5c48; color:#fff; padding:16px 28px; border-radius:12px; font:bold 16px sans-serif; z-index:99998; }
  </style>
  <div id="cap-loading">⏳ Loading Vyapaar Saathi...</div>
  <div id="cap-diag" style="display:none"><h3>❌ JS Error</h3></div>
  <script>
    window.$_TSR = window.$_TSR || {
      clean: function() {},
      h: function() {},
      buffer: [],
      t: new Map(),
      initialized: false,
      router: {
        manifest: { routes: {} },
        dehydratedData: {},
        lastMatchId: "",
        matches: []
      }
    };
    window.onerror = function(msg, src, line, col, err) {
      var d = document.getElementById('cap-diag');
      d.style.display = 'block';
      d.innerHTML += '<p><b>' + msg + '</b></p><p>' + src + ':' + line + '</p>';
    };
    window.onunhandledrejection = function(e) {
      var d = document.getElementById('cap-diag');
      d.style.display = 'block';
      d.innerHTML += '<p><b>Unhandled Promise:</b> ' + (e.reason || e) + '</p>';
    };
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        var loading = document.getElementById('cap-loading');
        if (loading) loading.remove();
      }, 8000); // remove after 8s if app took over
    });
  </script>`);

if (cssEntry) {
  tags.push(`  <link rel="stylesheet" href="/assets/${cssEntry}">`);
}

// Preload the main bundle
if (mainBundle) {
  tags.push(
    `  <link rel="modulepreload" href="/assets/${mainBundle}">`
  );
}

// The mainBundle (index-[hash].js) is the actual entry point containing createRoot().render()
// which imports client-[hash].js. It MUST be the <script type="module"> src.
const scriptSrc = mainBundle || clientBootstrap;
tags.push(
  `  <script type="module" src="/assets/${scriptSrc}"></script>`
);

// Read and patch index.html (or create if not present)
let html = fs.existsSync(indexPath)
  ? fs.readFileSync(indexPath, "utf-8")
  : `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vyapaar Saathi — Voice Business Khata</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="alternate icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="manifest" href="/manifest.json" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

// Remove old injected tags if re-patching
html = html.replace(
  /\s*<!-- capacitor-assets-start -->[\s\S]*?<!-- capacitor-assets-end -->/g,
  ""
);

// Inject before </head>
const injection = `\n  <!-- capacitor-assets-start -->\n${tags.join("\n")}\n  <!-- capacitor-assets-end -->`;
html = html.replace("</head>", `${injection}\n</head>`);

fs.writeFileSync(indexPath, html, "utf-8");
console.log("✅ index.html patched successfully!");
console.log("\nResult:\n" + html);

// ─── Patch the main JS bundle: hydrateRoot → createRoot ──────────────────────
//
// TanStack Start compiles the client entry with:
//   hydrateRoot(document, <StartClient />)
// This assumes a server rendered the initial HTML. In Capacitor there is no
// server, so hydration always fails and leaves a white screen.
//
// We replace it with:
//   createRoot(document.getElementById("root") || document.body).render(<StartClient />)
// so the app does a clean CSR render into the #root div we provide in index.html.
// ─────────────────────────────────────────────────────────────────────────────

const mainBundlePath = mainBundle ? path.join(assetsDir, mainBundle) : null;

if (mainBundlePath && fs.existsSync(mainBundlePath)) {
  let bundle = fs.readFileSync(mainBundlePath, "utf-8");

  const HYDRATE_PATTERN = /\(0,(\w+)\.hydrateRoot\)\(document,/;
  const match = bundle.match(HYDRATE_PATTERN);

  if (match) {
    const varName = match[1]; // e.g. "Ru"
    const search = `(0,${varName}.hydrateRoot)(document,`;
    const replace = `(0,${varName}.createRoot||window.__keepCreateRoot)(document.getElementById("root")||document.body).render(`;
    bundle = bundle.replace(search, replace);
    fs.writeFileSync(mainBundlePath, bundle, "utf-8");
    console.log(`✅ Bundle patched: hydrateRoot → createRoot (var: ${varName})`);
  } else {
    console.warn("⚠️  hydrateRoot pattern not found in bundle — skipping bundle patch.");
  }
} else {
  console.warn("⚠️  Main bundle not found — skipping bundle patch.");
}


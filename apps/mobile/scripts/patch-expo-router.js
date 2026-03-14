#!/usr/bin/env node
/**
 * Patches expo-router for monorepo compatibility:
 * 1. Replaces process.env references in _ctx files with hardcoded values
 *    (Metro's transform worker can't resolve env vars in monorepo setups)
 * 2. Patches entry.js to import polyfills before anything else
 *    (required because crypto.randomUUID, Buffer, etc. must exist before stores init)
 *
 * Run: node scripts/patch-expo-router.js
 */
const fs = require("fs");
const path = require("path");

const routerDir = path.join(__dirname, "..", "node_modules", "expo-router");

// --- 1. Patch _ctx files: replace env vars with hardcoded values ---
const ctxFiles = ["_ctx.ios.js", "_ctx.js", "_ctx.android.js", "_ctx.web.js"];

for (const file of ctxFiles) {
  const filePath = path.join(routerDir, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf-8");
  let patched = false;

  if (content.includes("process.env.EXPO_ROUTER_APP_ROOT")) {
    content = content.replace(
      "process.env.EXPO_ROUTER_APP_ROOT",
      '"../../app"'
    );
    patched = true;
  }

  if (content.includes("process.env.EXPO_ROUTER_IMPORT_MODE")) {
    content = content.replace(
      "process.env.EXPO_ROUTER_IMPORT_MODE",
      '"sync"'
    );
    patched = true;
  }

  if (patched) {
    fs.writeFileSync(filePath, content);
    console.log(`Patched ${file}`);
  }
}

// --- 2. Patch entry.js: inject polyfills import before expo-router loads ---
const entryPath = path.join(routerDir, "entry.js");
if (fs.existsSync(entryPath)) {
  const entryContent = fs.readFileSync(entryPath, "utf-8");
  if (!entryContent.includes("polyfills")) {
    const patched = `// Polyfills MUST run before any other code (GramJS, Zustand stores, etc.)
import '../../lib/polyfills';
${entryContent}`;
    fs.writeFileSync(entryPath, patched);
    console.log("Patched entry.js (added polyfills import)");
  }
}

console.log("expo-router patch complete");

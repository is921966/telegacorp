#!/usr/bin/env node
/**
 * Patches expo-router _ctx files for monorepo compatibility.
 * Replaces process.env references with hardcoded values since
 * Metro's transform worker can't resolve them in monorepo setups.
 *
 * Run: node scripts/patch-expo-router.js
 */
const fs = require("fs");
const path = require("path");

const ctxDir = path.join(__dirname, "..", "node_modules", "expo-router");
const files = ["_ctx.ios.js", "_ctx.js", "_ctx.android.js", "_ctx.web.js"];

for (const file of files) {
  const filePath = path.join(ctxDir, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, "utf-8");
  let patched = false;

  if (content.includes("process.env.EXPO_ROUTER_APP_ROOT")) {
    content = content.replace("process.env.EXPO_ROUTER_APP_ROOT", '"./app"');
    patched = true;
  }

  if (content.includes("process.env.EXPO_ROUTER_IMPORT_MODE")) {
    content = content.replace("process.env.EXPO_ROUTER_IMPORT_MODE", '"sync"');
    patched = true;
  }

  if (patched) {
    fs.writeFileSync(filePath, content);
    console.log(`Patched ${file}`);
  }
}

console.log("expo-router ctx patch complete");

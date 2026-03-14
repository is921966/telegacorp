// Ensure Expo Router knows the app directory (required in monorepos)
process.env.EXPO_ROUTER_APP_ROOT = "./app";

// Prevent Expo from resolving up to monorepo root as Metro server root
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = "1";

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");
const emptyShim = path.resolve(projectRoot, "shims/empty.js");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (for packages/shared)
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages (local first, then hoisted)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Node.js polyfill/shim mappings for GramJS and other native-only modules
const nodeShims = {
  fs: emptyShim,
  net: emptyShim,
  tls: emptyShim,
  os: emptyShim,
  path: emptyShim,
  assert: emptyShim,
  "graceful-fs": emptyShim,
  "node-localstorage": emptyShim,
  "write-file-atomic": emptyShim,
  util: path.resolve(projectRoot, "shims/util.js"),
  constants: emptyShim,
  child_process: emptyShim,
  http: emptyShim,
  https: emptyShim,
  zlib: emptyShim,
  dns: emptyShim,
  dgram: emptyShim,
  cluster: emptyShim,
  module: emptyShim,
  readline: emptyShim,
  repl: emptyShim,
  tty: emptyShim,
  vm: emptyShim,
  worker_threads: emptyShim,
  perf_hooks: emptyShim,
  async_hooks: emptyShim,
};

const nodePolyfills = {
  buffer: require.resolve("buffer/"),
  stream: require.resolve("readable-stream"),
  crypto: require.resolve("./shims/crypto.js"),
};

config.resolver.extraNodeModules = {
  ...nodeShims,
  ...nodePolyfills,
};

// 4. Override resolver to intercept Node.js-only modules that exist in node_modules
// (extraNodeModules is a fallback, not an override — this ensures shims take priority)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force shim for Node.js-only modules
  if (nodeShims[moduleName]) {
    return {
      filePath: nodeShims[moduleName],
      type: "sourceFile",
    };
  }
  // Force polyfills for modules with RN replacements
  if (nodePolyfills[moduleName]) {
    return {
      filePath: nodePolyfills[moduleName],
      type: "sourceFile",
    };
  }
  // Default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// 5. Ensure .cjs files are resolved
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), "cjs"];

module.exports = config;

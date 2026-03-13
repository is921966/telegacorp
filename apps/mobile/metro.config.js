// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the project root (monorepo root)
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (not just apps/mobile)
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Node.js polyfill mappings for GramJS
config.resolver.extraNodeModules = {
  // GramJS polyfills
  buffer: require.resolve("buffer/"),
  stream: require.resolve("readable-stream"),
  crypto: require.resolve("react-native-quick-crypto"),
  // Empty shims for unused Node.js modules
  net: require.resolve("./shims/empty.js"),
  tls: require.resolve("./shims/empty.js"),
  fs: require.resolve("./shims/empty.js"),
  os: require.resolve("./shims/empty.js"),
  path: require.resolve("./shims/empty.js"),
};

// 4. Ensure .cjs files are resolved (some packages use them)
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), "cjs"];

module.exports = config;

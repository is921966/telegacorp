// Ensure Expo Router knows the app directory (required in monorepos)
process.env.EXPO_ROUTER_APP_ROOT = "./app";

// Prevent Expo from resolving up to monorepo root as Metro server root
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = "1";

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (for packages/shared)
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages (local first, then hoisted)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Node.js polyfill mappings for GramJS
config.resolver.extraNodeModules = {
  buffer: require.resolve("buffer/"),
  stream: require.resolve("readable-stream"),
  crypto: require.resolve("react-native-quick-crypto"),
  net: require.resolve("./shims/empty.js"),
  tls: require.resolve("./shims/empty.js"),
  fs: require.resolve("./shims/empty.js"),
  os: require.resolve("./shims/empty.js"),
  path: require.resolve("./shims/empty.js"),
};

// 4. Ensure .cjs files are resolved
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), "cjs"];

module.exports = config;

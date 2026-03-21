const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("tflite");

// Prefer CJS builds — ESM builds of @supabase packages require tslib which Metro can't resolve
config.resolver.resolverMainFields = ['react-native', 'main', 'module'];

module.exports = config;

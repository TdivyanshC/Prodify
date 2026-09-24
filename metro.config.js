const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// GLTF/GLB 3D model assets (mascot render) — Metro needs to treat these as
// binary assets (copied + hashed, resolved to a URI) rather than trying to
// parse them as JS/JSON source, which is the default for unknown extensions.
config.resolver.assetExts.push('glb', 'gltf', 'bin');

module.exports = config;

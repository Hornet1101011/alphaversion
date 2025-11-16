// Compatibility wrapper to expose the User model for CommonJS require()
try {
  // Prefer built JS in dist if available
  const mod = require('../dist/models/User');
  // dist compiled may export default or named User
  module.exports = mod.default || mod.User || mod;
} catch (e) {
  try {
    // Fall back to TS source (used when running ts-node)
    const mod = require('../src/models/User');
    module.exports = mod.User || mod.default || mod;
  } catch (inner) {
    // As a last resort, rethrow the original error
    throw e;
  }
}

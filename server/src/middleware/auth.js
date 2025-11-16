// CommonJS shim for legacy JS routes that import requireAuth
// Try to require the TypeScript module directly first to avoid circular self-require
let authModule;
try {
	// Attempt to require the TS source when running under ts-node
	authModule = require('./auth.ts');
} catch (e) {
	try {
		// Fallback to requiring transpiled JS (or same file if running compiled)
		authModule = require('./auth');
	} catch (err) {
		// If both fail, set empty object so accesses don't throw
		// eslint-disable-next-line no-console
		console.error('Failed to load auth module shim:', err);
		authModule = {};
	}
}

// Map exported names with sensible fallbacks for legacy consumers
module.exports = {
	requireAuth: authModule.auth || authModule.requireAuth,
	auth: authModule.auth || authModule.requireAuth,
	authorize: authModule.authorize || authModule.authorize
};

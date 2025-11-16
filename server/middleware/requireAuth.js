/**
 * Middleware: requireAuth
 * - verifies a JWT in the Authorization header (Bearer ...) or cookie and attaches req.user
 * - if missing or invalid, respond with 401 Unauthorized
 */
const jwt = require('jsonwebtoken');
// Require the User model; some modules export { User } while others export default or module.exports
// Use destructuring first, then fallback to the module itself or mongoose model retrieval.
let UserModule = require('../models/User');
const User = (UserModule && UserModule.User) ? UserModule.User : (UserModule && UserModule.default) ? UserModule.default : UserModule;

module.exports = async function requireAuth(req, res, next) {
  try {
    // If some upstream middleware already set req.user, allow through
    if (req.user) return next();

    // Try to get token from Authorization header or cookie
    let token = null;
    if (req.header && req.header('Authorization')) {
      const raw = req.header('Authorization');
      if (raw && raw.startsWith('Bearer ')) token = raw.replace('Bearer ', '');
    }
    if (!token && req.cookies && req.cookies.token) token = req.cookies.token;

    // Debug: note whether an Authorization header or cookie was present (do not log token value)
    try {
      const hasAuthHeader = !!req.header && !!req.header('Authorization');
      const hasCookie = !!(req.cookies && req.cookies.token);
      if (process.env.DEBUG_AUTH) console.debug('requireAuth: hasAuthHeader=', hasAuthHeader, 'hasCookie=', hasCookie);
    } catch (e) {
      // ignore
    }

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const secret = process.env.JWT_SECRET || 'defaultsecret';
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (e) {
      console.error('JWT verify failed in requireAuth:', e);
      return res.status(401).json({ message: 'Token is not valid' });
    }

    const userId = decoded && (decoded._id || decoded.id || decoded.uid || decoded.userId);
    if (!userId) return res.status(401).json({ message: 'Invalid token payload' });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(401).json({ message: 'User not found' });

    // Attach minimal user info
    req.user = {
      _id: user._id,
      email: user.email,
      role: user.role,
      username: user.username,
      barangayID: user.barangayID,
      isActive: user.isActive,
      fullName: user.fullName,
    };

    return next();
  } catch (err) {
    console.error('requireAuth middleware error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Middleware: isAdmin
 * - expects req.user populated by authentication middleware
 * - allows through if req.user.role === 'admin' or req.user.isAdmin === true
 * - otherwise responds 403 Forbidden
 */
module.exports = function isAdmin(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(403).json({ message: 'Forbidden' });
    if (user.role === 'admin' || user.isAdmin === true) return next();
    return res.status(403).json({ message: 'Forbidden' });
  } catch (err) {
    console.error('isAdmin middleware error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

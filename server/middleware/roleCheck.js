module.exports = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to perform this action' });
    }
    next();
  };
};
// Moved to src/middleware/roleCheck.js

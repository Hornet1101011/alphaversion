const rateLimit = require('express-rate-limit');

// createRateLimiter(options) -> returns middleware
function createRateLimiter({ windowMs = 60 * 60 * 1000, max = 5, message } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        message: message || `Too many requests, please try again later.`,
      });
    },
  });
}

module.exports = { createRateLimiter };

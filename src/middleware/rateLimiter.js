const rateLimit = require('express-rate-limit');
const config = require('../config/config');

// General API rate limiting dengan trust proxy
const apiLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,  // Tambah ini untuk fix X-Forwarded-For
  skip: (req) => {
    // Skip rate limit untuk internal requests
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

// Message sending rate limiting
const messageLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    status: 'error',
    message: 'Too many messages sent. Please wait before sending more.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true  // Tambah ini
});

// Bulk message rate limiting
const bulkMessageLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1,
  message: {
    status: 'error',
    message: 'Bulk messaging limit reached. Please wait before sending more bulk messages.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true  // Tambah ini
});

module.exports = {
  apiLimit,
  messageLimit,
  bulkMessageLimit
};

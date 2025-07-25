const rateLimit = require('express-rate-limit');
const config = require('../config/config');

// General API rate limiting
const apiLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Message sending rate limiting (more restrictive)
const messageLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: {
    status: 'error',
    message: 'Too many messages sent. Please wait before sending more.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Bulk message rate limiting (very restrictive)
const bulkMessageLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1, // 1 bulk operation per 5 minutes
  message: {
    status: 'error',
    message: 'Bulk messaging limit reached. Please wait before sending more bulk messages.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimit,
  messageLimit,
  bulkMessageLimit
};
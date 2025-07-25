const express = require('express');
const sessionController = require('../controllers/sessionController');
const auth = require('../middleware/auth');

const router = express.Router();

// Public routes (no auth required)
router.get('/status', sessionController.getStatus);
router.get('/qr', sessionController.getQRCode);
router.get('/stream', sessionController.streamSession);

// Protected routes
router.post('/logout', auth.authenticate, sessionController.logout);

module.exports = router;
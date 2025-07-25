const whatsappService = require('../services/whatsappService');
const logger = require('../services/loggerService');
const { v4: uuidv4 } = require('uuid');

class SessionController {
  async getStatus(req, res) {
    try {
      const status = whatsappService.getStatus();
      
      res.status(200).json({
        status: 'success',
        data: status
      });
    } catch (error) {
      logger.error('Error in getStatus:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get session status',
        error: error.message
      });
    }
  }

  async getQRCode(req, res) {
    try {
      const qrCode = whatsappService.getQRCode();
      
      if (!qrCode) {
        return res.status(404).json({
          status: 'error',
          message: 'QR Code not available. WhatsApp may already be connected.'
        });
      }

      res.status(200).json({
        status: 'success',
        data: {
          qrCode,
          instruction: 'Scan this QR code with your WhatsApp mobile app'
        }
      });
    } catch (error) {
      logger.error('Error in getQRCode:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get QR code',
        error: error.message
      });
    }
  }

  async streamSession(req, res) {
    try {
      // Set headers for Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const sessionId = uuidv4();
      
      // Send initial status
      const status = whatsappService.getStatus();
      res.write(`data: ${JSON.stringify({ type: 'status', data: status })}\n\n`);

      // Add callback for session updates
      const callback = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      whatsappService.addSessionCallback(sessionId, callback);

      // Handle client disconnect
      req.on('close', () => {
        whatsappService.removeSessionCallback(sessionId);
        logger.info(`Session ${sessionId} disconnected`);
      });

    } catch (error) {
      logger.error('Error in streamSession:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to start session stream',
        error: error.message
      });
    }
  }

  async logout(req, res) {
    try {
      await whatsappService.logout();
      
      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Error in logout:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to logout',
        error: error.message
      });
    }
  }
}

module.exports = new SessionController();
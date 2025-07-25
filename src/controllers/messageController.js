const whatsappService = require('../services/whatsappService');
const storageService = require('../services/storageService');
const { validateMessage, validateBulkMessage } = require('../utils/validation');
const logger = require('../services/loggerService');

class MessageController {
  async sendMessage(req, res) {
    try {
      const { error, value } = validateMessage(req.body);
      if (error) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const { to, message, options = {} } = value;
      
      // Handle file upload if present
      if (req.file) {
        options.media = {
          path: req.file.path,
          mimetype: req.file.mimetype,
          filename: req.file.originalname,
          size: req.file.size
        };
      }

      const result = await whatsappService.sendMessage(to, message, options);

      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      logger.error('Error in sendMessage:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to send message',
        error: error.message
      });
    }
  }

  async sendBulkMessage(req, res) {
    try {
      const { error, value } = validateBulkMessage(req.body);
      if (error) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const { recipients, message, options = {} } = value;

      // Process bulk message in background
      setImmediate(async () => {
        try {
          await whatsappService.sendBulkMessage(recipients, message, options);
        } catch (error) {
          logger.error('Background bulk message failed:', error);
        }
      });

      res.status(202).json({
        status: 'success',
        message: 'Bulk message processing started',
        data: {
          recipientCount: recipients.length,
          estimatedTime: `${recipients.length * (options.delay || 2000) / 1000} seconds`
        }
      });
    } catch (error) {
      logger.error('Error in sendBulkMessage:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to start bulk message',
        error: error.message
      });
    }
  }

  async getMessageStatus(req, res) {
    try {
      const { messageId } = req.params;
      const message = await storageService.getMessageById(messageId);
      
      if (!message) {
        return res.status(404).json({
          status: 'error',
          message: 'Message not found'
        });
      }

      res.status(200).json({
        status: 'success',
        data: message
      });
    } catch (error) {
      logger.error('Error in getMessageStatus:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get message status',
        error: error.message
      });
    }
  }

  async getMessages(req, res) {
    try {
      const { page = 1, limit = 20, status, direction, to, from } = req.query;
      const filters = {};
      
      if (status) filters.status = status;
      if (direction) filters.direction = direction;
      if (to) filters.to = to;
      if (from) filters.from = from;

      const result = await storageService.getMessages(filters, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      logger.error('Error in getMessages:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get messages',
        error: error.message
      });
    }
  }

  async getContacts(req, res) {
    try {
      const contacts = await whatsappService.getContacts();
      
      res.status(200).json({
        status: 'success',
        data: contacts
      });
    } catch (error) {
      logger.error('Error in getContacts:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get contacts',
        error: error.message
      });
    }
  }

  async getChats(req, res) {
    try {
      const chats = await whatsappService.getChats();
      
      res.status(200).json({
        status: 'success',
        data: chats
      });
    } catch (error) {
      logger.error('Error in getChats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get chats',
        error: error.message
      });
    }
  }

  async getStats(req, res) {
    try {
      const { timeframe = '24h' } = req.query;
      const stats = await storageService.getMessageStats(timeframe);
      
      res.status(200).json({
        status: 'success',
        data: {
          timeframe,
          stats
        }
      });
    } catch (error) {
      logger.error('Error in getStats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get stats',
        error: error.message
      });
    }
  }
}

module.exports = new MessageController();
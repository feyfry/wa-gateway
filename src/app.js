const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const config = require('./config/config');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const logger = require('./services/loggerService');
const whatsappService = require('./services/whatsappService');
const storageService = require('./services/storageService');

// Routes
const messageRoutes = require('./routes/messages');
const sessionRoutes = require('./routes/session');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(compression());

// Rate limiting
app.use(rateLimiter.apiLimit);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/session', sessionRoutes);

// Health check
app.get('/health', (req, res) => {
  const whatsappStatus = whatsappService.getStatus();
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    whatsapp: {
      isReady: whatsappStatus.isReady,
      hasQR: whatsappStatus.hasQR
    }
  });
});

// API Documentation
app.get('/', (req, res) => {
  res.json({
    name: 'Simple WhatsApp Gateway',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      session: {
        status: 'GET /api/v1/session/status',
        qr: 'GET /api/v1/session/qr',
        logout: 'POST /api/v1/session/logout'
      },
      messages: {
        send: 'POST /api/v1/messages/send',
        bulk: 'POST /api/v1/messages/bulk',
        history: 'GET /api/v1/messages',
        contacts: 'GET /api/v1/messages/contacts',
        chats: 'GET /api/v1/messages/chats'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = config.port || 3000;

async function startServer() {
  try {
    // Initialize storage
    await storageService.initialize();
    
    // Initialize WhatsApp service
    await whatsappService.initialize();
    
    app.listen(PORT, () => {
      logger.info(`🚀 WhatsApp Gateway running on port ${PORT}`);
      logger.info(`📱 Environment: ${config.environment}`);
      logger.info(`📋 API Documentation: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await whatsappService.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await whatsappService.destroy();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

module.exports = app;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const storageService = require('../services/storageService');
const logger = require('../services/loggerService');

class AuthMiddleware {
  async authenticate(req, res, next) {
    try {
      const authHeader = req.header('Authorization');
      const apiKey = req.header('X-API-Key');
      
      // Check API Key authentication
      if (apiKey) {
        const user = await storageService.getUserByApiKey(apiKey);
        if (!user) {
          return res.status(401).json({
            status: 'error',
            message: 'Invalid API key'
          });
        }
        req.user = user;
        return next();
      }
      
      // Check JWT authentication
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        try {
          const decoded = jwt.verify(token, config.jwt.secret);
          const user = await storageService.getUser(decoded.username);
          
          if (!user) {
            return res.status(401).json({
              status: 'error',
              message: 'Invalid token'
            });
          }
          
          req.user = user;
          return next();
        } catch (error) {
          return res.status(401).json({
            status: 'error',
            message: 'Invalid token'
          });
        }
      }
      
      // No authentication provided
      res.status(401).json({
        status: 'error',
        message: 'Authentication required. Provide Authorization header or X-API-Key'
      });
      
    } catch (error) {
      logger.error('Authentication error:', error);
      res.status(401).json({
        status: 'error',
        message: 'Authentication failed'
      });
    }
  }

  async login(username, password) {
    try {
      const user = await storageService.getUser(username);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error('Invalid password');
      }
      
      const token = jwt.sign(
        { username: user.username },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );
      
      return {
        token,
        user: {
          username: user.username,
          apiKey: user.apiKey
        }
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  async createDefaultAdmin() {
    try {
      const existingAdmin = await storageService.getUser(config.defaultAdmin.username);
      
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(config.defaultAdmin.password, 10);
        
        const adminUser = {
          username: config.defaultAdmin.username,
          password: hashedPassword,
          apiKey: config.defaultAdmin.apiKey,
          role: 'admin',
          createdAt: new Date()
        };
        
        await storageService.saveUser(adminUser);
        logger.info('Default admin user created');
      }
    } catch (error) {
      logger.error('Error creating default admin:', error);
    }
  }
}

module.exports = new AuthMiddleware();
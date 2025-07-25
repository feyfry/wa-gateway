const fs = require('fs').promises;
const path = require('path');

class StorageService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.messagesFile = path.join(this.dataDir, 'messages.json');
    this.usersFile = path.join(this.dataDir, 'users.json');
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await this.initializeFile(this.messagesFile, []);
      await this.initializeFile(this.usersFile, []);
      console.log('Storage service initialized');
    } catch (error) {
      console.error('Failed to initialize storage service:', error);
      throw error;
    }
  }

  async initializeFile(filePath, defaultData) {
    try {
      await fs.access(filePath);
    } catch (error) {
      await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
      console.log(`Created ${path.basename(filePath)}`);
    }
  }

  async readFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return [];
    }
  }

  async writeFile(filePath, data) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      throw error;
    }
  }

  async saveMessage(messageData) {
    try {
      const messages = await this.readFile(this.messagesFile);
      if (!messageData.timestamp) {
        messageData.timestamp = new Date();
      }
      messages.push(messageData);
      if (messages.length > 1000) {
        messages.splice(0, messages.length - 1000);
      }
      await this.writeFile(this.messagesFile, messages);
      return messageData;
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  async getMessages(filters = {}, pagination = {}) {
    try {
      const messages = await this.readFile(this.messagesFile);
      const { page = 1, limit = 20 } = pagination;
      
      let filteredMessages = messages;
      
      if (filters.status) {
        filteredMessages = filteredMessages.filter(msg => msg.status === filters.status);
      }
      if (filters.direction) {
        filteredMessages = filteredMessages.filter(msg => msg.direction === filters.direction);
      }
      if (filters.to) {
        filteredMessages = filteredMessages.filter(msg => 
          msg.to && msg.to.includes(filters.to.replace(/\D/g, ''))
        );
      }
      if (filters.from) {
        filteredMessages = filteredMessages.filter(msg => 
          msg.from && msg.from.includes(filters.from.replace(/\D/g, ''))
        );
      }
      
      filteredMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      const total = filteredMessages.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedMessages = filteredMessages.slice(startIndex, endIndex);
      
      return {
        messages: paginatedMessages,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      };
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  async getMessageById(messageId) {
    try {
      const messages = await this.readFile(this.messagesFile);
      return messages.find(msg => msg.id === messageId);
    } catch (error) {
      console.error('Error getting message by ID:', error);
      throw error;
    }
  }

  async updateMessageStatus(messageId, status) {
    try {
      const messages = await this.readFile(this.messagesFile);
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      
      if (messageIndex !== -1) {
        messages[messageIndex].status = status;
        messages[messageIndex].updatedAt = new Date();
        await this.writeFile(this.messagesFile, messages);
        return messages[messageIndex];
      }
      return null;
    } catch (error) {
      console.error('Error updating message status:', error);
      throw error;
    }
  }

  async getMessageStats(timeframe = '24h') {
    try {
      const messages = await this.readFile(this.messagesFile);
      const now = new Date();
      let startDate;

      switch (timeframe) {
        case '1h': startDate = new Date(now.getTime() - 60 * 60 * 1000); break;
        case '24h': startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
        case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        default: startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const recentMessages = messages.filter(msg => new Date(msg.timestamp) >= startDate);
      const stats = { total: recentMessages.length, sent: 0, received: 0, failed: 0, pending: 0 };

      recentMessages.forEach(msg => {
        if (msg.status === 'sent') stats.sent++;
        else if (msg.status === 'received') stats.received++;
        else if (msg.status === 'failed') stats.failed++;
        else if (msg.status === 'pending') stats.pending++;
      });

      return stats;
    } catch (error) {
      console.error('Error getting message stats:', error);
      throw error;
    }
  }

  async getUser(username) {
    try {
      const users = await this.readFile(this.usersFile);
      return users.find(user => user.username === username);
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async getUserByApiKey(apiKey) {
    try {
      const users = await this.readFile(this.usersFile);
      return users.find(user => user.apiKey === apiKey);
    } catch (error) {
      console.error('Error getting user by API key:', error);
      return null;
    }
  }
}

module.exports = new StorageService();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const storageService = require('./storageService');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCode = null;
    this.sessionCallbacks = new Map();
  }

  async initialize() {
    try {
      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: './sessions' }),
        puppeteer: {
          headless: process.env.WA_HEADLESS !== 'false',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
      });

      this.setupEventHandlers();
      console.log('Initializing WhatsApp client...');
      await this.client.initialize();
    } catch (error) {
      console.error('Failed to initialize WhatsApp client:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    this.client.on('qr', async (qr) => {
      console.log('QR Code received');
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        this.sessionCallbacks.forEach((callback) => {
          callback({ type: 'qr', data: this.qrCode });
        });
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      }
    });

    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      this.isReady = true;
      this.qrCode = null;
      this.sessionCallbacks.forEach((callback) => {
        callback({ type: 'ready', data: { status: 'connected' } });
      });
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp client authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('Authentication failed:', msg);
      this.isReady = false;
    });

    this.client.on('disconnected', (reason) => {
      console.warn('WhatsApp client disconnected:', reason);
      this.isReady = false;
    });

    this.client.on('message', async (message) => {
      try {
        await this.handleIncomingMessage(message);
      } catch (error) {
        console.error('Error handling incoming message:', error);
      }
    });

    this.client.on('message_create', async (message) => {
      if (message.fromMe) {
        try {
          await this.handleOutgoingMessage(message);
        } catch (error) {
          console.error('Error handling outgoing message:', error);
        }
      }
    });
  }

  async sendMessage(to, message, options = {}) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);
      
      let sentMessage;
      if (options.media) {
        const media = MessageMedia.fromFilePath(options.media.path);
        sentMessage = await this.client.sendMessage(formattedNumber, media, { caption: message });
      } else {
        sentMessage = await this.client.sendMessage(formattedNumber, message);
      }

      const messageData = {
        id: sentMessage.id._serialized,
        to: formattedNumber,
        message,
        status: 'sent',
        timestamp: new Date(),
        direction: 'outgoing'
      };
      
      if (options.media) messageData.media = options.media;
      await storageService.saveMessage(messageData);

      console.log(`Message sent to ${to}: ${sentMessage.id._serialized}`);
      return {
        success: true,
        messageId: sentMessage.id._serialized,
        timestamp: sentMessage.timestamp
      };
    } catch (error) {
      console.error(`Failed to send message to ${to}:`, error);
      
      await storageService.saveMessage({
        id: `failed_${Date.now()}`,
        to: this.formatPhoneNumber(to),
        message,
        status: 'failed',
        timestamp: new Date(),
        direction: 'outgoing',
        error: error.message
      });
      
      throw error;
    }
  }

  async sendBulkMessage(recipients, message, options = {}) {
    const results = [];
    const delay = options.delay || 2000;

    console.log(`Starting bulk message to ${recipients.length} recipients`);

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        const result = await this.sendMessage(recipient, message, options);
        results.push({ recipient, ...result });
        
        console.log(`Bulk message ${i + 1}/${recipients.length} sent to ${recipient}`);
        
        if (delay > 0 && i < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`Failed to send bulk message to ${recipient}:`, error);
        results.push({ recipient, success: false, error: error.message });
      }
    }

    console.log(`Bulk message completed. Success: ${results.filter(r => r.success).length}/${recipients.length}`);
    return results;
  }

  async getContacts() {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const contacts = await this.client.getContacts();
      return contacts.map(contact => ({
        id: contact.id._serialized,
        name: contact.name || contact.pushname || contact.verifiedName,
        number: contact.number,
        isGroup: contact.isGroup,
        isUser: contact.isUser
      }));
    } catch (error) {
      console.error('Failed to get contacts:', error);
      throw error;
    }
  }

  async getChats() {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chats = await this.client.getChats();
      return chats.map(chat => ({
        id: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
        unreadCount: chat.unreadCount,
        lastMessage: chat.lastMessage ? {
          body: chat.lastMessage.body,
          timestamp: chat.lastMessage.timestamp,
          from: chat.lastMessage.from
        } : null
      }));
    } catch (error) {
      console.error('Failed to get chats:', error);
      throw error;
    }
  }

  formatPhoneNumber(number) {
    let cleaned = number.replace(/\D/g, '');
    if (!cleaned.startsWith('62') && cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62') && !cleaned.startsWith('1')) {
      cleaned = '62' + cleaned;
    }
    return cleaned + '@c.us';
  }

  getStatus() {
    return {
      isReady: this.isReady,
      hasQR: !!this.qrCode,
      clientState: this.client?.info || null
    };
  }

  getQRCode() {
    return this.qrCode;
  }

  async logout() {
    try {
      if (this.client) {
        await this.client.logout();
        this.isReady = false;
        this.qrCode = null;
        console.log('WhatsApp client logged out');
      }
    } catch (error) {
      console.error('Error logging out WhatsApp client:', error);
      throw error;
    }
  }

  addSessionCallback(id, callback) {
    this.sessionCallbacks.set(id, callback);
  }

  removeSessionCallback(id) {
    this.sessionCallbacks.delete(id);
  }

  async handleIncomingMessage(whatsappMessage) {
    try {
      const messageData = {
        id: whatsappMessage.id._serialized,
        from: whatsappMessage.from,
        to: whatsappMessage.to,
        message: whatsappMessage.body,
        type: whatsappMessage.type,
        direction: 'incoming',
        status: 'received',
        timestamp: new Date(whatsappMessage.timestamp * 1000)
      };

      if (whatsappMessage.hasMedia) {
        try {
          const media = await whatsappMessage.downloadMedia();
          messageData.media = {
            mimetype: media.mimetype,
            filename: media.filename || 'media',
            size: media.data.length
          };
        } catch (error) {
          console.error('Failed to download media:', error);
        }
      }

      await storageService.saveMessage(messageData);
      console.log(`Incoming message saved: ${messageData.id}`);
      
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  async handleOutgoingMessage(whatsappMessage) {
    try {
      await storageService.updateMessageStatus(whatsappMessage.id._serialized, 'sent');
    } catch (error) {
      console.error('Error handling outgoing message:', error);
    }
  }

  async destroy() {
    try {
      if (this.client) {
        await this.client.destroy();
        console.log('WhatsApp client destroyed');
      }
    } catch (error) {
      console.error('Error destroying WhatsApp client:', error);
    }
  }
}

module.exports = new WhatsAppService();

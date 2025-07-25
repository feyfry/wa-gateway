require('dotenv').config();

module.exports = {
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 3000,
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  
  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  
  // WhatsApp
  whatsapp: {
    sessionPath: process.env.WA_SESSION_PATH || './sessions',
    puppeteerOptions: {
      headless: process.env.WA_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    }
  },
  
  // File upload
  upload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
  },
  
  // Default admin user
  defaultAdmin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    apiKey: process.env.ADMIN_API_KEY || 'admin-api-key-change-this'
  }
};
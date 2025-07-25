const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Create all necessary files and directories
async function createSetup() {
  console.log('🚀 Setting up WhatsApp Gateway...');

  try {
    // Create directories
    const dirs = ['data', 'sessions', 'uploads', 'logs', 'src/middleware', 'src/services', 'src/utils'];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    }

    // Create .gitignore
    const gitignoreContent = `
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# WhatsApp session data
sessions/
.wwebjs_auth/
.wwebjs_cache/

# Uploads
uploads/*
!uploads/.gitkeep

# Data files
data/
*.json

# PM2
.pm2/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`;
    
    fs.writeFileSync('.gitignore', gitignoreContent.trim());
    console.log('✅ Created .gitignore');

    // Create missing middleware files
    if (!fs.existsSync('src/middleware/errorHandler.js')) {
      const errorHandlerContent = `const logger = require('../services/loggerService');

function errorHandler(err, req, res, next) {
  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      status: 'error',
      message: 'Validation Error',
      errors
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid token'
    });
  }

  // Multer error (file upload)
  if (err instanceof require('multer').MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File too large'
      });
    }
    return res.status(400).json({
      status: 'error',
      message: 'File upload error',
      error: err.message
    });
  }

  // Default error
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = errorHandler;`;
      
      fs.writeFileSync('src/middleware/errorHandler.js', errorHandlerContent);
      console.log('✅ Created src/middleware/errorHandler.js');
    }

    // Create uploads .gitkeep
    if (!fs.existsSync('uploads/.gitkeep')) {
      fs.writeFileSync('uploads/.gitkeep', '');
      console.log('✅ Created uploads/.gitkeep');
    }

    // Initialize data files
    const dataDir = 'data';
    
    // Messages file
    const messagesFile = path.join(dataDir, 'messages.json');
    if (!fs.existsSync(messagesFile)) {
      fs.writeFileSync(messagesFile, JSON.stringify([], null, 2));
      console.log('✅ Created data/messages.json');
    }

    // Users file with default admin
    const usersFile = path.join(dataDir, 'users.json');
    if (!fs.existsSync(usersFile)) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const defaultUsers = [{
        username: 'admin',
        password: hashedPassword,
        apiKey: 'admin-api-key-change-this',
        role: 'admin',
        createdAt: new Date()
      }];
      
      fs.writeFileSync(usersFile, JSON.stringify(defaultUsers, null, 2));
      console.log('✅ Created data/users.json with default admin');
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\nDefault credentials:');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('API Key: admin-api-key-change-this');
    console.log('\n⚠️  Please change default credentials in production!');
    console.log('\n🚀 You can now run: npm start');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  createSetup();
}

module.exports = createSetup;
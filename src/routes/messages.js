const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const config = require('../config/config');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxSize
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Apply authentication to all routes
router.use(auth.authenticate);

// Routes
router.post('/send', 
  rateLimiter.messageLimit, 
  upload.single('media'), 
  messageController.sendMessage
);

router.post('/bulk', 
  rateLimiter.bulkMessageLimit, 
  messageController.sendBulkMessage
);

router.get('/', messageController.getMessages);
router.get('/stats', messageController.getStats);
router.get('/contacts', messageController.getContacts);
router.get('/chats', messageController.getChats);
router.get('/:messageId', messageController.getMessageStatus);

module.exports = router;
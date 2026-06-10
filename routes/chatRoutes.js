import express from 'express';
import {
  getConversations,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  pinConversation,
  uploadFile
} from '../controllers/chatController.js';
import { protect } from '../middlewares/authMiddleware.js';
import upload from '../config/multer.js';

const router = express.Router();

router.use(protect);

router.get('/conversations', getConversations);
router.get('/conversations/:conversationId', getMessages);
router.post('/messages', sendMessage);

// Upload endpoint
router.post('/upload', upload.single('file'), uploadFile);

// Message adjustments
router.patch('/messages/:messageId', editMessage);
router.delete('/messages/:messageId', deleteMessage);

// Conversation pin
router.patch('/conversations/:conversationId/pin', pinConversation);

export default router;

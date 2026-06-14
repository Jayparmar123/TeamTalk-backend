import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get all conversations of logged-in user
// @route   GET /api/chats/conversations
// @access  Private
export const getConversations = asyncHandler(async (req, res, next) => {
  const conversations = await Conversation.find({
    participants: { $in: [req.user.id] }
  })
    .populate('participants', 'name email avatarUrl isOnline lastSeen role')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'name' }
    })
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    count: conversations.length,
    conversations
  });
});

// @desc    Get message history of a specific conversation
// @route   GET /api/chats/conversations/:conversationId
// @access  Private
export const getMessages = asyncHandler(async (req, res, next) => {
  const { conversationId } = req.params;

  // Validate conversation exists and current user is in it
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  if (!conversation.participants.includes(req.user.id)) {
    return next(new ErrorResponse('Not authorized to access these messages', 403));
  }

  // Load message logs sorted by time
  const messages = await Message.find({ conversationId })
    .populate('sender', 'name avatarUrl')
    .sort({ createdAt: 1 });

  // Update read receipts
  await Message.updateMany(
    { conversationId, recipient: req.user.id, isRead: false },
    { $set: { isRead: true } }
  );

  res.status(200).json({
    success: true,
    count: messages.length,
    messages
  });
});

// @desc    Send a message (REST API version)
// @route   POST /api/chats/messages
// @access  Private
export const sendMessage = asyncHandler(async (req, res, next) => {
  const { recipientId, conversationId, text, fileUrl, fileName, fileType } = req.body;

  let conversation;

  if (conversationId) {
    conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return next(new ErrorResponse('Conversation not found', 404));
    }
    if (!conversation.participants.includes(req.user.id)) {
      return next(new ErrorResponse('Not authorized to message in this channel', 403));
    }
  } else if (recipientId) {
    // Verify recipient exists and is active
    const recipient = await User.findById(recipientId);
    if (!recipient || !recipient.isActive) {
      return next(new ErrorResponse('Recipient employee is not active or does not exist', 404));
    }

    // Find or create conversation between these two participants
    conversation = await Conversation.findOne({
      participants: { $all: [req.user.id, recipientId] },
      isGroup: false
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user.id, recipientId],
        isGroup: false
      });
    }
  } else {
    return next(new ErrorResponse('Please provide a recipient ID or conversation ID', 400));
  }

  // Create message
  const message = await Message.create({
    conversationId: conversation._id,
    sender: req.user.id,
    recipient: recipientId || null,
    text: text || '',
    fileUrl: fileUrl || '',
    fileName: fileName || '',
    fileType: fileType || ''
  });

  // Update last message pointer in conversation
  conversation.lastMessage = message._id;
  await conversation.save();

  // Populate message sender before response
  const populatedMessage = await Message.findById(message._id)
    .populate('sender', 'name avatarUrl')
    .populate('recipient', 'name avatarUrl');

  res.status(201).json({
    success: true,
    message: populatedMessage,
    conversationId: conversation._id
  });
});

// @desc    Edit own message
// @route   PATCH /api/chats/messages/:messageId
// @access  Private
export const editMessage = asyncHandler(async (req, res, next) => {
  const { messageId } = req.params;
  const { text } = req.body;

  if (!text) {
    return next(new ErrorResponse('Please provide modified text content', 400));
  }

  const message = await Message.findById(messageId);
  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Confirm ownership
  if (message.sender.toString() !== req.user.id) {
    return next(new ErrorResponse('You can only edit your own messages', 403));
  }

  message.text = text;
  message.isEdited = true;
  await message.save();

  const populated = await Message.findById(message._id).populate('sender', 'name avatarUrl');

  res.status(200).json({
    success: true,
    message: populated
  });
});

// @desc    Soft delete own message
// @route   DELETE /api/chats/messages/:messageId
// @access  Private
export const deleteMessage = asyncHandler(async (req, res, next) => {
  const { messageId } = req.params;

  const message = await Message.findById(messageId);
  if (!message) {
    return next(new ErrorResponse('Message not found', 404));
  }

  // Confirm ownership
  if (message.sender.toString() !== req.user.id) {
    return next(new ErrorResponse('You can only delete your own messages', 403));
  }

  message.text = 'This message was deleted';
  message.isDeleted = true;
  message.fileUrl = ''; // Clear file references if any
  message.fileName = '';
  message.fileType = '';
  await message.save();

  res.status(200).json({
    success: true,
    messageId,
    conversationId: message.conversationId,
    message
  });
});

// @desc    Toggle pin conversation thread
// @route   PATCH /api/chats/conversations/:conversationId/pin
// @access  Private
export const pinConversation = asyncHandler(async (req, res, next) => {
  const { conversationId } = req.params;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return next(new ErrorResponse('Conversation not found', 404));
  }

  const user = await User.findById(req.user.id);
  const isPinned = user.pinnedConversations.includes(conversationId);

  if (isPinned) {
    // Unpin
    user.pinnedConversations = user.pinnedConversations.filter(id => id.toString() !== conversationId);
  } else {
    // Pin
    user.pinnedConversations.push(conversationId);
  }

  await user.save();

  res.status(200).json({
    success: true,
    pinnedConversations: user.pinnedConversations,
    isPinned: !isPinned
  });
});

// @desc    Upload file attachment
// @route   POST /api/chats/upload
// @access  Private
export const uploadFile = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse('Please upload a file attachment', 400));
  }

  // Generate dynamic full URL to serve client downloads
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  res.status(200).json({
    success: true,
    file: {
      url: fileUrl,
      name: req.file.originalname,
      type: req.file.mimetype
    }
  });
});


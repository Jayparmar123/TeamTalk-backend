import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

let io = null;

// Map to track user connections: userId -> Set of socketIds
const userSockets = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Socket middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user || !user.isActive) {
        return next(new Error('Authentication error: Account invalid'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid signature'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`User connected: ${socket.user.name} (${userId}) | Socket: ${socket.id}`);

    // Add socket to user's set of active connections
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join their personal room so we can send direct messages
    socket.join(userId);

    // If this is the user's first connection (online toggle)
    if (userSockets.get(userId).size === 1) {
      updateUserStatus(userId, true);
    }

    // Handle incoming chat messages
    socket.on('message:send', (data) => {
      const { recipientId, participants, message } = data;
      if (recipientId) {
        socket.to(recipientId).emit('message:receive', message);
      } else if (participants && Array.isArray(participants)) {
        participants.forEach(pId => {
          if (pId !== userId) {
            socket.to(pId).emit('message:receive', message);
          }
        });
      }
    });

    // Handle message editing edits
    socket.on('message:edit', (data) => {
      const { recipientId, participants, message, conversationId } = data;
      if (recipientId) {
        socket.to(recipientId).emit('message:edit', { message, conversationId });
      } else if (participants && Array.isArray(participants)) {
        participants.forEach(pId => {
          if (pId !== userId) {
            socket.to(pId).emit('message:edit', { message, conversationId });
          }
        });
      }
    });

    // Handle message soft deletions
    socket.on('message:delete', (data) => {
      const { recipientId, participants, messageId, message, conversationId } = data;
      if (recipientId) {
        socket.to(recipientId).emit('message:delete', { messageId, message, conversationId });
      } else if (participants && Array.isArray(participants)) {
        participants.forEach(pId => {
          if (pId !== userId) {
            socket.to(pId).emit('message:delete', { messageId, message, conversationId });
          }
        });
      }
    });

    // Handle typing indicators
    socket.on('typing:start', (data) => {
      const { recipientId, participants, conversationId } = data;
      if (recipientId) {
        socket.to(recipientId).emit('typing:status', {
          senderId: userId,
          conversationId,
          isTyping: true
        });
      } else if (participants && Array.isArray(participants)) {
        participants.forEach(pId => {
          if (pId !== userId) {
            socket.to(pId).emit('typing:status', {
              senderId: userId,
              conversationId,
              isTyping: true
            });
          }
        });
      }
    });

    socket.on('typing:stop', (data) => {
      const { recipientId, participants, conversationId } = data;
      if (recipientId) {
        socket.to(recipientId).emit('typing:status', {
          senderId: userId,
          conversationId,
          isTyping: false
        });
      } else if (participants && Array.isArray(participants)) {
        participants.forEach(pId => {
          if (pId !== userId) {
            socket.to(pId).emit('typing:status', {
              senderId: userId,
              conversationId,
              isTyping: false
            });
          }
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          updateUserStatus(userId, false);
        }
      }
    });
  });

  return io;
};

// Helper to update database status and broadcast to everyone
const updateUserStatus = async (userId, isOnline) => {
  try {
    await User.findByIdAndUpdate(userId, {
      isOnline,
      lastSeen: Date.now()
    });

    // Broadcast status update
    if (io) {
      io.emit(isOnline ? 'user:online' : 'user:offline', { userId });
      console.log(`Broadcasted user ${isOnline ? 'online' : 'offline'} for ${userId}`);
    }
  } catch (err) {
    console.error(`Error updating user status: ${err.message}`);
  }
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};

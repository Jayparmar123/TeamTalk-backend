import User from '../models/User.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import AuditLog from '../models/AuditLog.js';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getIO } from '../config/socket.js';
import { logAudit } from '../utils/logger.js';
import { addUserToGeneralChannel, ensureGeneralChannel } from '../utils/generalChannel.js';

// @desc    Get all registered users (admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = asyncHandler(async (req, res, next) => {
  const users = await User.find({}).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: users.length,
    users
  });
});

// @desc    Create a new employee user (admin only)
// @route   POST /api/admin/users
// @access  Private/Admin
export const createUser = asyncHandler(async (req, res, next) => {
  const { name, email, password, role, avatarUrl } = req.body;

  // Validate fields
  if (!name || !email || !password) {
    return next(new ErrorResponse('Please provide a name, email and password', 400));
  }

  // Check if user already exists
  const userExists = await User.findOne({ email });

  if (userExists) {
    return next(new ErrorResponse('User already registered with this email', 400));
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role || 'employee',
    avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
  });

  // Auto-add new user to the General channel
  let generalChannel = null;
  try {
    generalChannel = await addUserToGeneralChannel(user._id);
  } catch (err) {
    console.error('Failed to add user to General channel:', err.message);
  }

  // Emit real-time member join event (directory list update)
  try {
    const io = getIO();
    io.emit('member:join', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });

    // Notify all connected clients that the General channel participants updated
    if (generalChannel) {
      io.emit('channel:member:added', {
        conversationId: generalChannel._id.toString(),
        userId: user._id.toString(),
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          isOnline: false
        }
      });
    }
  } catch (err) {
    console.error('Socket notification failed on createUser:', err.message);
  }

  // Write audit log
  await logAudit(req.user.id, 'MEMBER_ADD', user.email, `Created user ${user.name} with role ${user.role}`, req);

  res.status(201).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive
    }
  });
});

// @desc    Update employee status or role (admin only)
// @route   PATCH /api/admin/users/:id
// @access  Private/Admin
export const updateUser = asyncHandler(async (req, res, next) => {
  const { name, email, role, isActive } = req.body;

  let user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse(`User not found with id ${req.params.id}`, 404));
  }

  // Make sure admin doesn't deactivate themselves
  if (req.user.id === req.params.id && isActive === false) {
    return next(new ErrorResponse('You cannot deactivate your own admin account', 400));
  }

  // Update properties if provided
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  // If user was deactivated, disconnect their socket sessions and notify peers
  try {
    const io = getIO();
    if (isActive === false) {
      io.to(req.params.id).emit('auth:logout', { reason: 'deactivated' });
      // Disconnect all sockets belonging to this room (user's personal room)
      const room = io.sockets.adapter.rooms.get(req.params.id);
      if (room) {
        for (const socketId of room) {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect(true);
          }
        }
      }
      io.emit('member:leave', { userId: req.params.id });
    } else {
      // If details changed, emit update
      io.emit('member:update', {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      });
    }
  } catch (err) {
    console.error('Socket notification failed on updateUser:', err.message);
  }

  // Write audit log
  let auditAction = 'MEMBER_UPDATE';
  let auditDetails = `Updated details for ${user.name}`;
  if (isActive !== undefined) {
    auditAction = isActive ? 'MEMBER_REACTIVATE' : 'MEMBER_DEACTIVATE';
    auditDetails = isActive ? `Reactivated user account for ${user.name}` : `Deactivated user account for ${user.name}`;
  } else if (role !== undefined) {
    auditAction = 'ROLE_CHANGE';
    auditDetails = `Changed role of ${user.name} to ${role}`;
  }
  await logAudit(req.user.id, auditAction, user.email, auditDetails, req);

  res.status(200).json({
    success: true,
    user
  });
});

// @desc    Remove/Delete user (admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse(`User not found with id ${req.params.id}`, 404));
  }

  // Prevent admin self-deletion
  if (req.user.id === req.params.id) {
    return next(new ErrorResponse('You cannot delete your own admin account', 400));
  }

  // Option: We can soft-delete by deactivating or hard-delete. Let's do a hard-delete.
  await User.findByIdAndDelete(req.params.id);

  // Force disconnect deleted user sockets and broadcast member:leave
  try {
    const io = getIO();
    io.to(req.params.id).emit('auth:logout', { reason: 'deleted' });
    const room = io.sockets.adapter.rooms.get(req.params.id);
    if (room) {
      for (const socketId of room) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
    }
    io.emit('member:leave', { userId: req.params.id });
  } catch (err) {
    console.error('Socket notification failed on deleteUser:', err.message);
  }

  // Write audit log
  await logAudit(req.user.id, 'MEMBER_REMOVE', user.email, `Permanently deleted member account: ${user.name}`, req);

  res.status(200).json({
    success: true,
    data: {},
    message: 'User has been removed from the directory successfully'
  });
});

// @desc    Get dashboard analytics (admin only)
// @route   GET /api/admin/analytics
// @access  Private/Admin
export const getAnalytics = asyncHandler(async (req, res, next) => {
  const totalEmployees = await User.countDocuments({});
  const onlineCount = await User.countDocuments({ isOnline: true });
  const totalMessages = await Message.countDocuments({});
  const activeChats = await Conversation.countDocuments({});

  // Get active user lists or recent users
  const recentUsers = await User.find({}).sort({ createdAt: -1 }).limit(5);

  res.status(200).json({
    success: true,
    analytics: {
      totalEmployees,
      onlineCount,
      totalMessages,
      activeChats,
      recentUsers
    }
  });
});

// @desc    Get system audit logs (admin only)
// @route   GET /api/admin/audit-logs
// @access  Private/Admin
export const getAuditLogs = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 15;
  const skip = (page - 1) * limit;

  const logs = await AuditLog.find({})
    .populate('actor', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await AuditLog.countDocuments({});

  res.status(200).json({
    success: true,
    count: logs.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    logs
  });
});

// @desc    Get (or create) the General channel with all users
// @route   GET /api/admin/general-channel
// @access  Private/Admin
export const getGeneralChannel = asyncHandler(async (req, res, next) => {
  const general = await ensureGeneralChannel();
  const populated = await Conversation.findById(general._id)
    .populate('participants', 'name email avatarUrl isOnline lastSeen role');

  res.status(200).json({
    success: true,
    channel: populated
  });
});

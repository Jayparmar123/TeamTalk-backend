import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// Helper to generate access and refresh tokens
const generateTokens = (userId, tokenVersion = 0) => {
  const accessToken = jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });

  const refreshToken = jwt.sign({ id: userId, tokenVersion }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });

  return { accessToken, refreshToken };
};

// Set refresh token in cookie
const sendRefreshTokenCookie = (res, token) => {
  const days = parseInt(process.env.COOKIE_EXPIRE || '7', 10);
  const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  res.cookie('refreshToken', token, {
    httpOnly: true,
    expires: expiryDate,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if active
  if (!user.isActive) {
    return next(new ErrorResponse('This account has been deactivated. Please contact an admin.', 403));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id, user.tokenVersion);

  // Send refresh token cookie
  sendRefreshTokenCookie(res, refreshToken);

  res.status(200).json({
    success: true,
    token: accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      pinnedConversations: user.pinnedConversations
    }
  });
});

// @desc    Log user out / clear cookie
// @route   POST /api/auth/logout
// @access  Private
export const logout = asyncHandler(async (req, res, next) => {
  // Update online status in database
  if (req.user) {
    await User.findByIdAndUpdate(req.user.id, {
      isOnline: false,
      lastSeen: Date.now()
    });
  }

  // Clear cookie
  res.cookie('refreshToken', 'none', {
    httpOnly: true,
    expires: new Date(Date.now() + 10 * 1000),
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      pinnedConversations: user.pinnedConversations
    }
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
export const refresh = asyncHandler(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return next(new ErrorResponse('Refresh token not found', 401));
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Get user
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 401));
    }

    if (!user.isActive) {
      return next(new ErrorResponse('User account has been deactivated', 403));
    }

    // Generate new tokens
    const tokens = generateTokens(user._id, user.tokenVersion);

    // Send new refresh token cookie
    sendRefreshTokenCookie(res, tokens.refreshToken);

    res.status(200).json({
      success: true,
      token: tokens.accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        pinnedConversations: user.pinnedConversations
      }
    });
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
});

// @desc    Logout user from all devices (invalidates tokens by incrementing version)
// @route   POST /api/auth/logout-all
// @access  Private
export const logoutAllDevices = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Increment session salt version
  user.tokenVersion += 1;
  user.isOnline = false;
  user.lastSeen = Date.now();
  await user.save();

  // Clear cookie
  res.cookie('refreshToken', 'none', {
    httpOnly: true,
    expires: new Date(Date.now() + 10 * 1000),
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.status(200).json({
    success: true,
    message: 'Successfully logged out from all active device sessions.'
  });
});

import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get/search active office members (excluding logged in user)
// @route   GET /api/users
// @access  Private
export const getActiveUsers = asyncHandler(async (req, res, next) => {
  const searchQuery = req.query.search
    ? {
        $and: [
          { isActive: true },
          { _id: { $ne: req.user.id } },
          {
            $or: [
              { name: { $regex: req.query.search, $options: 'i' } },
              { email: { $regex: req.query.search, $options: 'i' } }
            ]
          }
        ]
      }
    : { isActive: true, _id: { $ne: req.user.id } };

  const users = await User.find(searchQuery).select('-password').sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: users.length,
    users
  });
});

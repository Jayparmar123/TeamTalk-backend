import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

/**
 * Finds the "General" channel or creates it with ALL current active users.
 * Called once on server start and after every new user registration.
 * Returns the General channel document.
 */
export const ensureGeneralChannel = async () => {
  // Find existing General channel
  let general = await Conversation.findOne({ isGroup: true, name: 'General' });

  // Get all active user IDs
  const allUsers = await User.find({ isActive: true }).select('_id');
  const allUserIds = allUsers.map(u => u._id.toString());

  if (!general) {
    // Create it fresh with all current members
    general = await Conversation.create({
      name: 'General',
      isGroup: true,
      participants: allUserIds
    });
    console.log(`✅ General channel created with ${allUserIds.length} members`);
  } else {
    // Add any existing users who aren't in participants yet (idempotent)
    const existing = general.participants.map(p => p.toString());
    const toAdd = allUserIds.filter(id => !existing.includes(id));

    if (toAdd.length > 0) {
      general.participants.push(...toAdd);
      await general.save();
      console.log(`✅ General channel updated — added ${toAdd.length} missing member(s)`);
    }
  }

  return general;
};

/**
 * Adds a single user to the General channel (called after new user registration).
 * Returns the updated General channel.
 */
export const addUserToGeneralChannel = async (userId) => {
  const general = await Conversation.findOne({ isGroup: true, name: 'General' });
  if (!general) return null;

  const alreadyIn = general.participants.some(p => p.toString() === userId.toString());
  if (!alreadyIn) {
    general.participants.push(userId);
    await general.save();
  }

  return general;
};

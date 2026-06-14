/**
 * One-time seed script: creates the General channel with ALL current users.
 * Run with: node scripts/seedGeneral.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import models AFTER env is loaded
const { default: User } = await import('../models/User.js');
const { default: Conversation } = await import('../models/Conversation.js');

await mongoose.connect(process.env.MONGODB_URI);
console.log('✅ Connected to MongoDB');

// Find or create the General channel
let general = await Conversation.findOne({ isGroup: true, name: 'General' });

const allUsers = await User.find({ isActive: true }).select('_id name');
const allUserIds = allUsers.map(u => u._id.toString());

if (!general) {
  general = await Conversation.create({
    name: 'General',
    isGroup: true,
    participants: allUserIds,
  });
  console.log(`✅ General channel CREATED with ${allUserIds.length} member(s):`);
} else {
  const existing = general.participants.map(p => p.toString());
  const toAdd = allUserIds.filter(id => !existing.includes(id));

  if (toAdd.length > 0) {
    general.participants.push(...toAdd);
    await general.save();
    console.log(`✅ General channel UPDATED — added ${toAdd.length} missing member(s)`);
  } else {
    console.log('✅ General channel already exists and is up to date');
  }
}

allUsers.forEach(u => console.log(`   • ${u.name} (${u._id})`));
console.log(`\n📢 General channel ID: ${general._id}`);

await mongoose.disconnect();
console.log('✅ Done');

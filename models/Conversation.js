import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: ''
    },
    isGroup: {
      type: Boolean,
      default: false
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Conversation', ConversationSchema);

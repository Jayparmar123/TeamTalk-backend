import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    action: {
      type: String,
      required: true // e.g., 'MEMBER_ADD', 'MEMBER_REMOVE', 'MEMBER_STATUS_TOGGLE', 'ROLE_CHANGE'
    },
    target: {
      type: String,
      default: '' // e.g., 'john.doe@office.com' (email or user name)
    },
    details: {
      type: String,
      default: '' // e.g., 'Deactivated employee account' or 'Registered user as admin'
    },
    ipAddress: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('AuditLog', AuditLogSchema);

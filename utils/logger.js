import AuditLog from '../models/AuditLog.js';

/**
 * Creates an audit log entry in the database.
 * @param {string} actorId - ID of the admin performing the action
 * @param {string} action - Action key (e.g. 'MEMBER_JOIN', 'ROLE_TOGGLE')
 * @param {string} target - Target email or name
 * @param {string} details - Log description details
 * @param {object} req - Express request object (optional, for resolving client IP)
 */
export const logAudit = async (actorId, action, target, details, req = null) => {
  try {
    let ipAddress = '';
    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      // Clean up IP if it's dual-stack IPv4 mapped IPv6
      if (ipAddress.includes('::ffff:')) {
        ipAddress = ipAddress.split('::ffff:')[1];
      }
    }

    await AuditLog.create({
      actor: actorId,
      action,
      target: target || '',
      details: details || '',
      ipAddress
    });
  } catch (err) {
    console.error(`Audit logging failed: ${err.message}`);
  }
};

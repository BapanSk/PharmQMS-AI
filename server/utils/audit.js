const db = require('../config/db');

async function writeAuditLog({ userId, action, entityType, entityId, details, ipAddress }) {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId || null,
      action,
      entityType,
      entityId || null,
      details ? JSON.stringify(details) : null,
      ipAddress || null
    ]
  );
}

module.exports = {
  writeAuditLog
};

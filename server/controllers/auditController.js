const db = require('../config/db');
const { parsePagination, sanitizeString } = require('../utils/validate');

async function listAuditLogs(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const filters = [];
    const params = [];

    const search = sanitizeString(req.query.search, 120);
    if (search) {
      filters.push('(a.action LIKE ? OR a.entity_type LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (req.query.action) {
      filters.push('a.action = ?');
      params.push(req.query.action);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await db.query(
      `SELECT COUNT(*) AS total
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}`,
      params
    );

    const data = await db.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at,
              u.name AS user_name, u.email AS user_email, u.role AS user_role
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      data: data.map((row) => ({
        ...row,
        details: typeof row.details === 'string' ? safeJson(row.details) : row.details
      })),
      pagination: {
        page,
        limit,
        total: countRows[0].total,
        pages: Math.ceil(countRows[0].total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

module.exports = {
  listAuditLogs
};

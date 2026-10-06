const db = require('../config/db');
const { ROLES, STATUSES } = require('../utils/constants');

function analystFilter(user, alias) {
  if (user.role === ROLES.QA_ANALYST) {
    return { sql: ` ${alias}assigned_to = ?`, params: [user.id] };
  }
  return { sql: '', params: [] };
}

function dateFilter(range) {
  switch (range) {
    case '7d':
      return 'created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    case '30d':
      return 'created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    case '90d':
      return 'created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)';
    case 'year':
      return 'YEAR(created_at) = YEAR(CURDATE())';
    default:
      return 'created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)';
  }
}

async function getStats(req, res, next) {
  try {
    const range = req.query.range || 'year';
    const dateSql = dateFilter(range);
    const scope = analystFilter(req.user, '');
    const whereParts = [dateSql];
    const params = [];
    if (scope.sql) {
      whereParts.push(scope.sql.trim());
      params.push(...scope.params);
    }
    const where = `WHERE ${whereParts.join(' AND ')}`;

    const [totals] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'New') AS new_count,
         SUM(status = 'AI Analyzed') AS ai_analyzed_count,
         SUM(status = 'Under Investigation') AS investigation_count,
         SUM(status = 'Resolved') AS resolved_count,
         SUM(status = 'Closed') AS closed_count,
         SUM(severity = 'Critical') AS critical_count,
         SUM(priority = 'High') AS high_priority_count
       FROM complaints ${where}`,
      params
    );

    const byStatus = await db.query(
      `SELECT status, COUNT(*) AS count FROM complaints ${where} GROUP BY status`,
      params
    );
    const byCategory = await db.query(
      `SELECT category, COUNT(*) AS count FROM complaints ${where} GROUP BY category ORDER BY count DESC`,
      params
    );
    const bySeverity = await db.query(
      `SELECT severity, COUNT(*) AS count FROM complaints ${where} GROUP BY severity`,
      params
    );
    const byPriority = await db.query(
      `SELECT priority, COUNT(*) AS count FROM complaints ${where} GROUP BY priority`,
      params
    );
    const byMonth = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM complaints ${where}
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC`,
      params
    );

    const recentWhere = scope.sql ? `WHERE c.assigned_to = ?` : '';
    const recent = await db.query(
      `SELECT c.id, c.complaint_id, p.product_name, c.category, c.severity, c.priority, c.status, c.created_at, u.name AS assigned_to_name
       FROM complaints c
       INNER JOIN products p ON p.id = c.product_id
       LEFT JOIN users u ON u.id = c.assigned_to
       ${recentWhere}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT 8`,
      scope.params
    );

    const statusMap = Object.fromEntries(STATUSES.map((status) => [status, 0]));
    byStatus.forEach((row) => { statusMap[row.status] = Number(row.count); });

    res.json({
      range,
      stats: {
        total: Number(totals.total) || 0,
        new_complaints: Number(totals.new_count) || 0,
        ai_analyzed: Number(totals.ai_analyzed_count) || 0,
        under_investigation: Number(totals.investigation_count) || 0,
        resolved: Number(totals.resolved_count) || 0,
        closed: Number(totals.closed_count) || 0,
        critical: Number(totals.critical_count) || 0,
        high_priority: Number(totals.high_priority_count) || 0
      },
      charts: {
        by_month: byMonth.map((row) => ({ month: row.month, count: Number(row.count) })),
        by_category: byCategory.map((row) => ({ category: row.category, count: Number(row.count) })),
        by_severity: bySeverity.map((row) => ({ severity: row.severity, count: Number(row.count) })),
        by_priority: byPriority.map((row) => ({ priority: row.priority, count: Number(row.count) })),
        by_status: STATUSES.map((status) => ({ status, count: statusMap[status] || 0 }))
      },
      recent
    });
  } catch (error) {
    next(error);
  }
}

async function listAssignees(req, res, next) {
  try {
    const users = await db.query(
      `SELECT id, name, role
       FROM users
       WHERE is_active = 1 AND role IN ('ADMIN', 'QA_MANAGER', 'QA_ANALYST')
       ORDER BY name ASC`
    );
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStats,
  listAssignees
};

const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { writeAuditLog } = require('../utils/audit');
const {
  validateComplaintPayload,
  parsePositiveInt,
  parsePagination,
  sanitizeString
} = require('../utils/validate');
const { CATEGORIES, SEVERITIES, PRIORITIES, STATUSES, ROLES } = require('../utils/constants');
const { assertStatusTransition, assertComplaintEditable } = require('../utils/workflow');
const analysisService = require('../services/analysisService');
const investigationService = require('../services/investigationService');

const COMPLAINT_SELECT = `
  SELECT
    c.id,
    c.complaint_id,
    c.customer_name,
    c.customer_email,
    c.customer_phone,
    c.product_id,
    p.product_name,
    p.product_code,
    c.batch_number,
    c.manufacturing_date,
    c.expiry_date,
    c.category,
    c.description,
    c.purchase_location,
    c.country,
    c.severity,
    c.priority,
    c.status,
    c.assigned_to,
    u.name AS assigned_to_name,
    c.created_at,
    c.updated_at
  FROM complaints c
  INNER JOIN products p ON p.id = c.product_id
  LEFT JOIN users u ON u.id = c.assigned_to
`;

async function generateComplaintId(connection) {
  const year = new Date().getFullYear();
  const prefix = `PHQ-${year}-`;

  const [rows] = await connection.execute(
    `SELECT complaint_id
     FROM complaints
     WHERE complaint_id LIKE ?
     ORDER BY complaint_id DESC
     LIMIT 1
     FOR UPDATE`,
    [`${prefix}%`]
  );

  let nextNumber = 1;
  if (rows.length) {
    const current = Number(rows[0].complaint_id.slice(-6));
    if (Number.isInteger(current)) {
      nextNumber = current + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(6, '0')}`;
}

async function getComplaintById(id) {
  const rows = await db.query(`${COMPLAINT_SELECT} WHERE c.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

function assertAnalystCanModify(user, complaint) {
  if (!user || user.role !== ROLES.QA_ANALYST) {
    return;
  }

  if (complaint.assigned_to !== user.id) {
    throw new AppError(403, 'QA analysts can only update complaints assigned to them');
  }
}

function assertAnalystCanView(user, complaint) {
  if (user.role === ROLES.QA_ANALYST && complaint.assigned_to !== user.id) {
    throw new AppError(403, 'QA analysts can only view complaints assigned to them');
  }
}

async function listCommentsFor(id) {
  return db.query(
    `SELECT cm.id, cm.comment, cm.created_at, cm.user_id, u.name AS user_name, u.role AS user_role
     FROM complaint_comments cm
     INNER JOIN users u ON u.id = cm.user_id
     WHERE cm.complaint_pk = ?
     ORDER BY cm.created_at ASC, cm.id ASC`,
    [id]
  );
}

async function listAttachmentsFor(id) {
  return db.query(
    `SELECT a.id, a.file_name, a.mime_type, a.file_size, a.created_at, u.name AS uploaded_by_name
     FROM complaint_attachments a
     LEFT JOIN users u ON u.id = a.uploaded_by
     WHERE a.complaint_pk = ?
     ORDER BY a.created_at DESC, a.id DESC`,
    [id]
  );
}

async function listHistoryFor(id) {
  return db.query(
    `SELECT h.id, h.from_status, h.to_status, h.notes, h.created_at,
            h.changed_by, u.name AS changed_by_name, u.role AS changed_by_role
     FROM complaint_status_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.complaint_pk = ?
     ORDER BY h.created_at ASC, h.id ASC`,
    [id]
  );
}

async function recordStatusChange(complaintPk, fromStatus, toStatus, userId, notes) {
  if (!toStatus || fromStatus === toStatus) {
    return;
  }
  await db.query(
    `INSERT INTO complaint_status_history (complaint_pk, from_status, to_status, changed_by, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [complaintPk, fromStatus || null, toStatus, userId || null, notes || null]
  );
}

async function runAndStoreAnalysis(complaint, user, ipAddress) {
  const analysis = await analysisService.analyzeComplaint(complaint);
  const saved = await analysisService.saveAnalysis(complaint.id, analysis);

  if (complaint.status === 'New') {
    await db.query(`UPDATE complaints SET status = 'AI Analyzed' WHERE id = ?`, [complaint.id]);
    await recordStatusChange(complaint.id, 'New', 'AI Analyzed', user ? user.id : null, 'Automatic analysis completed');
  }

  await writeAuditLog({
    userId: user ? user.id : null,
    action: 'AI_ANALYSIS',
    entityType: 'complaint',
    entityId: complaint.id,
    details: { source: saved.source, confidence_score: saved.confidence_score },
    ipAddress
  });

  return saved;
}

async function createComplaint(req, res, next) {
  const connection = await db.getConnection();

  try {
    const payload = validateComplaintPayload(req.body, {
      publicIntake: !req.body.severity || !req.body.priority
    });
    if (!payload.severity) {
      payload.severity = 'Minor';
    }
    if (!payload.priority) {
      payload.priority = 'Medium';
    }

    const [products] = await connection.execute(
      'SELECT id FROM products WHERE id = ? AND is_active = 1 LIMIT 1',
      [payload.product_id]
    );
    if (!products.length) {
      throw new AppError(400, 'Active product not found');
    }

    if (payload.assigned_to) {
      const [assignees] = await connection.execute(
        'SELECT id FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
        [payload.assigned_to]
      );
      if (!assignees.length) {
        throw new AppError(400, 'Assigned user not found or inactive');
      }
    }

    await connection.beginTransaction();

    const complaintId = await generateComplaintId(connection);
    const initialStatus = 'New';

    const [result] = await connection.execute(
      `INSERT INTO complaints (
         complaint_id, customer_name, customer_email, customer_phone,
         product_id, batch_number, manufacturing_date, expiry_date,
         category, description, purchase_location, country,
         severity, priority, status, assigned_to
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        complaintId,
        payload.customer_name,
        payload.customer_email,
        payload.customer_phone || null,
        payload.product_id,
        payload.batch_number,
        payload.manufacturing_date || null,
        payload.expiry_date || null,
        payload.category,
        payload.description,
        payload.purchase_location || null,
        payload.country || null,
        payload.severity,
        payload.priority,
        initialStatus,
        payload.assigned_to || null
      ]
    );

    await connection.execute(
      `INSERT INTO complaint_status_history (complaint_pk, from_status, to_status, changed_by, notes)
       VALUES (?, NULL, ?, ?, ?)`,
      [result.insertId, initialStatus, req.user ? req.user.id : null, req.user ? 'Complaint created' : 'Customer intake']
    );

    await connection.commit();

    let complaint = await getComplaintById(result.insertId);
    let analysis = null;

    try {
      analysis = await runAndStoreAnalysis(complaint, req.user, req.ip);
      complaint = await getComplaintById(result.insertId);
    } catch (analysisError) {
      process.stderr.write(`Analysis failed for ${complaintId}: ${analysisError.message}\n`);
    }

    await writeAuditLog({
      userId: req.user ? req.user.id : null,
      action: 'COMPLAINT_CREATE',
      entityType: 'complaint',
      entityId: result.insertId,
      details: { complaint_id: complaintId, source: req.user ? 'staff' : 'public' },
      ipAddress: req.ip
    });

    res.status(201).json({ complaint, analysis });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // connection may not have an open transaction
    }
    next(error);
  } finally {
    connection.release();
  }
}

async function listComplaints(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const filters = [];
    const params = [];

    const search = sanitizeString(req.query.search, 200);
    if (search) {
      const like = `%${search}%`;
      filters.push(`(
        c.complaint_id LIKE ? OR
        c.customer_name LIKE ? OR
        c.customer_email LIKE ? OR
        c.batch_number LIKE ? OR
        c.description LIKE ? OR
        p.product_name LIKE ? OR
        p.product_code LIKE ?
      )`);
      params.push(like, like, like, like, like, like, like);
    }

    if (req.query.status) {
      if (!STATUSES.includes(req.query.status)) {
        throw new AppError(400, `status must be one of: ${STATUSES.join(', ')}`);
      }
      filters.push('c.status = ?');
      params.push(req.query.status);
    }

    if (req.query.severity) {
      if (!SEVERITIES.includes(req.query.severity)) {
        throw new AppError(400, `severity must be one of: ${SEVERITIES.join(', ')}`);
      }
      filters.push('c.severity = ?');
      params.push(req.query.severity);
    }

    if (req.query.priority) {
      if (!PRIORITIES.includes(req.query.priority)) {
        throw new AppError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
      }
      filters.push('c.priority = ?');
      params.push(req.query.priority);
    }

    if (req.query.category) {
      if (!CATEGORIES.includes(req.query.category)) {
        throw new AppError(400, `category must be one of: ${CATEGORIES.join(', ')}`);
      }
      filters.push('c.category = ?');
      params.push(req.query.category);
    }

    if (req.query.product) {
      const product = sanitizeString(req.query.product, 80);
      if (/^\d+$/.test(product)) {
        filters.push('c.product_id = ?');
        params.push(Number(product));
      } else {
        filters.push('(p.product_code = ? OR p.product_name LIKE ?)');
        params.push(product, `%${product}%`);
      }
    }

    if (req.query.date_from) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date_from))) {
        throw new AppError(400, 'date_from must be YYYY-MM-DD');
      }
      filters.push('DATE(c.created_at) >= ?');
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date_to))) {
        throw new AppError(400, 'date_to must be YYYY-MM-DD');
      }
      filters.push('DATE(c.created_at) <= ?');
      params.push(req.query.date_to);
    }

    const sortMap = {
      created_at: 'c.created_at',
      complaint_id: 'c.complaint_id',
      status: 'c.status',
      severity: 'c.severity',
      priority: 'c.priority',
      category: 'c.category',
      product: 'p.product_name'
    };
    const sortColumn = sortMap[req.query.sort] || 'c.created_at';
    const sortDir = String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    if (req.user.role === ROLES.QA_ANALYST) {
      filters.push('c.assigned_to = ?');
      params.push(req.user.id);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countRows = await db.query(
      `SELECT COUNT(*) AS total
       FROM complaints c
       INNER JOIN products p ON p.id = c.product_id
       ${whereClause}`,
      params
    );

    const data = await db.query(
      `${COMPLAINT_SELECT}
       ${whereClause}
       ORDER BY ${sortColumn} ${sortDir}, c.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      data,
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

async function getComplaint(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const complaint = await getComplaintById(id);

    if (!complaint) {
      throw new AppError(404, 'Complaint not found');
    }

    if (req.user.role === ROLES.QA_ANALYST && complaint.assigned_to !== req.user.id) {
      throw new AppError(403, 'QA analysts can only view complaints assigned to them');
    }

    const history = await listHistoryFor(id);

    const comments = await listCommentsFor(id);
    const analysis = await analysisService.getLatestAnalysis(id);
    const investigation = await investigationService.getByComplaint(id);
    const attachments = await listAttachmentsFor(id);

    res.json({ complaint, history, comments, analysis, investigation, attachments });
  } catch (error) {
    next(error);
  }
}

async function updateComplaint(req, res, next) {
  const connection = await db.getConnection();

  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const payload = validateComplaintPayload(req.body, { partial: true });

    if (!Object.keys(payload).length) {
      throw new AppError(400, 'No valid fields provided for update');
    }

    const existingRows = await db.query(
      'SELECT * FROM complaints WHERE id = ? LIMIT 1',
      [id]
    );
    if (!existingRows.length) {
      throw new AppError(404, 'Complaint not found');
    }

    const existing = existingRows[0];
    assertAnalystCanModify(req.user, existing);
    assertComplaintEditable(existing, payload, req.user);
    if (payload.status) {
      assertStatusTransition(existing.status, payload.status, req.user);
    }

    if (req.user.role === ROLES.QA_ANALYST) {
      const restricted = ['assigned_to', 'customer_name', 'customer_email', 'product_id'];
      const attempted = restricted.filter((field) => payload[field] !== undefined);
      if (attempted.length) {
        throw new AppError(403, 'QA analysts cannot change assignment or customer identity fields');
      }
    }

    if (payload.product_id) {
      const products = await db.query(
        'SELECT id FROM products WHERE id = ? AND is_active = 1 LIMIT 1',
        [payload.product_id]
      );
      if (!products.length) {
        throw new AppError(400, 'Active product not found');
      }
    }

    if (payload.assigned_to) {
      const assignees = await db.query(
        'SELECT id FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
        [payload.assigned_to]
      );
      if (!assignees.length) {
        throw new AppError(400, 'Assigned user not found or inactive');
      }
    }

    const fields = [];
    const values = [];
    const updatable = [
      'customer_name',
      'customer_email',
      'customer_phone',
      'product_id',
      'batch_number',
      'manufacturing_date',
      'expiry_date',
      'category',
      'description',
      'purchase_location',
      'country',
      'severity',
      'priority',
      'status',
      'assigned_to'
    ];

    updatable.forEach((field) => {
      if (payload[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(payload[field]);
      }
    });

    values.push(id);

    await connection.beginTransaction();

    await connection.execute(
      `UPDATE complaints SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (payload.status && payload.status !== existing.status) {
      await connection.execute(
        `INSERT INTO complaint_status_history (complaint_pk, from_status, to_status, changed_by, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [id, existing.status, payload.status, req.user.id, 'Status updated']
      );
    }

    await connection.commit();

    const complaint = await getComplaintById(id);

    await writeAuditLog({
      userId: req.user.id,
      action: payload.status && payload.status !== existing.status ? 'STATUS_CHANGED' : 'COMPLAINT_UPDATE',
      entityType: 'complaint',
      entityId: id,
      details: { fields: Object.keys(payload), from_status: existing.status, to_status: payload.status || existing.status },
      ipAddress: req.ip
    });

    res.json({ complaint });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // connection may not have an open transaction
    }
    next(error);
  } finally {
    connection.release();
  }
}

async function addComment(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const comment = sanitizeString(req.body.comment, 4000);
    if (!comment) {
      throw new AppError(400, 'Comment is required');
    }

    const complaint = await getComplaintById(id);
    if (!complaint) {
      throw new AppError(404, 'Complaint not found');
    }

    if (req.user.role === ROLES.QA_ANALYST && complaint.assigned_to !== req.user.id) {
      throw new AppError(403, 'QA analysts can only comment on complaints assigned to them');
    }

    const result = await db.query(
      `INSERT INTO complaint_comments (complaint_pk, user_id, comment)
       VALUES (?, ?, ?)`,
      [id, req.user.id, comment]
    );

    await writeAuditLog({
      userId: req.user.id,
      action: 'COMPLAINT_COMMENT',
      entityType: 'complaint',
      entityId: id,
      ipAddress: req.ip
    });

    res.status(201).json({
      comment: {
        id: result.insertId,
        comment,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        user_id: req.user.id,
        user_name: req.user.name,
        user_role: req.user.role
      }
    });
  } catch (error) {
    next(error);
  }
}

async function trackComplaint(req, res, next) {
  try {
    const complaintId = sanitizeString(req.params.complaintId, 20);
    if (!complaintId) {
      throw new AppError(400, 'Complaint ID is required');
    }

    const rows = await db.query(
      `SELECT
         c.complaint_id,
         p.product_name,
         p.product_code,
         c.category,
         c.status,
         c.created_at,
         c.updated_at
       FROM complaints c
       INNER JOIN products p ON p.id = c.product_id
       WHERE c.complaint_id = ?
       LIMIT 1`,
      [complaintId]
    );

    if (!rows.length) {
      throw new AppError(404, 'No complaint found with that ID');
    }

    const complaint = rows[0];
    res.json({
      complaint: {
        complaint_id: complaint.complaint_id,
        product: complaint.product_name,
        product_code: complaint.product_code,
        category: complaint.category,
        status: complaint.status,
        submitted_at: complaint.created_at,
        last_updated: complaint.updated_at,
        current_stage: complaint.status
      }
    });
  } catch (error) {
    next(error);
  }
}

async function listComments(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const complaint = await getComplaintById(id);
    if (!complaint) throw new AppError(404, 'Complaint not found');
    assertAnalystCanView(req.user, complaint);
    res.json({ data: await listCommentsFor(id) });
  } catch (error) {
    next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const complaint = await getComplaintById(id);
    if (!complaint) throw new AppError(404, 'Complaint not found');
    assertAnalystCanView(req.user, complaint);
    res.json({ data: await listHistoryFor(id) });
  } catch (error) {
    next(error);
  }
}

async function analyzeComplaint(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const complaint = await getComplaintById(id);
    if (!complaint) throw new AppError(404, 'Complaint not found');
    assertAnalystCanModify(req.user, complaint);
    const analysis = await runAndStoreAnalysis(complaint, req.user, req.ip);
    const updated = await getComplaintById(id);
    res.json({ analysis, complaint: updated });
  } catch (error) {
    next(error);
  }
}

async function reviewAnalysis(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const decision = sanitizeString(req.body.decision, 20);
    if (!['accept', 'edit', 'reject'].includes(decision)) {
      throw new AppError(400, 'decision must be accept, edit, or reject');
    }

    const complaint = await getComplaintById(id);
    if (!complaint) throw new AppError(404, 'Complaint not found');
    assertAnalystCanModify(req.user, complaint);

    const row = await analysisService.getLatestAnalysisRow(id);
    if (!row) throw new AppError(404, 'No analysis found for this complaint');

    const analysis = await analysisService.updateAnalysisDecision(row, {
      decision,
      edits: req.body,
      reviewer: req.user
    });

    if (decision === 'accept' || decision === 'edit') {
      await db.query(
        `UPDATE complaints SET category = ?, severity = ?, priority = ?, status = CASE WHEN status IN ('New', 'AI Analyzed') THEN 'QA Review' ELSE status END WHERE id = ?`,
        [analysis.category, analysis.severity, analysis.priority, id]
      );
      if (complaint.status === 'New' || complaint.status === 'AI Analyzed') {
        await recordStatusChange(id, complaint.status, 'QA Review', req.user.id, 'QA accepted analysis');
      }
    }

    if (decision === 'reject' && (complaint.status === 'New' || complaint.status === 'AI Analyzed')) {
      await db.query(`UPDATE complaints SET status = 'QA Review' WHERE id = ?`, [id]);
      await recordStatusChange(id, complaint.status, 'QA Review', req.user.id, 'QA rejected analysis');
    }

    await writeAuditLog({
      userId: req.user.id,
      action: decision === 'accept' ? 'AI_ACCEPTED' : decision === 'reject' ? 'AI_REJECTED' : 'AI_ANALYSIS',
      entityType: 'complaint',
      entityId: id,
      details: { decision },
      ipAddress: req.ip
    });

    res.json({ analysis, complaint: await getComplaintById(id) });
  } catch (error) {
    next(error);
  }
}

async function getInvestigation(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const complaint = await getComplaintById(id);
    if (!complaint) throw new AppError(404, 'Complaint not found');
    assertAnalystCanView(req.user, complaint);
    res.json({ investigation: await investigationService.getByComplaint(id) });
  } catch (error) {
    next(error);
  }
}

async function createInvestigation(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const complaint = await getComplaintById(id);
    if (!complaint) throw new AppError(404, 'Complaint not found');
    assertAnalystCanModify(req.user, complaint);
    const investigation = await investigationService.create(id, req.user, req.body);
    if (['New', 'AI Analyzed', 'QA Review'].includes(complaint.status)) {
      await db.query(`UPDATE complaints SET status = 'Under Investigation' WHERE id = ?`, [id]);
      await recordStatusChange(id, complaint.status, 'Under Investigation', req.user.id, 'Investigation started');
    }
    await writeAuditLog({
      userId: req.user.id,
      action: 'INVESTIGATION_CREATED',
      entityType: 'complaint',
      entityId: id,
      ipAddress: req.ip
    });
    res.status(201).json({ investigation, complaint: await getComplaintById(id) });
  } catch (error) {
    next(error);
  }
}

async function updateInvestigation(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const complaint = await getComplaintById(id);
    if (!complaint) throw new AppError(404, 'Complaint not found');
    assertAnalystCanModify(req.user, complaint);
    const investigation = await investigationService.update(id, req.body);
    await writeAuditLog({
      userId: req.user.id,
      action: 'INVESTIGATION_UPDATED',
      entityType: 'complaint',
      entityId: id,
      ipAddress: req.ip
    });
    res.json({ investigation });
  } catch (error) {
    next(error);
  }
}

async function uploadAttachment(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const complaint = await getComplaintById(id);
    if (!complaint) throw new AppError(404, 'Complaint not found');
    assertAnalystCanModify(req.user, complaint);
    if (!req.file) throw new AppError(400, 'File is required');

    const result = await db.query(
      `INSERT INTO complaint_attachments (complaint_pk, file_name, file_path, mime_type, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.user.id]
    );

    await writeAuditLog({
      userId: req.user.id,
      action: 'ATTACHMENT_UPLOAD',
      entityType: 'complaint',
      entityId: id,
      details: { file_name: req.file.originalname },
      ipAddress: req.ip
    });

    res.status(201).json({
      attachment: {
        id: result.insertId,
        file_name: req.file.originalname,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        uploaded_by_name: req.user.name
      }
    });
  } catch (error) {
    next(error);
  }
}

async function downloadAttachment(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const attachmentId = parsePositiveInt(req.params.attachmentId, 'attachmentId');
    const complaint = await getComplaintById(id);
    if (!complaint) throw new AppError(404, 'Complaint not found');
    assertAnalystCanView(req.user, complaint);

    const rows = await db.query(
      `SELECT * FROM complaint_attachments WHERE id = ? AND complaint_pk = ? LIMIT 1`,
      [attachmentId, id]
    );
    if (!rows.length) throw new AppError(404, 'Attachment not found');

    const filePath = path.join(__dirname, '..', '..', 'uploads', 'complaints', rows[0].file_path);
    if (!fs.existsSync(filePath)) throw new AppError(404, 'File is no longer available');
    res.download(filePath, rows[0].file_name);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createComplaint,
  listComplaints,
  getComplaint,
  updateComplaint,
  addComment,
  listComments,
  trackComplaint,
  getHistory,
  analyzeComplaint,
  reviewAnalysis,
  getInvestigation,
  createInvestigation,
  updateInvestigation,
  uploadAttachment,
  downloadAttachment
};

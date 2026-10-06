const db = require('../config/db');
const AppError = require('../utils/AppError');
const { sanitizeString, parsePositiveInt } = require('../utils/validate');

function parseCapa(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (error) {
    return { corrective_action: value };
  }
  return { corrective_action: value };
}

function mapInvestigation(row) {
  if (!row) return null;
  const extra = parseCapa(row.capa_actions);
  return {
    id: row.id,
    complaint_pk: row.complaint_pk,
    investigator_id: row.investigator_id,
    investigator_name: row.investigator_name || null,
    summary: extra.summary || null,
    root_cause: row.root_cause,
    findings: row.findings,
    corrective_action: extra.corrective_action || null,
    preventive_action: extra.preventive_action || null,
    capa_reference: extra.capa_reference || null,
    resolution_notes: extra.resolution_notes || null,
    investigation_status: row.investigation_status,
    investigation_date: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function parsePayload(body) {
  return {
    summary: body.summary !== undefined ? sanitizeString(body.summary, 4000) : undefined,
    root_cause: body.root_cause !== undefined ? sanitizeString(body.root_cause, 4000) : undefined,
    findings: body.findings !== undefined ? sanitizeString(body.findings, 4000) : undefined,
    corrective_action: body.corrective_action !== undefined ? sanitizeString(body.corrective_action, 4000) : undefined,
    preventive_action: body.preventive_action !== undefined ? sanitizeString(body.preventive_action, 4000) : undefined,
    capa_reference: body.capa_reference !== undefined ? sanitizeString(body.capa_reference, 80) : undefined,
    resolution_notes: body.resolution_notes !== undefined ? sanitizeString(body.resolution_notes, 4000) : undefined,
    investigator_id: body.investigator_id ? parsePositiveInt(body.investigator_id, 'investigator_id') : undefined,
    investigation_status: body.investigation_status || undefined,
    investigation_date: body.investigation_date !== undefined ? sanitizeString(body.investigation_date, 30) : undefined
  };
}

async function getById(id) {
  const rows = await db.query(
    `SELECT i.*, u.name AS investigator_name
     FROM complaint_investigations i
     LEFT JOIN users u ON u.id = i.investigator_id
     WHERE i.id = ? LIMIT 1`,
    [id]
  );
  return mapInvestigation(rows[0]);
}

async function getByComplaint(complaintPk) {
  const rows = await db.query(
    `SELECT i.*, u.name AS investigator_name
     FROM complaint_investigations i
     LEFT JOIN users u ON u.id = i.investigator_id
     WHERE i.complaint_pk = ?
     ORDER BY i.id DESC
     LIMIT 1`,
    [complaintPk]
  );
  return mapInvestigation(rows[0]);
}

async function create(complaintPk, user, body) {
  const existing = await getByComplaint(complaintPk);
  if (existing) {
    throw new AppError(409, 'An investigation already exists for this complaint');
  }

  const payload = parsePayload(body);
  const investigatorId = payload.investigator_id || user.id;
  const status = ['Open', 'In Progress', 'Completed'].includes(payload.investigation_status)
    ? payload.investigation_status
    : 'Open';

  const result = await db.query(
    `INSERT INTO complaint_investigations (
       complaint_pk, investigator_id, root_cause, findings, capa_actions,
       investigation_status, started_at, completed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      complaintPk,
      investigatorId,
      payload.root_cause || null,
      payload.findings || null,
      JSON.stringify({
        summary: payload.summary || null,
        corrective_action: payload.corrective_action || null,
        preventive_action: payload.preventive_action || null,
        capa_reference: payload.capa_reference || null,
        resolution_notes: payload.resolution_notes || null
      }),
      status,
      payload.investigation_date || new Date().toISOString().slice(0, 19).replace('T', ' '),
      status === 'Completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
    ]
  );

  return getById(result.insertId);
}

async function update(complaintPk, body) {
  const existing = await getByComplaint(complaintPk);
  if (!existing) {
    throw new AppError(404, 'Investigation not found');
  }

  const payload = parsePayload(body);
  const extra = {
    summary: payload.summary !== undefined ? payload.summary : existing.summary,
    corrective_action: payload.corrective_action !== undefined ? payload.corrective_action : existing.corrective_action,
    preventive_action: payload.preventive_action !== undefined ? payload.preventive_action : existing.preventive_action,
    capa_reference: payload.capa_reference !== undefined ? payload.capa_reference : existing.capa_reference,
    resolution_notes: payload.resolution_notes !== undefined ? payload.resolution_notes : existing.resolution_notes
  };
  const status = ['Open', 'In Progress', 'Completed'].includes(payload.investigation_status)
    ? payload.investigation_status
    : existing.investigation_status;

  await db.query(
    `UPDATE complaint_investigations
     SET investigator_id = ?, root_cause = ?, findings = ?, capa_actions = ?, investigation_status = ?,
         started_at = ?, completed_at = ?
     WHERE id = ?`,
    [
      payload.investigator_id || existing.investigator_id,
      payload.root_cause !== undefined ? payload.root_cause : existing.root_cause,
      payload.findings !== undefined ? payload.findings : existing.findings,
      JSON.stringify(extra),
      status,
      payload.investigation_date || existing.investigation_date,
      status === 'Completed'
        ? (existing.completed_at || new Date().toISOString().slice(0, 19).replace('T', ' '))
        : null,
      existing.id
    ]
  );

  return getById(existing.id);
}

module.exports = {
  getByComplaint,
  create,
  update
};

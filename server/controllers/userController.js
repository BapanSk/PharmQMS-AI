const bcrypt = require('bcrypt');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { writeAuditLog } = require('../utils/audit');
const { validateUserPayload, parsePositiveInt } = require('../utils/validate');
const { SAFE_USER_FIELDS } = require('../utils/constants');
const { toPublicUser } = require('../middleware/authMiddleware');

async function listUsers(req, res, next) {
  try {
    const users = await db.query(
      `SELECT ${SAFE_USER_FIELDS} FROM users ORDER BY id ASC`
    );

    res.json({
      data: users.map(toPublicUser)
    });
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const payload = validateUserPayload(req.body);
    const passwordHash = await bcrypt.hash(payload.password, 12);

    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        payload.name,
        payload.email,
        passwordHash,
        payload.role,
        payload.is_active === undefined ? 1 : payload.is_active
      ]
    );

    const users = await db.query(
      `SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    await writeAuditLog({
      userId: req.user.id,
      action: 'USER_CREATE',
      entityType: 'user',
      entityId: result.insertId,
      details: { email: payload.email, role: payload.role },
      ipAddress: req.ip
    });

    res.status(201).json({ user: toPublicUser(users[0]) });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const userId = parsePositiveInt(req.params.id, 'id');
    const payload = validateUserPayload(req.body, { partial: true });

    if (!Object.keys(payload).length) {
      throw new AppError(400, 'No valid fields provided for update');
    }

    const existing = await db.query(
      `SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!existing.length) {
      throw new AppError(404, 'User not found');
    }

    const fields = [];
    const values = [];

    if (payload.name !== undefined) {
      fields.push('name = ?');
      values.push(payload.name);
    }
    if (payload.email !== undefined) {
      fields.push('email = ?');
      values.push(payload.email);
    }
    if (payload.role !== undefined) {
      fields.push('role = ?');
      values.push(payload.role);
    }
    if (payload.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(payload.is_active);
    }
    if (payload.password !== undefined) {
      fields.push('password_hash = ?');
      values.push(await bcrypt.hash(payload.password, 12));
    }

    values.push(userId);

    await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.query(
      `SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    await writeAuditLog({
      userId: req.user.id,
      action: 'USER_UPDATE',
      entityType: 'user',
      entityId: userId,
      details: { fields: Object.keys(payload).filter((key) => key !== 'password') },
      ipAddress: req.ip
    });

    res.json({ user: toPublicUser(updated[0]) });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const userId = parsePositiveInt(req.params.id, 'id');

    if (userId === req.user.id) {
      throw new AppError(400, 'You cannot delete your own account');
    }

    const existing = await db.query(
      `SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!existing.length) {
      throw new AppError(404, 'User not found');
    }

    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);

    await writeAuditLog({
      userId: req.user.id,
      action: 'USER_DEACTIVATE',
      entityType: 'user',
      entityId: userId,
      details: { email: existing[0].email },
      ipAddress: req.ip
    });

    res.json({ message: 'User deactivated', user: toPublicUser({ ...existing[0], is_active: 0 }) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser
};

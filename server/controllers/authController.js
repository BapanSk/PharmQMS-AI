const bcrypt = require('bcrypt');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { writeAuditLog } = require('../utils/audit');
const { validateEmail } = require('../utils/validate');
const { SAFE_USER_FIELDS } = require('../utils/constants');
const {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  toPublicUser
} = require('../middleware/authMiddleware');

async function login(req, res, next) {
  try {
    const email = validateEmail(req.body.email);
    const password = req.body.password;

    if (typeof password !== 'string' || !password) {
      throw new AppError(400, 'Email and password are required');
    }

    const users = await db.query(
      `SELECT ${SAFE_USER_FIELDS}, password_hash FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (!users.length) {
      throw new AppError(401, 'Invalid email or password');
    }

    const user = users[0];

    if (!user.is_active) {
      throw new AppError(401, 'User account is inactive');
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new AppError(401, 'Invalid email or password');
    }

    delete user.password_hash;

    const token = signToken(user);
    setAuthCookie(res, token);

    await writeAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip
    });

    res.json({
      user: toPublicUser(user),
      token
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    clearAuthCookie(res);

    if (req.user) {
      await writeAuditLog({
        userId: req.user.id,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: req.user.id,
        ipAddress: req.ip
      });
    }

    res.json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    res.json({ user: toPublicUser(req.user) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  logout,
  me
};

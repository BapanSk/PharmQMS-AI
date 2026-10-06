const jwt = require('jsonwebtoken');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { SAFE_USER_FIELDS } = require('../utils/constants');

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  if (req.cookies && req.cookies.pharmqms_token) {
    return req.cookies.pharmqms_token;
  }

  return null;
}

function signToken(user) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new AppError(500, 'SESSION_SECRET is not configured');
  }

  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    }
  );
}

function setAuthCookie(res, token) {
  res.cookie('pharmqms_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie('pharmqms_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: Boolean(user.is_active)
  };
}

async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError(401, 'Authentication required');
    }

    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      throw new AppError(500, 'SESSION_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret);
    const users = await db.query(
      `SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [decoded.sub]
    );

    if (!users.length) {
      throw new AppError(401, 'Invalid authentication token');
    }

    const user = users[0];
    if (!user.is_active) {
      throw new AppError(401, 'User account is inactive');
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}

async function optionalAuthenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }

    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      return next();
    }

    const decoded = jwt.verify(token, secret);
    const users = await db.query(
      `SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [decoded.sub]
    );

    if (users.length && users[0].is_active) {
      req.user = users[0];
      req.token = token;
    }

    next();
  } catch (error) {
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  toPublicUser
};

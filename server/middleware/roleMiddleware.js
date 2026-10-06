const AppError = require('../utils/AppError');
const { ROLES } = require('../utils/constants');

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }

    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to perform this action'));
    }

    next();
  };
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required'));
  }

  if (req.user.role !== ROLES.ADMIN) {
    return next(new AppError(403, 'Administrator access required'));
  }

  next();
}

module.exports = {
  authorize,
  requireAdmin
};

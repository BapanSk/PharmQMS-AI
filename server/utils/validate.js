const AppError = require('./AppError');
const { CATEGORIES, SEVERITIES, PRIORITIES, STATUSES, ROLES } = require('./constants');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+()\-\s]{7,50}$/;
const COMPLAINT_ID_REGEX = /^PHQ-\d{4}-\d{6}$/;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function requireFields(payload, fields) {
  const missing = fields.filter((field) => isBlank(payload[field]));
  if (missing.length) {
    throw new AppError(400, `Missing required field(s): ${missing.join(', ')}`);
  }
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, `${fieldName} must be a positive integer`);
  }
  return parsed;
}

function optionalPositiveInt(value, fieldName) {
  if (isBlank(value)) {
    return null;
  }
  return parsePositiveInt(value, fieldName);
}

function sanitizeString(value, maxLength) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  if (maxLength && trimmed.length > maxLength) {
    throw new AppError(400, `Value exceeds maximum length of ${maxLength}`);
  }
  return trimmed;
}

function validateEmail(email) {
  const value = sanitizeString(email, 190);
  if (!value || !EMAIL_REGEX.test(value)) {
    throw new AppError(400, 'A valid email address is required');
  }
  return value.toLowerCase();
}

function validateOptionalPhone(phone) {
  if (isBlank(phone)) {
    return null;
  }
  const value = sanitizeString(phone, 50);
  if (!PHONE_REGEX.test(value)) {
    throw new AppError(400, 'Phone number format is invalid');
  }
  return value;
}

function validateEnum(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new AppError(400, `${fieldName} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function validateOptionalDate(value, fieldName) {
  if (isBlank(value)) {
    return null;
  }
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
    throw new AppError(400, `${fieldName} must be a valid date in YYYY-MM-DD format`);
  }
  return text;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new AppError(400, 'Password must be at least 8 characters');
  }
  return password;
}

function validateRole(role) {
  return validateEnum(role, Object.values(ROLES), 'role');
}

function validateComplaintPayload(payload, { partial = false, publicIntake = false } = {}) {
  const data = {};

  if (!partial) {
    const required = [
      'customer_name',
      'customer_email',
      'product_id',
      'batch_number',
      'category',
      'description'
    ];
    if (!publicIntake) {
      required.push('severity', 'priority');
    }
    requireFields(payload, required);
  }

  if (payload.customer_name !== undefined) {
    data.customer_name = sanitizeString(payload.customer_name, 200);
    if (!data.customer_name) {
      throw new AppError(400, 'customer_name is required');
    }
  }

  if (payload.customer_email !== undefined) {
    data.customer_email = validateEmail(payload.customer_email);
  }

  if (payload.customer_phone !== undefined) {
    data.customer_phone = validateOptionalPhone(payload.customer_phone);
  }

  if (payload.product_id !== undefined) {
    data.product_id = parsePositiveInt(payload.product_id, 'product_id');
  }

  if (payload.batch_number !== undefined) {
    data.batch_number = sanitizeString(payload.batch_number, 80);
    if (!data.batch_number) {
      throw new AppError(400, 'batch_number is required');
    }
  }

  if (payload.manufacturing_date !== undefined) {
    data.manufacturing_date = validateOptionalDate(payload.manufacturing_date, 'manufacturing_date');
  }

  if (payload.expiry_date !== undefined) {
    data.expiry_date = validateOptionalDate(payload.expiry_date, 'expiry_date');
  }

  if (payload.category !== undefined) {
    data.category = validateEnum(payload.category, CATEGORIES, 'category');
  }

  if (payload.description !== undefined) {
    data.description = sanitizeString(payload.description, 10000);
    if (!data.description) {
      throw new AppError(400, 'description is required');
    }
  }

  if (payload.purchase_location !== undefined) {
    data.purchase_location = sanitizeString(payload.purchase_location, 200);
  }

  if (payload.country !== undefined) {
    data.country = sanitizeString(payload.country, 100);
  }

  if (payload.severity !== undefined) {
    data.severity = validateEnum(payload.severity, SEVERITIES, 'severity');
  }

  if (payload.priority !== undefined) {
    data.priority = validateEnum(payload.priority, PRIORITIES, 'priority');
  }

  if (payload.status !== undefined) {
    data.status = validateEnum(payload.status, STATUSES, 'status');
  }

  if (payload.assigned_to !== undefined) {
    data.assigned_to = optionalPositiveInt(payload.assigned_to, 'assigned_to');
  }

  return data;
}

function validateUserPayload(payload, { partial = false } = {}) {
  const data = {};

  if (!partial) {
    requireFields(payload, ['name', 'email', 'password', 'role']);
  }

  if (payload.name !== undefined) {
    data.name = sanitizeString(payload.name, 120);
    if (!data.name) {
      throw new AppError(400, 'name is required');
    }
  }

  if (payload.email !== undefined) {
    data.email = validateEmail(payload.email);
  }

  if (payload.password !== undefined) {
    data.password = validatePassword(payload.password);
  }

  if (payload.role !== undefined) {
    data.role = validateRole(payload.role);
  }

  if (payload.is_active !== undefined) {
    if (typeof payload.is_active !== 'boolean' && payload.is_active !== 0 && payload.is_active !== 1) {
      throw new AppError(400, 'is_active must be a boolean');
    }
    data.is_active = payload.is_active ? 1 : 0;
  }

  return data;
}

function parsePagination(query) {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 20;

  if (!Number.isInteger(page) || page < 1) {
    throw new AppError(400, 'page must be a positive integer');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError(400, 'limit must be an integer between 1 and 100');
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

module.exports = {
  requireFields,
  parsePositiveInt,
  sanitizeString,
  validateEmail,
  validateComplaintPayload,
  validateUserPayload,
  parsePagination,
  COMPLAINT_ID_REGEX,
  isBlank
};

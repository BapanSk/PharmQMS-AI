const AppError = require('./AppError');
const { ROLES } = require('./constants');

const ALLOWED_TRANSITIONS = {
  New: ['AI Analyzed', 'QA Review'],
  'AI Analyzed': ['QA Review', 'Under Investigation'],
  'QA Review': ['Under Investigation', 'AI Analyzed', 'Corrective Action'],
  'Under Investigation': ['Corrective Action', 'QA Review'],
  'Corrective Action': ['Resolved', 'Under Investigation'],
  Resolved: ['Closed', 'Under Investigation'],
  Closed: []
};

function canReopen(user) {
  return user && (user.role === ROLES.ADMIN || user.role === ROLES.QA_MANAGER);
}

function assertStatusTransition(fromStatus, toStatus, user) {
  if (!toStatus || fromStatus === toStatus) {
    return;
  }

  if (fromStatus === 'Closed') {
    if (canReopen(user) && (toStatus === 'QA Review' || toStatus === 'Under Investigation')) {
      return;
    }
    throw new AppError(400, 'Closed complaints can only be reopened by a QA manager or administrator');
  }

  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new AppError(400, `Invalid status change from ${fromStatus} to ${toStatus}`);
  }
}

function assertComplaintEditable(complaint, payload, user) {
  if (complaint.status !== 'Closed') {
    return;
  }

  const keys = Object.keys(payload).filter((key) => payload[key] !== undefined);
  const onlyStatus = keys.length === 1 && keys[0] === 'status';
  if (onlyStatus && canReopen(user)) {
    return;
  }

  throw new AppError(400, 'Closed complaints cannot be edited. Reopen the complaint first.');
}

module.exports = {
  ALLOWED_TRANSITIONS,
  assertStatusTransition,
  assertComplaintEditable,
  canReopen
};

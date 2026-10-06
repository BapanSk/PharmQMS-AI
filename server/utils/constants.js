const ROLES = {
  ADMIN: 'ADMIN',
  QA_MANAGER: 'QA_MANAGER',
  QA_ANALYST: 'QA_ANALYST'
};

const CATEGORIES = [
  'Product Quality',
  'Packaging',
  'Labeling',
  'Adverse Event',
  'Distribution',
  'Manufacturing',
  'Other'
];

const SEVERITIES = ['Critical', 'Major', 'Minor'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const STATUSES = [
  'New',
  'AI Analyzed',
  'QA Review',
  'Under Investigation',
  'Corrective Action',
  'Resolved',
  'Closed'
];

const SAFE_USER_FIELDS = 'id, name, email, role, is_active, created_at, updated_at';

module.exports = {
  ROLES,
  CATEGORIES,
  SEVERITIES,
  PRIORITIES,
  STATUSES,
  SAFE_USER_FIELDS
};

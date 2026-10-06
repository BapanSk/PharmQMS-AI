CREATE DATABASE IF NOT EXISTS pharmqms
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pharmqms;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS complaint_status_history;
DROP TABLE IF EXISTS complaint_attachments;
DROP TABLE IF EXISTS complaint_comments;
DROP TABLE IF EXISTS complaint_investigations;
DROP TABLE IF EXISTS complaint_ai_analysis;
DROP TABLE IF EXISTS complaints;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'QA_MANAGER', 'QA_ANALYST') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_name VARCHAR(200) NOT NULL,
  product_code VARCHAR(50) NOT NULL,
  manufacturer VARCHAR(200) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_products_code (product_code),
  KEY idx_products_name (product_name),
  KEY idx_products_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE complaints (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  complaint_id VARCHAR(20) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_email VARCHAR(190) NOT NULL,
  customer_phone VARCHAR(50) NULL,
  product_id INT UNSIGNED NOT NULL,
  batch_number VARCHAR(80) NOT NULL,
  manufacturing_date DATE NULL,
  expiry_date DATE NULL,
  category ENUM(
    'Product Quality',
    'Packaging',
    'Labeling',
    'Adverse Event',
    'Distribution',
    'Manufacturing',
    'Other'
  ) NOT NULL,
  description TEXT NOT NULL,
  purchase_location VARCHAR(200) NULL,
  country VARCHAR(100) NULL,
  severity ENUM('Critical', 'Major', 'Minor') NOT NULL,
  priority ENUM('High', 'Medium', 'Low') NOT NULL,
  status ENUM(
    'New',
    'AI Analyzed',
    'QA Review',
    'Under Investigation',
    'Corrective Action',
    'Resolved',
    'Closed'
  ) NOT NULL DEFAULT 'New',
  assigned_to INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_complaints_complaint_id (complaint_id),
  KEY idx_complaints_status (status),
  KEY idx_complaints_severity (severity),
  KEY idx_complaints_priority (priority),
  KEY idx_complaints_category (category),
  KEY idx_complaints_product_id (product_id),
  KEY idx_complaints_assigned_to (assigned_to),
  KEY idx_complaints_customer_email (customer_email),
  KEY idx_complaints_batch_number (batch_number),
  KEY idx_complaints_created_at (created_at),
  CONSTRAINT fk_complaints_product
    FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_complaints_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE complaint_ai_analysis (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  complaint_pk INT UNSIGNED NOT NULL,
  summary TEXT NULL,
  suggested_severity ENUM('Critical', 'Major', 'Minor') NULL,
  suggested_priority ENUM('High', 'Medium', 'Low') NULL,
  suggested_category VARCHAR(50) NULL,
  risk_score DECIMAL(5, 2) NULL,
  recommendations TEXT NULL,
  model_name VARCHAR(100) NULL,
  raw_response JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_complaint_pk (complaint_pk),
  CONSTRAINT fk_ai_complaint
    FOREIGN KEY (complaint_pk) REFERENCES complaints (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE complaint_investigations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  complaint_pk INT UNSIGNED NOT NULL,
  investigator_id INT UNSIGNED NOT NULL,
  root_cause TEXT NULL,
  findings TEXT NULL,
  capa_actions TEXT NULL,
  investigation_status ENUM('Open', 'In Progress', 'Completed') NOT NULL DEFAULT 'Open',
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inv_complaint_pk (complaint_pk),
  KEY idx_inv_investigator_id (investigator_id),
  KEY idx_inv_status (investigation_status),
  CONSTRAINT fk_inv_complaint
    FOREIGN KEY (complaint_pk) REFERENCES complaints (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_inv_investigator
    FOREIGN KEY (investigator_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE complaint_comments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  complaint_pk INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comments_complaint_pk (complaint_pk),
  KEY idx_comments_user_id (user_id),
  CONSTRAINT fk_comments_complaint
    FOREIGN KEY (complaint_pk) REFERENCES complaints (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_comments_user
    FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE complaint_attachments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  complaint_pk INT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NULL,
  file_size INT UNSIGNED NULL,
  uploaded_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_att_complaint_pk (complaint_pk),
  KEY idx_att_uploaded_by (uploaded_by),
  CONSTRAINT fk_att_complaint
    FOREIGN KEY (complaint_pk) REFERENCES complaints (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_att_user
    FOREIGN KEY (uploaded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE complaint_status_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  complaint_pk INT UNSIGNED NOT NULL,
  from_status VARCHAR(50) NULL,
  to_status VARCHAR(50) NOT NULL,
  changed_by INT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hist_complaint_pk (complaint_pk),
  KEY idx_hist_changed_by (changed_by),
  KEY idx_hist_created_at (created_at),
  CONSTRAINT fk_hist_complaint
    FOREIGN KEY (complaint_pk) REFERENCES complaints (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_hist_user
    FOREIGN KEY (changed_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id INT UNSIGNED NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_user_id (user_id),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_action (action),
  KEY idx_audit_created_at (created_at),
  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

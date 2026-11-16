-- SVES Connect: MySQL / MariaDB schema (utf8mb4). Applied by `npm run migrate` (idempotent).
-- migrate.js also upgrades older databases (adds new users columns / indexes) and seeds colleges + principal accounts.

CREATE TABLE IF NOT EXISTS colleges (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(12) NOT NULL UNIQUE,
  name       VARCHAR(190) NOT NULL,
  city       VARCHAR(80),
  is_central TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One login table for every type of user. Hierarchy: admin > principal > hod > lab_incharge (lab coordinator).
CREATE TABLE IF NOT EXISTS users (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  college_id           INT UNSIGNED NULL,
  name                 VARCHAR(120) NOT NULL,
  email                VARCHAR(190) NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  role                 ENUM('student','faculty','external','lab_incharge','hod','principal','admin') NOT NULL DEFAULT 'student',
  department           VARCHAR(120) NULL,
  lab_name             VARCHAR(160) NULL,
  created_by           INT UNSIGNED NULL,
  lab_id               INT UNSIGNED NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  status               ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_college_email (college_id, email),
  KEY idx_users_scope (college_id, role, department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Labs: one per lab coordinator, organised as college > department > lab. Labs are never mixed when published.
CREATE TABLE IF NOT EXISTS labs (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  college_id       INT UNSIGNED NOT NULL,
  department       VARCHAR(120) NOT NULL,
  name             VARCHAR(160) NOT NULL,
  description      TEXT,
  building         VARCHAR(120),
  floor            VARCHAR(60),
  room             VARCHAR(60),
  accessibility    VARCHAR(60),
  incharge_user_id INT UNSIGNED NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lab (college_id, department, name),
  KEY idx_lab_dept (college_id, department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Equipment registered by lab coordinators. `data` holds every answer of the registration form (JSON text);
-- name/category/... are copied out for search. Workflow: draft > submitted > verified (HOD) > approved (Principal) | rejected.
CREATE TABLE IF NOT EXISTS equipment (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  college_id     INT UNSIGNED NULL,
  lab_id         INT UNSIGNED NULL,
  department     VARCHAR(120),
  template_key   VARCHAR(40),
  name           VARCHAR(255) NOT NULL,
  category       VARCHAR(120),
  description    TEXT,
  specifications TEXT,
  location       VARCHAR(255),
  data           LONGTEXT,
  status         ENUM('draft','submitted','verified','approved','rejected') NOT NULL DEFAULT 'draft',
  review_note    TEXT,
  created_by     INT UNSIGNED NULL,
  submitted_at   TIMESTAMP NULL,
  verified_by    INT UNSIGNED NULL,
  verified_at    TIMESTAMP NULL,
  approved_by    INT UNSIGNED NULL,
  approved_at    TIMESTAMP NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_equipment_category (category),
  KEY idx_equipment_department (department),
  KEY idx_equipment_lab (lab_id, status),
  FULLTEXT KEY ft_equipment (name, description, specifications)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional uploads (photos, invoices, manuals...). Files live on disk under STORAGE_DIR; only metadata here.
CREATE TABLE IF NOT EXISTS equipment_files (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  equipment_id  INT UNSIGNED NOT NULL,
  kind          VARCHAR(40) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(80) NOT NULL,
  mime          VARCHAR(100),
  size          INT UNSIGNED NOT NULL,
  uploaded_by   INT UNSIGNED NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_files_equipment (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit trail for chatbot use (Module 2 requirement: chat_logs).
CREATE TABLE IF NOT EXISTS chat_logs (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NULL,
  message    TEXT NOT NULL,
  response   TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

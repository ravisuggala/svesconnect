-- SVES Connect: MySQL / MariaDB schema (utf8mb4). Applied by `npm run migrate` (idempotent).
-- migrate.js also upgrades older databases (adds new users columns / indexes) and seeds colleges + principal accounts.

CREATE TABLE IF NOT EXISTS colleges (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(12) NOT NULL UNIQUE,
  name       VARCHAR(190) NOT NULL,
  city       VARCHAR(80),
  address    VARCHAR(300),
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
  role                 ENUM('student','faculty','external','lab_incharge','event_coordinator','event_member','hod','principal','admin') NOT NULL DEFAULT 'student',
  department           VARCHAR(120) NULL,
  lab_name             VARCHAR(160) NULL,
  created_by           INT UNSIGNED NULL,
  lab_id               INT UNSIGNED NULL,
  event_id             INT UNSIGNED NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  status               ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_college_email (college_id, email),
  KEY idx_users_scope (college_id, role, department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Equipment catalogue: one shared list of equipment names (with purpose) per college. Anyone in the college can add a name once; every lab then picks it from the type-ahead.
CREATE TABLE IF NOT EXISTS equipment_catalog (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  college_id  INT UNSIGNED NOT NULL,
  name        VARCHAR(255) NOT NULL,
  name_key    VARCHAR(255) NOT NULL,
  purpose     TEXT,
  type_key    VARCHAR(40) NULL,
  created_by  INT UNSIGNED NULL,
  department  VARCHAR(120),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalog_name (college_id, name_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI-written (or template) summary of one equipment across a whole college, shown on the public equipment pages. Rebuilt when the public facts change.
CREATE TABLE IF NOT EXISTS equipment_summaries (
  college_id  INT UNSIGNED NOT NULL,
  name_key    VARCHAR(255) NOT NULL,
  facts_hash  CHAR(40) NOT NULL,
  summary     TEXT,
  source      VARCHAR(10) NOT NULL DEFAULT 'template',
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (college_id, name_key)
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
  contact_name     VARCHAR(160),
  contact_email    VARCHAR(190),
  contact_phone    VARCHAR(40),
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

-- Events (BAJA, workshops, fests, consultancy ... any type). Organised college > academic year > event > folder > file.
CREATE TABLE IF NOT EXISTS events (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  college_id    INT UNSIGNED NOT NULL,
  department    VARCHAR(120) NULL,
  type_key      VARCHAR(40) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  academic_year VARCHAR(20) NULL,
  event_date    VARCHAR(60) NULL,
  venue         VARCHAR(200) NULL,
  description   TEXT,
  status        ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_by    INT UNSIGNED NULL,
  published_at  TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_event_college (college_id, status, academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Every file has its folder (and optional sub-folder), descriptive metadata and a machine-made summary.
CREATE TABLE IF NOT EXISTS event_files (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id      INT UNSIGNED NOT NULL,
  folder        VARCHAR(80) NOT NULL,
  subfolder     VARCHAR(80) NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  contributor   VARCHAR(160) NULL,
  file_date     VARCHAR(40) NULL,
  tags          VARCHAR(300) NULL,
  is_public     TINYINT(1) NOT NULL DEFAULT 0,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(400) NOT NULL,
  mime          VARCHAR(120),
  size          INT UNSIGNED NOT NULL DEFAULT 0,
  summary       TEXT,
  extracted     MEDIUMTEXT,
  uploaded_by   INT UNSIGNED NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ef_event (event_id, folder, subfolder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

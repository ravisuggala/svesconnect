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
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  status               ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_college_email (college_id, email),
  KEY idx_users_scope (college_id, role, department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Equipment (Module 1 will extend this with the full registration template fields).
CREATE TABLE IF NOT EXISTS equipment (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  category       VARCHAR(120),
  department     VARCHAR(120),
  description    TEXT,
  specifications TEXT,
  location       VARCHAR(255),
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_equipment_category (category),
  KEY idx_equipment_department (department),
  FULLTEXT KEY ft_equipment (name, description, specifications)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit trail for chatbot use (Module 2 requirement: chat_logs).
CREATE TABLE IF NOT EXISTS chat_logs (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NULL,
  message    TEXT NOT NULL,
  response   TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

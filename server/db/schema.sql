-- SVES Connect: MySQL / MariaDB schema (utf8mb4). Applied by `npm run migrate` (idempotent).
-- Each module owns its tables; add new module tables in new files under server/modules/<module>/ when that module is built.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','faculty','external','lab_incharge','hod','principal','admin') NOT NULL DEFAULT 'student',
  status        ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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

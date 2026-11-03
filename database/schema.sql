-- Jalankan di database dh_fleetsync. Installer CLI membuat databasenya otomatis.
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('bootstrap', '0');

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operators (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    site ENUM('BCP','ACP','KCP','SSCP') NOT NULL,
    nik VARCHAR(60) NOT NULL,
    name VARCHAR(150) NOT NULL,
    unit VARCHAR(60) NOT NULL DEFAULT '',
    equipment VARCHAR(100) NOT NULL DEFAULT '',
    last_date DATE NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_operator_identity (site, nik),
    KEY idx_operator_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lineups (
    id VARCHAR(80) PRIMARY KEY,
    site ENUM('BCP','ACP','KCP','SSCP') NOT NULL,
    work_date DATE NOT NULL,
    shift ENUM('D','N','Belum ditentukan') NOT NULL DEFAULT 'Belum ditentukan',
    type_category ENUM('Production','Support','Belum diklasifikasi') NOT NULL DEFAULT 'Belum diklasifikasi',
    unit VARCHAR(60) NOT NULL,
    equipment VARCHAR(100) NOT NULL DEFAULT '',
    operator_name VARCHAR(150) NOT NULL DEFAULT '',
    nik VARCHAR(60) NOT NULL DEFAULT '',
    dh ENUM('Ya','Tidak','Belum dicek') NOT NULL DEFAULT 'Ya',
    mine ENUM('Ya','Tidak','Belum dicek') NOT NULL DEFAULT 'Belum dicek',
    ftw ENUM('Ya','Tidak','Belum dicek') NOT NULL DEFAULT 'Belum dicek',
    source_status VARCHAR(150) NOT NULL DEFAULT '',
    note TEXT NOT NULL,
    proof_ftw VARCHAR(255) NOT NULL DEFAULT '',
    proof_mine VARCHAR(255) NOT NULL DEFAULT '',
    source VARCHAR(150) NOT NULL DEFAULT 'Input PHP',
    source_row INT UNSIGNED NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_assignment (site, work_date, shift, unit, nik),
    KEY idx_lineup_filter (site, work_date, shift, type_category),
    KEY idx_lineup_nik (site, nik)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id VARCHAR(80) NOT NULL,
    details JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_time (created_at),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
    attempt_key CHAR(64) PRIMARY KEY,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_attempt DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

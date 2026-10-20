-- =====================================================================
-- StratosEvent — Event Management and Registration Platform
-- Database Schema Definition (MySQL 8.0+)
-- TCS iON Industry Project
-- =====================================================================

-- Create database if it does not already exist
CREATE DATABASE IF NOT EXISTS stratosevent_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE stratosevent_db;

-- ---------------------------------------------------------------------
-- Table 1: USERS
-- Stores credentials and profiles for both Participants and Admins.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL COMMENT 'Bcrypt hashed password - never plaintext',
    role ENUM('admin', 'participant') NOT NULL DEFAULT 'participant',
    phone_number VARCHAR(20) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Constraints & Indexes
    CONSTRAINT uq_users_email UNIQUE (email),
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Table 2: EVENTS
-- Stores event information created and managed by administrators.
-- ---------------------------------------------------------------------
CREATE TABLE events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    event_type ENUM('workshop', 'webinar', 'conference', 'hackathon', 'seminar') NOT NULL DEFAULT 'workshop',
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    venue VARCHAR(255) NOT NULL COMMENT 'Physical location or online meeting link',
    capacity INT UNSIGNED NOT NULL COMMENT 'Maximum allowed attendees',
    status ENUM('draft', 'published', 'completed', 'cancelled') NOT NULL DEFAULT 'published',
    created_by INT UNSIGNED NULL COMMENT 'User ID of the admin who created the event',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Business Rules & Constraints
    CONSTRAINT chk_events_capacity CHECK (capacity > 0),
    CONSTRAINT chk_events_dates CHECK (end_time >= start_time),
    CONSTRAINT fk_events_created_by FOREIGN KEY (created_by) 
        REFERENCES users (id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    
    -- Performance Indexes
    INDEX idx_events_status (status),
    INDEX idx_events_start_time (start_time),
    INDEX idx_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Table 3: REGISTRATIONS
-- Records participant bookings for specific events.
-- ---------------------------------------------------------------------
CREATE TABLE registrations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    event_id INT UNSIGNED NOT NULL,
    ticket_code VARCHAR(64) NOT NULL COMMENT 'Unique booking ticket code or QR payload',
    status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'approved',
    registration_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraint: Prevent a participant from registering for the same event more than once
    CONSTRAINT uq_registrations_user_event UNIQUE (user_id, event_id),
    CONSTRAINT uq_registrations_ticket_code UNIQUE (ticket_code),

    -- Foreign Keys
    CONSTRAINT fk_registrations_user FOREIGN KEY (user_id) 
        REFERENCES users (id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_registrations_event FOREIGN KEY (event_id) 
        REFERENCES events (id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,

    -- Performance Indexes
    INDEX idx_registrations_user (user_id),
    INDEX idx_registrations_event (event_id),
    INDEX idx_registrations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Table 4: ATTENDANCE
-- Tracks check-in confirmation and attendance status on event day.
-- ---------------------------------------------------------------------
CREATE TABLE attendance (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id INT UNSIGNED NOT NULL,
    check_in_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    check_in_status ENUM('checked_in', 'absent', 'late') NOT NULL DEFAULT 'checked_in',
    verified_by INT UNSIGNED NULL COMMENT 'Admin/Staff who validated the entry',
    notes VARCHAR(255) NULL,

    -- Constraint: Prevent duplicate check-ins for the same registration pass
    CONSTRAINT uq_attendance_registration UNIQUE (registration_id),

    -- Foreign Keys
    CONSTRAINT fk_attendance_registration FOREIGN KEY (registration_id) 
        REFERENCES registrations (id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_attendance_verified_by FOREIGN KEY (verified_by) 
        REFERENCES users (id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,

    -- Performance Indexes
    INDEX idx_attendance_time (check_in_time),
    INDEX idx_attendance_status (check_in_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

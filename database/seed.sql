-- =====================================================================
-- StratosEvent -- Event Management and Registration Platform
-- Sample Seed Data (For Development & Testing)
-- TCS iON Industry Project
-- =====================================================================

USE stratosevent_db;

-- ---------------------------------------------------------------------
-- SAFETY NOTICE:
-- This seed script is strictly intended for a fresh, empty development
-- database. All TRUNCATE and DELETE statements have been removed to
-- guarantee that existing users, events, or registrations are never deleted.
-- If this script is executed on a database that already contains records,
-- MySQL will intentionally throw a duplicate-key error (ER_DUP_ENTRY)
-- to protect your existing data from accidental overwrites.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Insert Sample Users
-- Exactly one INSERT statement inserting exactly seven user records.
-- Password for all seven demo accounts: "StratosDev@2026"
-- Verified genuine Bcrypt hash ($2b$10$...):
--   $2b$10$KJMs01ULHyW3C6LYg8RnMubGrcVa7vbLdfRh4mZQTSdY1My/H7TpG
-- ---------------------------------------------------------------------
INSERT INTO users (id, full_name, email, password_hash, role, phone_number) VALUES
(1, 'Stratos Administrator', 'admin@stratosevent.internal', '$2b$10$KJMs01ULHyW3C6LYg8RnMubGrcVa7vbLdfRh4mZQTSdY1My/H7TpG', 'admin', '+91-98000-00001'),
(2, 'Campus Event Coordinator', 'coordinator@stratosevent.internal', '$2b$10$KJMs01ULHyW3C6LYg8RnMubGrcVa7vbLdfRh4mZQTSdY1My/H7TpG', 'admin', '+91-98000-00002'),
(3, 'Rohit Mehta', 'rohit.mehta@example.com', '$2b$10$KJMs01ULHyW3C6LYg8RnMubGrcVa7vbLdfRh4mZQTSdY1My/H7TpG', 'participant', '+91-98000-11101'),
(4, 'Ananya Sen', 'ananya.sen@example.com', '$2b$10$KJMs01ULHyW3C6LYg8RnMubGrcVa7vbLdfRh4mZQTSdY1My/H7TpG', 'participant', '+91-98000-11102'),
(5, 'Deepak Nair', 'deepak.nair@example.com', '$2b$10$KJMs01ULHyW3C6LYg8RnMubGrcVa7vbLdfRh4mZQTSdY1My/H7TpG', 'participant', '+91-98000-11103'),
(6, 'Kavita Rao', 'kavita.rao@example.com', '$2b$10$KJMs01ULHyW3C6LYg8RnMubGrcVa7vbLdfRh4mZQTSdY1My/H7TpG', 'participant', '+91-98000-11104'),
(7, 'Manish Joshi', 'manish.joshi@example.com', '$2b$10$KJMs01ULHyW3C6LYg8RnMubGrcVa7vbLdfRh4mZQTSdY1My/H7TpG', 'participant', '+91-98000-11105');

-- ---------------------------------------------------------------------
-- 2. Insert Sample Events
-- Exactly one INSERT statement inserting exactly five event records.
-- Covers various event categories, venues, and capacities.
-- ---------------------------------------------------------------------
INSERT INTO events (id, title, description, event_type, start_time, end_time, venue, capacity, status, created_by) VALUES
(1, 'Cloud Native Architecture & Kubernetes Workshop', 'Hands-on deep dive into building, deploying, and scaling microservices with Docker and Kubernetes.', 'workshop', '2026-11-05 09:30:00', '2026-11-05 17:00:00', 'Auditorium 1, TCS Synergy Park, Hyderabad', 60, 'published', 1),
(2, 'NextGen AI & LLM Systems Webinar', 'Exploring enterprise applications of generative AI, prompt engineering, and ethical AI deployment.', 'webinar', '2026-11-12 15:00:00', '2026-11-12 18:00:00', 'Online - Virtual Cisco Webex Session', 250, 'published', 1),
(3, 'Stratos Annual CodeStorm Hackathon 2026', 'A 24-hour rapid product innovation hackathon focused on FinTech, HealthTech, and GreenTech solutions.', 'hackathon', '2026-11-20 08:00:00', '2026-11-21 12:00:00', 'Innovation Hub, Tech Park Phase 2, Bengaluru', 120, 'published', 2),
(4, 'Cybersecurity & Zero Trust Architecture Seminar', 'Industry leaders discuss defense-in-depth strategies, vulnerability assessment, and compliance in cloud environments.', 'seminar', '2026-12-02 10:00:00', '2026-12-02 13:30:00', 'Conference Hall B, Siruseri IT Park, Chennai', 80, 'published', 2),
(5, 'Full-Stack JavaScript Mastery Bootcamp', 'Comprehensive session covering Node.js event-loop, Express middleware architecture, and modern ES6 patterns.', 'workshop', '2026-12-15 10:00:00', '2026-12-15 16:30:00', 'Online - Microsoft Teams Meeting', 150, 'draft', 1);

-- ---------------------------------------------------------------------
-- 3. Insert Sample Registrations
-- Exactly one INSERT statement inserting exactly seven registration records.
-- Demonstrates active, approved, and pending registrations with unique ticket codes.
-- ---------------------------------------------------------------------
INSERT INTO registrations (id, user_id, event_id, ticket_code, status, registration_date) VALUES
(1, 3, 1, 'TKT-STR-2026-0001', 'approved', '2026-10-16 10:15:00'),
(2, 4, 1, 'TKT-STR-2026-0002', 'approved', '2026-10-16 11:20:00'),
(3, 5, 1, 'TKT-STR-2026-0003', 'approved', '2026-10-16 12:45:00'),
(4, 3, 2, 'TKT-STR-2026-0004', 'approved', '2026-10-17 09:05:00'),
(5, 6, 2, 'TKT-STR-2026-0005', 'approved', '2026-10-17 14:30:00'),
(6, 7, 3, 'TKT-STR-2026-0006', 'pending', '2026-10-18 16:10:00'),
(7, 4, 3, 'TKT-STR-2026-0007', 'approved', '2026-10-18 17:00:00');

-- ---------------------------------------------------------------------
-- 4. Insert Sample Attendance Records
-- Exactly one INSERT statement inserting exactly three attendance records.
-- Shows verified check-ins for approved registrations.
-- ---------------------------------------------------------------------
INSERT INTO attendance (id, registration_id, check_in_time, check_in_status, verified_by, notes) VALUES
(1, 1, '2026-11-05 09:15:10', 'checked_in', 1, 'Verified via QR code scan at Desk A'),
(2, 2, '2026-11-05 09:28:40', 'checked_in', 1, 'Badge issued, verified at Gate 1'),
(3, 3, '2026-11-05 09:48:15', 'late', 2, 'Admitted 18 minutes post commencement');

-- =====================================================================
-- Migration 001: Support for Ticket Tiers / Registration Categories
-- StratosEvent — Event Management and Registration Platform
-- =====================================================================
-- Description:
-- Adds a 'ticket_tier' column to the 'registrations' table to categorize
-- attendee passes (e.g., General Admission, VIP / Speaker Pass, Student).
--
-- Safety Guarantees:
-- 1. Non-destructive: Does NOT drop or truncate any existing tables or rows.
-- 2. Preserves all existing seed records (IDs 1-7) with default 'general'.
-- 3. Uses safe ALTER TABLE ADD COLUMN.
-- =====================================================================

USE stratosevent_db;

-- Add ticket_tier column to registrations table
ALTER TABLE registrations
  ADD COLUMN ticket_tier ENUM('general', 'vip', 'student', 'early_bird') 
  NOT NULL DEFAULT 'general' 
  AFTER ticket_code;

-- Add index on ticket_tier for fast filtering
CREATE INDEX idx_registrations_ticket_tier ON registrations (ticket_tier);

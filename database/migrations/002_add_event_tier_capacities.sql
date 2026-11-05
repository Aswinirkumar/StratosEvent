-- =====================================================================
-- Migration 002: Support for Per-Event Ticket Tier Quotas & Capacities
-- StratosEvent — Event Management and Registration Platform
-- =====================================================================
-- Description:
-- Adds per-tier seat capacity columns to the 'events' table.
-- Allows event creators/admins to configure specific seat limits for:
--   - capacity_general: General Admission seats
--   - capacity_vip: VIP Pass seats
--   - capacity_student: Student Pass seats
--   - capacity_early_bird: Early Bird seats
--
-- Safety Guarantees:
-- 1. Non-destructive: Does NOT drop or truncate any existing tables or rows.
-- 2. Preserves all existing seed events (IDs 1-5) with NULL (shared pool).
-- 3. Uses safe ALTER TABLE ADD COLUMN.
-- =====================================================================

USE stratosevent_db;

-- Add tier capacity columns to events table
ALTER TABLE events
  ADD COLUMN capacity_general INT NULL DEFAULT NULL AFTER capacity,
  ADD COLUMN capacity_vip INT NULL DEFAULT NULL AFTER capacity_general,
  ADD COLUMN capacity_student INT NULL DEFAULT NULL AFTER capacity_vip,
  ADD COLUMN capacity_early_bird INT NULL DEFAULT NULL AFTER capacity_student;

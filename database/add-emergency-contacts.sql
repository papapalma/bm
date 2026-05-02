-- Migration: Add emergency contact fields to trainees table
-- Run this against your Supabase database

ALTER TABLE trainees
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);

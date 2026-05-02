-- Migration: Add certificates column to trainees table
-- This allows admins to upload certificates for trainees
-- Certificates are stored as JSONB array with file paths and metadata

-- Add certificates column to store array of certificate objects
ALTER TABLE trainees 
ADD COLUMN IF NOT EXISTS certificates JSONB DEFAULT '[]'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_trainees_certificates ON trainees USING GIN (certificates);

-- Add comment to document the structure
COMMENT ON COLUMN trainees.certificates IS 'Array of certificate objects: [{id: uuid, file_path: string, title: string, uploaded_at: timestamp, uploaded_by: uuid}]';

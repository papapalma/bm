-- Add level column to programs table
-- Supported values: Beginner, Intermediate, Advanced, All Levels

ALTER TABLE programs
ADD COLUMN IF NOT EXISTS level VARCHAR(100);

COMMENT ON COLUMN programs.level IS 'Skill level required: Beginner, Intermediate, Advanced, or All Levels';

-- Add instructor column to programs table
-- This allows manually entering instructor names for programs

ALTER TABLE programs
ADD COLUMN IF NOT EXISTS instructor VARCHAR(255);

COMMENT ON COLUMN programs.instructor IS 'Name of the instructor teaching this program (manually entered text field)';

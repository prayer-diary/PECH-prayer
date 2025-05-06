-- Add date column to prayer_updates table
ALTER TABLE prayer_updates ADD COLUMN update_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Create a comment to explain the purpose of the date column
COMMENT ON COLUMN prayer_updates.update_date IS 'The date of the prayer update, used as unique identifier for updates';

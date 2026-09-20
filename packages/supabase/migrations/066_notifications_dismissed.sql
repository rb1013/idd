ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed boolean DEFAULT false NOT NULL;

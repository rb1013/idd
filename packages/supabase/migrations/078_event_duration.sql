-- Free-form duration text for events (e.g. "2 hours", "All day")
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration text;

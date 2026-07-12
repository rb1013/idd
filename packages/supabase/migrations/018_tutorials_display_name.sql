-- Guardian-provided short display name shown to users instead of the auto-generated title
ALTER TABLE tutorials ADD COLUMN IF NOT EXISTS display_name TEXT;

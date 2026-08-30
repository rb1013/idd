-- Event category options (managed by admin)
CREATE TABLE event_category_options (
  id         uuid primary key default uuid_generate_v4(),
  label      text not null unique,
  created_at timestamptz default now()
);

-- Add category column to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS category text;

-- RLS: allow all authenticated users to read categories
ALTER TABLE event_category_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read event categories"
  ON event_category_options
  FOR SELECT
  USING (auth.role() = 'authenticated');

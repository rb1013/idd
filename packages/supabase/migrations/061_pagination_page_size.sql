ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS pagination_page_size integer NOT NULL DEFAULT 10
    CHECK (pagination_page_size > 0);

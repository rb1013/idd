-- Store the original guardian inputs used to generate a tutorial
ALTER TABLE tutorials
  ADD COLUMN IF NOT EXISTS visual_style    text,
  ADD COLUMN IF NOT EXISTS image_style     text,
  ADD COLUMN IF NOT EXISTS pacing_label    text,  -- 'slow' | 'normal'
  ADD COLUMN IF NOT EXISTS tone_label      text,  -- 'calm' | 'enthusiastic'
  ADD COLUMN IF NOT EXISTS background_audio text,
  ADD COLUMN IF NOT EXISTS core_action     text;

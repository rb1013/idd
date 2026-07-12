-- AI-generated tutorials don't have a video_url — drop the NOT NULL constraint
ALTER TABLE tutorials ALTER COLUMN video_url DROP NOT NULL;

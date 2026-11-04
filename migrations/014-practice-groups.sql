-- Practice groups run on a fast clock for testing (see lib/timing.ts).
ALTER TABLE groups ADD COLUMN IF NOT EXISTS practice BOOLEAN NOT NULL DEFAULT false;

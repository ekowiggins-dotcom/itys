-- Sealed predictions: a Moment whose answers stay hidden until an opening date, then the group opens them together.
ALTER TABLE moments ADD COLUMN IF NOT EXISTS sealed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE moments ADD COLUMN IF NOT EXISTS opens_at TIMESTAMPTZ;

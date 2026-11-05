-- A Moment started from a calendar event (Eurovision, New Year's Eve…): so the app knows the group has one.
ALTER TABLE moments ADD COLUMN IF NOT EXISTS event_key TEXT;

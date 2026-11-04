-- The competition round ("Round of 16", "Final") ranks European knockout games above league-phase games.
ALTER TABLE football_fixtures ADD COLUMN IF NOT EXISTS round_name TEXT;

ALTER TABLE seasons ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS snapshot JSONB;
CREATE TABLE season_members (season_id TEXT REFERENCES seasons(id),user_id TEXT REFERENCES users(id),eligible_since TIMESTAMPTZ NOT NULL,PRIMARY KEY(season_id,user_id));
CREATE TABLE season_drop_notices (id TEXT PRIMARY KEY,season_id TEXT REFERENCES seasons(id),user_id TEXT REFERENCES users(id),drop_count INTEGER NOT NULL,text TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL,seen_at TIMESTAMPTZ,UNIQUE(season_id,user_id,drop_count));
CREATE FUNCTION guard_frozen_season() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.frozen_at IS NOT NULL THEN RAISE EXCEPTION 'Frozen seasons are read-only'; END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END; $$;
CREATE TRIGGER frozen_season_guard BEFORE UPDATE OR DELETE ON seasons FOR EACH ROW EXECUTE FUNCTION guard_frozen_season();
CREATE FUNCTION guard_frozen_score() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM seasons WHERE id=OLD.season_id AND frozen_at IS NOT NULL) THEN RAISE EXCEPTION 'Frozen season scores are read-only'; END IF;
 IF TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM seasons WHERE id=NEW.season_id AND frozen_at IS NOT NULL) THEN RAISE EXCEPTION 'Frozen season scores are read-only'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END; $$;
CREATE TRIGGER frozen_score_guard BEFORE INSERT OR UPDATE OR DELETE ON scores FOR EACH ROW EXECUTE FUNCTION guard_frozen_score();

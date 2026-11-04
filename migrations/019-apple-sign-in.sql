-- Sign in with Apple: the stable Apple user id, so the same person finds their account on the web and in the app.
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_apple_sub ON users(apple_sub) WHERE apple_sub IS NOT NULL;

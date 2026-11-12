-- Up Migration
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;

-- Accounts created before email verification existed are treated as verified.
UPDATE users SET email_verified_at = now();

-- Down Migration
ALTER TABLE users DROP COLUMN email_verified_at;

-- Up Migration
CREATE EXTENSION IF NOT EXISTS citext;

-- Down Migration
DROP EXTENSION IF EXISTS citext;
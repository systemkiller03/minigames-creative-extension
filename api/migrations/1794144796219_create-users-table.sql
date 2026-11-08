-- Up Migration
CREATE TABLE users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext      NOT NULL UNIQUE,
  name  text        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 30),
  password_hash text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE users;
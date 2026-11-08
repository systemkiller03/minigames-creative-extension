-- Up Migration

CREATE TABLE auth_identities (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         text        NOT NULL CHECK (provider IN ('google')),
  provider_user_id text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id),
  UNIQUE (user_id, provider)
);

-- Down Migration
DROP TABLE auth_identities;
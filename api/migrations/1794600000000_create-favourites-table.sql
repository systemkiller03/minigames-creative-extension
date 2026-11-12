-- Up Migration
CREATE TABLE favourites (
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_slug  text        NOT NULL CHECK (char_length(game_slug) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_slug)
);

CREATE INDEX favourites_user_created_idx ON favourites (user_id, created_at DESC);

-- Down Migration
DROP TABLE favourites;

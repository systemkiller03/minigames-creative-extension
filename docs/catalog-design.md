# Catalog proxy and favourites design

Status: implemented and verified against the real upstream. Contract: `docs/base_api_endpoints.json`.
Change the design here first, then the code.

## Upstream facts that drive the design

- The upstream is shared and has no real auth: "identity" is a bare `userEmail` in the
  body (or query for reads).
- Favourites and comment likes are **toggles**. There is no "list my favourites" endpoint.
- Rate limited upstream (429 with a message, no documented `Retry-After`).
- Errors are inconsistent: unknown slug can be 400 or 404.

## Decisions

| #   | Decision                                                                                                                                                                                                                                                   | Reason                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | The gateway is the only caller. It sends a synthetic `userEmail` = `u-{user.id}@{UPSTREAM_EMAIL_DOMAIN}` (default `minigames-gateway.invalid`, from env). Never the client's value, never the real email.                                                  | The upstream namespace is shared. Avoids leaking real emails, collisions with other apps, and impersonation. Stable if the user's email changes. |
| C2  | Favourites live in Postgres: `favourites(user_id, game_slug, created_at)`, PK `(user_id, game_slug)`, `ON DELETE CASCADE` from users. This is the source of truth for "my favourites". The upstream is mirrored for `likesCount`.                          | Upstream cannot list a user's favourites.                                                                                                        |
| C3  | Idempotent API: `PUT /me/favourites/:slug` and `DELETE /me/favourites/:slug`. The gateway compares local state with the request and calls the upstream toggle only when the state must change.                                                             | A retry or double click must not flip the state back.                                                                                            |
| C4  | Redis cache `cache:up:{sha256(method+path+sorted query)}` for categories (long TTL), leaderboard, featured, game lists and game details (about 60 s). Cached responses never contain per-user data. `isLikedByCurrentUser` is filled from the local table. | One entry serves everyone.                                                                                                                       |
| C5  | Upstream client: timeout, one retry for GET only, never retry a toggle. Upstream 429 becomes our 503 with a retry hint. On upstream failure serve stale cache when present, otherwise 502. Unknown slug is always normalised to 404.                       | Upstream errors are inconsistent and rate limited.                                                                                               |
| C6  | Implemented. Comments and comment likes reuse the client, error mapping, cache and email mapping. Comment-like state needs no local table (upstream reports it for the synthetic email); `authorName` comes from `user.name`.                              | Separate concerns (sanitising, spam, limits).                                                                                                    |

## Failure ordering for a favourite change

1. Check the game exists (cached details or upstream 404).
2. Write Postgres (insert or delete, idempotent).
3. Call the upstream toggle only if the local state changed. If the upstream call
   fails, revert the local change and return 502, so local and upstream do not drift.

## Account deletion

Before the user row is deleted, un-favourite each of their favourites upstream
(best effort, logged on failure). Local rows go with the user through the cascade.

## Verified against the real upstream (2026-11-12)

- **F1 resolved:** the upstream accepts `u-{uuid}@minigames-gateway.invalid` for the favourite
  toggle. Toggling twice returned the game to its original `likesCount`.
- **F2 measured:** 60 sequential requests in about 7 s (roughly 8 per second) from one IP
  produced no 429, and no rate-limit headers are sent. The limit is higher than we need, so the
  current TTLs stand. Our own per-user limits stay as abuse protection.
- Real shapes match the client: game summaries carry `cardImage`, list `meta` carries
  `totalPages`, and an unknown slug answers 404 `{error: "Game not found: ..."}`.
- Not exercised: posting comments (cannot be undone on the shared service).

## Open items

- **F3:** `likesCount` can drift if someone toggles directly upstream with the same
  synthetic email. Accepted.

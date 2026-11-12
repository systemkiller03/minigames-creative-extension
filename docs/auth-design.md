# Identity design: JWT access + whitelisted refresh families

Status: implemented. The code must match this file. Change the
design here first, then the code.

## Decisions (with reasons)

| #   | Decision                                                                                                                                        | Reason                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Access JWT is stateless: signature + expiry only, nothing stored, no Redis call per request.                                                    | Matches "access tokens are not saved anywhere". Cost: a revoked session's access token works until it expires (<= 5 min). Later, SSE can tell the client to log out at once. |
| D2  | HS256 with two separate secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.                                                                     | Only this API issues and verifies, so a shared secret is enough. Separate secrets mean an access token can never pass as a refresh token.                                    |
| D3  | Reuse of a rotated-out refresh token revokes the whole family, with a grace window.                                                             | Reuse means theft or replay. The window avoids false logouts when two tabs refresh at once.                                                                                  |
| D4  | Refresh JWT carries `sub`, `sid`, `jti`. Redis whitelist stores the current `jti` per family.                                                   | The token is signed, so no secret needs hashing. Valid = signature OK AND `jti` equals the stored current (or previous inside grace).                                        |
| D5  | Access TTL 5 min, refresh idle timeout 7 d, absolute family limit 30 d.                                                                         | Short access TTL bounds the D1 revocation gap.                                                                                                                               |
| D6  | No separate CSRF token. Refresh relies on `SameSite=Lax`, `httpOnly`, cookie path scoped to the auth routes, and the `Origin` allow-list check. | Refresh is a POST needing a cookie browsers will not send cross-site. Removes `/auth/csrf`, the csrf cookie and per-token csrf state.                                        |
| D7  | Grace window 20 s; inside it the previous `jti` is accepted and rotated again from current.                                                     | Covers tab races. After 20 s, a previous `jti` means theft, so the family is revoked.                                                                                        |
| D8  | A family ends on: logout / revoke one device; logout all; password change or reset; reuse detected; idle or max expiry.                         | Each is either user intent or a security response.                                                                                                                           |
| D9  | One family per login (password or Google). Devices list = the user's families.                                                                  | Simple, matches "session families" for the devices page. `isCurrent` = access token `sid` equals family id.                                                                  |

## Vocabulary

- **Family (= session = device):** created at login, identified by `sid`. Every
  refresh rotates the token inside the family; the family id never changes.
- **Whitelist:** a refresh token is valid only if Redis says so. No entry means invalid.

## Tokens

### Access JWT (header `Authorization: Bearer`)

- Claims: `sub` (user id), `sid` (family id), `aud: "access"`, `iat`, `exp` (+5 min).
- Kept in frontend memory only. Never stored server-side.

### Refresh JWT (httpOnly cookie)

- Claims: `sub`, `sid`, `jti` (random, new on every rotation), `aud: "refresh"`,
  `iat`, `exp = min(now + 7 d, family.maxExpiresAt)`.
- Cookie: `httpOnly`, `Secure` in production, `SameSite=Lax`, `Path` = auth router
  base path, `maxAge` = time to its `exp`.
- Not returned in the JSON body.

## Redis model

```
auth:family:{sid}      HASH   userId, currentJti, previousJti, rotatedAt,
                              createdAt, lastSeenAt, maxExpiresAt,
                              userAgent, ipAddress
                       TTL    idle timeout (7 d), renewed on every rotation, never
                              beyond maxExpiresAt. Redis TTL therefore enforces
                              idle expiry; the family disappears when it expires.
auth:user-families:{uid}  ZSET  member = sid, score = lastSeenAt (listing order)
                       No TTL; stale members are removed lazily when the family
                       hash is missing.
```

Nothing else. No access-token keys and no per-token hash sets.

## Flows

**Login / Google login:** verify credentials, create a family (`sid` = new UUID,
`currentJti` = new jti, `maxExpiresAt` = now + 30 d), add to `auth:user-families`,
issue access JWT, set refresh cookie, return `{ user, accessToken, expiresIn }`.

**Authenticated request:** verify the access JWT (signature, `aud`, `exp`) and set
`req.auth = { userId: sub, sessionId: sid }`. No Redis.

**Refresh** (one atomic Lua script, after the JWT signature and `exp` are verified):

1. Family missing: reject 401 (revoked, expired or logged out).
2. `jti == currentJti`: rotate. `previousJti = currentJti`, `currentJti = new`,
   `rotatedAt = now`, `lastSeenAt = now`, renew TTL (cap at max). OK.
3. `jti == previousJti` and `now - rotatedAt <= 20 s`: grace. Rotate again as in step 2.
4. Anything else: reuse. Delete the family, remove it from the user index, reject 401.
   Then the service loads the user (if gone, revoke the family) and issues a new access JWT.

**Logout:** delete the current family (from `sid`), clear the cookie.
**Revoke device:** delete the family if it belongs to the user.
**Logout all / password change / reset:** delete every family in `auth:user-families:{uid}`.
**Devices list:** read the user's families; show id, device label (from the
User-Agent), IP, created, last seen, expiry (`min(lastSeen + 7 d, max)`), `isCurrent`.

## Removed from the current implementation

`auth:access:*` keys, `currentAccessHash`, per-token refresh hash sets, the CSRF
token and cookie, the `/auth/csrf` endpoint, opaque tokens, Redis lookup in `requireAuth`.

## Email verification

### Decisions

| #   | Decision                                                                                                                                                                                                   | Reason                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | `POST /auth/register` returns the same `201 { message }` whether or not the email already has an account.                                                                                                  | No account enumeration. A new email gets an unverified user and a code; an existing one gets nothing created (and optionally a "someone tried to register" email to the owner). The response no longer contains `user`. |
| E2  | Proof is an 8-digit emailed code (same pattern as password reset).                                                                                                                                         | Matches the spec and the existing reset code, email service and rate limits. No frontend route needed.                                                                                                                  |
| E3  | Google: accept only `email_verified = true` in the ID token; Google login sets `email_verified_at`; if it links to an existing UNVERIFIED password account, that account's `password_hash` is set to NULL. | Closes pre-registration hijack: an attacker who registered the victim's email with their own password loses that password when the real owner proves ownership through Google.                                          |
| E4  | Confirming the code only sets `email_verified_at`. The user then logs in normally.                                                                                                                         | Login and Google stay the only places that create sessions.                                                                                                                                                             |

### Defaults I chose (please confirm or change)

- **E5:** Login order is: check password, then check `email_verified_at`. If the password
  is right but the email is unverified: `403 EMAIL_NOT_VERIFIED`. Wrong password or no
  account is the same generic 401 as today, so this reveals nothing to someone without the
  password. Login does NOT send a code by itself; the client calls the request endpoint.
- **E6:** A successful password reset also sets `email_verified_at`, because the code was
  delivered to that mailbox. Safe against pre-hijack, since the reset replaces the password.
- **E7:** Existing users are backfilled with `email_verified_at = now()` in the migration, so
  current accounts are not locked out. (Only dev data exists today.)
- **E8:** Wrong-code attempts: after 5 failures the code is deleted and a new one must be
  requested; plus the per-IP and per-email rate limiter used by password reset. Resend
  cooldown: a new code is not issued if one was issued in the last 60 s (response stays
  generic).

### Endpoints

- `POST /auth/register` body `{ email, name, password }` -> `201 { message }`.
- `POST /auth/verify-email/request` body `{ email }` -> generic 200. Unknown or already
  verified emails: same response, nothing sent.
- `POST /auth/verify-email/confirm` body `{ email, code }` -> `200 { message }`; invalid,
  expired or used code -> 401.
- `POST /auth/login`: adds the 403 `EMAIL_NOT_VERIFIED` described in E5.

### Storage

- Postgres: `users.email_verified_at timestamptz NULL` (new migration, with the E7 backfill).
- Redis: `auth:email-verify:{sha256(email)}` -> JSON `{ userId, codeHash, attempts, issuedAt }`,
  TTL 10 min. One live code per email: a new request overwrites the old one.

## Open items

- **O1 (resolved):** account deletion: the deleted user's access token still works for up
  to 5 min. Accepted; to be fixed when SSE is built.
- **O2 (resolved):** email verification designed above (E1-E8; E5-E8 await confirmation).
- **O3:** `docs/` is gitignored. Decide whether the design should be committed.
- **O4 (resolved):** device labels come from a library (e.g. `ua-parser-js`).

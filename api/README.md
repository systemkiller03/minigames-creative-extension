# API authentication

Set `CORS_ORIGINS` to a comma-separated list of exact frontend origins (scheme and
host, with a port when needed). Do not include paths or wildcards. Browser requests
that use cookies must include credentials. Production cookies are `Secure`, host-only,
`SameSite=Lax`; configure the frontend and API on the same site.

## Tokens and sessions

Design: `docs/auth-design.md`. Both tokens are HS256 JWTs signed with separate secrets
(`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, each at least 32 characters and different).

- **Access token** (5 minutes): returned in the JSON body, kept in memory by the client and
  sent as `Authorization: Bearer`. It is verified by signature and expiry only and is never
  stored, so a revoked session's access token keeps working until it expires.
- **Refresh token** (7 days idle, 30 days absolute): an httpOnly, `SameSite=Lax` cookie scoped
  to the auth routes, never in the body. Redis keeps a whitelist: one hash per _family_ (one
  login on one device) holding the current refresh `jti`. Every refresh rotates the `jti`.
  Presenting a stale `jti` after a 20 second grace window revokes the whole family.

## Endpoints

- `POST /auth/register` — body `{ email, name, password }`. Always answers `201 { message }`,
  whether or not the email is already registered, and emails an 8-digit verification code
  to new accounts.
- `POST /auth/verify-email/request` — body `{ email }`. Generic response; sends a new code to
  an unverified account (at most one per minute).
- `POST /auth/verify-email/confirm` — body `{ email, code }`. Marks the email verified; the
  user then logs in. Five wrong codes invalidate the code.
- `POST /auth/login` — body `{ email, password }`. Returns `{ user, accessToken, expiresIn }`
  and sets the refresh cookie. Correct password with an unverified email answers
  `403 EMAIL_NOT_VERIFIED`.
- `GET /auth/google/login` and `GET /auth/google/callback` — Google OAuth. The callback
  validates the server-stored state and the ID token (which must have a verified email),
  marks the account verified, sets the refresh cookie and redirects to the frontend with
  `provider=google&status=success`. If it links to a never-verified password account, that
  account's password is removed.
- `POST /auth/password-reset/request`, `/verify`, `/confirm` — reset by emailed code. A
  successful reset revokes every session and also verifies the email.
- `POST /auth/refresh` — call with credentials (cookie) from an allowed `Origin`. Returns
  `{ user, accessToken, expiresIn }` and rotates the cookie. Call it on page load to get an
  access token.
- `GET /me` — profile: `id`, `email`, `name`, `emailVerified`, `hasPassword`, `providers`,
  `createdAt`. Bearer-authenticated, like every `/me` route.
- `PATCH /me` — body `{ name }`. Email cannot be changed here.
- `POST /me/password` — body `{ currentPassword, newPassword }`. Ends every session, including
  this one, and clears the cookie (`204`). Wrong current password is `403`; an account with no
  password is `409` (use password reset). Limited to 5 attempts per user per minute.
- `GET /me/sessions` — the user's families (devices): `id`, `device`, `userAgent`, `ipAddress`,
  `createdAt`, `lastSeenAt`, `expiresAt`, `isCurrent`.
- `DELETE /me/sessions/:sessionId` — end one family. `DELETE /me/sessions` — end all except
  the current one.
- `POST /auth/logout` and `POST /auth/logout-all` — end the current or all families.

Login is limited to 10 attempts per IP per minute; refresh to 30 per IP per minute. Email
code endpoints are limited per IP and per email.

Google sign-in is optional. Configure all four variables to enable it:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (the registered
Google callback URL, e.g. `http://localhost:3000/api/auth/google/callback`), and
`FRONTEND_AUTH_REDIRECT_URL` (the frontend destination after successful sign-in).
OAuth state is stored in Redis for five minutes and consumed once. The frontend can
obtain an access token after the callback by calling the refresh endpoint with credentials.

Password reset codes are sent by SMTP. Local development defaults to Mailpit at
`127.0.0.1:1025`; its inbox UI is available at `http://localhost:8025` after starting
the `mailpit` service in `docker-compose.yml`. Configure `SMTP_HOST`, `SMTP_PORT`,
and `SMTP_FROM` for other environments. Authenticated SMTP may additionally use
`SMTP_USER` and `SMTP_PASSWORD` together. Reset codes expire after 10 minutes, reset
tokens are single-use, and reset request/code verification limits are enforced per
IP and email.

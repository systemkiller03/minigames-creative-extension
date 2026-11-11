# API authentication

Set `CORS_ORIGINS` to a comma-separated list of exact frontend origins (scheme and
host, with a port when needed). Do not include paths or wildcards. Browser requests
that use cookies must include credentials. Production cookies are `Secure`, host-only,
`SameSite=Lax`; configure the frontend and API on the same site.

## Endpoints

- `POST /auth/login` — body `{ "email": "...", "password": "..." }`. Returns
  `{ user, accessToken, expiresIn, csrfToken }`; the refresh token is only set as an
  HttpOnly cookie. Keep the access token in memory and send it as a Bearer token.
- `GET /auth/google/login` — starts Google OAuth. Its callback validates the
  server-stored state and Google ID token, establishes the normal auth session, sets
  auth cookies, and redirects to the configured frontend URL with
  `provider=google&status=success`.
- `GET /auth/google/callback` — Google OAuth callback; normally reached only through
  the redirect from Google.
- `POST /auth/csrf` — call with credentials after a page reload to obtain a fresh
  CSRF token from the refresh-cookie session.
- `POST /auth/refresh` — call with credentials and `X-CSRF-Token` set to the current
  CSRF token. Returns a new access token and CSRF token, and rotates both cookies.
  Serialize refresh requests in the client; reuse of a rotated refresh token revokes
  that device session.
- `GET /auth/sessions` — Bearer-authenticated active device sessions. The current
  session is marked with `isCurrent`.
- `DELETE /auth/sessions/:sessionId` — terminate one of the user's sessions.
- `POST /auth/logout` and `POST /auth/logout-all` — terminate the current or all
  sessions, respectively.

Access tokens last 15 minutes. Sessions expire after 7 days without refresh and have
a 30-day maximum lifetime. Login is limited to 10 attempts per IP per minute;
CSRF bootstrap and refresh share a limit of 30 per IP per minute.

Google sign-in is optional. Configure all four variables to enable it:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (the registered
Google callback URL, e.g. `http://localhost:3000/api/auth/google/callback`), and
`FRONTEND_AUTH_REDIRECT_URL` (the frontend destination after successful sign-in).
OAuth state is stored in Redis for five minutes and consumed once. The frontend can
obtain an access token after the callback by using the existing CSRF and refresh
endpoints with credentials.

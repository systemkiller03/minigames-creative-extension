# API authentication

Set `CORS_ORIGINS` to a comma-separated list of exact frontend origins (scheme and
host, with a port when needed). Do not include paths or wildcards. Browser requests
that use cookies must include credentials. Production cookies are `Secure`, host-only,
`SameSite=Lax`; configure the frontend and API on the same site.

## Endpoints

- `POST /auth/login` — body `{ "email": "...", "password": "..." }`. Returns
  `{ user, accessToken, expiresIn, csrfToken }`; the refresh token is only set as an
  HttpOnly cookie. Keep the access token in memory and send it as a Bearer token.
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

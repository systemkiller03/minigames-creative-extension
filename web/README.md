# MiniGames React frontend

This is an isolated React + TypeScript implementation of MiniGames. The existing
root-level application remains unchanged as the behavior and design reference.

## Development

Run these commands from `web/`:

```sh
pnpm install --ignore-workspace --lockfile-dir .
pnpm dev
pnpm build
```

The app uses TanStack Router, Query, and Form with Zod, plus Tailwind CSS v4.
Design tokens and responsive breakpoints are defined in
[`src/styles/theme.css`](./src/styles/theme.css), migrated from the existing
SCSS token source.

The API client defaults to the same-origin `/api` prefix. For local development
against a separate API origin, copy `.env.example` to `.env.local` and set
`VITE_API_URL` to that API's `/api` base URL.

# Build from the repository root: docker build -f deploy/web.Dockerfile .
FROM node:24-slim AS build
ENV HUSKY=0
RUN npm install -g pnpm@11.20.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter web...
COPY web web
RUN pnpm --filter web build

FROM caddy:2-alpine
COPY --from=build /app/web/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile

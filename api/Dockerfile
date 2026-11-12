# Build from the repository root: docker build -f api/Dockerfile -t minigames-api .
FROM node:24-slim AS build
ENV HUSKY=0
RUN npm install -g pnpm@11.20.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
RUN pnpm install --frozen-lockfile --filter api...
COPY api api
RUN pnpm --filter api build \
 && pnpm --filter api deploy --legacy --prod /out \
 && cp -r api/dist api/migrations /out/

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
# Migrations: docker run --rm --env-file .env <image> node_modules/.bin/node-pg-migrate up -m migrations
CMD ["node", "dist/server.js"]

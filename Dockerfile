# Production image for Railway (or any Docker host with a persistent disk).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/assets ./assets
COPY --from=build /app/next.config.ts ./next.config.ts
# Railway sets PORT; `next start` listens on it.
CMD ["npx","next","start","--hostname","0.0.0.0"]

# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
# server.ts imports ./src/pdf/quote-document.tsx and ./src/lib/* at runtime (server-side PDF, money math, AI query guard);
# assets/ holds the bundled Arabic fonts for PDFs. Without these the container fails to start / PDFs fail offline.
COPY --from=builder /app/src/pdf ./src/pdf
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/tsconfig.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

# The entrypoint fixes volume ownership and then runs the server as the unprivileged "node" user.
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/uploads /app/backups && chown -R node:node /app/uploads /app/backups /app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npx", "tsx", "server.ts"]

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
# server.ts imports ./src/pdf/quote-document.tsx at runtime (server-side PDF generation); without it the container fails to start.
COPY --from=builder /app/src/pdf ./src/pdf
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/tsconfig.json ./

# Install tsx globally or keep it in node_modules
# Since we copied node_modules, it should be there.

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]

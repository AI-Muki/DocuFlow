# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./index.html

EXPOSE 3000

CMD ["node", "dist/server.cjs"]

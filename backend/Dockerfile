# Debian slim (not alpine): bcrypt and the Prisma engines work without extra build tools.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000
# Dev deps are kept so `npx prisma db seed` (ts-node) works inside the container.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

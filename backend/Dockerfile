# Debian slim (not alpine): bcrypt and the Prisma engines work without extra build tools.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
COPY fine_tuning_data/batch_test.py fine_tuning_data/groups.txt fine_tuning_data/summaries.json ./fine_tuning_data/
RUN npx prisma generate && npm run build

EXPOSE 3000
# Dev deps are kept so `npx prisma db seed` (ts-node) works inside the container.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

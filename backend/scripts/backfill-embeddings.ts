/**
 * Backfill: compute and store pgvector embeddings for physician orders that are
 * missing `orderEmbedding`, using the ai-service `/embed` endpoint (local
 * Qwen3-Embedding-0.6B model, 1024-dim).
 *
 * Run (from backend/):
 *   npm run prisma:embed:backfill
 *
 * Requires:
 *   - backend/.env with DATABASE_URL
 *   - ai-service running (default http://localhost:8000, see AI_SERVICE_URL)
 */
import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { OllamaClient } from '../src/course-in-ward/ollama-client';

/** Must match the vector dimension of the ai-service embedding model. */
const EMBEDDING_DIM = 1024;
const BATCH_SIZE = 16;

async function storeEmbedding(
  prisma: PrismaClient,
  orderId: string,
  vector: number[],
): Promise<void> {
  const literal = vector.map((v) => v.toFixed(8)).join(',');
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "physician_orders"
    SET "orderEmbedding" = ${`[${literal}]`}::vector
    WHERE "id" = ${orderId}
  `);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const ai = new OllamaClient();

  const rows = await prisma.$queryRaw<{ id: string; orderContent: string }[]>(Prisma.sql`
    SELECT "id", "orderContent"
    FROM "physician_orders"
    WHERE active = true
      AND "orderEmbedding" IS NULL
      AND "orderContent" <> ''
    ORDER BY "dateCreated" ASC
  `);

  console.log(`Found ${rows.length} active order(s) missing an embedding.`);

  if (rows.length === 0) {
    await prisma.$disconnect();
    return;
  }

  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    try {
      const { embeddings, dimension } = await ai.embedTexts(
        chunk.map((row) => row.orderContent),
      );
      if (dimension !== EMBEDDING_DIM) {
        throw new Error(
          `Embedding model dimension ${dimension} != expected ${EMBEDDING_DIM}. ` +
            `Column is vector(${EMBEDDING_DIM}); refusing to write mismatched vectors.`,
        );
      }
      for (let j = 0; j < chunk.length; j++) {
        const vector = embeddings[j];
        if (!vector || vector.length === 0) {
          failed++;
          continue;
        }
        await storeEmbedding(prisma, chunk[j].id, vector);
        embedded++;
      }
      console.log(
        `  ...processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} (embedded=${embedded})`,
      );
    } catch (err) {
      failed += chunk.length;
      console.error(`  batch failed at ${i}: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone. Embedded=${embedded}, failed=${failed}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

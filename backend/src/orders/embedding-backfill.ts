import { Prisma, PrismaClient } from '@prisma/client';
import { OllamaClient } from '../course-in-ward/ollama-client';

/** Must match the vector dimension of the ai-service embedding model. */
const EMBEDDING_DIM = 1024;
const BATCH_SIZE = 16;

export interface BackfillResult {
  found: number;
  embedded: number;
  failed: number;
}

/**
 * Embed every active order still missing `orderEmbedding` (seeded orders,
 * registration orders, orders written while the AI service was down).
 * Used by `npm run prisma:embed:backfill` and the admin AI report.
 */
export async function backfillOrderEmbeddings(
  prisma: PrismaClient,
  ai: OllamaClient,
  log: (line: string) => void = () => undefined,
): Promise<BackfillResult> {
  const rows = await prisma.$queryRaw<{ id: string; orderContent: string }[]>(Prisma.sql`
    SELECT "id", "orderContent"
    FROM "physician_orders"
    WHERE active = true
      AND "orderEmbedding" IS NULL
      AND "orderContent" <> ''
    ORDER BY "dateCreated" ASC
  `);
  log(`Found ${rows.length} active order(s) missing an embedding.`);

  let embedded = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    try {
      const { embeddings, dimension } = await ai.embedTexts(chunk.map((row) => row.orderContent));
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
        const literal = vector.map((v) => v.toFixed(8)).join(',');
        await prisma.$executeRaw(Prisma.sql`
          UPDATE "physician_orders"
          SET "orderEmbedding" = ${`[${literal}]`}::vector
          WHERE "id" = ${chunk[j].id}
        `);
        embedded++;
      }
      log(`  ...processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} (embedded=${embedded})`);
    } catch (err) {
      failed += chunk.length;
      log(`  batch failed at ${i}: ${(err as Error).message}`);
    }
  }
  return { found: rows.length, embedded, failed };
}

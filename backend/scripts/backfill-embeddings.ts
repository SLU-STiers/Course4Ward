/**
 * Backfill: compute and store pgvector embeddings for physician orders that are
 * missing `orderEmbedding`, using the ai-service `/embed` endpoint (local
 * Qwen3-Embedding-0.6B model, 1024-dim). Admins can run the same thing from
 * the AI report (Embeddings & RAG card).
 *
 * Run (from backend/):
 *   npm run prisma:embed:backfill
 *
 * Requires:
 *   - backend/.env with DATABASE_URL
 *   - ai-service running (default http://localhost:8000, see AI_SERVICE_URL)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { OllamaClient } from '../src/course-in-ward/ollama-client';
import { backfillOrderEmbeddings } from '../src/orders/embedding-backfill';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const { embedded, failed } = await backfillOrderEmbeddings(prisma, new OllamaClient(), console.log);
    console.log(`\nDone. Embedded=${embedded}, failed=${failed}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

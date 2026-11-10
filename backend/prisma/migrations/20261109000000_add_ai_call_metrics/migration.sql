-- CreateEnum
CREATE TYPE "AiCallKind" AS ENUM ('SUMMARY', 'EMBEDDING');

-- CreateTable
CREATE TABLE "ai_call_metrics" (
    "id" TEXT NOT NULL,
    "kind" "AiCallKind" NOT NULL,
    "model" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 1,
    "outputChars" INTEGER,
    "referenceCount" INTEGER,
    "topSimilarity" DOUBLE PRECISION,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_call_metrics_kind_createdAt_idx" ON "ai_call_metrics"("kind", "createdAt");

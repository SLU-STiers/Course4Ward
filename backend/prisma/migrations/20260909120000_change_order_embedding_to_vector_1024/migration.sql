-- Qwen3-Embedding-0.6B emits 1024-dim L2-normalized vectors (sentence-transformers).
-- The original schema guessed vector(768); align the column with the real model.
ALTER TABLE "physician_orders" ALTER COLUMN "orderEmbedding" TYPE vector(1024);

import { Logger } from '@nestjs/common';
import { AiCallKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** What caused an AI call (stored as text on `AiCallMetric.trigger`). */
export type AiTrigger = 'manual' | 'regenerate' | 'batch' | 'order' | 'rag-query' | 'discharge';

/** Outcome details read off a successful call's result. */
export interface AiCallOutcome {
  success?: boolean;
  model?: string;
  outputChars?: number;
  referenceCount?: number;
  topSimilarity?: number | null;
  error?: string | null;
}

const logger = new Logger('AiMetrics');

/**
 * Runs `call`, times it, and records one `AiCallMetric` row for the admin AI
 * statistics. Recording is best-effort: a failed write is logged and never
 * changes the call's result. Errors from `call` itself are recorded and
 * rethrown unchanged.
 */
export async function timeAiCall<T>(
  prisma: PrismaService,
  meta: { kind: AiCallKind; model: string; trigger: AiTrigger; itemCount?: number },
  call: () => Promise<T>,
  outcome: (result: T) => AiCallOutcome = () => ({}),
): Promise<T> {
  const started = Date.now();
  let result: T;
  try {
    result = await call();
  } catch (err) {
    await save(prisma, meta, Date.now() - started, {
      success: false,
      error: (err as Error)?.message ?? String(err),
    });
    throw err;
  }
  await save(prisma, meta, Date.now() - started, { success: true, ...outcome(result) });
  return result;
}

async function save(
  prisma: PrismaService,
  meta: { kind: AiCallKind; model: string; trigger: AiTrigger; itemCount?: number },
  durationMs: number,
  outcome: AiCallOutcome,
) {
  try {
    await prisma.aiCallMetric.create({
      data: {
        kind: meta.kind,
        model: outcome.model || meta.model,
        trigger: meta.trigger,
        durationMs,
        success: outcome.success ?? true,
        itemCount: meta.itemCount ?? 1,
        outputChars: outcome.outputChars,
        referenceCount: outcome.referenceCount,
        topSimilarity: outcome.topSimilarity ?? undefined,
        error: outcome.error?.slice(0, 500) ?? undefined,
      },
    });
  } catch (err) {
    logger.debug(`could not record AI call metric: ${(err as Error)?.message}`);
  }
}

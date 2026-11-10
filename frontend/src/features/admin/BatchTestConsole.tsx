/**
 * Part of the admin dashboard's Reporting → AI tab.
 *
 * Runs the summarization batch test (`fine_tuning_data/batch_test.py`) on the
 * server and shows its output live, like a terminal. It is not a shell: the
 * backend runs only that script, with the options picked here.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/domainApi';
import { apiErrorMessage } from '../../lib/apiError';
import { Button } from '../../components/ui';
import { styles } from './styles';
import type { BatchTestState, BatchTestVariant } from '../../types';

const QUERY_KEY = ['admin-batch-test'];

export function BatchTestConsole() {
  const queryClient = useQueryClient();
  const [variants, setVariants] = useState<BatchTestVariant[]>(['standard']);
  const [limit, setLimit] = useState('5');
  const [evalOnly, setEvalOnly] = useState(false);
  const [error, setError] = useState('');
  const logRef = useRef<HTMLPreElement>(null);

  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => adminApi.batchTestState().then((response) => response.data),
    // Poll only while a run is going; the log is otherwise static.
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 1500 : false),
  });

  const show = (state: BatchTestState) => {
    setError('');
    queryClient.setQueryData(QUERY_KEY, state);
  };
  const start = useMutation({
    mutationFn: () =>
      adminApi.startBatchTest({
        variants,
        limit: limit.trim() ? Number(limit) : undefined,
        evalOnly,
      }),
    onSuccess: (response) => show(response.data),
    onError: (cause) => setError(apiErrorMessage(cause, 'Could not start the batch test.')),
  });
  const stop = useMutation({
    mutationFn: () => adminApi.stopBatchTest(),
    onSuccess: (response) => show(response.data),
    onError: (cause) => setError(apiErrorMessage(cause, 'Could not stop the batch test.')),
  });

  // Follow the output as it grows, like a terminal.
  const lineCount = data?.log.length ?? 0;
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lineCount]);

  const downloadReport = async () => {
    try {
      const response = await adminApi.batchTestReport();
      const isPdf = String(response.headers['content-type'] ?? '').includes('pdf');
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `batch-test-report-${new Date().toISOString().slice(0, 10)}.${isPdf ? 'pdf' : 'html'}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(apiErrorMessage(cause, 'Could not download the test report.'));
    }
  };

  const running = data?.status === 'running';
  const limitValue = Number(limit);
  const limitInvalid = limit.trim() !== '' && (!Number.isInteger(limitValue) || limitValue < 1);
  const toggleVariant = (variant: BatchTestVariant) =>
    setVariants((current) =>
      current.includes(variant) ? current.filter((v) => v !== variant) : [...current, variant],
    );

  return (
    <article style={{ ...styles.reportCard, gridColumn: '1 / -1' }} aria-label="Summarization batch test">
      <div>
        <h4 style={styles.reportCardTitle}>Summarization batch test</h4>
        <span style={styles.reportCardHint}>
          Sends real physician orders through the AI service and checks every summary. About 20–50 s
          per order group; all 88 groups take 30–60 minutes.
        </span>
      </div>

      {data && !data.available ? (
        <p style={styles.reportEmpty}>
          The batch test script is not installed on this server (fine_tuning_data/batch_test.py).
        </p>
      ) : (
        <>
          <div style={consoleStyles.options}>
            <fieldset style={consoleStyles.fieldset} disabled={running}>
              <legend style={consoleStyles.legend}>Model</legend>
              {(['standard', 'fine_tuned'] as const).map((variant) => (
                <label key={variant} style={consoleStyles.check}>
                  <input
                    type="checkbox"
                    checked={variants.includes(variant)}
                    onChange={() => toggleVariant(variant)}
                  />
                  {variant === 'standard' ? 'Base (with RAG)' : 'Fine-tuned'}
                </label>
              ))}
            </fieldset>
            <label style={consoleStyles.field}>
              <span style={consoleStyles.legend}>Order groups</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="All"
                value={limit}
                disabled={running}
                onChange={(event) => setLimit(event.target.value)}
                aria-invalid={limitInvalid}
                style={{ ...styles.formInput, width: '84px', padding: '6px 8px' }}
              />
            </label>
            <label style={{ ...consoleStyles.check, paddingBottom: '6px' }}>
              <input
                type="checkbox"
                checked={evalOnly}
                disabled={running}
                onChange={(event) => setEvalOnly(event.target.checked)}
              />
              Held-out admissions only
            </label>
            <div style={consoleStyles.actions}>
              {running ? (
                <Button size="sm" variant="danger" loading={stop.isPending} onClick={() => stop.mutate()}>
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  loading={start.isPending}
                  disabled={!variants.length || limitInvalid}
                  onClick={() => start.mutate()}
                >
                  Run batch test
                </Button>
              )}
              {data?.reportAvailable ? (
                <Button size="sm" variant="ghost" onClick={downloadReport}>
                  Download test report
                </Button>
              ) : null}
            </div>
          </div>

          {error ? (
            <p role="alert" style={{ ...styles.reportEmpty, color: 'var(--c4w-color-danger, #b91c1c)' }}>
              {error}
            </p>
          ) : null}

          <p role="status" style={styles.reportEmpty}>
            {statusLine(data)}
          </p>
          <pre ref={logRef} style={consoleStyles.terminal} aria-label="Batch test output" tabIndex={0}>
            {data?.log.length ? data.log.join('\n') : 'Output appears here when a batch test runs.'}
          </pre>
        </>
      )}
    </article>
  );
}

function statusLine(data?: BatchTestState): string {
  if (!data || data.status === 'idle') return 'No batch test has run since the server started.';
  if (data.status === 'running') {
    return `Running since ${new Date(data.startedAt ?? Date.now()).toLocaleTimeString()}…`;
  }
  if (data.status === 'stopped') return 'Stopped. The output so far is kept below.';
  if (data.exitCode === 0) return 'Finished: every summary passed the hard checks.';
  if (data.exitCode === 1 && data.reportAvailable) {
    return 'Finished: some summaries failed a check. See the output or download the report.';
  }
  return 'The batch test did not complete. See the output below.';
}

const consoleStyles = {
  options: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: '12px 16px',
  },
  fieldset: {
    display: 'flex',
    gap: '12px',
    border: 0,
    margin: 0,
    padding: 0,
  },
  legend: {
    display: 'block',
    marginBottom: '4px',
    padding: 0,
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--c4w-color-text-muted, #64748b)',
  },
  check: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--c4w-color-text-secondary, #475569)',
  },
  field: { display: 'flex', flexDirection: 'column' },
  actions: { display: 'flex', gap: '8px', marginLeft: 'auto' },
  // Stays dark in both themes so it reads as a terminal.
  terminal: {
    margin: 0,
    minHeight: '160px',
    maxHeight: '340px',
    overflow: 'auto',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace',
    fontSize: '11.5px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
} satisfies Record<string, CSSProperties>;

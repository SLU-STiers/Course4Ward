import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

/** `fine_tuned_rag`: the fine-tuned model given RAG references (test-only; production sends it none). */
export const BATCH_TEST_VARIANTS = ['standard', 'fine_tuned', 'fine_tuned_rag'] as const;
export type BatchTestVariant = (typeof BATCH_TEST_VARIANTS)[number];

export interface BatchTestOptions {
  variants: BatchTestVariant[];
  /** First N order groups; all of them when omitted. */
  limit?: number;
  /** Only the admissions held out from fine-tuning. */
  evalOnly: boolean;
}

export type BatchTestStatus = 'idle' | 'running' | 'finished' | 'stopped';

/** Keep the console bounded: a full run prints ~100 lines, a runaway one could print forever. */
const MAX_LOG_LINES = 2000;

/**
 * Runs `fine_tuning_data/batch_test.py` for the admin "Batch test" console.
 *
 * Deliberately not a shell: the only thing that can run is that one script,
 * spawned without a shell and with an argument list built from validated
 * options, so nothing an admin types reaches a command line.
 *
 * ponytail: one run at a time, state in memory. A backend restart forgets the
 * log (the report files stay in the temp dir), and with several backend
 * instances each would hold its own run — fine for a single-server deployment.
 */
@Injectable()
export class BatchTestService {
  private readonly logger = new Logger(BatchTestService.name);
  private readonly script: string;
  private readonly python: string;
  private readonly aiServiceUrl: string;
  private readonly outDir = join(tmpdir(), 'course4ward-batch-test');

  private child: ChildProcess | null = null;
  private status: BatchTestStatus = 'idle';
  private log: string[] = [];
  private partial = '';
  private options: BatchTestOptions | null = null;
  private startedAt: Date | null = null;
  private finishedAt: Date | null = null;
  private exitCode: number | null = null;

  constructor(config: ConfigService) {
    // The backend runs from backend/, so the script sits one level up.
    this.script =
      config.get<string>('BATCH_TEST_SCRIPT') ??
      resolve(process.cwd(), '..', 'fine_tuning_data', 'batch_test.py');
    this.python =
      config.get<string>('BATCH_TEST_PYTHON') ?? (process.platform === 'win32' ? 'python' : 'python3');
    this.aiServiceUrl = config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8000';
  }

  private get reportPdf() {
    return join(this.outDir, 'batch_report.pdf');
  }

  private get reportHtml() {
    return join(this.outDir, 'batch_report.html');
  }

  /** Per-variant statistics the script writes next to its CSV (`<out>.json`). */
  private get statsFile() {
    return join(this.outDir, 'batch_results.json');
  }

  /** The last finished run's statistics; it outlives a backend restart, like the report. */
  private readStats(): unknown {
    if (this.status === 'running' || !existsSync(this.statsFile)) return null;
    try {
      return JSON.parse(readFileSync(this.statsFile, 'utf8'));
    } catch (error) {
      this.logger.warn(`Unreadable batch test stats: ${(error as Error).message}`);
      return null;
    }
  }

  state() {
    return {
      /** False when the script is not deployed next to the backend (e.g. in Docker). */
      available: existsSync(this.script),
      status: this.status,
      options: this.options,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      exitCode: this.exitCode,
      log: this.partial ? [...this.log, this.partial] : this.log,
      reportAvailable:
        this.status !== 'running' && (existsSync(this.reportPdf) || existsSync(this.reportHtml)),
      stats: this.readStats(),
    };
  }

  start(options: BatchTestOptions) {
    if (this.status === 'running') {
      throw new ConflictException('A batch test is already running.');
    }
    if (!existsSync(this.script)) {
      throw new NotFoundException(`Batch test script not found at ${this.script}.`);
    }
    mkdirSync(this.outDir, { recursive: true });
    // A run that dies before writing its report must not serve the previous one.
    for (const file of [this.reportPdf, this.reportHtml, this.statsFile]) rmSync(file, { force: true });

    const args = [
      this.script,
      '--url', this.aiServiceUrl,
      '--variant', ...options.variants,
      '--out', join(this.outDir, 'batch_results.csv'),
      '--report', this.reportHtml,
      ...(options.limit ? ['--limit', String(options.limit)] : []),
      ...(options.evalOnly ? ['--eval-only'] : []),
    ];

    this.status = 'running';
    this.log = [`$ batch_test.py ${args.slice(1).join(' ')}`, ''];
    this.partial = '';
    this.options = options;
    this.startedAt = new Date();
    this.finishedAt = null;
    this.exitCode = null;

    const child = spawn(this.python, args, {
      cwd: resolve(this.script, '..', '..'),
      // Unbuffered so lines reach the console as they happen, UTF-8 so
      // summaries with odd characters can't crash a cp1252 console.
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
      windowsHide: true,
    });
    this.child = child;

    child.stdout?.on('data', (chunk: Buffer) => this.append(chunk));
    child.stderr?.on('data', (chunk: Buffer) => this.append(chunk));
    child.on('error', (error) => {
      // e.g. ENOENT: python is not on PATH.
      this.append(Buffer.from(`\nCould not start ${this.python}: ${error.message}\n`));
      this.finish(null);
    });
    child.on('close', (code) => this.finish(code));

    this.logger.log(`Batch test started: ${args.slice(1).join(' ')}`);
    return this.state();
  }

  stop() {
    if (this.status !== 'running' || !this.child) {
      throw new ConflictException('No batch test is running.');
    }
    this.status = 'stopped';
    this.child.kill();
    this.append(Buffer.from('\nStopped by admin.\n'));
    return this.state();
  }

  /** The finished report: the PDF when Edge/Chrome made one, else the HTML. */
  reportFile() {
    if (this.status === 'running') throw new ConflictException('The batch test is still running.');
    if (existsSync(this.reportPdf)) return { path: this.reportPdf, type: 'application/pdf', ext: 'pdf' };
    if (existsSync(this.reportHtml)) return { path: this.reportHtml, type: 'text/html', ext: 'html' };
    throw new NotFoundException('No batch test report yet. Run a batch test first.');
  }

  private append(chunk: Buffer) {
    const lines = (this.partial + chunk.toString('utf8')).replace(/\r\n/g, '\n').split('\n');
    this.partial = lines.pop() ?? '';
    this.log.push(...lines);
    if (this.log.length > MAX_LOG_LINES) {
      this.log = ['… earlier output trimmed …', ...this.log.slice(-MAX_LOG_LINES)];
    }
  }

  private finish(code: number | null) {
    if (this.status === 'running') this.status = 'finished';
    if (this.partial) {
      this.log.push(this.partial);
      this.partial = '';
    }
    this.exitCode = code;
    this.finishedAt = new Date();
    this.child = null;
    this.logger.log(`Batch test ${this.status} (exit ${code ?? 'n/a'})`);
  }
}

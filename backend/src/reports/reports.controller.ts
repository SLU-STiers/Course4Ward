import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { BatchTestService } from './batch-test.service';
import { ActivityTrendQueryDto, ReportRangeDto } from './dto/report-range.dto';
import { StartBatchTestDto } from './dto/batch-test.dto';
import { RunMissedSummaryDto } from './dto/missed-summaries.dto';
import { CourseInWardService } from '../course-in-ward/course-in-ward.service';

/**
 * Admin reporting. Read-only aggregates over the clinical tables plus the
 * audit log — the "important analytics" half of the admin requirement.
 */
@ApiTags('admin-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/reports')
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
    private batchTest: BatchTestService,
    private courseInWard: CourseInWardService,
  ) {}

  /** Current distributions + flow counts for the selected window. */
  @Get('summary')
  summary(@Query() query: ReportRangeDto) {
    return this.reportsService.summary({
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  /** AI summarization / embedding timings, RAG usage and embedding coverage. */
  @Get('ai')
  ai(@Query() query: ReportRangeDto) {
    return this.reportsService.aiStats({
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  /** Past patient-days the nightly batch missed (no summary, finished orders unlinked). */
  @Get('missed-summaries')
  missedSummaries() {
    return this.courseInWard.missedNightlyDays();
  }

  /** Runs the nightly batch now for a missed day (or one patient of it); waits for the LLM. */
  @Post('missed-summaries/run')
  @HttpCode(200)
  runMissedSummary(@Body() dto: RunMissedSummaryDto) {
    return this.courseInWard.runBatchSummaries(dto.day, dto.patientId);
  }

  /** The batch-test console: current run status and its live output. */
  @Get('batch-test')
  batchTestState() {
    return this.batchTest.state();
  }

  /** Starts `fine_tuning_data/batch_test.py` against the AI service (409 while one runs). */
  @Post('batch-test')
  startBatchTest(@Body() dto: StartBatchTestDto) {
    return this.batchTest.start({
      variants: [...new Set(dto.variants ?? (['standard'] as const))],
      limit: dto.limit,
      evalOnly: dto.evalOnly ?? false,
    });
  }

  @Post('batch-test/stop')
  @HttpCode(200)
  stopBatchTest() {
    return this.batchTest.stop();
  }

  /** The last run's printable report (PDF, or HTML when no browser was found to print it). */
  @Get('batch-test/report')
  batchTestReport() {
    const file = this.batchTest.reportFile();
    const date = new Date().toISOString().slice(0, 10);
    return new StreamableFile(createReadStream(file.path), {
      type: file.type,
      disposition: `attachment; filename="batch-test-report-${date}.${file.ext}"`,
    });
  }

  /** Activity (and order) volume per day/week/month, zero-filled. */
  @Get('activity-trend')
  activityTrend(@Query() query: ActivityTrendQueryDto) {
    return this.reportsService.activityTrend({
      bucket: query.bucket,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }
}

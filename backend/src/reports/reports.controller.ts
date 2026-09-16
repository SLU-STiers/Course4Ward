import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ActivityTrendQueryDto, ReportRangeDto } from './dto/report-range.dto';

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
  constructor(private reportsService: ReportsService) {}

  /** Current distributions + flow counts for the selected window. */
  @Get('summary')
  summary(@Query() query: ReportRangeDto) {
    return this.reportsService.summary({
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
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

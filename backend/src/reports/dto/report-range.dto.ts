import { IsISO8601, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TREND_BUCKETS, type TrendBucket } from '../reports.service';

/**
 * Reporting window. Both bounds accept either a date-only value
 * (`2026-09-16`), which is read as that whole UTC day, or a full ISO-8601
 * instant. Omitting them reports the last 30 days.
 */
export class ReportRangeDto {
  @ApiPropertyOptional({ example: '2026-08-18', description: 'Inclusive lower bound.' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-16', description: 'Inclusive upper bound.' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class ActivityTrendQueryDto extends ReportRangeDto {
  @ApiPropertyOptional({ enum: TREND_BUCKETS, default: 'day' })
  @IsOptional()
  @IsIn(TREND_BUCKETS)
  bucket: TrendBucket = 'day';
}

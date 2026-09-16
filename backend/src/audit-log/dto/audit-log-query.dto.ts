import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActionType, Role } from '@prisma/client';
import {
  AGGREGATE_DIMENSIONS,
  AUDIT_LOG_BUCKETS,
  type AuditLogBucket,
  type AggregateDimension,
} from '../audit-log.service';

/**
 * Query contract for the admin Activity Logs table.
 *
 * The global `ValidationPipe` runs with `whitelist` + `forbidNonWhitelisted`,
 * so every accepted query parameter has to be declared here — and anything
 * else is rejected with a 400 instead of reaching Prisma.
 */
export class AuditLogQueryDto {
  @ApiPropertyOptional({ description: 'Rows to skip (offset).', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({
    description: 'Rows per page.',
    minimum: 1,
    maximum: 200,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;

  @ApiPropertyOptional({ enum: ActionType, description: 'Exact action to filter by.' })
  @IsOptional()
  @IsEnum(ActionType)
  action?: ActionType;

  @ApiPropertyOptional({ enum: Role, description: 'Filter by the actor role.' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: "Actor's login id, e.g. `DOC001`." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  userId?: string;

  @ApiPropertyOptional({
    description: 'Inclusive lower bound on the log timestamp (ISO-8601).',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound on the log timestamp (ISO-8601).',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description:
      'Free text matched against the actor name/login id and the action name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

/** Orders-per-period analytics query. */
export class OrdersOverTimeQueryDto {
  @ApiPropertyOptional({ enum: AUDIT_LOG_BUCKETS, default: 'day' })
  @IsOptional()
  @IsIn(AUDIT_LOG_BUCKETS)
  bucket: AuditLogBucket = 'day';
}

/**
 * Activity Logs graph query: the same filters as {@link AuditLogQueryDto} plus
 * the aggregation dimension. `skip`/`take` are accepted but ignored — the graph
 * always covers the whole filtered set.
 */
export class AuditLogAggregateQueryDto extends AuditLogQueryDto {
  @ApiPropertyOptional({
    enum: AGGREGATE_DIMENSIONS,
    default: 'day',
    description: '`day` = activity per UTC day, `action` = by action, `actor` = by user.',
  })
  @IsOptional()
  @IsIn(AGGREGATE_DIMENSIONS)
  by: AggregateDimension = 'day';
}

import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ResetStatus } from '@prisma/client';

export const RESET_REQUEST_SORT_FIELDS = ['date', 'name'] as const;
export type ResetRequestSortField = (typeof RESET_REQUEST_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/**
 * Query contract for the admin Password Reset Requests table.
 *
 * Every accepted parameter has to be declared here: the global
 * `ValidationPipe` rejects anything else with a 400.
 */
export class PasswordResetQueryDto {
  @ApiPropertyOptional({ description: 'Rows to skip (offset).', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({ description: 'Rows per page.', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @ApiPropertyOptional({ enum: ResetStatus })
  @IsOptional()
  @IsEnum(ResetStatus)
  status?: ResetStatus;

  @ApiPropertyOptional({
    description: "Free text matched against the user's name and login id, the requester IP and the request id.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: RESET_REQUEST_SORT_FIELDS, default: 'date' })
  @IsOptional()
  @IsIn(RESET_REQUEST_SORT_FIELDS)
  sort?: ResetRequestSortField;

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  direction?: SortDirection;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BATCH_TEST_VARIANTS, type BatchTestVariant } from '../batch-test.service';

/** Options for one admin batch-test run; every field becomes a fixed script argument. */
export class StartBatchTestDto {
  @ApiPropertyOptional({ enum: BATCH_TEST_VARIANTS, isArray: true, default: ['standard'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(BATCH_TEST_VARIANTS, { each: true })
  variants?: BatchTestVariant[];

  @ApiPropertyOptional({ description: 'Only the first N order groups (all when omitted).', example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiPropertyOptional({ description: 'Only the admissions held out from fine-tuning.', default: false })
  @IsOptional()
  @IsBoolean()
  evalOnly?: boolean;
}

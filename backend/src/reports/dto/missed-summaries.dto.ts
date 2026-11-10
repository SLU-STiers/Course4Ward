import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

/** A missed day to summarize now: every patient that day, or just `patientId`. */
export class RunMissedSummaryDto {
  @ApiProperty({ example: '2026-11-09', description: 'Server-local day, YYYY-MM-DD.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  patientId?: string;
}

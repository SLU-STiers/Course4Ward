import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePatientDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'ISO date of birth (preferred over age)' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Approximate age in years; used when dateOfBirth is omitted' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(130)
  age?: number;

  @ApiPropertyOptional({ description: 'ISO admission datetime; defaults to now' })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional({
    description: 'ADMITTED = inpatient ward; ER_OUTPATIENT = ER / not fully admitted',
    enum: ['ADMITTED', 'ER_OUTPATIENT'],
  })
  @IsOptional()
  @IsIn(['ADMITTED', 'ER_OUTPATIENT'])
  admissionStatus?: 'ADMITTED' | 'ER_OUTPATIENT';

  @ApiProperty({ description: 'Attending physician user id (UUID)' })
  @IsUUID()
  physicianId: string;

  @ApiPropertyOptional({
    description: 'Consulting physicians on the admission (UUIDs)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  additionalPhysicianIds?: string[];

  @ApiPropertyOptional({ description: 'Legacy flag; preferred: admissionStatus' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isOutpatient?: boolean;

  @ApiPropertyOptional({ description: 'Triage / clinical notes stored as initialAssessment' })
  @IsOptional()
  @IsString()
  initialAssessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  triageTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  heartRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  respRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  spo2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  temp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddConsultingPhysicianDto {
  @ApiProperty({ description: 'Physician user id (UUID) to add as a consultant' })
  @IsUUID()
  physicianId: string;
}

export class UpdatePatientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

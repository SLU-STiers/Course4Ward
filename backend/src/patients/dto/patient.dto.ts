import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
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

  @ApiPropertyOptional({ description: 'Clinical notes stored as initialAssessment (legacy alias of notes)' })
  @IsOptional()
  @IsString()
  initialAssessment?: string;

  @ApiPropertyOptional({ description: 'Triage time, 24h HH:mm', example: '08:30' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Triage time must be in HH:mm format' })
  triageTime?: string;

  @ApiPropertyOptional({ description: 'Heart rate (bpm)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Heart rate must be a whole number' })
  @Min(20, { message: 'Heart rate must be at least 20 bpm' })
  @Max(300, { message: 'Heart rate must be at most 300 bpm' })
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Respiratory rate (breaths/min)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Respiratory rate must be a whole number' })
  @Min(1, { message: 'Respiratory rate must be at least 1 /min' })
  @Max(80, { message: 'Respiratory rate must be at most 80 /min' })
  respRate?: number;

  @ApiPropertyOptional({ description: 'Oxygen saturation (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'SpO2 must be a whole number' })
  @Min(50, { message: 'SpO2 must be at least 50%' })
  @Max(100, { message: 'SpO2 must be at most 100%' })
  spo2?: number;

  @ApiPropertyOptional({ description: 'Blood pressure as systolic/diastolic', example: '120/80' })
  @IsOptional()
  @Matches(/^\d{2,3}\/\d{2,3}$/, { message: 'Blood pressure must look like 120/80' })
  bp?: string;

  @ApiPropertyOptional({ description: 'Body temperature (°C)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'Temperature must be a number with at most 1 decimal' })
  @Min(30, { message: 'Temperature must be at least 30 °C' })
  @Max(45, { message: 'Temperature must be at most 45 °C' })
  temp?: number;

  @ApiPropertyOptional({ description: 'Pain score 0–10' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Pain score must be a whole number' })
  @Min(0, { message: 'Pain score must be between 0 and 10' })
  @Max(10, { message: 'Pain score must be between 0 and 10' })
  pain?: number;

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

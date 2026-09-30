import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  MaxLength,
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
import { Transform, Type } from 'class-transformer';
import { CommunicationChannel, PatientClass, Sex } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePatientDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  lastName: string;

  // Required and never defaulted: the nurse has to pick it.
  @ApiProperty({ enum: Sex })
  @IsEnum(Sex, { message: 'Sex must be one of MALE, FEMALE, OTHER' })
  gender: Sex;

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

  // Kind of encounter the patient is registered as. EMERGENCY and OUTPATIENT
  // need no order. OBSERVATION and INPATIENT (direct admission, trauma,
  // scheduled surgery) are physician decisions, so they need
  // `registrationOrder`: the observation / admission order the nurse enters
  // on the attending physician's behalf.
  @ApiPropertyOptional({ enum: PatientClass, default: PatientClass.EMERGENCY })
  @IsOptional()
  @IsEnum(PatientClass)
  patientClass?: PatientClass;

  @ApiPropertyOptional({
    description: 'Observation / admission order text; required for OBSERVATION and INPATIENT',
    example: 'Admit to Medical Ward under Dr. Santos. CBC, CXR PA.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'The order must not be empty' })
  @MaxLength(2000)
  registrationOrder?: string;

  // How the physician gave the order; omit for a written/signed order.
  @ApiPropertyOptional({ enum: CommunicationChannel })
  @IsOptional()
  @IsEnum(CommunicationChannel)
  registrationOrderChannel?: CommunicationChannel;

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

  @ApiPropertyOptional({ description: 'Clinical notes stored as initialAssessment (legacy alias of notes)' })
  @IsOptional()
  @IsString()
  initialAssessment?: string;

  @ApiPropertyOptional({
    description: 'Triage level: 1 Resuscitation, 2 Emergent, 3 Urgent, 4 Less Urgent, 5 Non-Urgent',
    minimum: 1,
    maximum: 5,
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Triage level must be a whole number' })
  @Min(1, { message: 'Triage level must be between 1 and 5' })
  @Max(5, { message: 'Triage level must be between 1 and 5' })
  triageLevel?: number;

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
  @ApiPropertyOptional({ enum: Sex })
  @IsOptional()
  @IsEnum(Sex, { message: 'Sex must be one of MALE, FEMALE, OTHER' })
  gender?: Sex;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

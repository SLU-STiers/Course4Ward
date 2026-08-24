import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  gender: string;

  @ApiProperty()
  @IsDateString()
  dateOfBirth: string;

  @ApiPropertyOptional({ description: "Nurse's initial assessment notes" })
  @IsOptional()
  @IsString()
  initialAssessment?: string;
}

export class UpdatePatientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  initialAssessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dischargeDate?: string;
}

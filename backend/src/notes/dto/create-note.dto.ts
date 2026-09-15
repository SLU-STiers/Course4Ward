import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Optional reminder date/time' })
  @IsOptional()
  @IsDateString()
  reminderAt?: string;
}

export class UpdateNoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Optional reminder date/time' })
  @IsOptional()
  @IsDateString()
  reminderAt?: string | null;
}

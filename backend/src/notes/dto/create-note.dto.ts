import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Whether the physician has checked this note off' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

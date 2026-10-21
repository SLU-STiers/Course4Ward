import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ description: 'Temporary password; user resets on first login' })
  @IsString()
  @MinLength(8)
  temporaryPassword: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Physicians and nurses: assigned wards (replaces the current set on update)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wardIds?: string[];
}

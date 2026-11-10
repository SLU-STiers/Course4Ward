import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { NAME_PATTERN } from '../../patients/dto/patient.dto';
import { IsStrongPassword } from '../../auth/password-policy';

/** Longest first / last name accepted for a staff account. */
export const MAX_NAME_LENGTH = 50;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateUserDto {
  @ApiProperty({ maxLength: MAX_NAME_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(MAX_NAME_LENGTH)
  @Matches(NAME_PATTERN, {
    message: 'First name may contain letters, spaces, hyphens, apostrophes, and periods only',
  })
  firstName: string;

  @ApiProperty({ maxLength: MAX_NAME_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MaxLength(MAX_NAME_LENGTH)
  @Matches(NAME_PATTERN, {
    message: 'Last name may contain letters, spaces, hyphens, apostrophes, and periods only',
  })
  lastName: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ description: 'Temporary password; user resets on first login' })
  @IsString()
  @IsStrongPassword()
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

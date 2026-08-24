import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'DRJ-0231' })
  @IsString()
  userId: string;
}

// In a real hospital deployment this would be triggered by an admin-issued
// one-time code (e.g. via IT desk) rather than email, since LAN-only staff
// accounts often have no external email tied to them. The `resetToken` here
// stands in for that mechanism -- see docs/architecture.md.
export class ConfirmPasswordResetDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  resetToken: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

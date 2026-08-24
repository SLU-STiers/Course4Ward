import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'DRJ-0231' })
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;
}

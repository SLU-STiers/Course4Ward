import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  admissionId: string;

  // Required when a nurse enters an order on the physician's behalf --
  // the physician of record must still be attributed for the order.
  // Physicians may omit it; the order is then attributed to themselves.
  @ApiPropertyOptional({ description: 'The physician this order is attributed to' })
  @IsOptional()
  @IsUUID()
  orderedById?: string;

  @ApiProperty({ example: 'Paracetamol 500mg' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Order content must not be empty' })
  @MaxLength(2000)
  orderContent: string;
}

export class UpdateOrderDto {
  @ApiProperty({ example: 'Paracetamol 500mg' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Order content must not be empty' })
  @MaxLength(2000)
  orderContent: string;
}

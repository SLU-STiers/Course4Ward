<<<<<<< HEAD
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
=======
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
>>>>>>> 3aa45644467aafd36189ebd1e7677a214f194cd0

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

<<<<<<< HEAD
export class UpdateOrderDto {
  @ApiProperty({ example: 'Paracetamol 500mg' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Order content must not be empty' })
  @MaxLength(2000)
  orderContent: string;
=======
export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.FINISHED })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  // Omit to keep the current comment; send '' to clear it.
  @ApiPropertyOptional({ example: 'Given at 08:00, patient tolerated well' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nurseComment?: string;
>>>>>>> 3aa45644467aafd36189ebd1e7677a214f194cd0
}

import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  admissionId: string;

  // Required when a nurse enters an order on the physician's behalf --
  // the physician of record must still be attributed for the order.
  @ApiProperty({ description: 'The physician this order is attributed to' })
  @IsUUID()
  orderedById: string;

  @ApiProperty({ example: 'Paracetamol 500mg' })
  @IsString()
  orderContent: string;
}

export class UpdateOrderDto {
  @ApiProperty({ example: 'Paracetamol 500mg' })
  @IsString()
  orderContent: string;
}

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
}

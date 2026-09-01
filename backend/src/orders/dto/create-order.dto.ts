import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  // Required when a nurse enters an order on the physician's behalf --
  // the physician of record must still be attributed for the order.
  @ApiProperty({ description: 'The physician this order is attributed to' })
  @IsUUID()
  orderingPhysicianId: string;

  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({ example: 'Paracetamol 500mg' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'every 8 hours' })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({ example: '500mg' })
  @IsOptional()
  @IsString()
  dosage?: string;
}

import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

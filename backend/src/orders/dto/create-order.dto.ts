import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CommunicationChannel, OrderStatus, OrderType } from '@prisma/client';

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

  // OBSERVATION / ADMISSION / DISCHARGE: one-off decisions the nurse carries
  // out (observe, admit, discharge); which are allowed depends on the
  // admission's patient class. DEFAULT: every other (general / progress) order.
  @ApiPropertyOptional({ enum: OrderType, default: OrderType.DEFAULT })
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  // How the order reached the ward when a nurse relays it (SMS, email, verbal,
  // ...). Physicians writing their own orders leave it unset.
  @ApiPropertyOptional({ enum: CommunicationChannel })
  @IsOptional()
  @IsEnum(CommunicationChannel)
  communicationChannel?: CommunicationChannel;
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

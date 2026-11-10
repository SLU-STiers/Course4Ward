import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CommunicationChannel, OrderStatus, OrderType } from '@prisma/client';
import { normalizeRoom } from '../../patients/dto/patient.dto';

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

  // DISCHARGE: a one-off decision the nurse carries out. TRANSFER: move an
  // inpatient to `transferRoomNumber` once the nurse finishes it. DEFAULT: every other
  // (general / progress) order. OBSERVATION / ADMISSION orders are retired:
  // older ones still show, but no new ones can be written.
  @ApiPropertyOptional({ enum: [OrderType.DEFAULT, OrderType.DISCHARGE, OrderType.TRANSFER], default: OrderType.DEFAULT })
  @IsOptional()
  @IsIn([OrderType.DEFAULT, OrderType.DISCHARGE, OrderType.TRANSFER], {
    message: 'Order type must be a general, discharge or transfer order',
  })
  type?: OrderType;

  // Nurse orders on a physician's behalf: how the physician gave it. Omit for
  // a written / signed order. Kept out of `orderContent`, which feeds the AI summary.
  @ApiPropertyOptional({ enum: CommunicationChannel })
  @IsOptional()
  @IsEnum(CommunicationChannel)
  communicationChannel?: CommunicationChannel;

  // TRANSFER only (required there): the free room the patient moves to. The
  // room is reserved until the nurse finishes the order.
  @ApiPropertyOptional({ description: 'Destination room of a TRANSFER order', example: '305' })
  @IsOptional()
  @Transform(normalizeRoom)
  @IsString()
  @IsNotEmpty({ message: 'The room number must not be empty' })
  @MaxLength(20)
  transferRoomNumber?: string;
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

import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateSummaryDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;
}

export class EditSummaryDto {
  @ApiProperty({ description: "Physician's manually edited summary text" })
  @IsString()
  editedText: string;
}

import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateSummaryDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({
    required: false,
    description:
      "Order day to summarize as `YYYY-MM-DD`. Defaults to today; a Course in the Ward is generated per order day.",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'day must be a YYYY-MM-DD date' })
  day?: string;
}

export class EditSummaryDto {
  @ApiProperty({ description: "Physician's manually edited summary text" })
  @IsString()
  editedText: string;
}

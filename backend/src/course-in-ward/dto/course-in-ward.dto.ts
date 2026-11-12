import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SummaryModel } from '../ollama-client';

const SUMMARY_MODELS: SummaryModel[] = ['standard', 'fine_tuned', 'fine_tuned_rag'];
const MODEL_DESCRIPTION =
  'Which AI writes the summary: `standard` (base model + RAG references, the default), ' +
  '`fine_tuned`, or `fine_tuned_rag` (fine-tuned model + RAG references).';

/**
 * Formats how the summary is written, never what it says; see
 * `assertFormattingOnlyInstructions` for what the API rejects.
 */
const INSTRUCTIONS_DESCRIPTION =
  'Optional FORMATTING instructions for the AI, e.g. "mention the IV fluids first". ' +
  'They may change wording, order, grouping and length only: an instruction that asks ' +
  'for clinical content the orders do not contain (a new order, medication, dose, ' +
  'diagnosis or result) is rejected with a 400.';

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

  @ApiProperty({ required: false, description: INSTRUCTIONS_DESCRIPTION })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @ApiProperty({ required: false, enum: SUMMARY_MODELS, description: MODEL_DESCRIPTION })
  @IsOptional()
  @IsIn(SUMMARY_MODELS)
  model?: SummaryModel;
}

export class EditSummaryDto {
  @ApiProperty({ description: "Physician's manually edited summary text" })
  @IsString()
  editedText: string;
}

export class RegenerateSummaryDto {
  @ApiProperty({ required: false, description: INSTRUCTIONS_DESCRIPTION })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @ApiProperty({ required: false, enum: SUMMARY_MODELS, description: MODEL_DESCRIPTION })
  @IsOptional()
  @IsIn(SUMMARY_MODELS)
  model?: SummaryModel;
}

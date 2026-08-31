import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AssignSettingsDto {
  @ApiPropertyOptional() @IsString() @IsOptional() intro?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() allowSubmissionsFrom?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueDate?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() cutOffDate?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() gradingDueDate?: string;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() maxGrade?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() gradePass?: number;

  @ApiPropertyOptional({ type: [String], enum: ['online', 'file', 'url'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  submissionTypes?: ('online' | 'file' | 'url')[];

  @ApiPropertyOptional() @IsInt() @Min(1) @IsOptional() maxFiles?: number;
  @ApiPropertyOptional() @IsInt() @IsOptional() maxFileSize?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedFileTypes?: string[];

  @ApiPropertyOptional() @IsBoolean() @IsOptional() blindMarking?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() teamSubmission?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() requireSubmissionStatement?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() submissionStatement?: string;

  @ApiPropertyOptional({ enum: ['none', 'manual', 'untilpass'] })
  @IsEnum(['none', 'manual', 'untilpass'])
  @IsOptional()
  attemptReopenMethod?: 'none' | 'manual' | 'untilpass';

  @ApiPropertyOptional() @IsInt() @Min(1) @IsOptional() maxAttempts?: number;

  @ApiPropertyOptional({ enum: ['allow', 'block', 'penalise'] })
  @IsEnum(['allow', 'block', 'penalise'])
  @IsOptional()
  latePolicy?: 'allow' | 'block' | 'penalise';

  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() latePenaltyPercentPerDay?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() notifyGraders?: boolean;
  @ApiPropertyOptional() @IsObject() @IsOptional() rubric?: Record<string, unknown>;
}

export class SubmitAssignmentDto {
  @ApiPropertyOptional() @IsString() @IsOptional() onlineText?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() url?: string;

  @ApiPropertyOptional({ type: [String], description: 'Identificadores de ficheros ya subidos' })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  fileIds?: string[];

  @ApiPropertyOptional({ description: 'Guardar como borrador sin enviar' })
  @IsBoolean()
  @IsOptional()
  draft?: boolean;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() acceptStatement?: boolean;
}

export class GradeSubmissionDto {
  @ApiProperty() @IsNumber() grade!: number;
  @ApiPropertyOptional() @IsString() @IsOptional() feedbackText?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  feedbackFileIds?: string[];

  @ApiPropertyOptional() @IsObject() @IsOptional() rubricGrades?: Record<string, unknown>;
}

export class GrantExtensionDto {
  @ApiProperty() @IsDateString() extensionDueDate!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  userIds!: string[];
}

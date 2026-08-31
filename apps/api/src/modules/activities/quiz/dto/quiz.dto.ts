import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { QuizGradeMethod } from '@maya/shared';

export class QuizSettingsDto {
  @ApiPropertyOptional() @IsString() @IsOptional() intro?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() timeOpen?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() timeClose?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() timeLimitSeconds?: number;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() attemptsAllowed?: number;

  @ApiPropertyOptional({ enum: QuizGradeMethod })
  @IsEnum(QuizGradeMethod)
  @IsOptional()
  gradeMethod?: QuizGradeMethod;

  @ApiPropertyOptional() @IsNumber() @IsOptional() maxGrade?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() passingGrade?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() shuffleQuestions?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() shuffleAnswers?: boolean;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() questionsPerPage?: number;

  @ApiPropertyOptional({ enum: ['free', 'sequential'] })
  @IsEnum(['free', 'sequential'])
  @IsOptional()
  navMethod?: 'free' | 'sequential';

  @ApiPropertyOptional() @IsBoolean() @IsOptional() reviewAfterClose?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() showCorrectAnswers?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() requirePassword?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() password?: string;
}

export class AddQuizQuestionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  questionIds!: string[];

  @ApiPropertyOptional() @IsNumber() @IsOptional() maxMark?: number;
}

export class SaveResponseDto {
  @ApiProperty() @IsMongoId() questionId!: string;
  @ApiPropertyOptional() answer?: unknown;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() flagged?: boolean;
}

export class ManualGradeDto {
  @ApiProperty() @IsMongoId() questionId!: string;
  @ApiProperty() @IsNumber() mark!: number;
  @ApiPropertyOptional() @IsString() @IsOptional() feedback?: string;
}

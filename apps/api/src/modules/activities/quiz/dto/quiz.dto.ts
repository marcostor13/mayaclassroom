import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
  ValidateNested,
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

  @ApiPropertyOptional({ description: 'Hay que aprobarlo para superar el módulo' })
  @IsBoolean()
  @IsOptional()
  requiredToPass?: boolean;

  @ApiPropertyOptional({ description: 'Suspenderlo bloquea el resto del curso' })
  @IsBoolean()
  @IsOptional()
  blocksProgress?: boolean;
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

/** Una pregunta calificada dentro de una corrección en lote. */
export class GradedResponseDto {
  @ApiProperty() @IsMongoId() attemptId!: string;
  @ApiProperty() @IsMongoId() questionId!: string;
  @ApiProperty() @IsNumber() mark!: number;
  @ApiPropertyOptional() @IsString() @IsOptional() feedback?: string;
}

/**
 * Corrección de varias respuestas de una vez.
 *
 * Corregir de una en una obliga a una petición por respuesta y deja el examen
 * a medio calificar si algo falla por el camino; quien corrige treinta ensayos
 * seguidos necesita guardar la tanda entera.
 */
export class BulkGradeDto {
  @ApiProperty({ type: [GradedResponseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradedResponseDto)
  grades!: GradedResponseDto[];
}

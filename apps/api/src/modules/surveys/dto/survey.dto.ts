import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SurveyQuestionType, SurveyTrigger } from '@maya/shared';

export class SurveyQuestionDto {
  @ApiProperty({ enum: SurveyQuestionType })
  @IsEnum(SurveyQuestionType)
  type!: SurveyQuestionType;

  @ApiProperty() @IsString() @MinLength(1) text!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() help?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() required?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  @ApiPropertyOptional({ description: 'Tope de la escala: 5 o 10 son lo habitual' })
  @IsInt()
  @Min(2)
  @Max(10)
  @IsOptional()
  scaleMax?: number;

  @ApiPropertyOptional() @IsString() @IsOptional() scaleMinLabel?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() scaleMaxLabel?: string;
}

export class CreateSurveyDto {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;

  @ApiPropertyOptional({ enum: SurveyTrigger })
  @IsEnum(SurveyTrigger)
  @IsOptional()
  trigger?: SurveyTrigger;

  @ApiPropertyOptional({ description: 'Las respuestas no guardan autor' })
  @IsBoolean()
  @IsOptional()
  anonymous?: boolean;

  @ApiPropertyOptional({ type: [SurveyQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  @IsOptional()
  questions?: SurveyQuestionDto[];

  @ApiPropertyOptional() @IsDateString() @IsOptional() opensAt?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() closesAt?: string;
}

export class UpdateSurveyDto extends PartialType(CreateSurveyDto) {}

/**
 * Respuestas de un alumno.
 *
 * Llegan como un objeto de identificador de pregunta a valor, sin validar el
 * contenido campo a campo: el servicio comprueba cada respuesta contra el tipo
 * de su pregunta, que es lo único que sabe si «4» vale para una escala de 1 a 5.
 */
export class SubmitSurveyDto {
  @ApiProperty({ description: 'Respuestas indexadas por identificador de pregunta' })
  answers!: Record<string, unknown>;
}

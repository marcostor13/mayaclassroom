import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { GradeAggregation, GradeType } from '@maya/shared';

export class CreateGradeItemDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;

  @ApiPropertyOptional({ enum: GradeType })
  @IsEnum(GradeType)
  @IsOptional()
  gradeType?: GradeType;

  @ApiPropertyOptional() @IsMongoId() @IsOptional() categoryId?: string;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() scaleId?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() grademax?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() grademin?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() gradepass?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() weight?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() hidden?: boolean;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() decimals?: number;
}

export class UpdateGradeItemDto extends PartialType(CreateGradeItemDto) {
  @ApiPropertyOptional() @IsBoolean() @IsOptional() locked?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() excludeFromTotal?: boolean;
  @ApiPropertyOptional() @IsInt() @IsOptional() sortOrder?: number;
}

export class CreateGradeCategoryDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() parentId?: string;

  @ApiPropertyOptional({ enum: GradeAggregation })
  @IsEnum(GradeAggregation)
  @IsOptional()
  aggregation?: GradeAggregation;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() aggregateOnlyGraded?: boolean;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() dropLowest?: number;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() keepHighest?: number;
}

export class UpdateGradeCategoryDto extends PartialType(CreateGradeCategoryDto) {}

export class SetGradeDto {
  @ApiProperty() @IsMongoId() userId!: string;

  @ApiPropertyOptional({ description: 'Calificación; null para borrarla' })
  @IsNumber()
  @IsOptional()
  grade?: number | null;

  @ApiPropertyOptional() @IsString() @IsOptional() feedback?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() excluded?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() hidden?: boolean;
}

export class BulkSetGradesDto {
  @ApiProperty({ type: [SetGradeDto] })
  @IsArray()
  grades!: SetGradeDto[];
}

export class CreateScaleDto {
  @ApiProperty() @IsString() name!: string;

  @ApiProperty({ type: [String], example: ['Insuficiente', 'Suficiente', 'Bien', 'Notable', 'Sobresaliente'] })
  @IsArray()
  @IsString({ each: true })
  items!: string[];

  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() courseId?: string;
}

export class SetGradeLettersDto {
  @ApiProperty({ type: [Object], example: [{ letter: 'A', lowerBoundary: 90 }] })
  @IsArray()
  letters!: { letter: string; lowerBoundary: number }[];
}

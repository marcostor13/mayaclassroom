import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuestionType } from '@maya/shared';
import { PaginationQueryDto } from '../../../common/dto';

export class AnswerDto {
  @ApiProperty() @IsString() text!: string;
  @ApiProperty({ description: '1 = correcta, 0 = incorrecta' }) @IsNumber() fraction!: number;
  @ApiPropertyOptional() @IsString() @IsOptional() feedback?: string;
}

export class SubQuestionDto {
  @ApiProperty() @IsString() text!: string;
  @ApiProperty() @IsString() answer!: string;
}

export class CreateQuestionDto {
  @ApiProperty({ enum: QuestionType }) @IsEnum(QuestionType) type!: QuestionType;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty() @IsString() @MinLength(1) questionText!: string;

  @ApiProperty() @IsMongoId() categoryId!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() generalFeedback?: string;
  @ApiPropertyOptional() @IsNumber() @IsOptional() defaultMark?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() penalty?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() shuffleAnswers?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() single?: boolean;
  @ApiPropertyOptional() @IsNumber() @IsOptional() tolerance?: number;

  @ApiPropertyOptional({ type: [AnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  @IsOptional()
  answers?: AnswerDto[];

  @ApiPropertyOptional({ type: [SubQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubQuestionDto)
  @IsOptional()
  subquestions?: SubQuestionDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional() @IsMongoId() @IsOptional() courseId?: string;
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}

export class QuestionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsMongoId() @IsOptional() categoryId?: string;
  @ApiPropertyOptional({ enum: QuestionType }) @IsEnum(QuestionType) @IsOptional() type?: QuestionType;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() courseId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() tag?: string;
}

export class CreateQuestionCategoryDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() parentId?: string;
  @ApiProperty() @IsMongoId() contextId!: string;
}

export class ImportQuestionsDto {
  @ApiProperty({ enum: ['gift', 'json'] })
  @IsEnum(['gift', 'json'])
  format!: 'gift' | 'json';

  @ApiProperty() @IsString() content!: string;
  @ApiProperty() @IsMongoId() categoryId!: string;
}

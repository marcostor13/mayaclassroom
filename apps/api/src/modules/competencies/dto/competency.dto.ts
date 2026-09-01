import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { LearningPlanStatus } from '@maya/shared';

export class CreateFrameworkDto {
  @ApiProperty() @IsString() @MinLength(1) shortName!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() idNumber?: string;
}

export class CreateCompetencyDto {
  @ApiProperty() @IsMongoId() frameworkId!: string;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() parentId?: string;
  @ApiProperty() @IsString() @MinLength(1) shortName!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() idNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() ruleType?: string;
}

export class CreatePlanDto {
  @ApiProperty() @IsMongoId() userId!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueDate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  competencyIds?: string[];
}

export class UpdatePlanDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;

  @ApiPropertyOptional({ enum: LearningPlanStatus })
  @IsEnum(LearningPlanStatus)
  @IsOptional()
  status?: LearningPlanStatus;

  @ApiPropertyOptional() @IsDateString() @IsOptional() dueDate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  competencyIds?: string[];
}

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BadgeCriteriaType, BadgeStatus, BadgeType } from '@maya/shared';

export class BadgeCriterionDto {
  @ApiProperty({ enum: BadgeCriteriaType })
  @IsEnum(BadgeCriteriaType)
  type!: BadgeCriteriaType;

  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  moduleIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  courseIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  competencyIds?: string[];

  @ApiPropertyOptional() @IsNumber() @IsOptional() minGrade?: number;
}

export class CreateBadgeDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty() @IsString() @MinLength(1) description!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string;

  @ApiPropertyOptional({ enum: BadgeType })
  @IsEnum(BadgeType)
  @IsOptional()
  type?: BadgeType;

  @ApiPropertyOptional() @IsMongoId() @IsOptional() courseId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() issuerName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() issuerEmail?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() expiryDate?: string;

  @ApiPropertyOptional({ type: [BadgeCriterionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BadgeCriterionDto)
  @IsOptional()
  criteria?: BadgeCriterionDto[];

  @ApiPropertyOptional({ enum: ['all', 'any'] })
  @IsIn(['all', 'any'])
  @IsOptional()
  criteriaAggregation?: 'all' | 'any';
}

export class UpdateBadgeDto extends PartialType(CreateBadgeDto) {}

export class SetBadgeStatusDto {
  @ApiProperty({ enum: BadgeStatus })
  @IsEnum(BadgeStatus)
  status!: BadgeStatus;
}

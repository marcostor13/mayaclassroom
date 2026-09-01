import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsBoolean, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCohortDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() idNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() visible?: boolean;
}

export class UpdateCohortDto extends PartialType(CreateCohortDto) {}

export class CohortMembersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  userIds!: string[];
}

export class SyncCohortDto {
  @ApiPropertyOptional({ default: 'student', description: 'Rol con el que matricular' })
  @IsString()
  @IsOptional()
  roleShortName?: string;
}

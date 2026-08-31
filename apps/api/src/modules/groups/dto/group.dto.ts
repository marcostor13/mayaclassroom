import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() idNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() enrolmentKey?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() pictureUrl?: string;
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}

export class GroupMembersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  userIds!: string[];
}

export class AutoCreateGroupsDto {
  @ApiProperty({ enum: ['numberOfGroups', 'membersPerGroup'] })
  @IsEnum(['numberOfGroups', 'membersPerGroup'])
  mode!: 'numberOfGroups' | 'membersPerGroup';

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  value!: number;

  @ApiPropertyOptional({ default: 'Grupo @' })
  @IsString()
  @IsOptional()
  namingScheme?: string;

  @ApiPropertyOptional({ enum: ['random', 'alphabetical'], default: 'random' })
  @IsEnum(['random', 'alphabetical'])
  @IsOptional()
  allocation?: 'random' | 'alphabetical';

  @ApiPropertyOptional({ description: 'Agrupamiento donde añadir los grupos creados' })
  @IsMongoId()
  @IsOptional()
  groupingId?: string;
}

export class CreateGroupingDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() idNumber?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  groupIds?: string[];
}

export class UpdateGroupingDto extends PartialType(CreateGroupingDto) {}

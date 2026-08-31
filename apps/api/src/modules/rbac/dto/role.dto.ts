import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContextLevel, PermissionValue } from '@maya/shared';

export class CreateRoleDto {
  @ApiProperty({ example: 'tutor' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-z][a-z0-9_-]*$/, {
    message: 'El nombre corto solo admite minúsculas, números, guiones y guiones bajos.',
  })
  shortName!: string;

  @ApiProperty({ example: 'Tutor de prácticas' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ContextLevel, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ContextLevel, { each: true })
  assignableAt!: ContextLevel[];

  @ApiPropertyOptional({ default: 100 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Rol del que copiar las capacidades iniciales' })
  @IsMongoId()
  @IsOptional()
  copyFromRoleId?: string;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class SetCapabilityDto {
  @ApiProperty({ example: 'moodle/course:update' })
  @IsString()
  capability!: string;

  @ApiProperty({ enum: [1, 0, -1, -1000] })
  @IsEnum(PermissionValue)
  permission!: PermissionValue;

  @ApiPropertyOptional({ description: 'Contexto del override; vacío = definición base' })
  @IsMongoId()
  @IsOptional()
  contextId?: string;
}

export class BulkSetCapabilitiesDto {
  @ApiProperty({ type: [SetCapabilityDto] })
  @IsArray()
  items!: SetCapabilityDto[];

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  contextId?: string;
}

export class AssignRoleDto {
  @ApiProperty()
  @IsMongoId()
  userId!: string;

  @ApiProperty()
  @IsMongoId()
  roleId!: string;

  @ApiProperty({ description: 'Contexto donde se asigna el rol' })
  @IsMongoId()
  contextId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  component?: string;
}

export class BulkAssignRoleDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  userIds!: string[];

  @ApiProperty()
  @IsMongoId()
  roleId!: string;

  @ApiProperty()
  @IsMongoId()
  contextId!: string;
}

export class CheckCapabilityDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  capabilities!: string[];

  @ApiProperty()
  @IsMongoId()
  contextId!: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  requireAll?: boolean;
}

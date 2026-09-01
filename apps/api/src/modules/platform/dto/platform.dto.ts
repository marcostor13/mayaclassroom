import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { CustomFieldScope, CustomFieldType } from '@maya/shared';

/* ------------------------- Campos personalizados ------------------------- */

export class CreateCustomFieldDto {
  @ApiProperty({ enum: CustomFieldScope }) @IsEnum(CustomFieldScope) scope!: CustomFieldScope;
  @ApiProperty() @IsString() @MinLength(1) shortName!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ enum: CustomFieldType }) @IsEnum(CustomFieldType) type!: CustomFieldType;
  @ApiPropertyOptional() @IsString() @IsOptional() categoryName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() required?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];
}

export class UpdateCustomFieldDto extends PartialType(CreateCustomFieldDto) {}

/* -------------------------------- Etiquetas ------------------------------ */

export class SetTagStandardDto {
  @ApiProperty() @IsBoolean() isStandard!: boolean;
}

export class AddCommentDto {
  @ApiProperty() @IsString() @MinLength(1) content!: string;
}

/* ------------------------------ Servicios web ---------------------------- */

export class CreateTokenDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[];

  @ApiPropertyOptional() @IsDateString() @IsOptional() expiresAt?: string;
}

export class CreateWebhookDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;

  @ApiProperty({ description: 'Destino de la llamada; debe ser https en producción' })
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @ApiPropertyOptional({ description: 'Secreto con el que se firma cada envío' })
  @IsString()
  @IsOptional()
  secret?: string;
}

/* --------------------------------- RGPD ---------------------------------- */

export class CreatePrivacyRequestDto {
  @ApiProperty({ enum: ['export', 'delete'] })
  @IsIn(['export', 'delete'])
  requestType!: 'export' | 'delete';

  @ApiPropertyOptional() @IsString() @IsOptional() comment?: string;
}

export class ResolvePrivacyRequestDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}

/* --------------------------- Copias de seguridad ------------------------- */

export class CreateBackupDto {
  @ApiPropertyOptional({ description: 'Incluir matrículas y calificaciones' })
  @IsBoolean()
  @IsOptional()
  includeUsers?: boolean;
}

export class RestoreBackupDto {
  @ApiProperty() @IsMongoId() categoryId!: string;
  @ApiProperty() @IsString() @MinLength(1) shortName!: string;
  @ApiProperty() @IsString() @MinLength(1) fullName!: string;
}

export class ImportCourseDto {
  @ApiProperty() @IsMongoId() sourceCourseId!: string;
  @ApiProperty() @IsMongoId() targetCourseId!: string;
}

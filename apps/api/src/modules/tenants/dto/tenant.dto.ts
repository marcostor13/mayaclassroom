import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TenantPlan, TenantStatus } from '@maya/shared';
import { PaginationQueryDto } from '../../../common/dto';

export class PasswordPolicyDto {
  @IsInt() @Min(6) @IsOptional() minLength?: number;
  @IsBoolean() @IsOptional() requireUppercase?: boolean;
  @IsBoolean() @IsOptional() requireNumber?: boolean;
  @IsBoolean() @IsOptional() requireSymbol?: boolean;
  @IsInt() @Min(0) @IsOptional() expiryDays?: number;
}

export class TenantSettingsDto {
  @IsString() @IsOptional() defaultLanguage?: string;
  @IsString() @IsOptional() timezone?: string;
  @IsBoolean() @IsOptional() allowSelfRegistration?: boolean;
  @IsBoolean() @IsOptional() requireEmailVerification?: boolean;
  @IsBoolean() @IsOptional() allowGuestAccess?: boolean;
  @ValidateNested() @Type(() => PasswordPolicyDto) @IsOptional() passwordPolicy?: PasswordPolicyDto;
  @IsBoolean() @IsOptional() enforceTwoFactor?: boolean;
  @IsString() @IsOptional() sitePolicyUrl?: string;
  @IsEmail() @IsOptional() supportEmail?: string;
  @IsInt() @IsOptional() weekStart?: number;
  @IsInt() @Min(0) @IsOptional() gradeDecimals?: number;
}

export class TenantBrandingDto {
  @ApiPropertyOptional({ example: '#E4574D' })
  @IsHexColor()
  @IsOptional()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#F2B441' })
  @IsHexColor()
  @IsOptional()
  accentColor?: string;

  @IsUrl({ require_tld: false }) @IsOptional() logoUrl?: string;
  @IsUrl({ require_tld: false }) @IsOptional() faviconUrl?: string;
  @IsUrl({ require_tld: false }) @IsOptional() loginBackgroundUrl?: string;
  @IsString() @MaxLength(20000) @IsOptional() customCss?: string;
  @IsString() @MaxLength(500) @IsOptional() welcomeMessage?: string;
}

export class CreateTenantDto {
  @ApiProperty({ example: 'acme' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'El identificador solo admite minúsculas, números y guiones.',
  })
  slug!: string;

  @ApiProperty({ example: 'ACME Formación' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsEmail()
  contactEmail!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() legalName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() taxId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() domain?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() contactPhone?: string;

  @ApiPropertyOptional({ enum: TenantPlan })
  @IsEnum(TenantPlan)
  @IsOptional()
  plan?: TenantPlan;

  @ApiPropertyOptional({ enum: TenantStatus })
  @IsEnum(TenantStatus)
  @IsOptional()
  status?: TenantStatus;

  @ValidateNested() @Type(() => TenantBrandingDto) @IsOptional() branding?: TenantBrandingDto;
  @ValidateNested() @Type(() => TenantSettingsDto) @IsOptional() settings?: TenantSettingsDto;

  /* ------------------ Cuenta de administración de la empresa -------------- */

  @ApiPropertyOptional({
    description: 'Correo de la persona que administrará la empresa. Por omisión, el de contacto.',
    example: 'admin@acme.com',
  })
  @IsEmail({}, { message: 'El correo del administrador no es válido.' })
  @IsOptional()
  adminEmail?: string;

  @ApiPropertyOptional({
    description: 'Nombre de usuario del administrador. Por omisión se deriva del correo.',
    example: 'admin.acme',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[a-z0-9._-]+$/, {
    message: 'El nombre de usuario solo admite minúsculas, números, punto, guion y guion bajo.',
  })
  @IsOptional()
  adminUsername?: string;

  @ApiPropertyOptional({ example: 'Ana' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @IsOptional()
  adminFirstName?: string;

  @ApiPropertyOptional({ example: 'Pérez' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @IsOptional()
  adminLastName?: string;
}

/**
 * Los campos de la cuenta de administración solo tienen sentido en el alta:
 * una vez creada la empresa, su administración se gestiona desde usuarios.
 */
export class UpdateTenantDto extends PartialType(
  OmitType(CreateTenantDto, [
    'adminEmail',
    'adminUsername',
    'adminFirstName',
    'adminLastName',
  ] as const),
) {}

/** Filtros del listado de empresas (administración de plataforma). */
export class TenantQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TenantStatus })
  @IsEnum(TenantStatus)
  @IsOptional()
  status?: TenantStatus;

  @ApiPropertyOptional({ enum: TenantPlan })
  @IsEnum(TenantPlan)
  @IsOptional()
  plan?: TenantPlan;
}

/**
 * El dominio que una empresa quiere usar para su página pública.
 *
 * La forma se valida en el servicio y no aquí con una expresión regular: hay
 * que normalizar antes de juzgar —la gente pega `https://` y barras finales— y
 * el mensaje tiene que decir qué está mal, no solo que no vale.
 */
export class SetTenantDomainDto {
  @ApiProperty({ example: 'cursos.dulcelima.pe' })
  @IsString()
  @MaxLength(260)
  hostname!: string;
}

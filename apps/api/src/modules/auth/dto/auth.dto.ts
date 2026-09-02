import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ana.perez@acme.com', description: 'Correo o nombre de usuario' })
  @IsString()
  @MinLength(3)
  login!: string;

  @ApiProperty({ example: 'Secreta123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({
    example: 'acme',
    description:
      'Identificador de la empresa. Opcional: si no se indica, se deduce de las credenciales, ' +
      'y cuando valen en varias empresas la respuesta pide elegir una.',
  })
  @IsString()
  @IsOptional()
  tenantSlug?: string;

  @ApiPropertyOptional({ description: 'Código TOTP si el usuario tiene 2FA activo' })
  @IsString()
  @IsOptional()
  totp?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}

/** Segundo paso del acceso cuando las credenciales valen en varias empresas. */
export class TenantChoiceDto {
  @ApiProperty({ description: 'Testigo devuelto por el primer paso del acceso' })
  @IsString()
  tenantChoiceToken!: string;

  @ApiProperty({ description: 'Empresa elegida, de entre las que devolvió el primer paso' })
  @IsString()
  tenantId!: string;

  @ApiPropertyOptional({ description: 'Código TOTP si la cuenta tiene 2FA activo' })
  @IsString()
  @IsOptional()
  totp?: string;
}

export class RegisterDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(60) username!: string;
  @ApiProperty() @IsString() @MinLength(8) password!: string;
  @ApiProperty() @IsString() @MinLength(1) firstName!: string;
  @ApiProperty() @IsString() @MinLength(1) lastName!: string;
  @ApiProperty({ example: 'acme' }) @IsString() tenantSlug!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() enrolmentKey?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty() @IsEmail() email!: string;

  @ApiPropertyOptional({
    description:
      'Empresa concreta. Opcional: sin ella se envía un enlace por cada empresa donde exista ' +
      'ese correo.',
  })
  @IsString()
  @IsOptional()
  tenantSlug?: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() token!: string;
  @ApiProperty() @IsString() @MinLength(8) password!: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword!: string;
  @ApiProperty() @IsString() @MinLength(8) newPassword!: string;
}

export class VerifyEmailDto {
  @ApiProperty() @IsString() token!: string;
}

export class DisableTwoFactorDto {
  @ApiProperty({ description: 'Contraseña actual, para confirmar la identidad' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class TwoFactorSetupDto {
  @ApiProperty({ description: 'Código TOTP generado por la aplicación autenticadora' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

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

  @ApiProperty({ example: 'acme', description: 'Identificador de la empresa' })
  @IsString()
  tenantSlug!: string;

  @ApiPropertyOptional({ description: 'Código TOTP si el usuario tiene 2FA activo' })
  @IsString()
  @IsOptional()
  totp?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
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
  @ApiProperty() @IsString() tenantSlug!: string;
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

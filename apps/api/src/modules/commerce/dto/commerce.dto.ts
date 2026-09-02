import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { OrderStatus, PaymentProvider } from '@maya/shared';

export class MercadoPagoSettingsDto {
  @ApiPropertyOptional() @IsBoolean() @IsOptional() enabled?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) publicKey?: string | null;

  @ApiPropertyOptional({
    description: 'Token de acceso. Se guarda cifrado en reposo y nunca se devuelve.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(400)
  accessToken?: string | null;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() sandbox?: boolean;
}

export class PayPalSettingsDto {
  @ApiPropertyOptional() @IsBoolean() @IsOptional() enabled?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) clientId?: string | null;

  @ApiPropertyOptional({ description: 'Secreto de la aplicación. Nunca se devuelve.' })
  @IsString()
  @IsOptional()
  @MaxLength(400)
  secret?: string | null;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() sandbox?: boolean;
}

export class ManualPaymentSettingsDto {
  @ApiPropertyOptional() @IsBoolean() @IsOptional() enabled?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(2000) instructions?: string | null;
}

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional({ example: 'EUR' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ type: MercadoPagoSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MercadoPagoSettingsDto)
  mercadoPago?: MercadoPagoSettingsDto;

  @ApiPropertyOptional({ type: PayPalSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayPalSettingsDto)
  paypal?: PayPalSettingsDto;

  @ApiPropertyOptional({ type: ManualPaymentSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ManualPaymentSettingsDto)
  manual?: ManualPaymentSettingsDto;
}

/** Compra iniciada desde la ficha pública de un curso, sin sesión detrás. */
export class CreateCheckoutDto {
  @ApiProperty() @IsString() courseId!: string;

  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @ApiProperty() @IsString() @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MaxLength(80) lastName!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(40) phone?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: [OrderStatus.Paid, OrderStatus.Cancelled, OrderStatus.Refunded] })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) note?: string;
}

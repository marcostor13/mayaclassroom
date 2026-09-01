import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCertificateTemplateDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bodyHtml?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() backgroundUrl?: string;
}

export class IssueCertificateDto {
  @ApiPropertyOptional({ description: 'Plantilla a usar; por defecto, la de la empresa' })
  @IsMongoId()
  @IsOptional()
  templateId?: string;
}

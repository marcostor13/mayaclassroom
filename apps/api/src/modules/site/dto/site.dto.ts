import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EnrolmentRequestStatus, SiteSectionType, SiteTemplate } from '@maya/shared';
import type { SiteSectionStyle } from '@maya/shared';

export class SiteSectionItemDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(2000) body?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) author?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(40) icon?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(40) value?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) url?: string | null;
}

/** Aspecto de una sección: solo valores del catálogo, nunca CSS libre. */
export class SiteSectionStyleDto {
  @ApiPropertyOptional({ enum: ['plain', 'soft', 'brand', 'dark', 'image'] })
  @IsIn(['plain', 'soft', 'brand', 'dark', 'image'])
  @IsOptional()
  background?: SiteSectionStyle['background'];

  @ApiPropertyOptional({ enum: ['start', 'center'] })
  @IsIn(['start', 'center'])
  @IsOptional()
  align?: SiteSectionStyle['align'];

  @ApiPropertyOptional({ enum: ['compact', 'normal', 'roomy'] })
  @IsIn(['compact', 'normal', 'roomy'])
  @IsOptional()
  spacing?: SiteSectionStyle['spacing'];

  @ApiPropertyOptional({ enum: [2, 3, 4] })
  @IsIn([2, 3, 4])
  @IsOptional()
  columns?: SiteSectionStyle['columns'];
}

export class SiteSectionDto {
  @ApiProperty() @IsString() @MaxLength(60) id!: string;

  @ApiProperty({ enum: SiteSectionType })
  @IsEnum(SiteSectionType)
  type!: SiteSectionType;

  @ApiProperty() @IsBoolean() enabled!: boolean;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) title?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(400) subtitle?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(5000) body?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(60) ctaLabel?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) ctaUrl?: string | null;

  @ApiPropertyOptional({ type: [SiteSectionItemDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SiteSectionItemDto)
  items?: SiteSectionItemDto[];

  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(1) limit?: number | null;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(60) ctaSecondaryLabel?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) ctaSecondaryUrl?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) videoUrl?: string | null;

  @ApiPropertyOptional({ type: SiteSectionStyleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SiteSectionStyleDto)
  style?: SiteSectionStyleDto | null;
}

export class SiteSeoDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(70) title?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(160) description?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string | null;
}

export class SiteContactDto {
  @ApiPropertyOptional() @IsString() @IsOptional() email?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) address?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() website?: string | null;
}

export class UpdateSiteDto {
  @ApiPropertyOptional() @IsBoolean() @IsOptional() published?: boolean;

  @ApiPropertyOptional({ enum: SiteTemplate })
  @IsEnum(SiteTemplate)
  @IsOptional()
  template?: SiteTemplate;

  @ApiPropertyOptional({ type: [SiteSectionDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SiteSectionDto)
  sections?: SiteSectionDto[];

  @ApiPropertyOptional({ type: SiteSeoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SiteSeoDto)
  seo?: SiteSeoDto;

  @ApiPropertyOptional({ type: SiteContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SiteContactDto)
  contact?: SiteContactDto;
}

/** Solicitud de plaza enviada desde la página pública, sin sesión detrás. */
export class CreateEnrolmentRequestDto {
  @ApiProperty() @IsString() courseId!: string;
  @ApiProperty() @IsString() @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MaxLength(80) lastName!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(40) phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(1000) message?: string;
}

export class ResolveRequestDto {
  @ApiProperty({ enum: [EnrolmentRequestStatus.Approved, EnrolmentRequestStatus.Rejected] })
  @IsEnum(EnrolmentRequestStatus)
  status!: EnrolmentRequestStatus;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) note?: string;
}

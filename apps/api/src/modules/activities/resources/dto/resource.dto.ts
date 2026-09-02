import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LessonBlockType } from '@maya/shared';

/**
 * Contenido editable de un recurso.
 *
 * Todos los campos son opcionales porque un mismo recurso admite formas
 * distintas según su tipo: una página usa `content`, una URL usa
 * `externalUrl` y un archivo usa `fileIds`. Validar por tipo aquí obligaría a
 * un DTO por cada uno para no ganar nada: el servicio ya ignora lo que no
 * corresponde a su clase.
 */
export class LessonBlockDto {
  @ApiProperty() @IsString() @MaxLength(60) id!: string;

  @ApiProperty({ enum: LessonBlockType })
  @IsEnum(LessonBlockType)
  type!: LessonBlockType;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(20000) content?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(2000) url?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) title?: string | null;

  @ApiPropertyOptional({ enum: ['info', 'success', 'warning'] })
  @IsIn(['info', 'success', 'warning'])
  @IsOptional()
  variant?: 'info' | 'success' | 'warning' | null;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(120) mimeType?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(300) filename?: string | null;
}

export class UpdateResourceDto {
  @ApiPropertyOptional({ type: [LessonBlockDto], description: 'Lección por bloques ordenados' })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LessonBlockDto)
  blocks?: LessonBlockDto[];

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(255) name?: string;

  @ApiPropertyOptional({ description: 'Descripción breve, visible bajo el título' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  intro?: string;

  @ApiPropertyOptional({ description: 'Cuerpo en HTML. Se limpia en el servidor.' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(2000) externalUrl?: string;

  @ApiPropertyOptional({ enum: ['auto', 'embed', 'new', 'open', 'download'] })
  @IsIn(['auto', 'embed', 'new', 'open', 'download'])
  @IsOptional()
  display?: string;

  @ApiPropertyOptional({ type: [String], description: 'Ficheros adjuntos ya subidos' })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  fileIds?: string[];
}

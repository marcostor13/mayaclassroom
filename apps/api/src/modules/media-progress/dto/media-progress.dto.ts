import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { MediaSourceKind } from '@maya/shared';

/**
 * Latido del reproductor.
 *
 * `deltaSeconds` viene acotado a propósito: el cliente late cada pocos
 * segundos, así que un salto grande solo puede venir de una pestaña dormida o
 * de alguien intentando darse el vídeo por visto de una vez.
 */
export class MediaHeartbeatDto {
  @ApiProperty({ description: 'Identificador del bloque de lección o de la grabación' })
  @IsString()
  mediaId!: string;

  @ApiProperty({ enum: MediaSourceKind })
  @IsEnum(MediaSourceKind)
  kind!: MediaSourceKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Duración total del vídeo en segundos' })
  @IsNumber()
  @Min(0)
  @Max(60 * 60 * 12)
  durationSeconds!: number;

  @ApiProperty({ description: 'Posición del cursor al enviar el latido' })
  @IsNumber()
  @Min(0)
  positionSeconds!: number;

  @ApiProperty({ description: 'Segundos reproducidos desde el latido anterior' })
  @IsNumber()
  @Min(0)
  @Max(120)
  deltaSeconds!: number;
}

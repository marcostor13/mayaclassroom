import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LiveSessionMode, LiveSessionStatus } from '@maya/shared';

/** Ajustes de la sala. Todos opcionales: lo que no llega conserva su valor. */
export class LiveSessionSettingsDto {
  @ApiPropertyOptional({ description: 'Sala de espera antes de entrar' })
  @IsBoolean()
  @IsOptional()
  lobby?: boolean;

  @ApiPropertyOptional({ description: 'Entrar con el micrófono cerrado' })
  @IsBoolean()
  @IsOptional()
  muteOnJoin?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allowChat?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allowWhiteboard?: boolean;

  @ApiPropertyOptional({ description: 'El alumnado puede compartir su pantalla' })
  @IsBoolean()
  @IsOptional()
  allowAttendeeScreenShare?: boolean;

  @ApiPropertyOptional({ description: 'El alumnado puede encender su cámara' })
  @IsBoolean()
  @IsOptional()
  allowAttendeeCamera?: boolean;

  @ApiPropertyOptional({ description: 'Empezar a grabar al abrir la sala' })
  @IsBoolean()
  @IsOptional()
  autoRecord?: boolean;

  @ApiPropertyOptional({ description: 'Publicar las grabaciones al alumnado' })
  @IsBoolean()
  @IsOptional()
  recordingVisibleToStudents?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  @IsOptional()
  joinBeforeHostMinutes?: number;

  @ApiPropertyOptional({ minimum: 2, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  @IsOptional()
  maxParticipants?: number;
}

export class CreateLiveSessionDto {
  @ApiProperty({ example: 'Clase 3 · Señales y detección de cambios' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: LiveSessionMode, default: LiveSessionMode.Class })
  @IsEnum(LiveSessionMode)
  @IsOptional()
  mode?: LiveSessionMode;

  @ApiPropertyOptional({ description: 'Curso al que pertenece la clase' })
  @IsMongoId()
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Grupo del curso, si la clase es de uno solo' })
  @IsMongoId()
  @IsOptional()
  groupId?: string;

  @ApiProperty({ description: 'Comienzo previsto, en ISO 8601' })
  @IsDateString()
  scheduledStart!: string;

  @ApiPropertyOptional({ description: 'Final previsto, en ISO 8601' })
  @IsDateString()
  @IsOptional()
  scheduledEnd?: string;

  @ApiPropertyOptional({ type: [String], description: 'Co-anfitriones' })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  coHostIds?: string[];

  @ApiPropertyOptional({ description: 'Abierta a toda la empresa, no solo al curso' })
  @IsBoolean()
  @IsOptional()
  openToTenant?: boolean;

  @ApiPropertyOptional({ type: LiveSessionSettingsDto })
  @ValidateNested()
  @Type(() => LiveSessionSettingsDto)
  @IsOptional()
  settings?: LiveSessionSettingsDto;

  @ApiPropertyOptional({ description: 'Minutos de recordatorio antes de empezar' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  @IsOptional()
  reminderMinutes?: number;

  @ApiPropertyOptional({ description: 'Avisar por notificación a los participantes' })
  @IsBoolean()
  @IsOptional()
  notify?: boolean;
}

export class UpdateLiveSessionDto extends PartialType(CreateLiveSessionDto) {
  @ApiPropertyOptional({ enum: LiveSessionStatus })
  @IsEnum(LiveSessionStatus)
  @IsOptional()
  status?: LiveSessionStatus;
}

export class LiveSessionQueryDto {
  @ApiPropertyOptional({ enum: LiveSessionStatus })
  @IsEnum(LiveSessionStatus)
  @IsOptional()
  status?: LiveSessionStatus;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Solo las que aún no han terminado' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  upcoming?: boolean;

  @ApiPropertyOptional({ description: 'Desde esta fecha (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta esta fecha (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit: number = 50;
}

export class StartRecordingDto {
  @ApiPropertyOptional({ description: 'Nombre de la grabación' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ default: 'video/webm' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  mimeType?: string;
}

export class FinishRecordingDto {
  @ApiProperty({ description: 'Duración en segundos' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds!: number;

  @ApiProperty({ description: 'Número de trozos enviados' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  chunkCount!: number;
}

export class UpdateRecordingDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Publicada al alumnado matriculado' })
  @IsBoolean()
  @IsOptional()
  visibleToStudents?: boolean;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsMongoId, IsOptional, IsString } from 'class-validator';
import { LogAction } from '@maya/shared';
import { PaginationQueryDto } from '../../../common/dto';

/** Filtros del registro de eventos, además de la paginación heredada. */
export class LogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Eventos ejecutados por este usuario' })
  @IsMongoId()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Eventos ocurridos en este curso' })
  @IsMongoId()
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional({ enum: LogAction })
  @IsEnum(LogAction)
  @IsOptional()
  action?: LogAction;

  @ApiPropertyOptional({ description: 'Origen del evento, por ejemplo `mod/assign`' })
  @IsString()
  @IsOptional()
  component?: string;

  @ApiPropertyOptional({ description: 'Fecha inicial (ISO 8601)' })
  @IsISO8601()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Fecha final (ISO 8601)' })
  @IsISO8601()
  @IsOptional()
  to?: string;
}

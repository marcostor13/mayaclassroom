import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ description: 'Término de búsqueda (mínimo dos caracteres)' })
  @IsString()
  @MinLength(2, { message: 'Escriba al menos dos caracteres.' })
  q!: string;

  @ApiPropertyOptional({ default: 5, maximum: 20, description: 'Resultados por grupo' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  limit: number = 5;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@maya/shared';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, maximum: MAX_PAGE_SIZE })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @IsOptional()
  limit: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ description: 'Búsqueda de texto libre' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Campo de ordenación' })
  @IsString()
  @IsOptional()
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Incluir elementos eliminados lógicamente' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  withDeleted?: boolean;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  get sortObject(): Record<string, 1 | -1> {
    if (!this.sort) return { createdAt: -1 };
    return { [this.sort]: this.order === 'asc' ? 1 : -1 };
  }
}

export class PaginatedResult<T> {
  items!: T[];
  total!: number;
  page!: number;
  limit!: number;
  pages!: number;

  static of<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
    return {
      items,
      total,
      page,
      limit,
      pages: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }
}

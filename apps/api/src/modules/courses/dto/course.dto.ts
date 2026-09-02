import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CourseFormat, CourseVisibility, GroupMode, ModuleType } from '@maya/shared';
import { PaginationQueryDto } from '../../../common/dto';

export class CreateCourseDto {
  @ApiProperty({ example: 'MAT-101' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[\w .-]+$/, { message: 'El nombre corto contiene caracteres no permitidos.' })
  shortName!: string;

  @ApiProperty({ example: 'Matemáticas I' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @ApiProperty()
  @IsMongoId()
  categoryId!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() idNumber?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(20000) @IsOptional() summary?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string;

  @ApiPropertyOptional({ enum: CourseFormat, default: CourseFormat.Topics })
  @IsEnum(CourseFormat)
  @IsOptional()
  format?: CourseFormat;

  @ApiPropertyOptional({ enum: CourseVisibility })
  @IsEnum(CourseVisibility)
  @IsOptional()
  visibility?: CourseVisibility;

  @ApiPropertyOptional() @IsDateString() @IsOptional() startDate?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endDate?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsInt()
  @Min(0)
  @Max(52)
  @IsOptional()
  numSections?: number;

  @ApiPropertyOptional({ enum: [0, 1, 2] })
  @IsEnum(GroupMode)
  @IsOptional()
  groupMode?: GroupMode;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() forceGroupMode?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() showGradebook?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() enableCompletion?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() completionNotify?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() language?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  formatOptions?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;
}

/**
 * Datos de venta del curso, para el escaparate público. Van en su propio
 * objeto porque describen el producto, no la asignatura: sin `listed` el curso
 * ni siquiera aparece fuera.
 */
export class CourseCatalogDto {
  @ApiPropertyOptional({ description: 'Mostrar el curso en la página pública' })
  @IsBoolean()
  @IsOptional()
  listed?: boolean;

  @ApiPropertyOptional({ description: 'Precio en céntimos. 0 es gratuito.' })
  @IsInt()
  @Min(0)
  @IsOptional()
  priceCents?: number;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Frase gancho, distinta del resumen académico' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  headline?: string | null;

  @ApiPropertyOptional({ type: [String], description: '«Lo que aprenderá»' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  highlights?: string[];

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(40) level?: string | null;

  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() durationHours?: number | null;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {
  @ApiPropertyOptional({ type: CourseCatalogDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CourseCatalogDto)
  catalog?: CourseCatalogDto;
}

export class CourseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsMongoId() @IsOptional() categoryId?: string;

  @ApiPropertyOptional({ description: 'Incluir subcategorías al filtrar' })
  @IsBoolean()
  @IsOptional()
  includeSubcategories?: boolean;

  @ApiPropertyOptional({ enum: CourseVisibility })
  @IsEnum(CourseVisibility)
  @IsOptional()
  visibility?: CourseVisibility;

  @ApiPropertyOptional({ description: 'Solo los cursos en los que participa el usuario' })
  @IsBoolean()
  @IsOptional()
  onlyMine?: boolean;

  @ApiPropertyOptional({ enum: ['inprogress', 'future', 'past', 'favourites', 'all'] })
  @IsString()
  @IsOptional()
  classification?: 'inprogress' | 'future' | 'past' | 'favourites' | 'all';

  @ApiPropertyOptional() @IsString() @IsOptional() tag?: string;
}

export class CreateSectionDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(20000) @IsOptional() summary?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() visible?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() availabilityJson?: string;
}

export class UpdateSectionDto extends PartialType(CreateSectionDto) {}

export class CreateModuleDto {
  @ApiProperty({ enum: ModuleType })
  @IsEnum(ModuleType)
  moduleType!: ModuleType;

  @ApiProperty()
  @IsMongoId()
  sectionId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() visible?: boolean;

  @ApiPropertyOptional({ description: 'Configuración específica de la actividad' })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional() @IsEnum(GroupMode) @IsOptional() groupMode?: GroupMode;
  @ApiPropertyOptional() @IsInt() @IsOptional() completionTracking?: number;
  @ApiPropertyOptional() @IsObject() @IsOptional() completionRules?: Record<string, unknown>;
  @ApiPropertyOptional({ description: 'Cadena vacía para quitar la fecha' })
  @ValidateIf((_, value) => value !== '')
  @IsDateString()
  @IsOptional()
  completionExpected?: string;

  @ApiPropertyOptional({ description: 'Árbol de restricción serializado; vacío para quitarlo' })
  @IsString()
  @IsOptional()
  availabilityJson?: string;
}

export class UpdateModuleDto extends PartialType(CreateModuleDto) {}

export class MoveModuleDto {
  @ApiProperty() @IsMongoId() sectionId!: string;

  @ApiProperty({ description: 'Posición dentro de la sección (0 = primera)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}

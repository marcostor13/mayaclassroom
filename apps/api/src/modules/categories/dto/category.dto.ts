import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Formación continua' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() idNumber?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(5000) @IsOptional() description?: string;

  @ApiPropertyOptional({ description: 'Categoría padre; vacío = raíz' })
  @IsMongoId()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  visible?: boolean;

  @ApiPropertyOptional() @IsInt() @IsOptional() sortOrder?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() imageUrl?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class MoveCategoryDto {
  @ApiPropertyOptional({ description: 'Nueva categoría padre; vacío = raíz' })
  @IsMongoId()
  @IsOptional()
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

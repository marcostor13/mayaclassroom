import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsMongoId, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { SignatureUse } from '@maya/shared';

/**
 * Trazo de la firma tal como lo produce el lienzo del navegador.
 *
 * El formato se valida con una expresión regular y no solo por longitud: sin
 * ella, cualquier cadena entraría como «imagen» y acabaría incrustada en un
 * certificado, que es HTML.
 */
export class SaveSignatureDto {
  @ApiProperty({ description: 'PNG en base64: data:image/png;base64,…' })
  @IsString()
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, {
    message: 'La firma debe ser una imagen PNG en base64.',
  })
  imageDataUrl!: string;

  @ApiPropertyOptional() @IsInt() @Min(100) @Max(2000) @IsOptional() width?: number;
  @ApiPropertyOptional() @IsInt() @Min(50) @Max(1000) @IsOptional() height?: number;
}

/** Estampa la firma sobre un hecho: una asistencia, una visualización. */
export class SignRecordDto {
  @ApiProperty({ enum: SignatureUse })
  @IsEnum(SignatureUse)
  use!: SignatureUse;

  @ApiPropertyOptional() @IsMongoId() @IsOptional() courseId?: string;

  @ApiPropertyOptional({ description: 'Sesión en vivo o actividad que se firma' })
  @IsMongoId()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Qué se firma, para leerlo en el acta' })
  @IsString()
  @IsOptional()
  referenceLabel?: string;
}

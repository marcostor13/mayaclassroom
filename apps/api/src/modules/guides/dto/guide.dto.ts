import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateGuideProgressDto {
  @ApiPropertyOptional({ description: 'Paso que se acaba de completar' })
  @IsString()
  @IsOptional()
  completedStepId?: string;

  @ApiPropertyOptional({ description: 'Paso en el que se queda el recorrido' })
  @IsInt()
  @Min(0)
  @IsOptional()
  currentStep?: number;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() dismissed?: boolean;

  @ApiPropertyOptional({ description: 'Vuelve a empezar la guía desde el primer paso' })
  @IsBoolean()
  @IsOptional()
  restart?: boolean;
}

export class GuideIdParamDto {
  @ApiProperty() @IsString() guideId!: string;
}

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EnrolmentMethod, EnrolmentStatus } from '@maya/shared';
import { PaginationQueryDto } from '../../../common/dto';

export class EnrolUsersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  userIds!: string[];

  @ApiPropertyOptional({ description: 'Nombre corto del rol (por defecto: student)' })
  @IsString()
  @IsOptional()
  roleShortName?: string;

  @ApiPropertyOptional() @IsDateString() @IsOptional() timeStart?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() timeEnd?: string;

  @ApiPropertyOptional({ description: 'Grupo al que añadir a los usuarios' })
  @IsMongoId()
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() notify?: boolean;
}

export class SelfEnrolDto {
  @ApiPropertyOptional({ description: 'Clave de matriculación si el curso la exige' })
  @IsString()
  @IsOptional()
  enrolmentKey?: string;
}

export class UpdateEnrolmentDto {
  @ApiPropertyOptional({ enum: EnrolmentStatus })
  @IsEnum(EnrolmentStatus)
  @IsOptional()
  status?: EnrolmentStatus;

  @ApiPropertyOptional() @IsDateString() @IsOptional() timeStart?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() timeEnd?: string;
}

export class EnrolmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EnrolmentStatus })
  @IsEnum(EnrolmentStatus)
  @IsOptional()
  status?: EnrolmentStatus;

  @ApiPropertyOptional() @IsString() @IsOptional() roleShortName?: string;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() groupId?: string;
}

export class CreateEnrolmentMethodDto {
  @ApiProperty({ enum: EnrolmentMethod })
  @IsEnum(EnrolmentMethod)
  method!: EnrolmentMethod;

  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() enabled?: boolean;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() roleId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() enrolmentKey?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() startDate?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endDate?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() enrolPeriodDays?: number;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() maxEnrolled?: number;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() cohortId?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() sendWelcomeMessage?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() welcomeMessage?: string;
}

export class UpdateEnrolmentMethodDto extends PartialType(CreateEnrolmentMethodDto) {}

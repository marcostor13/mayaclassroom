import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '@maya/shared';
import { PaginationQueryDto } from '../../../common/dto';

export class CreateUserDto {
  @ApiProperty({ example: 'ana.perez@acme.com' })
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  email!: string;

  @ApiProperty({ example: 'ana.perez' })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[a-z0-9._-]+$/, {
    message: 'El nombre de usuario solo admite minúsculas, números, punto, guion y guion bajo.',
  })
  username!: string;

  @ApiPropertyOptional({ description: 'Si se omite se envía una invitación por correo' })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) lastName!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() idNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() city?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() country?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() timezone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() language?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() department?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() institution?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(2000) @IsOptional() description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsOptional()
  interests?: string[];

  @ApiPropertyOptional({ enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Rol inicial en la empresa (nombre corto)' })
  @IsString()
  @IsOptional()
  initialRole?: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'initialRole'] as const),
) {}

export class UpdateProfileDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'initialRole', 'status', 'email', 'username'] as const),
) {}

export class UpdatePreferencesDto {
  @IsString() @IsOptional() theme?: 'light' | 'dark' | 'system';
  @IsBoolean() @IsOptional() emailDigest?: boolean;
  @IsString() @IsOptional() forumAutoSubscribe?: string;
  @IsBoolean() @IsOptional() showCourseImages?: boolean;
  @IsString() @IsOptional() courseView?: 'cards' | 'list' | 'summary';
  @IsObject() @IsOptional() extra?: Record<string, unknown>;
}

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Filtrar por rol (nombre corto)' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ description: 'Filtrar por curso' })
  @IsMongoId()
  @IsOptional()
  courseId?: string;
}

export class BulkUserActionDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  userIds!: string[];

  @ApiProperty({ enum: ['suspend', 'activate', 'delete', 'resend-invitation'] })
  @IsString()
  action!: 'suspend' | 'activate' | 'delete' | 'resend-invitation';
}

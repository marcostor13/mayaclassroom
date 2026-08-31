import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ForumSubscriptionMode, ForumType } from '@maya/shared';

export class ForumSettingsDto {
  @ApiPropertyOptional() @IsString() @IsOptional() intro?: string;

  @ApiPropertyOptional({ enum: ForumType })
  @IsEnum(ForumType)
  @IsOptional()
  type?: ForumType;

  @ApiPropertyOptional({ enum: ForumSubscriptionMode })
  @IsEnum(ForumSubscriptionMode)
  @IsOptional()
  subscriptionMode?: ForumSubscriptionMode;

  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() maxAttachments?: number;
  @ApiPropertyOptional() @IsInt() @IsOptional() maxBytes?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() allowRating?: boolean;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() blockAfter?: number;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() gradeMax?: number;
}

export class CreateDiscussionDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty() @IsString() @MinLength(1) message!: string;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() groupId?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() pinned?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  attachmentIds?: string[];
}

export class CreatePostDto {
  @ApiPropertyOptional() @IsString() @IsOptional() subject?: string;
  @ApiProperty() @IsString() @MinLength(1) message!: string;
  @ApiPropertyOptional() @IsMongoId() @IsOptional() parentId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  attachmentIds?: string[];
}

export class UpdatePostDto {
  @ApiPropertyOptional() @IsString() @IsOptional() subject?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() message?: string;
}

export class RatePostDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  value!: number;
}

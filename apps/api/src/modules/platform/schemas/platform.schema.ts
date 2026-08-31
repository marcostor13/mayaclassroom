import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CustomFieldScope, CustomFieldType, ScheduledTaskStatus } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/** Campo personalizado para usuarios, cursos o categorías. */
@Schema({ collection: 'custom_fields', timestamps: true })
export class CustomField extends TenantScopedDocument {
  @Prop({ type: String, enum: Object.values(CustomFieldScope), required: true, index: true })
  scope!: CustomFieldScope;

  @Prop({ default: 'General' }) categoryName!: string;
  @Prop({ required: true }) shortName!: string;
  @Prop({ required: true }) name!: string;

  @Prop({ type: String, enum: Object.values(CustomFieldType), required: true })
  type!: CustomFieldType;

  @Prop({ type: String, default: null }) description!: string | null;
  @Prop({ default: false }) required!: boolean;
  @Prop({ default: false }) uniqueValues!: boolean;

  @Prop({ type: String, enum: ['all', 'teachers', 'none'], default: 'all' })
  visibility!: 'all' | 'teachers' | 'none';

  @Prop({ type: String, default: null }) defaultValue!: string | null;
  @Prop({ type: [String], default: [] }) options!: string[];
  @Prop({ default: 0 }) sortOrder!: number;
}

export type CustomFieldDocument = HydratedDocument<CustomField>;
export const CustomFieldSchema = SchemaFactory.createForClass(CustomField);
CustomFieldSchema.index({ tenant: 1, scope: 1, shortName: 1 }, { unique: true });

/** Etiqueta transversal. */
@Schema({ collection: 'tags', timestamps: true })
export class Tag extends TenantScopedDocument {
  @Prop({ required: true, lowercase: true, index: true }) name!: string;
  @Prop({ required: true }) rawName!: string;
  @Prop({ type: String, default: null }) description!: string | null;
  @Prop({ default: false }) isStandard!: boolean;
  @Prop({ default: 0 }) usageCount!: number;
}

export type TagDocument = HydratedDocument<Tag>;
export const TagSchema = SchemaFactory.createForClass(Tag);
TagSchema.index({ tenant: 1, name: 1 }, { unique: true });

/** Comentario genérico sobre cualquier elemento. */
@Schema({ collection: 'comments', timestamps: true })
export class Comment extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Context', required: true, index: true })
  context!: Types.ObjectId;

  @Prop({ required: true, index: true }) component!: string;
  @Prop({ type: Types.ObjectId, required: true, index: true }) itemId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ required: true }) content!: string;
}

export type CommentDocument = HydratedDocument<Comment>;
export const CommentSchema = SchemaFactory.createForClass(Comment);

/** Token de servicio web. */
@Schema({ collection: 'web_service_tokens', timestamps: true })
export class WebServiceToken extends TenantScopedDocument {
  @Prop({ required: true }) name!: string;
  @Prop({ required: true, unique: true, index: true }) tokenHash!: string;
  @Prop({ required: true }) tokenPreview!: string;

  @Prop({ type: [String], default: [] }) scopes!: string[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner!: Types.ObjectId;

  @Prop({ type: Date, default: null }) lastUsedAt!: Date | null;
  @Prop({ type: Date, default: null }) expiresAt!: Date | null;
  @Prop({ default: true }) enabled!: boolean;
}

export type WebServiceTokenDocument = HydratedDocument<WebServiceToken>;
export const WebServiceTokenSchema = SchemaFactory.createForClass(WebServiceToken);

/** Webhook de salida. */
@Schema({ collection: 'webhooks', timestamps: true })
export class Webhook extends TenantScopedDocument {
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) url!: string;
  @Prop({ type: [String], default: [] }) events!: string[];
  @Prop({ type: String, default: null }) secret!: string | null;
  @Prop({ default: true }) enabled!: boolean;
  @Prop({ type: Number, default: null }) lastStatus!: number | null;
  @Prop({ type: Date, default: null }) lastDeliveredAt!: Date | null;
}

export type WebhookDocument = HydratedDocument<Webhook>;
export const WebhookSchema = SchemaFactory.createForClass(Webhook);

/** Solicitud RGPD de exportación o eliminación de datos. */
@Schema({ collection: 'data_requests', timestamps: true })
export class DataRequest extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: ['export', 'delete'], required: true })
  requestType!: 'export' | 'delete';

  @Prop({ type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'pending' })
  status!: 'pending' | 'approved' | 'rejected' | 'completed';

  @Prop({ type: String, default: null }) comment!: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  handledBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null }) completedAt!: Date | null;
}

export type DataRequestDocument = HydratedDocument<DataRequest>;
export const DataRequestSchema = SchemaFactory.createForClass(DataRequest);

/** Registro de ejecución de tareas programadas. */
@Schema({ collection: 'scheduled_tasks', timestamps: true })
export class ScheduledTask extends TenantScopedDocument {
  @Prop({ required: true, index: true }) taskName!: string;
  @Prop({ default: '' }) description!: string;

  @Prop({ type: String, enum: Object.values(ScheduledTaskStatus), default: ScheduledTaskStatus.Idle })
  status!: ScheduledTaskStatus;

  @Prop({ type: Date, default: null }) lastRunAt!: Date | null;
  @Prop({ type: Date, default: null }) nextRunAt!: Date | null;
  @Prop({ default: 0 }) lastDurationMs!: number;
  @Prop({ type: String, default: null }) lastError!: string | null;
  @Prop({ default: true }) enabled!: boolean;
}

export type ScheduledTaskDocument = HydratedDocument<ScheduledTask>;
export const ScheduledTaskSchema = SchemaFactory.createForClass(ScheduledTask);

/** Copia de seguridad de un curso. */
@Schema({ collection: 'course_backups', timestamps: true })
export class CourseBackup extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ required: true }) courseName!: string;
  @Prop({ required: true }) filename!: string;
  @Prop({ required: true }) size!: number;
  @Prop({ default: false }) includeUsers!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'StoredFile', required: true })
  file!: Types.ObjectId;
}

export type CourseBackupDocument = HydratedDocument<CourseBackup>;
export const CourseBackupSchema = SchemaFactory.createForClass(CourseBackup);

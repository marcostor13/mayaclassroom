import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Categoría de cursos. Árbol anidado con ruta materializada, igual que en
 * Moodle: permite mover ramas completas y resolver visibilidad heredada.
 */
@Schema({ collection: 'course_categories', timestamps: true })
export class Category extends TenantScopedDocument {
  @Prop({ required: true, trim: true, index: true })
  name!: string;

  @Prop({ type: String, default: null }) idNumber!: string | null;
  @Prop({ type: String, default: null }) description!: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null, index: true })
  parent!: Types.ObjectId | null;

  /** `/idPadre/idHijo/` — permite consultas por subárbol en una sola query. */
  @Prop({ required: true, default: '/', index: true })
  path!: string;

  @Prop({ default: 0, index: true })
  depth!: number;

  @Prop({ default: true, index: true })
  visible!: boolean;

  /** Visibilidad heredada: si un ancestro está oculto, esta también lo está. */
  @Prop({ default: true })
  visibleOld!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ default: 0 })
  courseCount!: number;

  @Prop({ type: String, default: null })
  imageUrl!: string | null;

  @Prop({ type: Object, default: {} })
  customFields!: Record<string, unknown>;
}

export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ tenant: 1, parent: 1, sortOrder: 1 });
CategorySchema.index({ tenant: 1, name: 1 });

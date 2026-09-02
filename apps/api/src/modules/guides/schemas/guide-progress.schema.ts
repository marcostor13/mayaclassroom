import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { GuideId } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Por dónde va cada persona en cada guía.
 *
 * Se guarda en el servidor y no en el navegador porque el recorrido cruza
 * pantallas y a menudo también dispositivos —se empieza a configurar en el
 * portátil y se comprueba en el móvil—, y una guía que vuelve a empezar cada
 * vez es peor que no tenerla.
 */
@Schema({ collection: 'guide_progress', timestamps: true })
export class GuideProgress extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(GuideId), required: true, index: true })
  guideId!: GuideId;

  @Prop({ type: [String], default: [] }) completedStepIds!: string[];
  @Prop({ default: 0 }) currentStep!: number;
  /** Descartada: no se vuelve a ofrecer sola, pero se puede reabrir a mano. */
  @Prop({ default: false }) dismissed!: boolean;
  @Prop({ type: Date, default: null }) completedAt!: Date | null;
}

export type GuideProgressDocument = HydratedDocument<GuideProgress>;
export const GuideProgressSchema = SchemaFactory.createForClass(GuideProgress);

GuideProgressSchema.index({ tenant: 1, user: 1, guideId: 1 }, { unique: true });

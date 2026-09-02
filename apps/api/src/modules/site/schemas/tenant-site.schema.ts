import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SiteSectionType, SiteTemplate } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ _id: false })
export class SiteSectionItemSchema {
  @Prop({ required: true, trim: true }) title!: string;
  @Prop({ type: String, default: null }) body!: string | null;
  @Prop({ type: String, default: null }) imageUrl!: string | null;
  @Prop({ type: String, default: null }) author!: string | null;
}

@Schema({ _id: false })
export class SiteSectionSchema {
  @Prop({ required: true }) id!: string;

  @Prop({ type: String, enum: Object.values(SiteSectionType), required: true })
  type!: SiteSectionType;

  @Prop({ default: true }) enabled!: boolean;
  @Prop({ type: String, default: null }) title!: string | null;
  @Prop({ type: String, default: null }) subtitle!: string | null;
  @Prop({ type: String, default: null }) body!: string | null;
  @Prop({ type: String, default: null }) imageUrl!: string | null;
  @Prop({ type: String, default: null }) ctaLabel!: string | null;
  @Prop({ type: String, default: null }) ctaUrl!: string | null;
  @Prop({ type: [SiteSectionItemSchema], default: [] }) items!: SiteSectionItemSchema[];
  @Prop({ type: Number, default: null }) limit!: number | null;
}

@Schema({ _id: false })
export class SiteSeoSchema {
  @Prop({ type: String, default: null }) title!: string | null;
  @Prop({ type: String, default: null }) description!: string | null;
  @Prop({ type: String, default: null }) imageUrl!: string | null;
}

@Schema({ _id: false })
export class SiteContactSchema {
  @Prop({ type: String, default: null }) email!: string | null;
  @Prop({ type: String, default: null }) phone!: string | null;
  @Prop({ type: String, default: null }) address!: string | null;
  @Prop({ type: String, default: null }) website!: string | null;
}

/**
 * El escaparate de una empresa. Uno por empresa, creado con secciones de
 * ejemplo la primera vez que se abre el editor.
 *
 * El orden de las secciones es el del array: guardar un índice aparte obliga a
 * mantener dos fuentes de verdad que se desincronizan en cuanto se reordena.
 */
@Schema({ collection: 'tenant_sites' })
export class TenantSite extends TenantScopedDocument {
  /**
   * Se redeclara solo para marcarlo único: una empresa tiene exactamente una
   * página. Añadir un `schema.index({ tenant: 1 }, { unique: true })` aparte
   * choca con el `index: true` de la clase base y Mongoose avisa de índice
   * duplicado en cada arranque.
   */
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, unique: true })
  declare tenant: Types.ObjectId;

  @Prop({ default: false, index: true }) published!: boolean;

  @Prop({ type: String, enum: Object.values(SiteTemplate), default: SiteTemplate.Classic })
  template!: SiteTemplate;

  @Prop({ type: [SiteSectionSchema], default: [] }) sections!: SiteSectionSchema[];
  @Prop({ type: SiteSeoSchema, default: () => ({}) }) seo!: SiteSeoSchema;
  @Prop({ type: SiteContactSchema, default: () => ({}) }) contact!: SiteContactSchema;
}

export type TenantSiteDocument = HydratedDocument<TenantSite>;
export const TenantSiteSchema = SchemaFactory.createForClass(TenantSite);

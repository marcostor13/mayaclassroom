import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Base común de todos los documentos: marca temporal, borrado lógico y
 * pertenencia a una empresa (tenant). El aislamiento multiempresa se apoya en
 * `tenant` + índices compuestos en cada colección.
 */
@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true, versionKey: false },
})
export abstract class BaseDocument {
  @Prop({ type: Date, default: null, index: true })
  deletedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId | null;

  createdAt!: Date;
  updatedAt!: Date;
  id!: string;
}

/** Base de los documentos que pertenecen a una empresa. */
@Schema()
export abstract class TenantScopedDocument extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenant!: Types.ObjectId;
}

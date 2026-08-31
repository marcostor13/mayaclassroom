import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Base común de todos los documentos: marca temporal, borrado lógico y
 * pertenencia a una empresa (tenant). El aislamiento multiempresa se apoya en
 * `tenant` + índices compuestos en cada colección.
 *
 * Nota: las opciones `toJSON`/`toObject` de este decorador NO las heredan los
 * esquemas hijos (`SchemaFactory.createForClass` solo lee el decorador de la
 * clase concreta). Quien garantiza de verdad la serialización con `id` es el
 * complemento global registrado en `DatabaseModule`; esto se conserva por
 * coherencia si alguna vez se instancia la base directamente.
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

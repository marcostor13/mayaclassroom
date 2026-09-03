import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { WhiteboardPageDto } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Pizarra de una sesión: un documento por sala, con sus páginas y trazos.
 *
 * Se guarda para que quien llega tarde vea lo que ya está dibujado y para que
 * la clase siga ahí cuando termina. Los trazos van en una lista plana de
 * números (pares `x, y` normalizados), que es lo que hace viable guardarlos:
 * una pizarra llena son decenas de miles de puntos y en formato de objetos
 * ocuparía varias veces el límite de un documento de Mongo.
 */
@Schema({ collection: 'live_boards', timestamps: true })
export class LiveBoard extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'LiveSession', required: true, unique: true, index: true })
  session!: Types.ObjectId;

  @Prop({ type: [Object], default: [] })
  pages!: WhiteboardPageDto[];

  @Prop({ type: String, default: '' })
  activePageId!: string;
}

export type LiveBoardDocument = HydratedDocument<LiveBoard>;
export const LiveBoardSchema = SchemaFactory.createForClass(LiveBoard);

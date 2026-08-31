import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../../common/schemas/base.schema';

@Schema({ collection: 'mod_forum_posts', timestamps: true })
export class Post extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Discussion', required: true, index: true })
  discussion!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', default: null, index: true })
  parent!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true }) subject!: string;
  @Prop({ required: true }) message!: string;

  @Prop({ type: [Types.ObjectId], ref: 'StoredFile', default: [] })
  attachments!: Types.ObjectId[];

  @Prop({ default: false }) edited!: boolean;

  /** Valoraciones: usuario → puntuación. */
  @Prop({ type: [{ user: Types.ObjectId, value: Number }], default: [] })
  ratings!: { user: Types.ObjectId; value: number }[];
}

export type PostDocument = HydratedDocument<Post>;
export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ discussion: 1, createdAt: 1 });

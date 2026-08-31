import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../../common/schemas/base.schema';

@Schema({ collection: 'mod_book_chapters', timestamps: true })
export class BookChapter extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'CourseResource', required: true, index: true })
  book!: Types.ObjectId;

  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) content!: string;
  @Prop({ default: false }) subChapter!: boolean;
  @Prop({ default: false }) hidden!: boolean;
  @Prop({ default: 0 }) sortOrder!: number;
}

export type BookChapterDocument = HydratedDocument<BookChapter>;
export const BookChapterSchema = SchemaFactory.createForClass(BookChapter);
BookChapterSchema.index({ book: 1, sortOrder: 1 });

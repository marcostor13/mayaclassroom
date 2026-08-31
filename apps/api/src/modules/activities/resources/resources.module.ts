import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CourseResource, CourseResourceSchema } from './schemas/resource.schema';
import { BookChapter, BookChapterSchema } from './schemas/book-chapter.schema';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseResource.name, schema: CourseResourceSchema },
      { name: BookChapter.name, schema: BookChapterSchema },
    ]),
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}

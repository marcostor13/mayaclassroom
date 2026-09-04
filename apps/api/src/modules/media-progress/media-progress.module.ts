import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaProgress, MediaProgressSchema } from './schemas/media-progress.schema';
import { CourseModule, CourseModuleSchema } from '../courses/schemas/course-module.schema';
import {
  CourseResource,
  CourseResourceSchema,
} from '../activities/resources/schemas/resource.schema';
import { MediaProgressService } from './media-progress.service';
import { MediaProgressController } from './media-progress.controller';

/**
 * Global porque el expediente del alumno y el cálculo de la nota final
 * consultan el avance de vídeo, y son módulos que no tienen otra relación con
 * este.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MediaProgress.name, schema: MediaProgressSchema },
      { name: CourseModule.name, schema: CourseModuleSchema },
      { name: CourseResource.name, schema: CourseResourceSchema },
    ]),
  ],
  controllers: [MediaProgressController],
  providers: [MediaProgressService],
  exports: [MediaProgressService, MongooseModule],
})
export class MediaProgressModule {}

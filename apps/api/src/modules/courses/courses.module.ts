import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from './schemas/course.schema';
import { CourseSection, CourseSectionSchema } from './schemas/course-section.schema';
import { CourseModule, CourseModuleSchema } from './schemas/course-module.schema';
import { CoursesService } from './courses.service';
import { CourseViewService } from './course-view.service';
import { CoursesController } from './courses.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: CourseSection.name, schema: CourseSectionSchema },
      { name: CourseModule.name, schema: CourseModuleSchema },
    ]),
  ],
  controllers: [CoursesController],
  providers: [CoursesService, CourseViewService],
  exports: [CoursesService, CourseViewService, MongooseModule],
})
export class CoursesModule {}

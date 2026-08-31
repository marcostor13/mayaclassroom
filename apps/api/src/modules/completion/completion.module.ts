import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ModuleCompletion, ModuleCompletionSchema } from './schemas/completion.schema';
import {
  CourseCompletion,
  CourseCompletionSchema,
} from './schemas/course-completion.schema';
import { CourseModule, CourseModuleSchema } from '../courses/schemas/course-module.schema';
import { CompletionService } from './completion.service';
import { CompletionController } from './completion.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ModuleCompletion.name, schema: ModuleCompletionSchema },
      { name: CourseCompletion.name, schema: CourseCompletionSchema },
      { name: CourseModule.name, schema: CourseModuleSchema },
    ]),
  ],
  controllers: [CompletionController],
  providers: [CompletionService],
  exports: [CompletionService, MongooseModule],
})
export class CompletionModule {}

import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GradeItem, GradeItemSchema } from './schemas/grade-item.schema';
import { GradeCategory, GradeCategorySchema } from './schemas/grade-category.schema';
import { Grade, GradeSchema } from './schemas/grade.schema';
import { GradeScale, GradeScaleSchema } from './schemas/grade-scale.schema';
import { GradeLetter, GradeLetterSchema } from './schemas/grade-letter.schema';
import { GradesService } from './grades.service';
import { GradeScalesController, GradesController } from './grades.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GradeItem.name, schema: GradeItemSchema },
      { name: GradeCategory.name, schema: GradeCategorySchema },
      { name: Grade.name, schema: GradeSchema },
      { name: GradeScale.name, schema: GradeScaleSchema },
      { name: GradeLetter.name, schema: GradeLetterSchema },
    ]),
  ],
  controllers: [GradesController, GradeScalesController],
  providers: [GradesService],
  exports: [GradesService, MongooseModule],
})
export class GradesModule {}

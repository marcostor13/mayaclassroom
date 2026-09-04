import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GradeItem, GradeItemSchema } from './schemas/grade-item.schema';
import { GradeCategory, GradeCategorySchema } from './schemas/grade-category.schema';
import { Grade, GradeSchema } from './schemas/grade.schema';
import { GradeScale, GradeScaleSchema } from './schemas/grade-scale.schema';
import { GradeLetter, GradeLetterSchema } from './schemas/grade-letter.schema';
import { Quiz, QuizSchema } from '../activities/quiz/schemas/quiz.schema';
import {
  QuizAttempt,
  QuizAttemptSchema,
} from '../activities/quiz/schemas/quiz-attempt.schema';
import { GradesService } from './grades.service';
import { CourseGradingService } from './course-grading.service';
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
      // Los exámenes se registran aquí porque la situación académica necesita
      // saber cuáles son obligatorios y cuáles esperan corrección; el módulo
      // del cuestionario no es global y no se puede importar sin ciclo.
      { name: Quiz.name, schema: QuizSchema },
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
    ]),
  ],
  controllers: [GradesController, GradeScalesController],
  providers: [GradesService, CourseGradingService],
  exports: [GradesService, CourseGradingService, MongooseModule],
})
export class GradesModule {}

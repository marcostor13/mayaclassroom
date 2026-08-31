import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from './schemas/question.schema';
import {
  QuestionCategory,
  QuestionCategorySchema,
} from './schemas/question-category.schema';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: QuestionCategory.name, schema: QuestionCategorySchema },
    ]),
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService, MongooseModule],
})
export class QuestionsModule {}

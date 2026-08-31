import { Module } from '@nestjs/common';
import { AssignModule } from './assign/assign.module';
import { QuizModule } from './quiz/quiz.module';
import { ForumModule } from './forum/forum.module';
import { ChoiceModule } from './choice/choice.module';
import { FeedbackModule } from './feedback/feedback.module';
import { ResourcesModule } from './resources/resources.module';
import { AdvancedActivitiesModule } from './advanced/advanced-activities.module';

/** Agrupa todos los tipos de actividad y recurso disponibles. */
@Module({
  imports: [
    AssignModule,
    QuizModule,
    ForumModule,
    ChoiceModule,
    FeedbackModule,
    ResourcesModule,
    AdvancedActivitiesModule,
  ],
  exports: [
    AssignModule,
    QuizModule,
    ForumModule,
    ChoiceModule,
    FeedbackModule,
    ResourcesModule,
    AdvancedActivitiesModule,
  ],
})
export class ActivitiesModule {}

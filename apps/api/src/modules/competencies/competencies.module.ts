import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Competency,
  CompetencyFramework,
  CompetencyFrameworkSchema,
  CompetencyLink,
  CompetencyLinkSchema,
  CompetencySchema,
  LearningPlan,
  LearningPlanSchema,
  UserCompetency,
  UserCompetencySchema,
} from './schemas/competency.schema';
import { CompetenciesService } from './competencies.service';
import { CompetenciesController } from './competencies.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompetencyFramework.name, schema: CompetencyFrameworkSchema },
      { name: Competency.name, schema: CompetencySchema },
      { name: CompetencyLink.name, schema: CompetencyLinkSchema },
      { name: UserCompetency.name, schema: UserCompetencySchema },
      { name: LearningPlan.name, schema: LearningPlanSchema },
    ]),
  ],
  controllers: [CompetenciesController],
  providers: [CompetenciesService],
  exports: [CompetenciesService, MongooseModule],
})
export class CompetenciesModule {}

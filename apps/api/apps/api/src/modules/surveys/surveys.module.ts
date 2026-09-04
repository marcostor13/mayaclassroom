import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Survey,
  SurveyParticipation,
  SurveyParticipationSchema,
  SurveyResponse,
  SurveyResponseSchema,
  SurveySchema,
} from './schemas/survey.schema';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Survey.name, schema: SurveySchema },
      { name: SurveyResponse.name, schema: SurveyResponseSchema },
      { name: SurveyParticipation.name, schema: SurveyParticipationSchema },
    ]),
  ],
  controllers: [SurveysController],
  providers: [SurveysService],
  exports: [SurveysService],
})
export class SurveysModule {}

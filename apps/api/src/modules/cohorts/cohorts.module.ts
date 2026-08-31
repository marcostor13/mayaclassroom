import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cohort, CohortSchema } from './schemas/cohort.schema';
import { CohortsService } from './cohorts.service';
import { CohortsController } from './cohorts.controller';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Cohort.name, schema: CohortSchema }])],
  controllers: [CohortsController],
  providers: [CohortsService],
  exports: [CohortsService, MongooseModule],
})
export class CohortsModule {}

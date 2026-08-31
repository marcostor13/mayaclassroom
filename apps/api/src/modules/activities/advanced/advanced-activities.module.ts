import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AdvancedActivity,
  AdvancedActivitySchema,
  AdvancedEntry,
  AdvancedEntrySchema,
} from './schemas/advanced-activity.schema';
import { AdvancedActivitiesService } from './advanced-activities.service';
import { AdvancedActivitiesController } from './advanced-activities.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdvancedActivity.name, schema: AdvancedActivitySchema },
      { name: AdvancedEntry.name, schema: AdvancedEntrySchema },
    ]),
  ],
  controllers: [AdvancedActivitiesController],
  providers: [AdvancedActivitiesService],
  exports: [AdvancedActivitiesService],
})
export class AdvancedActivitiesModule {}

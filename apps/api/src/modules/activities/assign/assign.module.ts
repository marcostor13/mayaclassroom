import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Assign, AssignSchema } from './schemas/assign.schema';
import {
  AssignSubmission,
  AssignSubmissionSchema,
} from './schemas/assign-submission.schema';
import { AssignService } from './assign.service';
import { AssignController } from './assign.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Assign.name, schema: AssignSchema },
      { name: AssignSubmission.name, schema: AssignSubmissionSchema },
    ]),
  ],
  controllers: [AssignController],
  providers: [AssignService],
  exports: [AssignService],
})
export class AssignModule {}

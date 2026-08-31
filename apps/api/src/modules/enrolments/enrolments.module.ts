import { Global, Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Enrolment, EnrolmentSchema } from './schemas/enrolment.schema';
import {
  EnrolmentMethodConfig,
  EnrolmentMethodSchema,
} from './schemas/enrolment-method.schema';
import { EnrolmentsService } from './enrolments.service';
import { EnrolmentsController } from './enrolments.controller';
import { GroupsModule } from '../groups/groups.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Enrolment.name, schema: EnrolmentSchema },
      { name: EnrolmentMethodConfig.name, schema: EnrolmentMethodSchema },
    ]),
    forwardRef(() => GroupsModule),
  ],
  controllers: [EnrolmentsController],
  providers: [EnrolmentsService],
  exports: [EnrolmentsService, MongooseModule],
})
export class EnrolmentsModule {}

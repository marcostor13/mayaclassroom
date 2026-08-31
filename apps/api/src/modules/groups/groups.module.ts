import { Global, Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from './schemas/group.schema';
import { Grouping, GroupingSchema } from './schemas/grouping.schema';
import { GroupsService } from './groups.service';
import { GroupingsController, GroupsController } from './groups.controller';
import { EnrolmentsModule } from '../enrolments/enrolments.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: Grouping.name, schema: GroupingSchema },
    ]),
    forwardRef(() => EnrolmentsModule),
  ],
  controllers: [GroupsController, GroupingsController],
  providers: [GroupsService],
  exports: [GroupsService, MongooseModule],
})
export class GroupsModule {}

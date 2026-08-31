import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema } from './schemas/role.schema';
import { RoleCapability, RoleCapabilitySchema } from './schemas/role-capability.schema';
import { RoleAssignment, RoleAssignmentSchema } from './schemas/role-assignment.schema';
import { RolesService } from './roles.service';
import { AccessService } from './access.service';
import { RbacController } from './rbac.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: RoleCapability.name, schema: RoleCapabilitySchema },
      { name: RoleAssignment.name, schema: RoleAssignmentSchema },
    ]),
  ],
  controllers: [RbacController],
  providers: [RolesService, AccessService],
  exports: [RolesService, AccessService, MongooseModule],
})
export class RbacModule {}

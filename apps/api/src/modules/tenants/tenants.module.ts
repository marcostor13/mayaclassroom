import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { TenantsService } from './tenants.service';
import { TenantDomainsService } from './tenant-domains.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantsController } from './tenants.controller';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }])],
  controllers: [TenantsController],
  providers: [TenantsService, TenantProvisioningService, TenantDomainsService],
  exports: [TenantsService, TenantProvisioningService, TenantDomainsService, MongooseModule],
})
export class TenantsModule {}

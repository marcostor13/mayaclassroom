import { Global, Module } from '@nestjs/common';
import { ActivityRegistry } from './activity-registry.service';

@Global()
@Module({
  providers: [ActivityRegistry],
  exports: [ActivityRegistry],
})
export class ActivityRegistryModule {}

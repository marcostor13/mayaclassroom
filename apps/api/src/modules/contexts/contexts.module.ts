import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Context, ContextSchema } from './schemas/context.schema';
import { ContextsService } from './contexts.service';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Context.name, schema: ContextSchema }])],
  providers: [ContextsService],
  exports: [ContextsService, MongooseModule],
})
export class ContextsModule {}

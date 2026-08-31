import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Log, LogSchema } from './schemas/log.schema';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';

/**
 * Global: el interceptor de auditoría y buena parte de los módulos funcionales
 * inyectan `LogsService` sin importar este módulo explícitamente.
 */
@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }])],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService, MongooseModule],
})
export class LogsModule {}

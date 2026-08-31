import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseConfig } from '../config';

/**
 * Conexión a MongoDB Atlas. La cadena de conexión llega por `MONGODB_URI`
 * (formato `mongodb+srv://…`). Se activan reintentos y un pool acotado para
 * entornos serverless.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<DatabaseConfig>('database');
        const logger = new Logger('Mongoose');
        return {
          uri: db.uri,
          dbName: db.dbName,
          autoIndex: db.autoIndex,
          maxPoolSize: db.maxPoolSize,
          serverSelectionTimeoutMS: 10_000,
          retryWrites: true,
          connectionFactory: (connection: { on: (e: string, cb: (a?: unknown) => void) => void; name?: string }) => {
            connection.on('connected', () => logger.log(`Conectado a MongoDB (${db.dbName})`));
            connection.on('disconnected', () => logger.warn('Conexión con MongoDB perdida'));
            connection.on('error', (err) => logger.error(`Error de MongoDB: ${String(err)}`));
            return connection;
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}

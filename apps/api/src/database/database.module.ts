import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { setServers } from 'node:dns';
import type { Connection, Schema } from 'mongoose';
import type { DatabaseConfig } from '../config';

/**
 * Normaliza la serialización JSON de todos los documentos: expone `id` en
 * lugar de `_id` y oculta `__v`.
 *
 * `BaseDocument` ya declara estas opciones en su `@Schema()`, pero
 * `SchemaFactory.createForClass()` no hereda las opciones del decorador de la
 * clase padre, así que en la práctica no se aplicaban a ninguna colección: la
 * API devolvía `_id` y el cliente recibía `id: undefined`. Registrarlo como
 * complemento global de la conexión lo garantiza para todos los esquemas sin
 * repetirlo en cada uno.
 */
function serializacionJson(schema: Schema): void {
  const opciones = {
    virtuals: true,
    versionKey: false,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      // Los subdocumentos declarados con `_id: false` no tienen identificador:
      // sin esta guarda acabarían con `id: "undefined"`.
      if (ret._id !== undefined) {
        ret.id = String(ret._id);
        delete ret._id;
      }
      return ret;
    },
  };
  schema.set('toJSON', opciones);
  schema.set('toObject', opciones);
}

/**
 * Fija los servidores DNS que Node usa para `dns.resolve*`.
 *
 * Una cadena `mongodb+srv://` obliga al driver a resolver un registro SRV, y
 * hay resolvers locales (VPN, proxys DNS, antivirus) que los rechazan aunque
 * el resto de la navegación funcione: el síntoma es
 * `querySrv ECONNREFUSED _mongodb._tcp.<clúster>`. Apuntar a un servidor
 * público evita ese salto. No afecta a `dns.lookup`, que resuelve después las
 * direcciones de los shards a través del sistema operativo.
 */
function configurarDns(servidores: string[], logger: Logger): void {
  if (!servidores.length) return;
  try {
    setServers(servidores);
    logger.log(`Resolución DNS fijada en ${servidores.join(', ')}`);
  } catch (error) {
    // Una lista mal formada no debe impedir el arranque: si el resolver del
    // sistema funciona, la conexión seguirá adelante sin este ajuste.
    logger.warn(`NODE_DNS_SERVERS no es válido (${servidores.join(', ')}): ${String(error)}`);
  }
}

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

        // Antes de devolver las opciones: el driver resuelve el SRV al conectar.
        configurarDns(db.dnsServers, logger);

        return {
          uri: db.uri,
          dbName: db.dbName,
          autoIndex: db.autoIndex,
          maxPoolSize: db.maxPoolSize,
          serverSelectionTimeoutMS: 10_000,
          retryWrites: true,
          connectionFactory: (connection: Connection) => {
            // Antes de que `forFeature` compile los modelos, para que el
            // complemento alcance a todos los esquemas.
            connection.plugin(serializacionJson);
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

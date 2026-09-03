import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { LiveConfig } from '../../config';
import { JwtConfig } from '../../config';
import { AuthModule } from '../auth/auth.module';
import { LiveSession, LiveSessionSchema } from './schemas/live-session.schema';
import { LiveAttendance, LiveAttendanceSchema } from './schemas/live-attendance.schema';
import { LiveRecording, LiveRecordingSchema } from './schemas/live-recording.schema';
import { LiveBoard, LiveBoardSchema } from './schemas/live-board.schema';
import { LiveChatMessage, LiveChatMessageSchema } from './schemas/live-chat-message.schema';
import { LiveService } from './live.service';
import { LiveBoardService } from './live-board.service';
import { LiveRecordingsService } from './live-recordings.service';
import { LivePresenceService } from './live-presence.service';
import { LiveController } from './live.controller';
import { LiveGateway } from './live.gateway';

/**
 * Aulas en vivo: videoconferencia nativa por WebRTC.
 *
 * Registra su propio `MulterModule` porque los trozos de grabación llegan de
 * uno en uno y son mucho mayores que un adjunto normal: reutilizar el límite
 * general obligaría a subirlo para todo el mundo.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LiveSession.name, schema: LiveSessionSchema },
      { name: LiveAttendance.name, schema: LiveAttendanceSchema },
      { name: LiveRecording.name, schema: LiveRecordingSchema },
      { name: LiveBoard.name, schema: LiveBoardSchema },
      { name: LiveChatMessage.name, schema: LiveChatMessageSchema },
    ]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: memoryStorage(),
        limits: { fileSize: config.getOrThrow<LiveConfig>('live').recordingChunkSize },
      }),
    }),
    // La señalización verifica el testigo en el saludo del socket, donde no
    // llega el guard global de HTTP: necesita el verificador por su cuenta.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const jwt = config.getOrThrow<JwtConfig>('jwt');
        return { secret: jwt.accessSecret } as JwtModuleOptions;
      },
    }),
    AuthModule,
  ],
  controllers: [LiveController],
  providers: [
    LiveService,
    LiveBoardService,
    LiveRecordingsService,
    LivePresenceService,
    LiveGateway,
  ],
  exports: [LiveService, LiveRecordingsService, LivePresenceService, MongooseModule],
})
export class LiveModule {}

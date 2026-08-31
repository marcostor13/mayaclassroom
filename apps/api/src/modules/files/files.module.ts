import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { StorageConfig } from '../../config';
import { StoredFile, StoredFileSchema } from './schemas/stored-file.schema';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';
import { FilesController } from './files.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: StoredFile.name, schema: StoredFileSchema }]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: memoryStorage(),
        limits: { fileSize: config.getOrThrow<StorageConfig>('storage').maxFileSize },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, StorageService],
  exports: [FilesService, StorageService, MongooseModule],
})
export class FilesModule {}

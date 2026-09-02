import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GuideProgress, GuideProgressSchema } from './schemas/guide-progress.schema';
import { GuidesService } from './guides.service';
import { GuidesController } from './guides.controller';

/**
 * Las guías interactivas que acompañan a quien empieza.
 *
 * No registra el catálogo de pasos: vive en `@maya/shared` porque el cliente
 * necesita los mismos textos y los mismos anclajes para pintar el recorrido.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: GuideProgress.name, schema: GuideProgressSchema }]),
  ],
  controllers: [GuidesController],
  providers: [GuidesService],
  exports: [GuidesService],
})
export class GuidesModule {}

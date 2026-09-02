import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantSite, TenantSiteSchema } from './schemas/tenant-site.schema';
import { EnrolmentRequest, EnrolmentRequestSchema } from './schemas/enrolment-request.schema';
import { SiteService } from './site.service';
import { SiteController } from './site.controller';

/**
 * El escaparate público de cada empresa.
 *
 * No registra los esquemas de curso, sección, módulo ni categoría: los aportan
 * sus módulos, que son globales. Aquí solo se leen para armar el catálogo y el
 * temario que se enseña antes de comprar.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TenantSite.name, schema: TenantSiteSchema },
      { name: EnrolmentRequest.name, schema: EnrolmentRequestSchema },
    ]),
  ],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService],
})
export class SiteModule {}

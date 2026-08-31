import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CertificateTemplate,
  CertificateTemplateSchema,
  IssuedCertificate,
  IssuedCertificateSchema,
} from './schemas/certificate.schema';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CertificateTemplate.name, schema: CertificateTemplateSchema },
      { name: IssuedCertificate.name, schema: IssuedCertificateSchema },
    ]),
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}

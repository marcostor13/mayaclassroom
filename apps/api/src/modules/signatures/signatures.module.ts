import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SignatureRecord,
  SignatureRecordSchema,
  UserSignature,
  UserSignatureSchema,
} from './schemas/signature.schema';
import { SignaturesService } from './signatures.service';
import { SignaturesController } from './signatures.controller';

/**
 * Global porque el certificado y el expediente del alumno necesitan la firma, y
 * son módulos que no tienen otra relación con este.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSignature.name, schema: UserSignatureSchema },
      { name: SignatureRecord.name, schema: SignatureRecordSchema },
    ]),
  ],
  controllers: [SignaturesController],
  providers: [SignaturesService],
  exports: [SignaturesService, MongooseModule],
})
export class SignaturesModule {}

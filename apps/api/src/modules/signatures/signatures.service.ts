import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SignatureRecordDto, SignatureUse, UserSignatureDto } from '@maya/shared';
import {
  SignatureRecord,
  SignatureRecordDocument,
  UserSignature,
  UserSignatureDocument,
} from './schemas/signature.schema';
import { SaveSignatureDto, SignRecordDto } from './dto/signature.dto';
import { SecurityConfig } from '../../config';
import { sealPayload, toObjectId, verifySeal } from '../../common/utils';

/**
 * Tamaño máximo del trazo.
 *
 * Un lienzo de 600 × 200 firmado a mano ronda los 20 kB; medio megabyte deja
 * sitio de sobra y corta de raíz que alguien suba una fotografía disfrazada de
 * firma, que acabaría incrustada en cada certificado y en cada acta.
 */
const MAX_SIGNATURE_BYTES = 512 * 1024;

/**
 * Firma electrónica del alumnado.
 *
 * La firma no pretende ser una firma digital cualificada —no hay certificado
 * personal detrás—: es una firma manuscrita capturada con su contexto (quién,
 * cuándo, desde dónde) y sellada con el secreto de la plataforma, de modo que
 * pueda demostrarse que el trazo que se enseña es el que se registró y que
 * nadie lo ha cambiado después.
 */
@Injectable()
export class SignaturesService {
  constructor(
    @InjectModel(UserSignature.name)
    private readonly model: Model<UserSignatureDocument>,
    @InjectModel(SignatureRecord.name)
    private readonly recordModel: Model<SignatureRecordDocument>,
    private readonly config: ConfigService,
  ) {}

  private get secret(): string {
    return this.config.getOrThrow<SecurityConfig>('security').signingSecret;
  }

  /* ------------------------- Firma de referencia ------------------------- */

  async mine(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<UserSignatureDto | null> {
    const signature = await this.model
      .findOne({ tenant: toObjectId(tenantId), user: toObjectId(userId) })
      .exec();
    return signature ? this.toDto(signature) : null;
  }

  /** Registra o sustituye la firma de una persona. */
  async save(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    dto: SaveSignatureDto,
    context: { ip?: string | null; userAgent?: string | null } = {},
  ): Promise<UserSignatureDto> {
    if (dto.imageDataUrl.length > MAX_SIGNATURE_BYTES) {
      throw new BadRequestException('La firma es demasiado grande.');
    }

    const signedAt = new Date();
    const hash = sealPayload(
      [String(userId), dto.imageDataUrl, signedAt.toISOString()],
      this.secret,
    );

    const signature = await this.model
      .findOneAndUpdate(
        { tenant: toObjectId(tenantId), user: toObjectId(userId) },
        {
          $set: {
            imageDataUrl: dto.imageDataUrl,
            hash,
            signedAt,
            width: dto.width ?? 600,
            height: dto.height ?? 200,
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    return this.toDto(signature);
  }

  async remove(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<void> {
    await this.model
      .deleteOne({ tenant: toObjectId(tenantId), user: toObjectId(userId) })
      .exec();
  }

  /** ¿El trazo guardado es el que se registró? */
  verify(signature: UserSignatureDocument): boolean {
    return verifySeal(
      [String(signature.user), signature.imageDataUrl, signature.signedAt.toISOString()],
      this.secret,
      signature.hash,
    );
  }

  async findOfUser(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<UserSignatureDocument | null> {
    return this.model
      .findOne({ tenant: toObjectId(tenantId), user: toObjectId(userId) })
      .exec();
  }

  /* ------------------------------- Usos ---------------------------------- */

  /**
   * Estampa la firma sobre un hecho concreto.
   *
   * Copia el trazo dentro del registro en lugar de referenciar la firma de
   * perfil: un acta firmada debe seguir enseñando lo que se firmó aunque la
   * persona cambie su firma después.
   */
  async sign(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    dto: SignRecordDto,
    context: { ip?: string | null; userAgent?: string | null } = {},
  ): Promise<SignatureRecordDto> {
    const signature = await this.findOfUser(tenantId, userId);
    if (!signature) {
      throw new BadRequestException(
        'Antes de firmar hay que registrar la firma en el perfil.',
      );
    }

    const reference = dto.referenceId ? toObjectId(dto.referenceId) : null;
    const existing = reference
      ? await this.recordModel
          .findOne({ user: toObjectId(userId), use: dto.use, reference })
          .exec()
      : null;
    // Firmar dos veces lo mismo devuelve la firma que ya había: pulsar el botón
    // otra vez no debe parecer un error ni duplicar la fila del acta.
    if (existing) return this.recordToDto(existing);

    const signedAt = new Date();
    const hash = sealPayload(
      [
        String(userId),
        dto.use,
        dto.referenceId ?? '',
        signature.imageDataUrl,
        signedAt.toISOString(),
      ],
      this.secret,
    );

    const record = await this.recordModel.create({
      tenant: toObjectId(tenantId),
      user: toObjectId(userId),
      use: dto.use,
      course: dto.courseId ? toObjectId(dto.courseId) : null,
      reference,
      referenceLabel: dto.referenceLabel ?? null,
      imageDataUrl: signature.imageDataUrl,
      hash,
      signedAt,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    });

    return this.recordToDto(record);
  }

  /** ¿Ha firmado esta persona este hecho? */
  async hasSigned(
    userId: string | Types.ObjectId,
    use: SignatureUse,
    referenceId: string | Types.ObjectId,
  ): Promise<boolean> {
    const count = await this.recordModel
      .countDocuments({ user: toObjectId(userId), use, reference: toObjectId(referenceId) })
      .exec();
    return count > 0;
  }

  /** Actas firmadas de una persona, para su expediente. */
  async recordsOfUser(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<SignatureRecordDocument[]> {
    return this.recordModel
      .find({ tenant: toObjectId(tenantId), user: toObjectId(userId) })
      .sort({ signedAt: -1 })
      .exec();
  }

  /** Acta de firmas de un curso: quién firmó qué y cuándo. */
  async recordsOfCourse(
    tenantId: string | Types.ObjectId,
    courseId: string | Types.ObjectId,
    referenceId?: string,
  ): Promise<SignatureRecordDocument[]> {
    return this.recordModel
      .find({
        tenant: toObjectId(tenantId),
        course: toObjectId(courseId),
        ...(referenceId ? { reference: toObjectId(referenceId) } : {}),
      })
      .populate('user', 'firstName lastName email')
      .sort({ signedAt: -1 })
      .exec();
  }

  async requireRecord(id: string | Types.ObjectId): Promise<SignatureRecordDocument> {
    const record = await this.recordModel.findById(toObjectId(id)).exec();
    if (!record) throw new NotFoundException('Firma no encontrada.');
    return record;
  }

  /* ---------------------------- Serialización ---------------------------- */

  toDto(signature: UserSignatureDocument): UserSignatureDto {
    return {
      id: signature.id,
      userId: String(signature.user),
      imageDataUrl: signature.imageDataUrl,
      hash: signature.hash,
      signedAt: signature.signedAt.toISOString(),
      width: signature.width,
      height: signature.height,
    };
  }

  recordToDto(record: SignatureRecordDocument, includeImage = true): SignatureRecordDto {
    const user = record.user as unknown as { firstName?: string; lastName?: string };
    return {
      id: record.id,
      userId: String(record.user?._id ?? record.user),
      userName: user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : undefined,
      use: record.use,
      courseId: record.course ? String(record.course) : null,
      referenceId: record.reference ? String(record.reference) : null,
      referenceLabel: record.referenceLabel,
      signedAt: record.signedAt.toISOString(),
      hash: record.hash,
      ...(includeImage ? { imageDataUrl: record.imageDataUrl } : {}),
      ip: record.ip,
    };
  }
}

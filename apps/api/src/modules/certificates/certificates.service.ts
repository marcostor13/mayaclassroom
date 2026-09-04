import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Handlebars from 'handlebars';
import * as QRCode from 'qrcode';
import {
  CertificateAccessMode,
  CertificateTemplateDto,
  CertificateVerificationDto,
  IssuedCertificateDto,
  MAYA_BRAND,
} from '@maya/shared';
import {
  CertificateTemplate,
  CertificateTemplateDocument,
  IssuedCertificate,
  IssuedCertificateDocument,
} from './schemas/certificate.schema';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import { CourseGradingService } from '../grades/course-grading.service';
import { SignaturesService } from '../signatures/signatures.service';
import { TenantsService } from '../tenants/tenants.service';
import { SecurityConfig } from '../../config';
import { dayjs, randomCode, sealPayload, toObjectId, verifySeal } from '../../common/utils';

const DEFAULT_TEMPLATE = `
<section class="certificate">
  <header><h1>Certificado de aprovechamiento</h1></header>
  <p class="lead">Se certifica que</p>
  <p class="name">{{nombre}}</p>
  <p class="lead">ha superado con éxito el curso</p>
  <p class="course">{{curso}}</p>
  {{#if nota}}<p class="grade">Calificación final: <strong>{{nota}}</strong></p>{{/if}}
  <p class="date">Expedido el {{fecha}}</p>
  <footer><span class="code">Código de verificación: {{codigo}}</span></footer>
</section>`;

@Injectable()
export class CertificatesService {
  constructor(
    @InjectModel(CertificateTemplate.name)
    private readonly templateModel: Model<CertificateTemplateDocument>,
    @InjectModel(IssuedCertificate.name)
    private readonly issuedModel: Model<IssuedCertificateDocument>,
    private readonly users: UsersService,
    private readonly courses: CoursesService,
    private readonly courseGrading: CourseGradingService,
    private readonly signatures: SignaturesService,
    private readonly tenants: TenantsService,
    private readonly config: ConfigService,
  ) {}

  private get secret(): string {
    return this.config.getOrThrow<SecurityConfig>('security').signingSecret;
  }

  /* ------------------------------ Plantillas ----------------------------- */

  async templates(tenantId: string | Types.ObjectId): Promise<CertificateTemplateDto[]> {
    const templates = await this.templateModel.find({ tenant: toObjectId(tenantId) }).exec();
    if (!templates.length) {
      const created = await this.templateModel.create({
        tenant: toObjectId(tenantId),
        name: 'Plantilla predeterminada',
        bodyHtml: DEFAULT_TEMPLATE,
      });
      return [this.toDto(created)];
    }
    return templates.map((t) => this.toDto(t));
  }

  async createTemplate(
    tenantId: string | Types.ObjectId,
    dto: Partial<CertificateTemplateDto> & { name: string; bodyHtml?: string },
  ): Promise<CertificateTemplateDto> {
    const template = await this.templateModel.create({
      tenant: toObjectId(tenantId),
      name: dto.name,
      bodyHtml: dto.bodyHtml ?? DEFAULT_TEMPLATE,
      backgroundUrl: dto.backgroundUrl ?? null,
      orientation: dto.orientation ?? 'landscape',
      showGrade: dto.showGrade ?? true,
      showDate: dto.showDate ?? true,
      showQr: dto.showQr ?? true,
    });
    return this.toDto(template);
  }

  /* ------------------------------- Emisión ------------------------------- */

  /**
   * Expide el certificado de un curso.
   *
   * Es idempotente: el mismo curso y la misma persona devuelven siempre el
   * mismo documento. Esa es la garantía de no duplicidad —dos llamadas no
   * producen dos certificados válidos del mismo hecho— y se apoya en el índice
   * único de la colección, no solo en esta comprobación.
   */
  async issue(params: {
    tenantId: string | Types.ObjectId;
    templateId?: string | Types.ObjectId;
    courseId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
  }): Promise<IssuedCertificateDto> {
    const existing = await this.issuedModel
      .findOne({ course: toObjectId(params.courseId), user: toObjectId(params.userId) })
      .exec();
    if (existing) return this.issuedToDto(existing);

    const course = await this.courses.findById(params.courseId);
    const settings = course.gradeSettings;

    const template = await this.resolveTemplate(params.tenantId, params.templateId, settings);

    const [user, summary, signature] = await Promise.all([
      this.users.findById(params.userId),
      this.courseGrading.summary(params.courseId, params.userId),
      this.signatures.findOfUser(params.tenantId, params.userId),
    ]);

    const issuedAt = new Date();
    const code = `MAYA-${randomCode(10)}`;
    const serial = await this.nextSerial(params.tenantId);
    const recipientName = `${user.firstName} ${user.lastName}`.trim();
    const accessMode = settings?.certificateAccess ?? CertificateAccessMode.Download;

    const issued = await this.issuedModel.create({
      tenant: toObjectId(params.tenantId),
      template: template._id,
      course: toObjectId(params.courseId),
      user: toObjectId(params.userId),
      code,
      serial,
      recipientName,
      courseName: course.fullName,
      grade: summary.finalGrade,
      gradeMax: summary.gradeMax,
      signatureImage: signature?.imageDataUrl ?? null,
      accessMode,
      issuedAt,
      hash: this.seal({
        code,
        serial,
        recipientName,
        courseName: course.fullName,
        grade: summary.finalGrade,
        issuedAt,
      }),
    });

    return this.issuedToDto(issued);
  }

  /**
   * Expide el certificado solo si el curso está realmente superado.
   *
   * Es lo que usa el alumno al pedir el suyo. Sin esta comprobación, cualquiera
   * podría reclamar el certificado de un curso a medio hacer llamando a la ruta
   * directamente.
   */
  async claim(
    tenantId: string | Types.ObjectId,
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<IssuedCertificateDto> {
    const existing = await this.issuedModel
      .findOne({ course: toObjectId(courseId), user: toObjectId(userId) })
      .exec();
    if (existing) return this.issuedToDto(existing);

    const summary = await this.courseGrading.summary(courseId, userId);
    if (summary.passed !== true) {
      const pendiente = summary.requirements.find((r) => !r.met);
      throw new ForbiddenException(
        pendiente
          ? `Todavía no ha superado el curso: ${pendiente.label.toLowerCase()} (${pendiente.actual} de ${pendiente.required}).`
          : 'Todavía no ha superado el curso.',
      );
    }
    return this.issue({ tenantId, courseId, userId });
  }

  /**
   * Expide el certificado al completarse el curso, si está configurado así.
   *
   * Se engancha al evento de finalización en lugar de comprobarlo al entrar en
   * la pantalla: el alumno recibe el certificado sin tener que ir a pedirlo, y
   * quien no cumpla los requisitos simplemente no lo obtiene —`claim` lo
   * rechaza y aquí se ignora, porque no es un fallo sino el caso normal de un
   * curso que se completa sin aprobar.
   */
  @OnEvent('course.completed')
  async onCourseCompleted(payload: { courseId: string; userId: string }): Promise<void> {
    const course = await this.courses.findById(payload.courseId).catch(() => null);
    if (!course?.gradeSettings?.autoIssueCertificate) return;
    try {
      await this.claim(course.tenant, payload.courseId, payload.userId);
    } catch {
      // Requisitos sin cumplir: no hay nada que expedir todavía.
    }
  }

  /** Anula un certificado sin borrarlo, para que su código siga respondiendo. */
  async revoke(code: string, reason: string): Promise<IssuedCertificateDto> {
    const issued = await this.issuedModel.findOne({ code }).exec();
    if (!issued) throw new NotFoundException('Certificado no encontrado.');
    issued.revoked = true;
    issued.revokedReason = reason;
    issued.revokedAt = new Date();
    await issued.save();
    return this.issuedToDto(issued);
  }

  /**
   * Siguiente correlativo de la empresa.
   *
   * Se toma del mayor emitido y no de un contador aparte: un contador que se
   * desincronizara chocaría contra el índice único y dejaría de emitirse nada.
   */
  private async nextSerial(tenantId: string | Types.ObjectId): Promise<number> {
    const last = await this.issuedModel
      .findOne({ tenant: toObjectId(tenantId) })
      .sort({ serial: -1 })
      .select('serial')
      .lean()
      .exec();
    return (last?.serial ?? 0) + 1;
  }

  private async resolveTemplate(
    tenantId: string | Types.ObjectId,
    templateId: string | Types.ObjectId | undefined,
    settings?: { certificateTemplate?: Types.ObjectId | null },
  ): Promise<CertificateTemplateDocument> {
    const chosen = templateId ?? settings?.certificateTemplate ?? undefined;
    const template = chosen
      ? await this.templateModel.findById(toObjectId(chosen)).exec()
      : ((await this.templateModel.findOne({ tenant: toObjectId(tenantId) }).exec()) ??
        (await this.templateModel.create({
          tenant: toObjectId(tenantId),
          name: 'Plantilla predeterminada',
          bodyHtml: DEFAULT_TEMPLATE,
        })));
    if (!template) throw new NotFoundException('Plantilla de certificado no encontrada.');
    return template;
  }

  /* ------------------------------ Consultas ------------------------------ */

  async userCertificates(userId: string | Types.ObjectId): Promise<IssuedCertificateDto[]> {
    const items = await this.issuedModel
      .find({ user: toObjectId(userId) })
      .sort({ issuedAt: -1 })
      .exec();
    return items.map((i) => this.issuedToDto(i));
  }

  async forCourseAndUser(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<IssuedCertificateDto | null> {
    const issued = await this.issuedModel
      .findOne({ course: toObjectId(courseId), user: toObjectId(userId) })
      .exec();
    return issued ? this.issuedToDto(issued) : null;
  }

  async courseCertificates(courseId: string | Types.ObjectId): Promise<IssuedCertificateDto[]> {
    const items = await this.issuedModel
      .find({ course: toObjectId(courseId) })
      .sort({ serial: -1 })
      .exec();
    return items.map((i) => this.issuedToDto(i));
  }

  /* --------------------------- Verificación ------------------------------ */

  /**
   * Comprueba un certificado desde la página pública.
   *
   * Devuelve siempre una respuesta, también para un código inexistente: quien
   * comprueba necesita saber que ese código no vale, y un 404 se confunde con
   * un fallo de la página.
   */
  async verify(code: string): Promise<CertificateVerificationDto> {
    const issued = await this.issuedModel.findOne({ code }).exec();
    if (!issued) {
      return { valid: false, reason: 'No existe ningún certificado con ese código.' };
    }
    if (issued.revoked) {
      return {
        valid: false,
        reason: issued.revokedReason
          ? `Certificado anulado: ${issued.revokedReason}`
          : 'Certificado anulado.',
        code: issued.code,
        serial: issued.serial,
      };
    }
    if (!this.checkSeal(issued)) {
      // El sello no cuadra con lo guardado: alguien tocó el documento en la
      // base de datos. Es exactamente lo que el sello está para detectar.
      return {
        valid: false,
        reason: 'El contenido del certificado no coincide con su sello de autenticidad.',
        code: issued.code,
      };
    }

    const tenant = await this.tenants.findById(issued.tenant).catch(() => null);
    return {
      valid: true,
      code: issued.code,
      serial: issued.serial,
      hash: issued.hash,
      recipient: issued.recipientName,
      course: issued.courseName,
      grade: issued.grade,
      issuedAt: issued.issuedAt.toISOString(),
      tenantName: tenant?.name ?? undefined,
      tenantLogoUrl: tenant?.branding?.logoUrl ?? null,
      downloadUrl: this.downloadUrl(issued),
    };
  }

  private seal(input: {
    code: string;
    serial: number;
    recipientName: string;
    courseName: string;
    grade: number | null;
    issuedAt: Date;
  }): string {
    return sealPayload(
      [
        input.code,
        input.serial,
        input.recipientName,
        input.courseName,
        input.grade,
        input.issuedAt.toISOString(),
      ],
      this.secret,
    );
  }

  private checkSeal(issued: IssuedCertificateDocument): boolean {
    return verifySeal(
      [
        issued.code,
        issued.serial,
        issued.recipientName,
        issued.courseName,
        issued.grade,
        issued.issuedAt.toISOString(),
      ],
      this.secret,
      issued.hash,
    );
  }

  /* ------------------------------ Presentación --------------------------- */

  /**
   * Genera el certificado en HTML.
   *
   * `printable` distingue la copia imprimible de la vista en línea. Un curso
   * configurado como «solo enlace» no entrega la primera: su certificado existe
   * únicamente como página que se comprueba contra el servidor, de modo que no
   * circula ninguna copia que pueda enseñarse alterada.
   */
  async render(code: string, baseUrl: string, printable: boolean): Promise<string> {
    const issued = await this.issuedModel.findOne({ code }).exec();
    if (!issued) throw new NotFoundException('Certificado no encontrado.');

    if (printable && issued.accessMode === CertificateAccessMode.Link) {
      throw new ForbiddenException(
        'Este certificado solo puede consultarse en línea; su curso no permite descargarlo.',
      );
    }

    const [template, tenant] = await Promise.all([
      this.templateModel.findById(issued.template).exec(),
      this.tenants.findById(issued.tenant).catch(() => null),
    ]);
    if (!template) throw new NotFoundException('Plantilla no encontrada.');

    const verifyUrl = `${baseUrl}/certificates/verify/${issued.code}`;
    const qr = template.showQr ? await QRCode.toDataURL(verifyUrl) : null;
    const valid = this.checkSeal(issued) && !issued.revoked;

    const body = Handlebars.compile(template.bodyHtml)({
      nombre: issued.recipientName,
      curso: issued.courseName,
      nota:
        template.showGrade && issued.grade !== null
          ? issued.gradeMax
            ? `${issued.grade} / ${issued.gradeMax}`
            : String(issued.grade)
          : null,
      fecha: template.showDate ? dayjs(issued.issuedAt).format('D [de] MMMM [de] YYYY') : '',
      codigo: issued.code,
      serie: issued.serial,
      empresa: tenant?.name ?? '',
    });

    return this.html({
      issued,
      body,
      qr,
      verifyUrl,
      printable,
      valid,
      orientation: template.orientation,
      backgroundUrl: template.backgroundUrl,
      logoUrl: tenant?.branding?.logoUrl ?? null,
      tenantName: tenant?.name ?? '',
    });
  }

  private html(input: {
    issued: IssuedCertificateDocument;
    body: string;
    qr: string | null;
    verifyUrl: string;
    printable: boolean;
    valid: boolean;
    orientation: 'landscape' | 'portrait';
    backgroundUrl: string | null;
    logoUrl: string | null;
    tenantName: string;
  }): string {
    const { issued } = input;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Certificado ${issued.code} · ${escapeHtml(issued.courseName)}</title>
<style>
  @page { size: A4 ${input.orientation}; margin: 0; }
  body { margin:0; font-family:'Segoe UI',system-ui,sans-serif; color:${MAYA_BRAND.colors.ink};
         background:${MAYA_BRAND.colors.surfaceTint}; display:flex; flex-direction:column;
         align-items:center; justify-content:center; min-height:100vh; gap:1rem; padding:1rem; }
  .certificate { position:relative; width:min(1050px,94vw); aspect-ratio:${input.orientation === 'landscape' ? '1.414' : '0.707'};
                 background:#fff ${input.backgroundUrl ? `url('${input.backgroundUrl}') center/cover` : ''};
                 border:14px solid ${MAYA_BRAND.colors.primary}; border-radius:8px;
                 padding:5% 8%; text-align:center; box-shadow:0 24px 60px rgba(142,42,34,.16);
                 display:flex; flex-direction:column; justify-content:center; gap:.6rem; }
  h1 { font-size:2.4rem; color:${MAYA_BRAND.colors.primaryDeep}; margin:0 0 1rem; letter-spacing:-.02em; }
  .lead { color:#7a6a66; margin:0; font-size:1.05rem; }
  .name { font-size:2.6rem; font-weight:800; margin:.2rem 0; color:${MAYA_BRAND.colors.primaryDark}; }
  .course { font-size:1.7rem; font-weight:700; margin:.2rem 0 1rem; }
  .grade, .date { margin:.2rem 0; }
  footer { margin-top:auto; font-size:.8rem; color:#948a86; }
  .logo { position:absolute; left:6%; top:6%; max-height:64px; max-width:200px; }
  .qr { position:absolute; right:6%; bottom:6%; width:96px; height:96px; }
  .firma { position:absolute; left:8%; bottom:8%; text-align:center; }
  .firma img { display:block; height:64px; margin:0 auto .25rem; }
  .firma span { display:block; border-top:1px solid #cfc4c1; padding-top:.25rem;
                font-size:.72rem; color:#948a86; min-width:180px; }
  .aviso { max-width:min(1050px,94vw); font-size:.82rem; color:#7a6a66; text-align:center; }
  .aviso strong { color:${MAYA_BRAND.colors.primaryDeep}; }
  .anulado { position:absolute; inset:0; display:grid; place-items:center;
             font-size:4rem; font-weight:800; color:rgba(142,42,34,.18);
             transform:rotate(-18deg); letter-spacing:.2em; }
  /* Al imprimir sobra todo lo que no es el propio documento. */
  @media print { .aviso { display:none } body { background:#fff; padding:0 } }
</style></head><body>
<article class="certificate">
  ${input.logoUrl ? `<img class="logo" src="${input.logoUrl}" alt="${escapeHtml(input.tenantName)}">` : ''}
  ${input.body}
  ${
    issued.signatureImage
      ? `<div class="firma"><img src="${issued.signatureImage}" alt="Firma de ${escapeHtml(issued.recipientName)}"><span>${escapeHtml(issued.recipientName)}</span></div>`
      : ''
  }
  ${input.qr ? `<img class="qr" src="${input.qr}" alt="Código QR de verificación">` : ''}
  ${input.valid ? '' : '<div class="anulado">ANULADO</div>'}
</article>
<p class="aviso">
  ${
    input.valid
      ? `Certificado n.º <strong>${issued.serial}</strong> · código <strong>${issued.code}</strong>.
         Compruebe su autenticidad en <a href="${input.verifyUrl}">${input.verifyUrl}</a>.`
      : 'Este certificado no es válido: ha sido anulado o su contenido no coincide con el sello registrado.'
  }
  ${
    input.printable
      ? ''
      : '<br>Este certificado solo puede consultarse en línea. Comparta el enlace o el código QR para acreditarlo.'
  }
</p>
</body></html>`;
  }

  /* ---------------------------- Serialización ---------------------------- */

  private downloadUrl(issued: IssuedCertificateDocument): string | null {
    if (issued.revoked) return null;
    return issued.accessMode === CertificateAccessMode.Link
      ? null
      : `/api/v1/certificates/${issued.code}/render`;
  }

  private toDto(template: CertificateTemplateDocument): CertificateTemplateDto {
    return {
      id: template.id,
      tenantId: String(template.tenant),
      name: template.name,
      backgroundUrl: template.backgroundUrl,
      bodyHtml: template.bodyHtml,
      orientation: template.orientation,
      showGrade: template.showGrade,
      showDate: template.showDate,
      showQr: template.showQr,
    };
  }

  issuedToDto(issued: IssuedCertificateDocument): IssuedCertificateDto {
    return {
      id: issued.id,
      templateId: String(issued.template),
      courseId: String(issued.course),
      courseName: issued.courseName,
      userId: String(issued.user),
      userName: issued.recipientName,
      code: issued.code,
      serial: issued.serial,
      hash: issued.hash,
      issuedAt: issued.issuedAt.toISOString(),
      grade: issued.grade,
      accessMode: issued.accessMode,
      revoked: issued.revoked,
      revokedReason: issued.revokedReason,
      verifyUrl: `/certificates/verify/${issued.code}`,
      downloadUrl: this.downloadUrl(issued),
    };
  }
}

/** Escapa lo que se interpola en el HTML del certificado. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

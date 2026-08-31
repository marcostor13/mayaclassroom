import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Handlebars from 'handlebars';
import * as QRCode from 'qrcode';
import { CertificateTemplateDto, IssuedCertificateDto, MAYA_BRAND } from '@maya/shared';
import {
  CertificateTemplate,
  CertificateTemplateDocument,
  IssuedCertificate,
  IssuedCertificateDocument,
} from './schemas/certificate.schema';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import { GradesService } from '../grades/grades.service';
import { dayjs, randomCode, toObjectId } from '../../common/utils';

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
    private readonly grades: GradesService,
  ) {}

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

    const template = params.templateId
      ? await this.templateModel.findById(toObjectId(params.templateId)).exec()
      : (await this.templateModel.findOne({ tenant: toObjectId(params.tenantId) }).exec()) ??
        (await this.templateModel.create({
          tenant: toObjectId(params.tenantId),
          name: 'Plantilla predeterminada',
          bodyHtml: DEFAULT_TEMPLATE,
        }));
    if (!template) throw new NotFoundException('Plantilla de certificado no encontrada.');

    const totalItem = await this.grades.courseTotalItem(params.courseId);
    const grade = await this.grades.userGradeForItem(totalItem._id, params.userId);

    const issued = await this.issuedModel.create({
      tenant: toObjectId(params.tenantId),
      template: template._id,
      course: toObjectId(params.courseId),
      user: toObjectId(params.userId),
      code: `MAYA-${randomCode(10)}`,
      grade: grade?.finalGrade ?? null,
    });
    return this.issuedToDto(issued);
  }

  async userCertificates(userId: string | Types.ObjectId): Promise<IssuedCertificateDto[]> {
    const items = await this.issuedModel
      .find({ user: toObjectId(userId) })
      .sort({ issuedAt: -1 })
      .exec();
    return items.map((i) => this.issuedToDto(i));
  }

  /** Genera el HTML imprimible del certificado. */
  async render(code: string, baseUrl: string): Promise<string> {
    const issued = await this.issuedModel.findOne({ code }).exec();
    if (!issued) throw new NotFoundException('Certificado no encontrado.');

    const [template, user, course] = await Promise.all([
      this.templateModel.findById(issued.template).exec(),
      this.users.findById(issued.user),
      this.courses.findById(issued.course),
    ]);
    if (!template) throw new NotFoundException('Plantilla no encontrada.');

    const qr = template.showQr
      ? await QRCode.toDataURL(`${baseUrl}/certificates/verify/${issued.code}`)
      : null;

    const body = Handlebars.compile(template.bodyHtml)({
      nombre: `${user.firstName} ${user.lastName}`,
      curso: course.fullName,
      nota: template.showGrade ? issued.grade : null,
      fecha: template.showDate ? dayjs(issued.issuedAt).format('D [de] MMMM [de] YYYY') : '',
      codigo: issued.code,
    });

    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Certificado · ${course.fullName}</title>
<style>
  @page { size: A4 ${template.orientation}; margin: 0; }
  body { margin:0; font-family:'Segoe UI',system-ui,sans-serif; color:${MAYA_BRAND.colors.ink};
         background:${MAYA_BRAND.colors.surfaceTint}; display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .certificate { position:relative; width:min(1050px,94vw); aspect-ratio:${template.orientation === 'landscape' ? '1.414' : '0.707'};
                 background:#fff ${template.backgroundUrl ? `url('${template.backgroundUrl}') center/cover` : ''};
                 border:14px solid ${MAYA_BRAND.colors.primary}; border-radius:8px;
                 padding:5% 8%; text-align:center; box-shadow:0 24px 60px rgba(142,42,34,.16);
                 display:flex; flex-direction:column; justify-content:center; gap:.6rem; }
  h1 { font-size:2.4rem; color:${MAYA_BRAND.colors.primaryDeep}; margin:0 0 1rem; letter-spacing:-.02em; }
  .lead { color:#7a6a66; margin:0; font-size:1.05rem; }
  .name { font-size:2.6rem; font-weight:800; margin:.2rem 0; color:${MAYA_BRAND.colors.primaryDark}; }
  .course { font-size:1.7rem; font-weight:700; margin:.2rem 0 1rem; }
  .grade, .date { margin:.2rem 0; }
  footer { margin-top:auto; font-size:.8rem; color:#948a86; }
  .qr { position:absolute; right:6%; bottom:6%; width:96px; height:96px; }
</style></head><body>${body}
${qr ? `<img class="qr" src="${qr}" alt="Código QR de verificación">` : ''}
</body></html>`;
  }

  async verify(code: string) {
    const issued = await this.issuedModel
      .findOne({ code })
      .populate('user', 'firstName lastName')
      .populate('course', 'fullName')
      .exec();
    if (!issued) throw new NotFoundException('Certificado no encontrado.');

    const user = issued.user as unknown as { firstName: string; lastName: string };
    const course = issued.course as unknown as { fullName: string };
    return {
      valid: true,
      code: issued.code,
      recipient: `${user.firstName} ${user.lastName}`,
      course: course.fullName,
      grade: issued.grade,
      issuedAt: issued.issuedAt.toISOString(),
    };
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

  private issuedToDto(issued: IssuedCertificateDocument): IssuedCertificateDto {
    return {
      id: issued.id,
      templateId: String(issued.template),
      courseId: String(issued.course),
      userId: String(issued.user),
      code: issued.code,
      issuedAt: issued.issuedAt.toISOString(),
      grade: issued.grade,
      verifyUrl: `/certificates/verify/${issued.code}`,
      downloadUrl: `/api/v1/certificates/${issued.code}/render`,
    };
  }
}

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CourseVisibility,
  EnrolmentRequestStatus,
  TenantStatus,
  UserStatus,
} from '@maya/shared';
import type {
  EnrolmentRequestDto,
  EnrolmentRequestResult,
  PublicCourseDto,
  PublicSiteDto,
  TenantSiteDto,
} from '@maya/shared';
import { TenantSite, TenantSiteDocument, SiteSectionSchema } from './schemas/tenant-site.schema';
import {
  EnrolmentRequest,
  EnrolmentRequestDocument,
} from './schemas/enrolment-request.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { toObjectId } from '../../common/utils';
import { DEFAULT_TEMPLATE, defaultSections } from './site.defaults';
import type {
  CreateEnrolmentRequestDto,
  ResolveRequestDto,
  SiteSectionDto,
  UpdateSiteDto,
} from './dto/site.dto';

/**
 * Un campo que el editor no envía es un campo que se vacía, no uno que se
 * conserva: `undefined` en Mongoose deja el valor anterior, y al desactivar un
 * subtítulo volvería a aparecer el de antes.
 */
function normalizeSection(section: SiteSectionDto): SiteSectionSchema {
  return {
    id: section.id,
    type: section.type,
    enabled: section.enabled,
    title: section.title ?? null,
    subtitle: section.subtitle ?? null,
    body: section.body ?? null,
    imageUrl: section.imageUrl ?? null,
    ctaLabel: section.ctaLabel ?? null,
    ctaUrl: section.ctaUrl ?? null,
    items: (section.items ?? []).map((item) => ({
      title: item.title,
      body: item.body ?? null,
      imageUrl: item.imageUrl ?? null,
      author: item.author ?? null,
    })),
    limit: section.limit ?? null,
  };
}

@Injectable()
export class SiteService {
  private readonly logger = new Logger(SiteService.name);

  constructor(
    @InjectModel(TenantSite.name) private readonly siteModel: Model<TenantSiteDocument>,
    @InjectModel(EnrolmentRequest.name)
    private readonly requestModel: Model<EnrolmentRequestDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    private readonly tenants: TenantsService,
    private readonly users: UsersService,
    private readonly enrolments: EnrolmentsService,
  ) {}

  /* ------------------------------ Administración -------------------------- */

  /**
   * La página de la empresa, creándola con contenido de ejemplo la primera vez.
   * Crear al leer evita una pantalla vacía con un botón «crear página» que no
   * decide nada: siempre hay exactamente una página por empresa.
   */
  async forTenant(tenantId: string | Types.ObjectId): Promise<TenantSiteDocument> {
    const tenant = toObjectId(tenantId);
    const existing = await this.siteModel.findOne({ tenant }).exec();
    if (existing) return existing;

    const { name } = await this.tenants.findById(tenant);
    return this.siteModel.create({
      tenant,
      published: false,
      template: DEFAULT_TEMPLATE,
      sections: defaultSections(name),
      seo: { title: name, description: null, imageUrl: null },
      contact: {},
    });
  }

  async update(tenantId: string | Types.ObjectId, dto: UpdateSiteDto): Promise<TenantSiteDocument> {
    const site = await this.forTenant(tenantId);
    if (dto.published !== undefined) site.published = dto.published;
    if (dto.template) site.template = dto.template;
    if (dto.sections) {
      this.assertUniqueIds(dto.sections.map((section) => section.id));
      site.sections = dto.sections.map((section) => normalizeSection(section));
    }
    if (dto.seo) site.seo = { ...site.seo, ...dto.seo };
    if (dto.contact) site.contact = { ...site.contact, ...dto.contact };
    await site.save();
    return site;
  }

  /**
   * El identificador de sección es el ancla del enlace («#cursos») y la clave
   * de `track` al reordenar en el editor. Repetido, el navegador salta a la
   * primera y el editor mezcla dos secciones al arrastrar.
   */
  private assertUniqueIds(ids: string[]): void {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        throw new BadRequestException(`Hay dos secciones con el identificador «${id}».`);
      }
      seen.add(id);
    }
  }

  toDto(site: TenantSiteDocument): TenantSiteDto {
    return {
      id: site.id as string,
      published: site.published,
      template: site.template,
      sections: site.sections,
      seo: site.seo,
      contact: site.contact,
      updatedAt: (site.get('updatedAt') as Date | undefined)?.toISOString() ?? '',
    };
  }

  /* --------------------------------- Público ------------------------------ */

  /**
   * Todo lo que necesita la página pública en una sola petición.
   *
   * Va junto y no en tres llamadas porque es la primera pantalla que ve un
   * visitante: tres viajes encadenados se notan, y aquí no hay sesión ni caché
   * de aplicación que los disimule.
   */
  async publicSite(slug: string): Promise<PublicSiteDto> {
    const tenant = await this.tenants.requireBySlug(slug);
    if (tenant.status === TenantStatus.Suspended || tenant.status === TenantStatus.Archived) {
      throw new NotFoundException('Esta página no está disponible.');
    }

    const site = await this.siteModel.findOne({ tenant: tenant._id }).exec();
    // Sin publicar equivale a no existir: no se distingue de una empresa que
    // nunca creó su página, para no delatar quién la tiene a medias.
    if (!site?.published) throw new NotFoundException('Esta página no está disponible.');

    const courses = await this.listedCourses(tenant._id);
    const categories = await this.categoriesOf(courses);

    return {
      tenant: {
        id: tenant.id as string,
        slug: tenant.slug,
        name: tenant.name,
        logoUrl: tenant.branding?.logoUrl ?? null,
        primaryColor: tenant.branding?.primaryColor ?? null,
        accentColor: tenant.branding?.accentColor ?? null,
      },
      site: this.toDto(site),
      courses,
      categories,
    };
  }

  /** Cursos a la venta: marcados para el catálogo y no ocultos. */
  private async listedCourses(tenantId: Types.ObjectId): Promise<PublicCourseDto[]> {
    const courses = await this.courseModel
      .find({
        tenant: tenantId,
        'catalog.listed': true,
        visibility: CourseVisibility.Visible,
        deletedAt: null,
      })
      .sort({ sortOrder: 1, fullName: 1 })
      .exec();

    // Los nombres de categoría se resuelven en una consulta aparte en lugar de
    // con `populate`: son un puñado, se repiten mucho entre cursos y así el
    // documento sigue siendo un `CourseDocument` corriente.
    const names = await this.categoryNames(courses.map((course) => course.category));

    return courses.map((course) => ({
      id: course.id as string,
      title: course.fullName,
      summary: course.summary,
      imageUrl: course.imageUrl,
      categoryId: course.category?.toString() ?? null,
      categoryName: names.get(course.category?.toString() ?? '') ?? null,
      tags: course.tags,
      catalog: {
        listed: course.catalog.listed,
        priceCents: course.catalog.priceCents,
        currency: course.catalog.currency,
        headline: course.catalog.headline,
        highlights: course.catalog.highlights,
        level: course.catalog.level,
        durationHours: course.catalog.durationHours,
      },
      enrolledCount: course.enrolledCount,
    }));
  }

  private async categoryNames(ids: (Types.ObjectId | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is Types.ObjectId => !!id).map(String))];
    if (unique.length === 0) return new Map();
    const categories = await this.categoryModel
      .find({ _id: { $in: unique.map((id) => toObjectId(id)) } })
      .select('name')
      .exec();
    return new Map(categories.map((category) => [category._id.toString(), category.name]));
  }

  /** Categorías deducidas del propio catálogo, para no ofrecer filtros vacíos. */
  private async categoriesOf(
    courses: PublicCourseDto[],
  ): Promise<{ id: string; name: string; courseCount: number }[]> {
    const counts = new Map<string, { name: string; count: number }>();
    for (const course of courses) {
      if (!course.categoryId) continue;
      const entry = counts.get(course.categoryId);
      if (entry) entry.count += 1;
      else counts.set(course.categoryId, { name: course.categoryName ?? '', count: 1 });
    }
    return [...counts.entries()]
      .map(([id, { name, count }]) => ({ id, name, courseCount: count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /* --------------------------- Solicitudes de plaza ----------------------- */

  /**
   * Solicitud enviada desde la página pública.
   *
   * Los cursos gratuitos se resuelven al momento —cuenta creada y matrícula
   * hecha— porque no hay nada que aprobar y hacer esperar sin motivo pierde a
   * quien acaba de decidirse. Los de pago quedan pendientes: el cobro ocurre
   * fuera de la plataforma y solo la empresa sabe cuándo se ha producido.
   */
  async createRequest(
    slug: string,
    dto: CreateEnrolmentRequestDto,
  ): Promise<EnrolmentRequestResult> {
    const tenant = await this.tenants.requireBySlug(slug);
    const site = await this.siteModel.findOne({ tenant: tenant._id }).exec();
    if (!site?.published) throw new NotFoundException('Esta página no está disponible.');

    const course = await this.courseModel
      .findOne({
        _id: toObjectId(dto.courseId),
        tenant: tenant._id,
        'catalog.listed': true,
        visibility: CourseVisibility.Visible,
        deletedAt: null,
      })
      .exec();
    if (!course) throw new NotFoundException('Ese curso no está disponible.');

    const email = dto.email.toLowerCase().trim();
    const request = await this.requestModel.create({
      tenant: tenant._id,
      course: course._id,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email,
      phone: dto.phone ?? null,
      message: dto.message ?? null,
      status: EnrolmentRequestStatus.Pending,
    });

    if (course.catalog.priceCents > 0) {
      return {
        enrolled: false,
        status: EnrolmentRequestStatus.Pending,
        message:
          'Hemos recibido su solicitud. Le escribiremos para confirmar la plaza y el pago.',
      };
    }

    await this.approve(request, tenant._id);
    return {
      enrolled: true,
      status: EnrolmentRequestStatus.Approved,
      message:
        'Ya está matriculado. Le hemos enviado por correo los datos para entrar en la plataforma.',
    };
  }

  async listRequests(
    tenantId: string | Types.ObjectId,
    status?: EnrolmentRequestStatus,
  ): Promise<EnrolmentRequestDto[]> {
    const filter: Record<string, unknown> = { tenant: toObjectId(tenantId), deletedAt: null };
    if (status) filter.status = status;
    const requests = await this.requestModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();

    const titles = await this.courseTitles(requests.map((request) => request.course));
    return requests.map((request) =>
      this.toRequestDto(request, titles.get(request.course.toString()) ?? ''),
    );
  }

  private async courseTitles(ids: Types.ObjectId[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.map(String))];
    if (unique.length === 0) return new Map();
    const courses = await this.courseModel
      .find({ _id: { $in: unique.map((id) => toObjectId(id)) } })
      .select('fullName')
      .exec();
    return new Map(courses.map((course) => [course._id.toString(), course.fullName]));
  }

  toRequestDto(request: EnrolmentRequestDocument, courseTitle: string): EnrolmentRequestDto {
    return {
      id: request.id as string,
      course: { id: request.course.toString(), title: courseTitle },
      firstName: request.firstName,
      lastName: request.lastName,
      email: request.email,
      phone: request.phone,
      message: request.message,
      status: request.status,
      note: request.note,
      createdAt: (request.get('createdAt') as Date | undefined)?.toISOString() ?? '',
      updatedAt: (request.get('updatedAt') as Date | undefined)?.toISOString() ?? '',
    };
  }

  async resolveRequest(
    tenantId: string | Types.ObjectId,
    id: string,
    dto: ResolveRequestDto,
  ): Promise<EnrolmentRequestDto> {
    const tenant = toObjectId(tenantId);
    const request = await this.requestModel
      .findOne({ _id: toObjectId(id), tenant, deletedAt: null })
      .exec();
    if (!request) throw new NotFoundException('La solicitud no existe.');
    if (request.status !== EnrolmentRequestStatus.Pending) {
      throw new BadRequestException('Esta solicitud ya estaba resuelta.');
    }

    request.note = dto.note ?? null;
    if (dto.status === EnrolmentRequestStatus.Approved) {
      await this.approve(request, tenant);
    } else {
      request.status = EnrolmentRequestStatus.Rejected;
      await request.save();
    }
    const titles = await this.courseTitles([request.course]);
    return this.toRequestDto(request, titles.get(request.course.toString()) ?? '');
  }

  /**
   * Aprueba una solicitud: cuenta y matrícula.
   *
   * Si ya existe una cuenta con ese correo en la empresa se reutiliza, en lugar
   * de fallar por correo duplicado: quien se apunta a un segundo curso es la
   * misma persona, y una cuenta nueva le partiría el expediente en dos.
   */
  private async approve(
    request: EnrolmentRequestDocument,
    tenantId: Types.ObjectId,
  ): Promise<void> {
    let user = await this.users.findByEmail(request.email, tenantId);
    if (!user) {
      user = await this.users.create(tenantId, {
        email: request.email,
        username: request.email,
        firstName: request.firstName,
        lastName: request.lastName,
        status: UserStatus.Pending,
        initialRole: 'student',
      });
      // Sin contraseña: entra por el enlace de «he olvidado mi contraseña»,
      // que ya sabe encontrar la cuenta sin preguntar por la empresa.
      this.logger.log(`Cuenta creada desde el escaparate: ${user.email}`);
    }

    await this.enrolments.enrol({
      courseId: request.course,
      tenantId,
      userId: user._id,
      roleShortName: 'student',
    });

    request.status = EnrolmentRequestStatus.Approved;
    request.user = user._id;
    await request.save();
  }
}

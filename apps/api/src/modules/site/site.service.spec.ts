import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EnrolmentRequestStatus, SiteSectionType, SiteTemplate, TenantStatus } from '@maya/shared';
import { SiteService } from './site.service';
import { TenantSite } from './schemas/tenant-site.schema';
import { EnrolmentRequest } from './schemas/enrolment-request.schema';
import { Course } from '../courses/schemas/course.schema';
import { CourseSection } from '../courses/schemas/course-section.schema';
import { CourseModule } from '../courses/schemas/course-module.schema';
import { Category } from '../categories/schemas/category.schema';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import type { CreateEnrolmentRequestDto, UpdateSiteDto } from './dto/site.dto';

type MockFn = ReturnType<typeof jest.fn>;

const TENANT = new Types.ObjectId();
const COURSE = new Types.ObjectId();
const USER = new Types.ObjectId();

const tenantDouble = {
  _id: TENANT,
  id: TENANT.toString(),
  slug: 'acme',
  name: 'Acme',
  status: TenantStatus.Active,
  branding: { logoUrl: null, primaryColor: '#ff0000', accentColor: '#00ff00' },
};

function siteDouble(published: boolean) {
  return {
    id: 'site-1',
    published,
    template: SiteTemplate.Classic,
    sections: [],
    seo: {},
    contact: {},
    get: () => new Date(),
    save: jest.fn(async () => undefined),
  };
}

function courseDouble(priceCents: number) {
  return {
    _id: COURSE,
    id: COURSE.toString(),
    fullName: 'Curso de prueba',
    summary: null,
    imageUrl: null,
    category: null,
    tags: [],
    enrolledCount: 0,
    catalog: { listed: true, priceCents, currency: 'EUR', highlights: [] },
  };
}

/** Doble de modelo: solo lo que usa el servicio, con `exec()` encadenado. */
function modelStub(options: { findOne?: unknown; find?: unknown[]; create?: MockFn }) {
  return {
    findOne: jest.fn(() => ({ exec: async () => options.findOne ?? null })),
    find: jest.fn(() => ({
      sort: () => ({ limit: () => ({ exec: async () => options.find ?? [] }), exec: async () => options.find ?? [] }),
      select: () => ({ exec: async () => options.find ?? [] }),
      exec: async () => options.find ?? [],
    })),
    create: options.create ?? jest.fn(async (doc: Record<string, unknown>) => ({ ...doc, save: jest.fn() })),
  };
}

async function build(options: {
  site?: ReturnType<typeof siteDouble> | null;
  course?: ReturnType<typeof courseDouble> | null;
  existingUser?: unknown;
  createdRequest?: Record<string, unknown>;
}) {
  const request = options.createdRequest ?? {
    _id: new Types.ObjectId(),
    id: 'req-1',
    course: COURSE,
    email: 'ana@ejemplo.com',
    firstName: 'Ana',
    lastName: 'Pérez',
    status: EnrolmentRequestStatus.Pending,
    save: jest.fn(async () => undefined),
    get: () => new Date(),
  };

  const siteModel = modelStub({ findOne: options.site ?? null });
  const requestModel = modelStub({ create: jest.fn(async () => request) });
  const courseModel = modelStub({
    findOne: options.course ?? null,
    find: options.course ? [options.course] : [],
  });
  const categoryModel = modelStub({ find: [] });
  // El temario de la ficha de venta se arma con secciones y módulos; en estas
  // pruebas no hay ninguno y basta con que el modelo exista.
  const sectionModel = modelStub({ find: [] });
  const courseModuleModel = modelStub({ find: [] });

  const users = {
    findByEmail: jest.fn(async () => options.existingUser ?? null),
    create: jest.fn(async () => ({ _id: USER, id: USER.toString(), email: 'ana@ejemplo.com' })),
  };
  const enrolments = { enrol: jest.fn(async () => ({})) };
  const tenants = {
    requireBySlug: jest.fn(async () => tenantDouble),
    findById: jest.fn(async () => tenantDouble),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      SiteService,
      { provide: getModelToken(TenantSite.name), useValue: siteModel },
      { provide: getModelToken(EnrolmentRequest.name), useValue: requestModel },
      { provide: getModelToken(Course.name), useValue: courseModel },
      { provide: getModelToken(CourseSection.name), useValue: sectionModel },
      { provide: getModelToken(CourseModule.name), useValue: courseModuleModel },
      { provide: getModelToken(Category.name), useValue: categoryModel },
      { provide: TenantsService, useValue: tenants },
      { provide: UsersService, useValue: users },
      { provide: EnrolmentsService, useValue: enrolments },
    ],
  }).compile();

  return { service: moduleRef.get(SiteService), users, enrolments, request, siteModel };
}

const solicitud = {
  courseId: COURSE.toString(),
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@ejemplo.com',
} as CreateEnrolmentRequestDto;

describe('SiteService · página pública', () => {
  it('no muestra la página mientras no está publicada', async () => {
    const { service } = await build({ site: siteDouble(false) });

    await expect(service.publicSite('acme')).rejects.toThrow('no está disponible');
  });

  it('no distingue entre página sin publicar y empresa sin página', async () => {
    // El mismo mensaje en ambos casos: si fueran distintos, se podría deducir
    // desde fuera qué empresas tienen la página a medio hacer.
    const sinPagina = await build({ site: null });
    const sinPublicar = await build({ site: siteDouble(false) });

    const a = await sinPagina.service.publicSite('acme').catch((e: Error) => e.message);
    const b = await sinPublicar.service.publicSite('acme').catch((e: Error) => e.message);
    expect(a).toBe(b);
  });

  it('rechaza dos secciones con el mismo identificador', async () => {
    const { service } = await build({ site: siteDouble(true) });
    const dto = {
      sections: [
        { id: 'cursos', type: SiteSectionType.Courses, enabled: true },
        { id: 'cursos', type: SiteSectionType.Faq, enabled: true },
      ],
    } as UpdateSiteDto;

    await expect(service.update(TENANT, dto)).rejects.toThrow('dos secciones');
  });
});

describe('SiteService · solicitudes de plaza', () => {
  it('matricula al momento cuando el curso es gratuito', async () => {
    const { service, users, enrolments } = await build({
      site: siteDouble(true),
      course: courseDouble(0),
    });

    const result = await service.createRequest('acme', solicitud);

    expect(result.enrolled).toBe(true);
    expect(result.status).toBe(EnrolmentRequestStatus.Approved);
    expect(users.create).toHaveBeenCalledTimes(1);
    expect(enrolments.enrol).toHaveBeenCalledTimes(1);
  });

  it('deja pendiente el curso de pago, sin crear cuenta ni matricular', async () => {
    const { service, users, enrolments } = await build({
      site: siteDouble(true),
      course: courseDouble(9900),
    });

    const result = await service.createRequest('acme', solicitud);

    expect(result.enrolled).toBe(false);
    expect(result.status).toBe(EnrolmentRequestStatus.Pending);
    expect(users.create).not.toHaveBeenCalled();
    expect(enrolments.enrol).not.toHaveBeenCalled();
  });

  it('reutiliza la cuenta existente en vez de duplicarla', async () => {
    const existing = { _id: USER, id: USER.toString(), email: 'ana@ejemplo.com' };
    const { service, users, enrolments } = await build({
      site: siteDouble(true),
      course: courseDouble(0),
      existingUser: existing,
    });

    await service.createRequest('acme', solicitud);

    expect(users.create).not.toHaveBeenCalled();
    expect(enrolments.enrol).toHaveBeenCalledTimes(1);
  });

  it('no acepta solicitudes de un curso que no está en el catálogo', async () => {
    const { service } = await build({ site: siteDouble(true), course: null });

    await expect(service.createRequest('acme', solicitud)).rejects.toThrow('no está disponible');
  });
});

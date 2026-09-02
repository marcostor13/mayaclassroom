import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ContextLevel, EnrolmentStatus, UserStatus } from '@maya/shared';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { RoleAssignment } from '../rbac/schemas/role-assignment.schema';
import { Enrolment } from '../enrolments/schemas/enrolment.schema';
import { Course } from '../courses/schemas/course.schema';
import { IssuedBadge } from '../badges/schemas/badge.schema';
import { ContextsService } from '../contexts/contexts.service';
import { RolesService } from '../rbac/roles.service';
import { TenantsService } from '../tenants/tenants.service';

const TENANT = new Types.ObjectId();
const USER = new Types.ObjectId();
const CURSO = new Types.ObjectId();

const usuario = {
  _id: USER,
  id: USER.toString(),
  email: 'ana@ejemplo.com',
  firstName: 'Ana',
  lastName: 'Ruiz',
  status: UserStatus.Active,
  toJSON: () => ({ id: USER.toString(), email: 'ana@ejemplo.com', firstName: 'Ana' }),
};

function asignacion(role: unknown, context: unknown) {
  return { user: USER, tenant: TENANT, role, context };
}

async function build(options: {
  assignments?: unknown[];
  enrolments?: unknown[];
  courses?: unknown[];
  badges?: number;
}) {
  const userModel = {
    findOne: jest.fn(() => ({ exec: async () => usuario })),
  };
  const assignmentModel = {
    find: jest.fn(() => ({
      populate: () => ({
        populate: () => ({ exec: async () => options.assignments ?? [] }),
      }),
    })),
  };
  const enrolmentModel = {
    find: jest.fn(() => ({ exec: async () => options.enrolments ?? [] })),
  };
  const courseModel = {
    find: jest.fn(() => ({ select: () => ({ exec: async () => options.courses ?? [] }) })),
  };
  const issuedBadgeModel = {
    countDocuments: jest.fn(() => ({ exec: async () => options.badges ?? 0 })),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      UsersService,
      { provide: getModelToken(User.name), useValue: userModel },
      { provide: getModelToken(RoleAssignment.name), useValue: assignmentModel },
      { provide: getModelToken(Enrolment.name), useValue: enrolmentModel },
      { provide: getModelToken(Course.name), useValue: courseModel },
      { provide: getModelToken(IssuedBadge.name), useValue: issuedBadgeModel },
      { provide: ContextsService, useValue: {} },
      { provide: RolesService, useValue: {} },
      { provide: TenantsService, useValue: {} },
    ],
  }).compile();

  return { service: moduleRef.get(UsersService) };
}

describe('UsersService · ficha de usuario', () => {
  it('reúne roles, cursos e insignias en una sola respuesta', async () => {
    const { service } = await build({
      assignments: [
        asignacion(
          { _id: new Types.ObjectId(), name: 'Estudiante', shortName: 'student' },
          { level: ContextLevel.Tenant, label: 'Academia Maya', instanceId: TENANT },
        ),
      ],
      enrolments: [
        {
          course: CURSO,
          status: EnrolmentStatus.Active,
          progress: 42,
          lastAccess: new Date('2026-01-15T10:00:00.000Z'),
        },
      ],
      courses: [{ _id: CURSO, shortName: 'ANG-22', fullName: 'Angular 22' }],
      badges: 3,
    });

    const ficha = await service.profile(USER, TENANT);

    expect(ficha.roles).toHaveLength(1);
    expect(ficha.roles[0].contextLabel).toBe('Academia Maya');
    expect(ficha.courses).toHaveLength(1);
    expect(ficha.courses[0].shortName).toBe('ANG-22');
    expect(ficha.courses[0].progress).toBe(42);
    expect(ficha.courses[0].lastAccess).toBe('2026-01-15T10:00:00.000Z');
    expect(ficha.badgeCount).toBe(3);
  });

  it('dice con qué papel participa en cada curso', async () => {
    const { service } = await build({
      assignments: [
        asignacion(
          { _id: new Types.ObjectId(), name: 'Profesor', shortName: 'editingteacher' },
          { level: ContextLevel.Course, label: 'Angular 22', instanceId: CURSO },
        ),
      ],
      enrolments: [{ course: CURSO, status: EnrolmentStatus.Active, progress: 0, lastAccess: null }],
      courses: [{ _id: CURSO, shortName: 'ANG-22', fullName: 'Angular 22' }],
    });

    const ficha = await service.profile(USER, TENANT);

    expect(ficha.courses[0].roleName).toBe('Profesor');
  });

  it('ignora las asignaciones cuyo rol o contexto ya no existen', async () => {
    // Restos de un borrado a medias: no deben reventar la ficha entera.
    const { service } = await build({
      assignments: [
        asignacion(null, { level: ContextLevel.Tenant, label: 'X', instanceId: TENANT }),
        asignacion({ _id: new Types.ObjectId(), name: 'Estudiante', shortName: 'student' }, null),
      ],
    });

    const ficha = await service.profile(USER, TENANT);

    expect(ficha.roles).toEqual([]);
  });

  it('no lista una matrícula cuyo curso se ha borrado', async () => {
    const { service } = await build({
      enrolments: [{ course: CURSO, status: EnrolmentStatus.Active, progress: 0, lastAccess: null }],
      courses: [],
    });

    const ficha = await service.profile(USER, TENANT);

    expect(ficha.courses).toEqual([]);
  });
});

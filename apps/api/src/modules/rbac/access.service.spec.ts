import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ContextLevel, PermissionValue } from '@maya/shared';
import { AccessService } from './access.service';
import { Role } from './schemas/role.schema';
import { RoleCapability } from './schemas/role-capability.schema';
import { RoleAssignment } from './schemas/role-assignment.schema';
import { Context } from '../contexts/schemas/context.schema';
import { ContextsService } from '../contexts/contexts.service';

const SYSTEM = new Types.ObjectId();
const TENANT = new Types.ObjectId();
const COURSE = new Types.ObjectId();

const STUDENT_ROLE = new Types.ObjectId();
const TEACHER_ROLE = new Types.ObjectId();
const USER = new Types.ObjectId();

const COURSE_PATH = `/${SYSTEM}/${TENANT}/${COURSE}/`;

const courseContext = {
  _id: COURSE,
  id: COURSE.toString(),
  level: ContextLevel.Course,
  path: COURSE_PATH,
  depth: 2,
} as never;

/** Devuelve un doble de modelo Mongoose con `find(...).lean().exec()`. */
function modelStub(rows: unknown[]) {
  const chain = {
    lean: () => chain,
    exec: async () => rows,
    sort: () => chain,
    populate: () => chain,
    select: () => chain,
  };
  return {
    find: jest.fn(() => chain),
    findOne: jest.fn(() => chain),
    countDocuments: jest.fn(() => chain),
    distinct: jest.fn(async () => []),
  };
}

describe('AccessService · resolución de capacidades', () => {
  async function build(options: {
    assignments: unknown[];
    capabilities: unknown[];
    contexts?: unknown[];
  }) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccessService,
        { provide: getModelToken(Role.name), useValue: modelStub([]) },
        {
          provide: getModelToken(RoleCapability.name),
          useValue: modelStub(options.capabilities),
        },
        {
          provide: getModelToken(RoleAssignment.name),
          useValue: modelStub(options.assignments),
        },
        {
          provide: getModelToken(Context.name),
          useValue: modelStub(
            options.contexts ?? [
              { _id: SYSTEM, depth: 0 },
              { _id: TENANT, depth: 1 },
              { _id: COURSE, depth: 2 },
            ],
          ),
        },
        {
          provide: ContextsService,
          useValue: {
            parentIdsFromPath: (path: string) =>
              path.split('/').filter(Boolean).map((id) => new Types.ObjectId(id)),
            findById: async () => courseContext,
          },
        },
      ],
    }).compile();

    return moduleRef.get(AccessService);
  }

  it('concede la capacidad cuando el rol la permite en el contexto del curso', async () => {
    const access = await build({
      assignments: [{ role: STUDENT_ROLE, user: USER, contextPath: COURSE_PATH }],
      capabilities: [
        { role: STUDENT_ROLE, capability: 'moodle/course:view', permission: PermissionValue.Allow, context: null },
      ],
    });

    await expect(
      access.hasCapability({ userId: USER }, 'moodle/course:view', courseContext),
    ).resolves.toBe(true);
  });

  it('deniega la capacidad si el rol no la tiene definida', async () => {
    const access = await build({
      assignments: [{ role: STUDENT_ROLE, user: USER, contextPath: COURSE_PATH }],
      capabilities: [],
    });

    await expect(
      access.hasCapability({ userId: USER }, 'moodle/course:update', courseContext),
    ).resolves.toBe(false);
  });

  it('PROHIBIT gana aunque otro rol conceda la capacidad', async () => {
    const access = await build({
      assignments: [
        { role: STUDENT_ROLE, user: USER, contextPath: COURSE_PATH },
        { role: TEACHER_ROLE, user: USER, contextPath: COURSE_PATH },
      ],
      capabilities: [
        { role: TEACHER_ROLE, capability: 'mod/forum:replypost', permission: PermissionValue.Allow, context: null },
        { role: STUDENT_ROLE, capability: 'mod/forum:replypost', permission: PermissionValue.Prohibit, context: null },
      ],
    });

    await expect(
      access.hasCapability({ userId: USER }, 'mod/forum:replypost', courseContext),
    ).resolves.toBe(false);
  });

  it('la anulación en el contexto del curso pesa más que la definición base del rol', async () => {
    const access = await build({
      assignments: [{ role: STUDENT_ROLE, user: USER, contextPath: COURSE_PATH }],
      capabilities: [
        { role: STUDENT_ROLE, capability: 'mod/quiz:attempt', permission: PermissionValue.Prevent, context: null },
        { role: STUDENT_ROLE, capability: 'mod/quiz:attempt', permission: PermissionValue.Allow, context: COURSE },
      ],
    });

    await expect(
      access.hasCapability({ userId: USER }, 'mod/quiz:attempt', courseContext),
    ).resolves.toBe(true);
  });

  it('el administrador de plataforma atraviesa cualquier comprobación', async () => {
    const access = await build({ assignments: [], capabilities: [] });

    await expect(
      access.hasCapability({ userId: USER, isPlatformAdmin: true }, 'maya/site:config', courseContext),
    ).resolves.toBe(true);
  });

  it('effectiveCapabilities excluye las capacidades prohibidas', async () => {
    const access = await build({
      assignments: [{ role: STUDENT_ROLE, user: USER, contextPath: COURSE_PATH }],
      capabilities: [
        { role: STUDENT_ROLE, capability: 'moodle/course:view', permission: PermissionValue.Allow, context: null },
        { role: STUDENT_ROLE, capability: 'mod/quiz:attempt', permission: PermissionValue.Prohibit, context: null },
      ],
    });

    const capabilities = await access.effectiveCapabilities({ userId: USER }, courseContext);
    expect(capabilities).toContain('moodle/course:view');
    expect(capabilities).not.toContain('mod/quiz:attempt');
  });

  it('requireCapability lanza 403 cuando no se cumple', async () => {
    const access = await build({ assignments: [], capabilities: [] });

    await expect(
      access.requireCapability({ userId: USER }, 'moodle/course:update', courseContext),
    ).rejects.toThrow(/permiso/i);
  });
});

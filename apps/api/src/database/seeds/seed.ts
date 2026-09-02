/* eslint-disable no-console */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import {
  ContextLevel,
  CourseFormat,
  EnrolmentMethod,
  ModuleType,
  QuestionType,
  SYSTEM_TENANT_SLUG,
  TenantPlan,
  TenantStatus,
  UserStatus,
} from '@maya/shared';
import { AppModule } from '../../app.module';
import { ContextsService } from '../../modules/contexts/contexts.service';
import { RolesService } from '../../modules/rbac/roles.service';
import { TenantsService } from '../../modules/tenants/tenants.service';
import { UsersService } from '../../modules/users/users.service';
import { CategoriesService } from '../../modules/categories/categories.service';
import { CoursesService } from '../../modules/courses/courses.service';
import { EnrolmentsService } from '../../modules/enrolments/enrolments.service';
import { GradesService } from '../../modules/grades/grades.service';
import { QuestionsService } from '../../modules/questions/questions.service';
import { QuizService } from '../../modules/activities/quiz/quiz.service';
import { ScheduledTasksService } from '../../modules/platform/scheduled-tasks.service';
import { CalendarService } from '../../modules/calendar/calendar.service';
import { CohortsService } from '../../modules/cohorts/cohorts.service';
import { CompetenciesService } from '../../modules/competencies/competencies.service';
import { BadgesService } from '../../modules/badges/badges.service';
import { SiteService } from '../../modules/site/site.service';
import { PaymentsService } from '../../modules/commerce/payments.service';
import { Order } from '../../modules/commerce/schemas/order.schema';
import type { OrderDocument } from '../../modules/commerce/schemas/order.schema';
import { Course } from '../../modules/courses/schemas/course.schema';
import type { CourseDocument } from '../../modules/courses/schemas/course.schema';
import { seedStorefront } from './demo-storefront';

const logger = new Logger('Seed');

/**
 * Siembra la plataforma con:
 *  - el contexto de sistema y los roles arquetípicos globales,
 *  - una empresa de demostración con su marca,
 *  - usuarios de ejemplo (administrador, gestora, profesores y alumnado),
 *  - categorías, cursos con secciones y actividades reales.
 */
async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const contexts = app.get(ContextsService);
  const roles = app.get(RolesService);
  const tenants = app.get(TenantsService);
  const users = app.get(UsersService);
  const categories = app.get(CategoriesService);
  const courses = app.get(CoursesService);
  const enrolments = app.get(EnrolmentsService);
  const grades = app.get(GradesService);
  const questions = app.get(QuestionsService);
  const quizzes = app.get(QuizService);
  const tasks = app.get(ScheduledTasksService);
  const calendar = app.get(CalendarService);
  const cohorts = app.get(CohortsService);
  const competencies = app.get(CompetenciesService);
  const badges = app.get(BadgesService);
  const site = app.get(SiteService);
  const payments = app.get(PaymentsService);
  const orderModel = app.get<Model<OrderDocument>>(getModelToken(Order.name));
  const courseModel = app.get<Model<CourseDocument>>(getModelToken(Course.name));

  logger.log('1/9 · Contexto de sistema y roles globales');
  const systemContext = await contexts.getSystemContext();
  await roles.provisionPresetRoles(null);

  logger.log('2/9 · Empresa del sistema y empresa de demostración');
  let systemTenant = await tenants.findBySlug(SYSTEM_TENANT_SLUG);
  if (!systemTenant) {
    systemTenant = await tenants.create({
      slug: SYSTEM_TENANT_SLUG,
      name: 'Maya Classroom · Plataforma',
      contactEmail: 'plataforma@mayaclassroom.app',
      plan: TenantPlan.Enterprise,
      status: TenantStatus.Active,
    });
  }

  let demo = await tenants.findBySlug('demo');
  if (!demo) {
    demo = await tenants.create({
      slug: 'demo',
      name: 'Academia Maya',
      legalName: 'Academia Maya S.L.',
      contactEmail: 'info@academiamaya.example',
      plan: TenantPlan.Business,
      status: TenantStatus.Active,
      branding: {
        primaryColor: '#E4574D',
        accentColor: '#F2B441',
        welcomeMessage: 'Bienvenido al aula virtual de Academia Maya.',
      },
      settings: {
        allowSelfRegistration: true,
        requireEmailVerification: false,
        defaultLanguage: 'es',
        timezone: 'Europe/Madrid',
      },
    });
  }
  await tasks.provision(demo._id);

  const tenantContext = await contexts.requireByInstance(ContextLevel.Tenant, demo._id);

  logger.log('3/9 · Usuarios de demostración');
  const password = process.env.SEED_PASSWORD ?? 'Maya2026!';

  const ensureUser = async (data: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    platformAdmin?: boolean;
  }) => {
    const existing = await users.findByEmail(data.email, demo!._id);
    if (existing) return existing;
    const user = await users.create(demo!._id, {
      email: data.email,
      username: data.username,
      password,
      firstName: data.firstName,
      lastName: data.lastName,
      status: UserStatus.Active,
      initialRole: data.role,
    });
    if (data.platformAdmin) {
      user.isPlatformAdmin = true;
      user.emailVerified = true;
      await user.save();
      await roles.assignByShortName({
        userId: user._id,
        shortName: 'platformadmin',
        contextId: systemContext._id,
        tenantId: null,
        component: 'seed',
      });
    }
    await roles.assignByShortName({
      userId: user._id,
      shortName: data.role,
      contextId: tenantContext._id,
      tenantId: demo!._id,
      component: 'seed',
    });
    return user;
  };

  const admin = await ensureUser({
    email: 'admin@mayaclassroom.app',
    username: 'admin',
    firstName: 'Marcos',
    lastName: 'Administrador',
    role: 'manager',
    platformAdmin: true,
  });

  const manager = await ensureUser({
    email: 'gestora@academiamaya.example',
    username: 'gestora',
    firstName: 'Lucía',
    lastName: 'Fernández',
    role: 'manager',
  });

  const teacher = await ensureUser({
    email: 'profesor@academiamaya.example',
    username: 'profesor',
    firstName: 'Daniel',
    lastName: 'Ortega',
    role: 'editingteacher',
  });

  const students = [];
  const names: [string, string][] = [
    ['Ana', 'Ruiz'],
    ['Carlos', 'Molina'],
    ['Elena', 'Vargas'],
    ['Jorge', 'Serrano'],
    ['María', 'Cabrera'],
    ['Pablo', 'Nieto'],
  ];
  for (const [first, last] of names) {
    students.push(
      await ensureUser({
        email: `${first.toLowerCase()}.${last.toLowerCase()}@academiamaya.example`,
        username: `${first.toLowerCase()}.${last.toLowerCase()}`,
        firstName: first,
        lastName: last,
        role: 'student',
      }),
    );
  }

  logger.log('4/9 · Categorías y cursos');
  const existingCategories = await categories.list(demo._id, { includeHidden: true });
  const rootCategory =
    existingCategories.find((c) => c.name === 'Formación profesional') ??
    (await categories.create(demo._id, {
      name: 'Formación profesional',
      description: 'Ciclos y certificados de profesionalidad.',
    }));

  const devCategory =
    existingCategories.find((c) => c.name === 'Desarrollo de software') ??
    (await categories.create(demo._id, {
      name: 'Desarrollo de software',
      parentId: rootCategory.id,
    }));

  const ensureCourse = async (shortName: string, fullName: string, summary: string) => {
    const found = await courses
      .paginate(demo!._id, { page: 1, limit: 1, order: 'desc', search: shortName } as never, {
        canSeeHidden: true,
      })
      .then((r) => r.items.find((c) => c.shortName === shortName));
    if (found) return found;

    const course = await courses.create(
      demo!._id,
      {
        shortName,
        fullName,
        summary,
        categoryId: devCategory.id,
        format: CourseFormat.Topics,
        numSections: 5,
        enableCompletion: true,
      },
      teacher._id,
    );
    await grades.provisionCourse(course._id);
    await enrolments.provisionDefaults(course._id);
    return course;
  };

  const angularCourse = await ensureCourse(
    'ANG-22',
    'Desarrollo frontend con Angular 22',
    '<p>Aprende a construir aplicaciones modernas con Angular 22: señales, componentes independientes y renderizado sin zonas.</p>',
  );
  const nestCourse = await ensureCourse(
    'NEST-11',
    'APIs profesionales con NestJS 11',
    '<p>Diseño de APIs REST escalables con NestJS 11, MongoDB Atlas y buenas prácticas de seguridad.</p>',
  );

  logger.log('5/9 · Matriculación');
  await enrolments.enrol({
    courseId: angularCourse._id,
    tenantId: demo._id,
    userId: teacher._id,
    roleShortName: 'editingteacher',
  });
  await enrolments.enrol({
    courseId: nestCourse._id,
    tenantId: demo._id,
    userId: teacher._id,
    roleShortName: 'editingteacher',
  });
  for (const student of students) {
    await enrolments.enrol({
      courseId: angularCourse._id,
      tenantId: demo._id,
      userId: student._id,
      roleShortName: 'student',
      method: EnrolmentMethod.Manual,
    });
  }
  for (const student of students.slice(0, 4)) {
    await enrolments.enrol({
      courseId: nestCourse._id,
      tenantId: demo._id,
      userId: student._id,
      roleShortName: 'student',
    });
  }

  logger.log('6/9 · Contenido del curso');
  const sections = await courses.sections(angularCourse._id);
  const intro = sections.find((s) => s.sectionNumber === 1) ?? sections[0];
  const second = sections.find((s) => s.sectionNumber === 2) ?? sections[0];

  const existingModules = await courses.modules(angularCourse._id);
  if (!existingModules.length) {
    await courses.updateSection(intro.id, {
      name: 'Fundamentos de Angular 22',
      summary: '<p>Componentes independientes, señales y el nuevo control de flujo.</p>',
    });

    await courses.addModule(
      angularCourse._id,
      {
        moduleType: ModuleType.Page,
        sectionId: intro.id,
        name: 'Guía de inicio rápido',
        settings: {
          content:
            '<h2>Bienvenida</h2><p>En esta unidad prepararemos el entorno y crearemos la primera aplicación con Angular 22.</p>',
        },
      },
      teacher._id,
    );

    await courses.addModule(
      angularCourse._id,
      {
        moduleType: ModuleType.Url,
        sectionId: intro.id,
        name: 'Documentación oficial de Angular',
        settings: { externalUrl: 'https://angular.dev', display: 'new' },
      },
      teacher._id,
    );

    const forum = await courses.addModule(
      angularCourse._id,
      {
        moduleType: ModuleType.Forum,
        sectionId: intro.id,
        name: 'Foro de dudas',
        settings: { intro: '<p>Plantee aquí sus dudas sobre la unidad.</p>' },
      },
      teacher._id,
    );

    const assign = await courses.addModule(
      angularCourse._id,
      {
        moduleType: ModuleType.Assign,
        sectionId: second.id,
        name: 'Práctica 1 · Componente de tarjetas',
        completionTracking: 2,
        completionRules: { submit: true },
        settings: {
          intro:
            '<p>Cree un componente reutilizable de tarjetas con señales de entrada y salida.</p>',
          dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString(),
          maxGrade: 10,
          submissionTypes: ['online', 'file'],
        },
      },
      teacher._id,
    );
    await grades.syncModuleItem({
      courseId: angularCourse._id,
      moduleType: ModuleType.Assign,
      instanceId: assign.instance,
      courseModuleId: assign._id,
      name: assign.name,
      grademax: 10,
    });

    logger.log('   · Banco de preguntas y cuestionario');
    const category = await questions.defaultCategoryForCourse(demo._id, angularCourse._id);
    const q1 = await questions.create(demo._id, {
      type: QuestionType.MultiChoice,
      name: 'Señales en Angular',
      questionText: '¿Qué función crea una señal de solo lectura derivada de otras señales?',
      categoryId: category.id,
      courseId: angularCourse.id,
      defaultMark: 1,
      answers: [
        { text: 'computed()', fraction: 1, feedback: 'Correcto: computed() deriva valores.' },
        { text: 'signal()', fraction: 0 },
        { text: 'effect()', fraction: 0 },
        { text: 'inject()', fraction: 0 },
      ],
    });
    const q2 = await questions.create(demo._id, {
      type: QuestionType.TrueFalse,
      name: 'Componentes independientes',
      questionText: 'En Angular 22 los componentes son independientes (standalone) por defecto.',
      categoryId: category.id,
      courseId: angularCourse.id,
      answers: [
        { text: 'Verdadero', fraction: 1 },
        { text: 'Falso', fraction: 0 },
      ],
    });

    const quizModule = await courses.addModule(
      angularCourse._id,
      {
        moduleType: ModuleType.Quiz,
        sectionId: second.id,
        name: 'Cuestionario de la unidad 1',
        completionTracking: 2,
        completionRules: { attempt: true },
        settings: {
          intro: '<p>Compruebe lo aprendido en la primera unidad.</p>',
          maxGrade: 10,
          attemptsAllowed: 2,
          timeLimitSeconds: 900,
        },
      },
      teacher._id,
    );
    await quizzes.addQuestions(quizModule.instance, [q1.id, q2.id]);
    await grades.syncModuleItem({
      courseId: angularCourse._id,
      moduleType: ModuleType.Quiz,
      instanceId: quizModule.instance,
      courseModuleId: quizModule._id,
      name: quizModule.name,
      grademax: 10,
    });

    await calendar.create({
      tenantId: demo._id,
      name: 'Sesión en directo: señales avanzadas',
      description: 'Clase en línea sobre patrones con señales.',
      eventType: 'course' as never,
      courseId: angularCourse._id,
      startAt: new Date(Date.now() + 5 * 86_400_000),
      endAt: new Date(Date.now() + 5 * 86_400_000 + 5_400_000),
      location: 'Aula virtual',
    });

    void forum;
  }

  logger.log('7/9 · Cohortes y competencias');
  const cohortList = await cohorts.paginate(demo._id, { page: 1, limit: 10, order: 'desc' } as never);
  if (!cohortList.items.length) {
    const cohort = await cohorts.create(demo._id, {
      name: 'Promoción 2026',
      description: 'Alumnado matriculado en el curso académico 2026.',
    });
    await cohorts.addMembers(
      cohort.id,
      students.map((s) => s.id),
    );
  }

  const frameworks = await competencies.frameworks(demo._id);
  if (!frameworks.length) {
    const framework = await competencies.createFramework(demo._id, {
      shortName: 'DEV-WEB',
      name: 'Competencias de desarrollo web',
      description: 'Marco de competencias técnicas para perfiles de desarrollo.',
    });
    const parent = await competencies.createCompetency(demo._id, {
      frameworkId: framework.id,
      shortName: 'Frontend',
      description: 'Desarrollo de interfaces de usuario.',
    });
    await competencies.createCompetency(demo._id, {
      frameworkId: framework.id,
      parentId: parent.id,
      shortName: 'Angular',
      description: 'Construcción de aplicaciones con Angular.',
    });
  }

  logger.log('8/9 · Insignias');
  const badgeList = await badges.list(demo._id, angularCourse.id);
  if (!badgeList.length) {
    await badges.create(demo._id, {
      name: 'Angular esencial',
      description: 'Concedida al completar el curso de Angular 22.',
      courseId: angularCourse.id,
      issuerName: 'Academia Maya',
      issuerEmail: 'info@academiamaya.example',
      criteria: [{ type: 'course', courses: [angularCourse._id] }],
    });
  }

  logger.log('9/9 · Escaparate, catálogo de venta y pedidos');
  await seedStorefront({
    tenantId: demo._id,
    tenantName: demo.name,
    teacherId: teacher._id,
    studentIds: students.map((student) => student._id),
    courses,
    categories,
    enrolments,
    grades,
    site,
    payments,
    orderModel,
    courseModel,
    angularCourseId: angularCourse._id,
    nestCourseId: nestCourse._id,
  });

  console.log('\n──────────────────────────────────────────────');
  console.log(' Maya Classroom · datos de demostración listos');
  console.log('──────────────────────────────────────────────');
  console.log(` Empresa (slug):     demo`);
  console.log(` Administrador:      ${admin.email} / ${password}`);
  console.log(` Gestora:            ${manager.email} / ${password}`);
  console.log(` Profesor:           ${teacher.email} / ${password}`);
  console.log(` Alumnado:           ${students[0].email} … / ${password}`);
  console.log('──────────────────────────────────────────────');
  console.log(` Escaparate público: /p/demo`);
  console.log(` Curso gratuito:     /p/demo/c/ia-101`);
  console.log('──────────────────────────────────────────────');
  console.log(' Para que la pantalla de acceso ofrezca la demostración');
  console.log(' (ver el escaparate y entrar como administrador o estudiante),');
  console.log(' arranque la API con DEMO_ENABLED=true.');
  console.log('──────────────────────────────────────────────\n');

  await app.close();
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('La siembra ha fallado', error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });

void Types;

/* eslint-disable no-console */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  ContextLevel,
  CourseFormat,
  DEFAULT_TIMEZONE,
  EnrolmentMethod,
  ModuleType,
  QuestionType,
  SYSTEM_TENANT_SLUG,
  TenantPlan,
  TenantStatus,
  UserStatus,
} from '@maya/shared';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../app.module';
import { ContextsService } from '../../modules/contexts/contexts.service';
import { RolesService } from '../../modules/rbac/roles.service';
import { TenantsService } from '../../modules/tenants/tenants.service';
import { UsersService } from '../../modules/users/users.service';
import { CategoriesService } from '../../modules/categories/categories.service';
import { CoursesService } from '../../modules/courses/courses.service';
import { EnrolmentsService } from '../../modules/enrolments/enrolments.service';
import { GradesService } from '../../modules/grades/grades.service';
import { CompletionService } from '../../modules/completion/completion.service';
import { QuestionsService } from '../../modules/questions/questions.service';
import { QuizService } from '../../modules/activities/quiz/quiz.service';
import { ForumService } from '../../modules/activities/forum/forum.service';
import { ScheduledTasksService } from '../../modules/platform/scheduled-tasks.service';
import { CalendarService } from '../../modules/calendar/calendar.service';
import { CohortsService } from '../../modules/cohorts/cohorts.service';
import { CompetenciesService } from '../../modules/competencies/competencies.service';
import { BadgesService } from '../../modules/badges/badges.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { MessagingService } from '../../modules/messaging/messaging.service';
import { SiteService } from '../../modules/site/site.service';
import { PaymentsService } from '../../modules/commerce/payments.service';
import { Order } from '../../modules/commerce/schemas/order.schema';
import type { OrderDocument } from '../../modules/commerce/schemas/order.schema';
import { Course } from '../../modules/courses/schemas/course.schema';
import type { CourseDocument } from '../../modules/courses/schemas/course.schema';
import { User } from '../../modules/users/schemas/user.schema';
import type { UserDocument } from '../../modules/users/schemas/user.schema';
import { seedStorefront } from './demo-storefront';
import { retirarDemoAnterior } from './demo-retire';
import { cursosDemo, avatar } from './demo-courses';
import type { CursoDemo } from './demo-courses';
import { leccion } from './demo-content';
import { FOTOS, resolverVideos } from './demo-media';

const logger = new Logger('Seed');

/**
 * Dice en voz alta sobre qué base se va a escribir.
 *
 * La siembra ya no solo crea: actualiza la empresa de demostración, saca
 * cursos del catálogo y suspende cuentas. Y la misma orden vale para la base
 * local y para la de producción —lo único que cambia es el `.env` que se haya
 * cargado—, así que conviene ver el destino antes de que empiece a escribir.
 *
 * Del `MONGODB_URI` sale solo el servidor: la cadena lleva la contraseña y un
 * registro no es sitio para ella.
 */
function anunciarDestino(config: ConfigService): void {
  const uri = config.get<string>('database.uri') ?? '';
  const dbName = config.get<string>('database.dbName') ?? '(por defecto)';

  let servidor = '(desconocido)';
  try {
    servidor = new URL(uri).host || servidor;
  } catch {
    // Una cadena que no se puede analizar no debe impedir sembrar; el nombre
    // de la base ya orienta lo suficiente.
  }

  logger.log(`Base de datos: «${dbName}» en ${servidor}`);
}

/**
 * Dentro de N días, a la hora en punto que se indique, en horario de Lima.
 *
 * Sin fijar la hora, los eventos heredan el momento en que se sembró y en la
 * demostración aparecen clases en vivo a la una de la mañana.
 * Lima no cambia la hora en todo el año: son siempre UTC-5.
 */
function aLasDeLima(dias: number, hora: number): Date {
  const fecha = new Date(Date.now() + dias * 86_400_000);
  fecha.setUTCHours(hora + 5, 0, 0, 0);
  return fecha;
}

/**
 * Nombre de cuenta a partir de un nombre propio.
 *
 * Los apellidos peruanos llevan tilde («Huamán», «Ttito») y una dirección de
 * correo no la admite: se descompone el carácter y se quitan las marcas
 * diacríticas, que es lo que hace `\u0300-\u036f`.
 */
function sinTildes(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Siembra la plataforma con la escuela de pastelería de demostración:
 *  - el contexto de sistema y los roles arquetípicos globales,
 *  - Dulce Lima, con su marca, su logotipo y su equipo,
 *  - cuatro cursos con temario, lecciones en vídeo, foros y actividades,
 *  - alumnado con avance, notas e insignias, para que ninguna pantalla salga
 *    vacía al entrar como estudiante,
 *  - el escaparate publicado, los cobros en soles y pedidos ya recibidos.
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
  const completion = app.get(CompletionService);
  const questions = app.get(QuestionsService);
  const quizzes = app.get(QuizService);
  const forums = app.get(ForumService);
  const tasks = app.get(ScheduledTasksService);
  const calendar = app.get(CalendarService);
  const cohorts = app.get(CohortsService);
  const competencies = app.get(CompetenciesService);
  const badges = app.get(BadgesService);
  const notifications = app.get(NotificationsService);
  const messaging = app.get(MessagingService);
  const site = app.get(SiteService);
  const payments = app.get(PaymentsService);
  const orderModel = app.get<Model<OrderDocument>>(getModelToken(Order.name));
  const courseModel = app.get<Model<CourseDocument>>(getModelToken(Course.name));
  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

  anunciarDestino(app.get(ConfigService));

  logger.log('1/10 · Contexto de sistema y roles globales');
  const systemContext = await contexts.getSystemContext();
  await roles.provisionPresetRoles(null);

  logger.log('2/10 · Medios de la demostración');
  const videos = await resolverVideos();
  const definiciones = cursosDemo(videos);

  logger.log('3/10 · Empresa del sistema y escuela de demostración');
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

  /**
   * Identidad de la escuela de demostración.
   *
   * Se aplica exista o no la empresa: la siembra se ejecuta muchas veces sobre
   * la misma base, y si al cambiar la demostración solo se creara lo nuevo, un
   * despliegue con datos anteriores se quedaría con el nombre, la marca y el
   * logotipo viejos mientras el resto de la página ya es otra cosa.
   */
  const escuela = {
    name: 'Dulce Lima',
    legalName: 'Dulce Lima Escuela de Pastelería S.A.C.',
    contactEmail: 'hola@dulcelima.pe',
    branding: {
      // Frambuesa y caramelo: la marca de la escuela, distinta de la de la
      // plataforma, para que se vea que la personalización por empresa manda.
      primaryColor: '#E11D64',
      accentColor: '#F2A93B',
      logoUrl: '/demo/dulce-lima.svg',
      welcomeMessage: 'Bienvenido al aula de Dulce Lima. Póngase el mandil.',
    },
    settings: {
      allowSelfRegistration: true,
      requireEmailVerification: false,
      defaultLanguage: 'es',
      timezone: DEFAULT_TIMEZONE,
    },
  };

  let demo = await tenants.findBySlug('demo');
  if (demo) {
    await tenants.update(demo._id, escuela);
    demo = await tenants.requireBySlug('demo');
  } else {
    demo = await tenants.create({
      slug: 'demo',
      plan: TenantPlan.Business,
      status: TenantStatus.Active,
      ...escuela,
    });
  }
  await tasks.provision(demo._id);

  await retirarDemoAnterior({ tenantId: demo._id, courseModel, userModel });

  const tenantContext = await contexts.requireByInstance(ContextLevel.Tenant, demo._id);

  logger.log('4/10 · Equipo y alumnado');
  const password = process.env.SEED_PASSWORD ?? 'Maya2026!';

  /**
   * Un nombre de usuario que no esté cogido en la empresa.
   *
   * El nombre de usuario es único por empresa, y la siembra escribe sobre una
   * empresa que puede tener cuentas que no creó ella: las de la demostración
   * anterior, o las que haya dado de alta quien la administra. Con el nombre
   * ocupado, `create` lanza y la siembra muere a medias —justo en el estado
   * mezclado del que se venía huyendo—, así que se busca uno libre en vez de
   * pelearse por él.
   */
  const usuarioLibre = async (deseado: string): Promise<string> => {
    let candidato = deseado;
    for (let intento = 2; intento < 50; intento += 1) {
      if (!(await users.findByLogin(candidato, demo!._id))) return candidato;
      candidato = `${deseado}${intento}`;
    }
    return candidato;
  };

  const ensureUser = async (data: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    platformAdmin?: boolean;
    avatarUrl?: string;
  }): Promise<UserDocument> => {
    const existing = await users.findByEmail(data.email, demo!._id);
    if (existing) return existing;
    const user = await users.create(demo!._id, {
      email: data.email,
      username: await usuarioLibre(data.username),
      password,
      firstName: data.firstName,
      lastName: data.lastName,
      status: UserStatus.Active,
      initialRole: data.role,
    });
    if (data.avatarUrl) {
      user.avatarUrl = data.avatarUrl;
      await user.save();
    }
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

  // La gestora es con quien entra la demostración de administración: tiene el
  // escaparate, los cobros y el alumnado, y no es administradora de plataforma.
  const manager = await ensureUser({
    email: 'gestora@dulcelima.pe',
    username: 'rosa.quispe',
    firstName: 'Rosa',
    lastName: 'Quispe',
    role: 'manager',
    avatarUrl: avatar(FOTOS.cocina),
  });

  const chef = await ensureUser({
    email: 'elena.chavez@dulcelima.pe',
    username: 'elena.chavez',
    firstName: 'Elena',
    lastName: 'Chávez',
    role: 'editingteacher',
    avatarUrl: avatar(FOTOS.amasando),
  });

  const panadero = await ensureUser({
    email: 'julio.ramirez@dulcelima.pe',
    username: 'julio.ramirez',
    firstName: 'Julio',
    lastName: 'Ramírez',
    role: 'editingteacher',
    avatarUrl: avatar(FOTOS.panes),
  });

  const chocolatero = await ensureUser({
    email: 'marco.ttito@dulcelima.pe',
    username: 'marco.ttito',
    firstName: 'Marco',
    lastName: 'Ttito',
    role: 'editingteacher',
    avatarUrl: avatar(FOTOS.chocolate),
  });

  /** Quién dicta cada curso. El resto de cursos los lleva la chef. */
  const profesorDe = (shortName: string): UserDocument =>
    shortName === 'PAN-150' ? panadero : shortName === 'CHOC-201' ? chocolatero : chef;

  const students: UserDocument[] = [];
  const nombres: [string, string][] = [
    ['Ana', 'Quispe'],
    ['Carlos', 'Mendoza'],
    ['Lucía', 'Huamán'],
    ['Diego', 'Palomino'],
    ['Sofía', 'Ccahuana'],
    ['Jorge', 'Vilca'],
    ['María', 'Espinoza'],
    ['Rocío', 'Ttito'],
  ];
  for (const [first, last] of nombres) {
    const cuenta = `${sinTildes(first)}.${sinTildes(last)}`;
    students.push(
      await ensureUser({
        email: `${cuenta}@dulcelima.pe`,
        username: cuenta,
        firstName: first,
        lastName: last,
        role: 'student',
      }),
    );
  }

  logger.log('5/10 · Categorías y cursos');
  const raiz =
    (await categories.list(demo._id, { includeHidden: true })).find(
      (c) => c.name === 'Pastelería y repostería',
    ) ??
    (await categories.create(demo._id, {
      name: 'Pastelería y repostería',
      description: 'La formación de la escuela, del primer bizcocho a la bombonería fina.',
    }));

  /** Crea la categoría del curso si aún no existe. */
  const categoriaDe = async (definicion: CursoDemo): Promise<string> => {
    const existentes = await categories.list(demo!._id, { includeHidden: true });
    const encontrada = existentes.find((c) => c.name === definicion.categoria);
    if (encontrada) return encontrada.id;
    const creada = await categories.create(demo!._id, {
      name: definicion.categoria,
      description: definicion.categoriaDescripcion,
      parentId: raiz.id,
    });
    return creada.id;
  };

  const cursos = new Map<string, CourseDocument>();
  for (const definicion of definiciones) {
    const existente = await courseModel
      .findOne({ tenant: demo._id, shortName: definicion.shortName, deletedAt: null })
      .exec();
    if (existente) {
      cursos.set(definicion.shortName, existente);
      continue;
    }

    const profesor = profesorDe(definicion.shortName);
    const curso = await courses.create(
      demo._id,
      {
        shortName: definicion.shortName,
        fullName: definicion.fullName,
        summary: definicion.summary,
        categoryId: await categoriaDe(definicion),
        format: CourseFormat.Topics,
        numSections: definicion.temas.length,
        enableCompletion: true,
      },
      profesor._id,
    );
    await grades.provisionCourse(curso._id);
    await enrolments.provisionDefaults(curso._id);
    await enrolments.enrol({
      courseId: curso._id,
      tenantId: demo._id,
      userId: profesor._id,
      roleShortName: 'editingteacher',
    });

    await contenidoDelCurso(definicion, curso, profesor);
    cursos.set(definicion.shortName, curso);
  }

  /** Temario, lecciones y foro con sus debates. */
  async function contenidoDelCurso(
    definicion: CursoDemo,
    curso: CourseDocument,
    profesor: UserDocument,
  ): Promise<void> {
    const secciones = await courses.sections(curso._id);

    for (const [indice, tema] of definicion.temas.entries()) {
      const seccion = secciones.find((s) => s.sectionNumber === indice + 1);
      if (!seccion) continue;

      await courses.updateSection(seccion.id as string, {
        name: tema.nombre,
        summary: tema.resumen,
      });

      await courses.addModule(
        curso._id,
        {
          moduleType: ModuleType.Page,
          sectionId: seccion.id as string,
          name: tema.nombre.split('·')[1]?.trim() ?? tema.nombre,
          completionTracking: 2,
          completionRules: { view: true },
          settings: { blocks: leccion(tema.leccion) },
        },
        profesor._id,
      );
    }

    const foro = await courses.addModule(
      curso._id,
      {
        moduleType: ModuleType.Forum,
        sectionId: (secciones[0]?.id ?? secciones[1]?.id) as string,
        name: definicion.foro.nombre,
        settings: { intro: definicion.foro.intro },
      },
      profesor._id,
    );

    // Los debates los abre el alumnado y los responde quien dicta el curso:
    // un foro con un único autor no enseña nada de cómo funciona.
    for (const [indice, debate] of definicion.foro.debates.entries()) {
      const autor = students[indice % students.length] ?? profesor;
      const creado = await forums.createDiscussion(foro.instance, autor._id, {
        name: debate.titulo,
        message: debate.mensaje,
      } as never);
      for (const [posicion, respuesta] of debate.respuestas.entries()) {
        const responde = posicion % 2 === 0 ? profesor : autor;
        await forums.reply(creado.id, responde._id, { message: respuesta } as never);
      }
    }
  }

  const pasteleria = cursos.get('PAST-101')!;
  const chocolateria = cursos.get('CHOC-201')!;
  const panaderia = cursos.get('PAN-150')!;
  const intro = cursos.get('INTRO-10')!;

  logger.log('6/10 · Matrículas');
  /** Quién está en qué: repartido para que las listas no salgan todas iguales. */
  const matriculas: [CourseDocument, UserDocument[]][] = [
    [intro, students],
    [pasteleria, students.slice(0, 6)],
    [chocolateria, students.slice(1, 4)],
    [panaderia, students.slice(3, 7)],
  ];
  for (const [curso, alumnado] of matriculas) {
    for (const alumno of alumnado) {
      await enrolments.enrol({
        courseId: curso._id,
        tenantId: demo._id,
        userId: alumno._id,
        roleShortName: 'student',
        method: EnrolmentMethod.Manual,
      });
    }
  }

  logger.log('7/10 · Tarea, cuestionario y calendario');
  const modulos = await courses.modules(pasteleria._id);
  const secciones = await courses.sections(pasteleria._id);
  const segunda = secciones.find((s) => s.sectionNumber === 2) ?? secciones[0];
  const tieneTarea = modulos.some((m) => m.moduleType === ModuleType.Assign);

  let itemTarea: string | null = null;
  if (!tieneTarea) {
    const tarea = await courses.addModule(
      pasteleria._id,
      {
        moduleType: ModuleType.Assign,
        sectionId: segunda.id as string,
        name: 'Práctica 1 · Su primera tanda de alfajores',
        completionTracking: 2,
        completionRules: { submit: true },
        settings: {
          intro:
            '<p>Hornee una tanda de doce alfajores siguiendo la receta del módulo 2. Suba tres ' +
            'fotos: la masa antes de hornear, el disco cortado por la mitad y el alfajor ' +
            'armado. Cuente qué le costó más.</p>',
          dueDate: new Date(Date.now() + 12 * 86_400_000).toISOString(),
          maxGrade: 20,
          submissionTypes: ['online', 'file'],
        },
      },
      chef._id,
    );
    // Nota sobre 20, como en Perú.
    await grades.syncModuleItem({
      courseId: pasteleria._id,
      moduleType: ModuleType.Assign,
      instanceId: tarea.instance,
      courseModuleId: tarea._id,
      name: tarea.name,
      grademax: 20,
    });

    const categoria = await questions.defaultCategoryForCourse(demo._id, pasteleria._id);
    const q1 = await questions.create(demo._id, {
      type: QuestionType.MultiChoice,
      name: 'Punto del manjarblanco',
      questionText: '¿A qué temperatura está en su punto el manjarblanco para alfajor?',
      categoryId: categoria.id,
      courseId: pasteleria.id,
      defaultMark: 1,
      answers: [
        {
          text: 'Entre 104 y 106 °C',
          fraction: 1,
          feedback: 'Correcto: por debajo escurre y por encima se cristaliza.',
        },
        { text: 'Entre 85 y 90 °C', fraction: 0 },
        { text: 'Cuando cambia de color, sin medir', fraction: 0 },
        { text: 'A 120 °C, como el almíbar', fraction: 0 },
      ],
    });
    const q2 = await questions.create(demo._id, {
      type: QuestionType.TrueFalse,
      name: 'Almíbar del merengue italiano',
      questionText: 'El almíbar del merengue italiano se incorpora a 118 °C.',
      categoryId: categoria.id,
      courseId: pasteleria.id,
      answers: [
        { text: 'Verdadero', fraction: 1 },
        { text: 'Falso', fraction: 0 },
      ],
    });

    const cuestionario = await courses.addModule(
      pasteleria._id,
      {
        moduleType: ModuleType.Quiz,
        sectionId: segunda.id as string,
        name: 'Cuestionario · Puntos y temperaturas',
        completionTracking: 2,
        completionRules: { attempt: true },
        settings: {
          intro: '<p>Cinco minutos para comprobar los puntos de cocción del módulo.</p>',
          maxGrade: 20,
          attemptsAllowed: 2,
          timeLimitSeconds: 900,
        },
      },
      chef._id,
    );
    await quizzes.addQuestions(cuestionario.instance, [q1.id, q2.id]);
    await grades.syncModuleItem({
      courseId: pasteleria._id,
      moduleType: ModuleType.Quiz,
      instanceId: cuestionario.instance,
      courseModuleId: cuestionario._id,
      name: cuestionario.name,
      grademax: 20,
    });

    await calendar.create({
      tenantId: demo._id,
      name: 'Clase en vivo · Merengue italiano sin fallos',
      description: 'Resolvemos dudas del módulo 3 y montamos un suspiro en directo.',
      eventType: 'course' as never,
      courseId: pasteleria._id,
      startAt: aLasDeLima(6, 19),
      endAt: new Date(aLasDeLima(6, 19).getTime() + 5_400_000),
      location: 'Aula virtual',
    });
    await calendar.create({
      tenantId: demo._id,
      name: 'Entrega · Primera tanda de alfajores',
      description: 'Último día para subir las fotos de la práctica 1.',
      eventType: 'course' as never,
      courseId: pasteleria._id,
      startAt: aLasDeLima(12, 23),
      endAt: new Date(aLasDeLima(12, 23).getTime() + 3_600_000),
      location: 'Aula virtual',
    });
  }

  const items = await grades.items(pasteleria._id);
  itemTarea = items.find((i) => i.name.includes('alfajores'))?.id ?? null;
  const itemCuestionario = items.find((i) => i.name.includes('Cuestionario'))?.id ?? null;

  logger.log('8/10 · Cohortes, competencias e insignias');
  // Se busca la cohorte por su nombre, no «si no hay ninguna»: sobre una base
  // con la demostración anterior ya sembrada, esa condición dejaba la
  // promoción vieja y no creaba la de la escuela.
  const COHORTE = 'Promoción verano 2026';
  const cohortesExistentes = await cohorts.paginate(demo._id, {
    page: 1,
    limit: 50,
    order: 'desc',
  } as never);
  if (!cohortesExistentes.items.some((c) => c.name === COHORTE)) {
    const cohorte = await cohorts.create(demo._id, {
      name: COHORTE,
      description: 'Alumnado matriculado en la temporada de verano.',
    });
    await cohorts.addMembers(
      cohorte.id,
      students.map((s) => s.id),
    );
  }

  // Igual que la cohorte: por nombre corto, para que el marco de la escuela se
  // cree aunque siga estando el de la demostración anterior.
  const marcos = await competencies.frameworks(demo._id);
  if (!marcos.some((m) => m.shortName === 'PAST-TEC')) {
    const marco = await competencies.createFramework(demo._id, {
      shortName: 'PAST-TEC',
      name: 'Técnicas de pastelería',
      description: 'Marco de competencias del obrador: masas, cremas, chocolate y acabado.',
    });
    const masas = await competencies.createCompetency(demo._id, {
      frameworkId: marco.id,
      shortName: 'Masas',
      description: 'Masas quebradas, batidas y fermentadas.',
    });
    await competencies.createCompetency(demo._id, {
      frameworkId: marco.id,
      parentId: masas.id,
      shortName: 'Fermentación',
      description: 'Control de fermentación por temperatura y humedad.',
    });
    await competencies.createCompetency(demo._id, {
      frameworkId: marco.id,
      shortName: 'Cremas y merengues',
      description: 'Cremas cocidas, merengues y su estabilidad.',
    });
    await competencies.createCompetency(demo._id, {
      frameworkId: marco.id,
      shortName: 'Chocolate',
      description: 'Templado, moldeado y ganaches.',
    });
  }

  /** Una insignia por curso, para que la pantalla del alumnado tenga qué mostrar. */
  const insignias = new Map<string, string>();
  for (const definicion of definiciones) {
    const curso = cursos.get(definicion.shortName);
    if (!curso) continue;
    const existentes = await badges.list(demo._id, curso.id);
    const insignia =
      existentes[0] ??
      (await badges.create(demo._id, {
        name: `${definicion.categoria} · ${definicion.catalogo.level}`,
        description: `Concedida al completar «${definicion.fullName}».`,
        courseId: curso.id,
        issuerName: demo.name,
        issuerEmail: 'hola@dulcelima.pe',
        criteria: [{ type: 'course', courses: [curso._id] }],
      }));
    insignias.set(definicion.shortName, insignia.id);
  }

  logger.log('9/10 · Avance, notas e insignias del alumnado');
  await sembrarAvance();

  /**
   * Deja el aula con vida: lecciones vistas, notas puestas e insignias
   * concedidas.
   *
   * Sin esto, quien entra como estudiante ve un panel a cero y una demostración
   * a cero no enseña nada. El avance va escalonado para que las listas del
   * profesorado tampoco salgan todas iguales.
   */
  async function sembrarAvance(): Promise<void> {
    const lecciones = (await courses.modules(intro._id)).filter(
      (m) => m.moduleType === ModuleType.Page,
    );
    const leccionesPasteleria = (await courses.modules(pasteleria._id)).filter(
      (m) => m.moduleType === ModuleType.Page,
    );

    for (const [indice, alumno] of students.entries()) {
      // El curso gratuito lo termina casi todo el mundo; es el de entrada.
      const vistasIntro = indice < 6 ? lecciones.length : Math.max(1, lecciones.length - 1);
      for (const modulo of lecciones.slice(0, vistasIntro)) {
        await completion.setManual(modulo._id, alumno._id, true);
      }

      // En el de pastelería el avance baja según se avanza en la lista.
      if (indice < 6) {
        const vistas = Math.max(1, leccionesPasteleria.length - indice);
        for (const modulo of leccionesPasteleria.slice(0, vistas)) {
          await completion.setManual(modulo._id, alumno._id, true);
        }
      }
    }

    // Notas sobre 20, como se califica en Perú.
    const notas = [18, 17, 20, 15, 19, 16];
    if (itemTarea) {
      for (const [indice, alumno] of students.slice(0, 6).entries()) {
        await grades.setGrade(
          itemTarea,
          {
            userId: alumno.id,
            grade: notas[indice],
            feedback:
              notas[indice] >= 18
                ? 'Muy buen armado y disco parejo. Cuide el grosor en los bordes.'
                : 'Le falta cocción al manjarblanco: se nota en la foto del corte.',
          } as never,
          chef._id,
        );
      }
    }
    if (itemCuestionario) {
      for (const [indice, alumno] of students.slice(0, 6).entries()) {
        await grades.setGrade(
          itemCuestionario,
          { userId: alumno.id, grade: [20, 20, 15, 20, 10, 15][indice] } as never,
          chef._id,
        );
      }
    }

    // Insignia del curso gratuito a quien lo terminó.
    const insigniaIntro = insignias.get('INTRO-10');
    if (insigniaIntro) {
      for (const alumno of students.slice(0, 6)) {
        await badges.award(insigniaIntro, alumno._id);
      }
    }
    const insigniaPasteleria = insignias.get('PAST-101');
    if (insigniaPasteleria) {
      for (const alumno of students.slice(0, 2)) {
        await badges.award(insigniaPasteleria, alumno._id);
      }
    }

    await avisosYMensajes();
  }

  /**
   * Avisos sin leer y una conversación con el profesorado.
   *
   * El panel del alumnado cuenta notificaciones y mensajes pendientes; a cero,
   * media pantalla se queda en blanco y la demostración no enseña que existen.
   */
  async function avisosYMensajes(): Promise<void> {
    const alumnado = students.slice(0, 6);

    await notifications.notify({
      tenantId: demo!._id,
      userIds: alumnado.map((a) => a._id),
      component: 'mod/assign',
      eventName: 'assign_graded',
      subject: 'Su primera tanda de alfajores ya tiene nota',
      body: 'Elena revisó las fotos y dejó comentarios en cada una. Entre a verlos.',
      contextUrl: `/courses/${pasteleria.id}`,
      icon: 'clipboard-check',
      fromUserId: chef._id,
    });

    await notifications.notify({
      tenantId: demo!._id,
      userIds: alumnado.map((a) => a._id),
      component: 'mod/forum',
      eventName: 'forum_post',
      subject: 'Nueva respuesta en el foro del curso',
      body: 'Respondimos la duda del manjarblanco cortado. Puede que le sirva.',
      contextUrl: `/courses/${pasteleria.id}`,
      icon: 'message-square',
      fromUserId: chef._id,
    });

    // Una conversación de verdad, con las dos partes escribiendo.
    for (const alumno of students.slice(0, 3)) {
      const conversacion = await messaging.openWith(demo!._id, alumno._id, chef._id);
      await messaging.send(
        conversacion.id,
        alumno._id,
        'Hola Elena, ¿el manjarblanco se puede dejar hecho de un día para otro o pierde punto?',
      );
      await messaging.send(
        conversacion.id,
        chef._id,
        'Se puede, y hasta mejora: tapado a piel y en frío aguanta cinco días. Sáquelo una ' +
          'hora antes de armar para que vuelva a estar manejable.',
      );
    }
  }

  logger.log('10/10 · Escaparate, catálogo de venta y pedidos');
  await seedStorefront({
    tenantId: demo._id,
    tenantName: demo.name,
    studentIds: students.map((student) => student._id),
    site,
    payments,
    orderModel,
    courseModel,
    cursos,
    definiciones,
    videos,
  });

  const sinVideo = Object.values(videos).filter((v) => !v).length;

  console.log('\n──────────────────────────────────────────────');
  console.log(' Maya Classroom · Dulce Lima, datos de demostración listos');
  console.log('──────────────────────────────────────────────');
  console.log(` Empresa (slug):     demo`);
  console.log(` Administrador:      ${admin.email} / ${password}`);
  console.log(` Gestora:            ${manager.email} / ${password}`);
  console.log(` Profesorado:        ${chef.email} · ${panadero.email} · ${chocolatero.email}`);
  console.log(` Alumnado:           ${students[0].email} … / ${password}`);
  console.log('──────────────────────────────────────────────');
  console.log(` Escaparate público: /p/demo`);
  console.log(` Curso gratuito:     /p/demo/c/intro-10`);
  console.log('──────────────────────────────────────────────');
  if (sinVideo) {
    console.log(` ${sinVideo} vídeo(s) sin resolver: ponga PEXELS_API_KEY y vuelva a sembrar`);
    console.log(' para que la demostración salga también con los vídeos.');
    console.log('──────────────────────────────────────────────');
  }
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

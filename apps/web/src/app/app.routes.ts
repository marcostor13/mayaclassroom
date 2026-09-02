import { Routes } from '@angular/router';
import { CAP } from '@maya/shared';
import { authGuard, guestGuard, passwordChangeGuard } from './core/guards/auth.guard';
import { capabilityGuard, platformAdminGuard } from './core/guards/capability.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

  /* ────────────────────── Escaparate público (sin sesión) ─────────────── */
  {
    // Fuera del armazón de la aplicación y sin guard: su público es quien
    // todavía no tiene cuenta. Son las únicas rutas que se sirven a desconocidos.
    path: 'p/:slug',
    loadComponent: () =>
      import('./features/site/site-public.page').then((m) => m.SitePublicPage),
  },
  {
    // La ficha de venta de un curso. `ref` es el nombre corto —`ang-22`— para
    // que la dirección se pueda compartir y diga de qué va.
    path: 'p/:slug/c/:ref',
    loadComponent: () =>
      import('./features/site/course-public.page').then((m) => m.CoursePublicPage),
  },
  {
    // Pasarela de prueba. Ruta propia porque el circuito debe salir de la
    // ficha y volver a ella, igual que con una pasarela de verdad.
    path: 'p/:slug/pago-prueba/:reference',
    title: 'Pago de prueba · Maya Classroom',
    loadComponent: () =>
      import('./features/site/payment-sandbox.page').then((m) => m.PaymentSandboxPage),
  },
  {
    // Vuelta de la pasarela. Ruta propia y no un parámetro de la ficha para que
    // recargar o guardar el enlace siga enseñando el estado de la compra.
    path: 'p/:slug/pedido/:reference',
    title: 'Su compra · Maya Classroom',
    loadComponent: () =>
      import('./features/site/order-public.page').then((m) => m.OrderPublicPage),
  },

  /* ─────────────────────────── Autenticación ─────────────────────────── */
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        title: 'Acceder · Maya Classroom',
        loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        title: 'Crear cuenta · Maya Classroom',
        loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
      },
      {
        path: 'forgot-password',
        title: 'Recuperar contraseña · Maya Classroom',
        loadComponent: () =>
          import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
      },
      {
        path: 'reset-password',
        title: 'Nueva contraseña · Maya Classroom',
        loadComponent: () =>
          import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage),
      },
    ],
  },

  /* ─────────────────── Cambio de contraseña obligatorio ──────────────── */
  {
    path: 'password-change',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: '',
        title: 'Cambiar contraseña · Maya Classroom',
        loadComponent: () =>
          import('./features/auth/change-password.page').then((m) => m.ChangePasswordPage),
      },
    ],
  },

  /* ──────────────────────── Aplicación autenticada ───────────────────── */
  {
    path: '',
    canActivate: [authGuard, passwordChangeGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        title: 'Panel · Maya Classroom',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },

      {
        path: 'search',
        title: 'Resultados · Maya Classroom',
        loadComponent: () => import('./features/search/search.page').then((m) => m.SearchPage),
      },

      /* Cursos */
      {
        path: 'courses',
        title: 'Mis cursos · Maya Classroom',
        loadComponent: () => import('./features/courses/courses.page').then((m) => m.CoursesPage),
      },
      {
        path: 'courses/new',
        title: 'Crear curso · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.COURSE_CREATE] },
        loadComponent: () =>
          import('./features/courses/course-editor.page').then((m) => m.CourseEditorPage),
      },
      {
        path: 'courses/:id',
        loadComponent: () =>
          import('./features/courses/course-view.page').then((m) => m.CourseViewPage),
      },
      {
        path: 'courses/:id/edit',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.COURSE_UPDATE, CAP.COURSE_MANAGE_ACTIVITIES] },
        loadComponent: () =>
          import('./features/courses/course-editor.page').then((m) => m.CourseEditorPage),
      },
      {
        path: 'courses/:id/participants',
        loadComponent: () =>
          import('./features/participants/participants.page').then((m) => m.ParticipantsPage),
      },
      {
        path: 'courses/:id/groups',
        title: 'Grupos · Maya Classroom',
        loadComponent: () => import('./features/groups/groups.page').then((m) => m.GroupsPage),
      },
      {
        path: 'courses/:id/grades',
        loadComponent: () => import('./features/grades/my-grades.page').then((m) => m.MyGradesPage),
      },
      {
        path: 'courses/:id/gradebook',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.GRADE_VIEW_ALL, CAP.GRADE_EDIT] },
        loadComponent: () => import('./features/grades/gradebook.page').then((m) => m.GradebookPage),
      },

      /* Actividades */
      {
        path: 'mod/assign/:moduleId',
        loadComponent: () => import('./features/activities/assign.page').then((m) => m.AssignPage),
      },
      {
        path: 'mod/quiz/:moduleId',
        loadComponent: () => import('./features/activities/quiz.page').then((m) => m.QuizPage),
      },
      {
        path: 'mod/forum/:moduleId',
        loadComponent: () => import('./features/activities/forum.page').then((m) => m.ForumPage),
      },
      {
        path: 'mod/choice/:moduleId',
        loadComponent: () => import('./features/activities/choice.page').then((m) => m.ChoicePage),
      },
      {
        path: 'mod/feedback/:moduleId',
        loadComponent: () =>
          import('./features/activities/feedback.page').then((m) => m.FeedbackPage),
      },
      {
        path: 'mod/resource/:moduleId',
        loadComponent: () =>
          import('./features/activities/resource.page').then((m) => m.ResourcePage),
      },
      {
        path: 'mod/advanced/:moduleId',
        loadComponent: () =>
          import('./features/activities/advanced.page').then((m) => m.AdvancedActivityPage),
      },

      /* Comunicación y personal */
      {
        path: 'calendar',
        title: 'Calendario · Maya Classroom',
        loadComponent: () =>
          import('./features/calendar/calendar.page').then((m) => m.CalendarPage),
      },
      {
        path: 'messages',
        title: 'Mensajes · Maya Classroom',
        loadComponent: () =>
          import('./features/messages/messages.page').then((m) => m.MessagesPage),
      },
      {
        path: 'notifications',
        title: 'Notificaciones · Maya Classroom',
        loadComponent: () =>
          import('./features/notifications/notifications.page').then((m) => m.NotificationsPage),
      },
      {
        path: 'profile',
        title: 'Mi perfil · Maya Classroom',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'files',
        title: 'Mis ficheros · Maya Classroom',
        loadComponent: () => import('./features/files/files.page').then((m) => m.FilesPage),
      },
      {
        path: 'badges',
        title: 'Insignias · Maya Classroom',
        loadComponent: () => import('./features/badges/badges.page').then((m) => m.BadgesPage),
      },
      {
        path: 'certificates',
        title: 'Certificados · Maya Classroom',
        loadComponent: () =>
          import('./features/certificates/certificates.page').then((m) => m.CertificatesPage),
      },
      {
        path: 'competencies',
        title: 'Competencias · Maya Classroom',
        loadComponent: () =>
          import('./features/competencies/competencies.page').then((m) => m.CompetenciesPage),
      },
      {
        path: 'catalogue',
        title: 'Catálogo · Maya Classroom',
        loadComponent: () =>
          import('./features/catalogue/catalogue.page').then((m) => m.CataloguePage),
      },

      /* Docencia */
      {
        path: 'question-bank',
        title: 'Banco de preguntas · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.QUESTION_VIEW_ALL, CAP.QUESTION_ADD] },
        loadComponent: () =>
          import('./features/question-bank/question-bank.page').then((m) => m.QuestionBankPage),
      },
      {
        path: 'analytics',
        title: 'Analíticas · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.REPORT_VIEW_COURSE, CAP.TENANT_VIEW_REPORTS] },
        loadComponent: () =>
          import('./features/analytics/analytics.page').then((m) => m.AnalyticsPage),
      },

      /* Administración */
      {
        path: 'admin/users',
        title: 'Usuarios · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.TENANT_MANAGE_USERS, CAP.USER_CREATE, CAP.USER_UPDATE] },
        loadComponent: () => import('./features/admin/users.page').then((m) => m.AdminUsersPage),
      },
      {
        path: 'admin/roles',
        title: 'Roles y permisos · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.ROLE_MANAGE, CAP.ROLE_ASSIGN] },
        loadComponent: () => import('./features/admin/roles.page').then((m) => m.AdminRolesPage),
      },
      {
        path: 'admin/categories',
        title: 'Categorías · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.CATEGORY_MANAGE, CAP.CATEGORY_CREATE] },
        loadComponent: () =>
          import('./features/admin/categories.page').then((m) => m.AdminCategoriesPage),
      },
      {
        path: 'admin/cohorts',
        title: 'Cohortes · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.COHORT_VIEW, CAP.COHORT_MANAGE] },
        loadComponent: () =>
          import('./features/admin/cohorts.page').then((m) => m.AdminCohortsPage),
      },
      {
        path: 'admin/site',
        title: 'Administración del sitio · Maya Classroom',
        canActivate: [capabilityGuard],
        data: {
          capabilities: [
            CAP.REPORT_VIEW_LOGS,
            CAP.SITE_VIEW_AUDIT,
            CAP.BACKUP_COURSE,
            CAP.TAG_MANAGE,
            CAP.CUSTOMFIELD_MANAGE,
            CAP.GDPR_MANAGE_REQUESTS,
            CAP.TENANT_MANAGE_WEBSERVICES,
          ],
        },
        loadComponent: () =>
          import('./features/admin/site/site.page').then((m) => m.AdminSitePage),
      },
      {
        // «storefront» y no «site»: `admin/site` ya es la administración de la
        // plataforma (registros, auditoría, copias). Esto es el escaparate.
        path: 'admin/storefront',
        title: 'Página pública · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.SITE_MANAGE, CAP.SITE_MANAGE_REQUESTS] },
        loadComponent: () =>
          import('./features/admin/storefront/storefront.page').then((m) => m.AdminStorefrontPage),
      },
      {
        path: 'admin/storefront/curso/:id',
        title: 'Página de venta · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.SITE_MANAGE, CAP.COURSE_UPDATE] },
        loadComponent: () =>
          import('./features/admin/storefront/course-landing/course-landing.page').then(
            (m) => m.AdminCourseLandingPage,
          ),
      },
      {
        path: 'admin/payments',
        title: 'Cobros · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.PAYMENT_MANAGE] },
        loadComponent: () =>
          import('./features/admin/payments/payments.page').then((m) => m.AdminPaymentsPage),
      },
      {
        path: 'admin/tenants',
        title: 'Empresas · Maya Classroom',
        // Ámbito plataforma, no empresa: se exige ser administrador de
        // plataforma, igual que los endpoints `@PlatformAdminOnly` que consume.
        canActivate: [platformAdminGuard],
        loadComponent: () =>
          import('./features/admin/tenants.page').then((m) => m.AdminTenantsPage),
      },
      {
        path: 'admin/tenants/:id',
        title: 'Ficha de empresa · Maya Classroom',
        // Ruta propia y no un panel dentro del listado: así la ficha sobrevive
        // a una recarga, se puede compartir y se puede guardar en marcadores.
        canActivate: [platformAdminGuard],
        loadComponent: () =>
          import('./features/admin/tenant-detail.page').then((m) => m.AdminTenantDetailPage),
      },
      {
        path: 'admin/tenant',
        title: 'Empresa · Maya Classroom',
        canActivate: [capabilityGuard],
        data: { capabilities: [CAP.TENANT_UPDATE, CAP.TENANT_MANAGE_BRANDING] },
        loadComponent: () => import('./features/admin/tenant.page').then((m) => m.AdminTenantPage),
      },
    ],
  },

  {
    path: '**',
    title: 'Página no encontrada · Maya Classroom',
    loadComponent: () => import('./features/misc/not-found.page').then((m) => m.NotFoundPage),
  },
];

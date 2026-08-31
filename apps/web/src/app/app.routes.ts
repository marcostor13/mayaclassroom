import { Routes } from '@angular/router';
import { CAP } from '@maya/shared';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { capabilityGuard } from './core/guards/capability.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

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

  /* ──────────────────────── Aplicación autenticada ───────────────────── */
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        title: 'Panel · Maya Classroom',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
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
        path: 'badges',
        title: 'Mis insignias · Maya Classroom',
        loadComponent: () => import('./features/badges/badges.page').then((m) => m.BadgesPage),
      },
      {
        path: 'competencies',
        title: 'Mis competencias · Maya Classroom',
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

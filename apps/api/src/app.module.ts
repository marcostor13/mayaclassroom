import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SecurityConfig, configurations, validateEnv } from './config';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CapabilityGuard } from './common/guards/capability.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { PasswordChangeGuard } from './common/guards/password-change.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

// Fase 1 — núcleo
import { ContextsModule } from './modules/contexts/contexts.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { FilesModule } from './modules/files/files.module';
import { LogsModule } from './modules/logs/logs.module';
import { HealthModule } from './modules/health/health.module';

// Fase 2 — LMS funcional
import { CategoriesModule } from './modules/categories/categories.module';
import { CoursesModule } from './modules/courses/courses.module';
import { GroupsModule } from './modules/groups/groups.module';
import { EnrolmentsModule } from './modules/enrolments/enrolments.module';
import { CompletionModule } from './modules/completion/completion.module';
import { MediaProgressModule } from './modules/media-progress/media-progress.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { GradesModule } from './modules/grades/grades.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { ActivityRegistryModule } from './modules/activities/activity-registry.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { LiveModule } from './modules/live/live.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SearchModule } from './modules/search/search.module';

// Fase 3 — avanzado
import { CohortsModule } from './modules/cohorts/cohorts.module';
import { CompetenciesModule } from './modules/competencies/competencies.module';
import { BadgesModule } from './modules/badges/badges.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { SignaturesModule } from './modules/signatures/signatures.module';
import { PlatformModule } from './modules/platform/platform.module';
import { SiteModule } from './modules/site/site.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { GuidesModule } from './modules/guides/guides.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configurations,
      validate: validateEnv,
      // Los guiones del espacio de trabajo se ejecutan con el directorio de
      // trabajo en apps/api, mientras que en Docker es la raíz del proyecto:
      // se buscan ambas ubicaciones para que el fichero de la raíz se cargue
      // en los dos casos.
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
      expandVariables: true,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const security = config.getOrThrow<SecurityConfig>('security');
        return [{ ttl: security.throttleTtl, limit: security.throttleLimit }];
      },
    }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,

    // Fase 1
    ContextsModule,
    RbacModule,
    TenantsModule,
    UsersModule,
    AuthModule,
    MailModule,
    FilesModule,
    LogsModule,
    HealthModule,

    // Fase 2
    CategoriesModule,
    ActivityRegistryModule,
    CoursesModule,
    GroupsModule,
    EnrolmentsModule,
    CompletionModule,
    MediaProgressModule,
    GradesModule,
    AvailabilityModule,
    QuestionsModule,
    NotificationsModule,
    CalendarModule,
    MessagingModule,
    LiveModule,
    ActivitiesModule,
    DashboardModule,
    SearchModule,

    // Fase 3
    CohortsModule,
    CompetenciesModule,
    BadgesModule,
    SignaturesModule,
    CertificatesModule,
    PlatformModule,

    // Fase 4 — escaparate, venta y acompañamiento
    SiteModule,
    CommerceModule,
    GuidesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}

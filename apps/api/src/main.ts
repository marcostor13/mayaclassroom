import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { API_VERSION, MAYA_BRAND, TENANT_HEADER } from '@maya/shared';
import { AppModule } from './app.module';
import type { AppConfig } from './config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor, TransformInterceptor } from './common/interceptors';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const appConfig = config.getOrThrow<AppConfig>('app');
  const logger = new Logger('Bootstrap');

  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: appConfig.env === 'production' ? undefined : false,
    }),
  );
  app.use(compression());

  app.enableCors({
    origin: appConfig.corsOrigins.includes('*') ? true : appConfig.corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', TENANT_HEADER, 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
  });

  app.setGlobalPrefix(appConfig.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_VERSION.replace('v', '') });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle(`${MAYA_BRAND.name} API`)
    .setDescription(
      'API de la plataforma de aulas virtuales Maya Classroom. Multiempresa, con modelo de ' +
        'roles y capacidades por contexto inspirado en Moodle.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addGlobalParameters({
      name: TENANT_HEADER,
      in: 'header',
      required: false,
      description: 'Identificador (slug) de la empresa activa.',
      schema: { type: 'string' },
    })
    .addTag('Autenticación')
    .addTag('Empresas')
    .addTag('Usuarios')
    .addTag('Roles y permisos')
    .addTag('Categorías')
    .addTag('Cursos')
    .addTag('Matriculación')
    .addTag('Actividades')
    .addTag('Calificaciones')
    .addTag('Comunicación')
    .build();

  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup(`${appConfig.globalPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    customSiteTitle: `${MAYA_BRAND.name} · API`,
  });

  await app.listen(appConfig.port, appConfig.host);
  logger.log(`${MAYA_BRAND.name} API escuchando en ${await app.getUrl()}`);
  logger.log(`Documentación: ${appConfig.url}/${appConfig.globalPrefix}/docs`);
}

void bootstrap();

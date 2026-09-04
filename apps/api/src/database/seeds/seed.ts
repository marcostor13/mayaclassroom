/* eslint-disable no-console */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../app.module';
import { anunciarDestino, sembrarDemostracion } from './demo-seed';

const logger = new Logger('Seed');

/**
 * Punto de entrada de `bun run seed`.
 *
 * La siembra se separó de este arranque para poder lanzarla también desde la
 * API —la plataforma reinicia la demostración desde su propia pantalla— sin
 * duplicar ni una línea de lo que crea. Aquí queda solo lo que es propio de la
 * línea de órdenes: levantar el contexto, contar lo hecho y cerrar.
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  anunciarDestino(app.get(ConfigService));

  const resumen = await sembrarDemostracion(app);

  console.log('\n──────────────────────────────────────────────');
  console.log(' Maya Classroom · Dulce Lima, datos de demostración listos');
  console.log('──────────────────────────────────────────────');
  console.log(` Empresa (slug):     ${resumen.tenantSlug}`);
  console.log(` Administrador:      ${resumen.admin} / ${resumen.password}`);
  console.log(` Gestora:            ${resumen.manager} / ${resumen.password}`);
  console.log(` Profesorado:        ${resumen.teachers.join(' · ')}`);
  console.log(` Alumnado:           ${resumen.student} … / ${resumen.password}`);
  console.log('──────────────────────────────────────────────');
  console.log(` Escaparate público: /p/${resumen.tenantSlug}`);
  console.log(` Curso gratuito:     /p/${resumen.tenantSlug}/c/intro-10`);
  console.log('──────────────────────────────────────────────');
  if (resumen.sinVideo) {
    console.log(` ${resumen.sinVideo} vídeo(s) sin resolver: ponga PEXELS_API_KEY y vuelva a sembrar`);
    console.log(' para que la demostración salga también con los vídeos.');
    console.log('──────────────────────────────────────────────');
  }
  console.log(' Para que la pantalla de acceso ofrezca la demostración');
  console.log(' (ver el escaparate y entrar como estudiante, profesor o');
  console.log(' administrador), arranque la API con DEMO_ENABLED=true.');
  console.log('──────────────────────────────────────────────\n');

  await app.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('La siembra ha fallado', error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });

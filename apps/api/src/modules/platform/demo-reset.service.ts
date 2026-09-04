import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { ModuleRef } from '@nestjs/core';
import type { Connection, Types } from 'mongoose';
import type { DemoResetStatusDto, DemoResetSummary } from '@maya/shared';
import type { DemoConfig } from '../../config';
import { sembrarDemostracion } from '../../database/seeds/demo-seed';

/**
 * Rehace la empresa de demostración desde cero.
 *
 * ## Por qué hace falta
 *
 * La demostración la comparten todos los visitantes a la vez y puede escribir
 * contenido docente: crear cursos, corregir, editar su página pública.
 * `DemoGuard` le cierra la administración, así que de una visita destructiva
 * no se sale nunca una plataforma rota —pero sí una demostración desordenada,
 * y hasta ahora arreglarla exigía entrar por SSH a lanzar `bun run seed`.
 *
 * ## Por qué borra en vez de volver a sembrar encima
 *
 * La siembra es idempotente y sabe actualizar lo que ya existe, pero no sabe
 * deshacer: un curso que un visitante borró queda con `deletedAt` puesto y
 * volver a sembrar no lo recupera; peor, una cuenta borrada bloquea el correo
 * y la siembra choca contra el índice único al recrearla. Reiniciar es borrar
 * y sembrar, no sembrar otra vez.
 *
 * El borrado se apoya en el invariante que sostiene toda la API: **todo lo que
 * pertenece a una empresa lleva su `tenant`**. Así que se recorren las
 * colecciones que tengan ese campo y se borra lo que apunte a la demostración.
 * Nada más, y nada de otra empresa.
 *
 * ## Por qué en segundo plano
 *
 * Rehacer la demostración entera pasa del minuto: cuatro cursos con temario,
 * lecciones, foros, alumnado con notas y una tienda con pedidos, más las
 * consultas a Pexels por los vídeos. Detrás de un proxy eso es una petición
 * que se corta a mitad y deja la base a medias sin que nadie se entere. La
 * orden solo arranca el trabajo; la pantalla pregunta por el estado.
 */
@Injectable()
export class DemoResetService {
  private readonly logger = new Logger(DemoResetService.name);

  /** Estado del reinicio. Vive en memoria: es de este proceso y de este rato. */
  private estado: DemoResetStatusDto;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly moduleRef: ModuleRef,
    private readonly config: ConfigService,
  ) {
    this.estado = {
      tenantSlug: this.slug,
      running: false,
      startedAt: null,
      finishedAt: null,
      step: null,
      ok: null,
      error: null,
      summary: null,
    };
  }

  private get slug(): string {
    return this.config.getOrThrow<DemoConfig>('demo').tenantSlug;
  }

  status(): DemoResetStatusDto {
    return { ...this.estado, tenantSlug: this.slug };
  }

  /**
   * Arranca el reinicio y devuelve el estado inicial.
   *
   * `confirmacion` tiene que ser el identificador de la empresa que se va a
   * rehacer. No es ceremonia: esto borra una empresa entera, y si algún día
   * `DEMO_TENANT_SLUG` apuntara por error a la de un cliente, escribir su
   * nombre a mano es lo único que se interpone.
   */
  async start(confirmacion: string): Promise<DemoResetStatusDto> {
    const slug = this.slug;

    if (this.estado.running) {
      throw new ConflictException('Ya hay un reinicio en marcha.');
    }
    if (confirmacion?.trim().toLowerCase() !== slug.toLowerCase()) {
      throw new BadRequestException(
        `Para confirmar, escriba el identificador de la empresa de demostración: «${slug}».`,
      );
    }

    const tenant = await this.connection
      .collection('tenants')
      .findOne({ slug, deletedAt: null });
    if (!tenant) {
      throw new BadRequestException(
        `No hay ninguna empresa con el identificador «${slug}». Revise DEMO_TENANT_SLUG.`,
      );
    }

    this.estado = {
      tenantSlug: slug,
      running: true,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      step: 'Borrando los datos de la demostración',
      ok: null,
      error: null,
      summary: null,
    };

    // Deliberadamente sin `await`: la respuesta sale ya y el trabajo sigue.
    void this.ejecutar(tenant._id as Types.ObjectId);

    return this.status();
  }

  private async ejecutar(tenantId: Types.ObjectId): Promise<void> {
    try {
      let removed: Record<string, number> = {};

      // El mismo código que `bun run seed`, no una copia: una demostración que
      // se reinicia distinta de la que se siembra no es una demostración.
      //
      // El borrado va dentro, en el punto en el que la siembra ya ha resuelto
      // todo lo que necesita y todavía no ha escrito nada. Borrar antes de
      // llamarla dejaría la empresa vacía si fallara una inyección, que es el
      // fallo más probable y el único sin arreglo automático.
      const resumen = await sembrarDemostracion(
        { get: <T>(tipo: never) => this.moduleRef.get<T>(tipo, { strict: false }) },
        {
          antesDeSembrar: async () => {
            removed = await this.borrarEmpresa(tenantId);
            this.estado = { ...this.estado, step: 'Sembrando la demostración de nuevo' };
          },
        },
      );

      const summary: DemoResetSummary = {
        removed,
        courses: resumen.courses,
        students: resumen.students,
        missingVideos: resumen.sinVideo,
      };

      this.estado = {
        ...this.estado,
        running: false,
        finishedAt: new Date().toISOString(),
        step: null,
        ok: true,
        error: null,
        summary,
      };
      this.logger.log(
        `Demostración reiniciada: ${resumen.courses} cursos y ${resumen.students} alumnos.`,
      );
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.estado = {
        ...this.estado,
        running: false,
        finishedAt: new Date().toISOString(),
        step: null,
        ok: false,
        error: mensaje,
        summary: null,
      };
      this.logger.error(
        `El reinicio de la demostración ha fallado: ${mensaje}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Borra todo lo que pertenece a la empresa, y la empresa al final.
   *
   * Se recorren los modelos registrados en lugar de nombrar las colecciones a
   * mano: una lista escrita a mano envejece en cuanto alguien añade un módulo,
   * y lo que deja atrás no es un fallo visible sino restos de la demostración
   * anterior mezclados con la nueva.
   *
   * El filtro es siempre `tenant`, así que las colecciones globales —los roles
   * arquetípicos, el contexto de sistema— ni se miran: no tienen ese campo.
   */
  private async borrarEmpresa(tenantId: Types.ObjectId): Promise<Record<string, number>> {
    const removed: Record<string, number> = {};

    for (const nombre of this.connection.modelNames()) {
      const modelo = this.connection.model(nombre);
      if (!modelo.schema.path('tenant')) continue;

      const { deletedCount } = await modelo.deleteMany({ tenant: tenantId }).exec();
      if (deletedCount) removed[modelo.collection.collectionName] = deletedCount;
    }

    // La empresa se borra la última: mientras exista, lo de arriba sigue
    // teniendo a quién pertenecer si algo falla por el camino.
    const empresa = await this.connection
      .collection('tenants')
      .deleteOne({ _id: tenantId });
    if (empresa.deletedCount) removed.tenants = empresa.deletedCount;

    return removed;
  }
}

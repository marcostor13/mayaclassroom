import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';

/**
 * Adaptador de Socket.IO que respeta la lista de orígenes de la aplicación.
 *
 * Sin él, la señalización de las aulas en vivo se queda con el CORS por defecto
 * de Socket.IO, que no tiene nada que ver con el que configura `CORS_ORIGINS`:
 * la API respondería a las peticiones normales del cliente y rechazaría —o
 * aceptaría de más— las del socket, que es un síntoma difícil de leer porque
 * el navegador solo enseña un fallo de transporte.
 */
export class LiveIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
    private readonly globalPrefix: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      // El socket cuelga del mismo prefijo que la API (`/api/live-socket`) en
      // lugar del `/socket.io` por defecto. No es cosmético: el proxy de
      // desarrollo y el nginx del despliegue solo reenvían `/api`, así que en
      // la ruta por defecto la señalización moría con un 404 del servidor de
      // ficheros estáticos, sin llegar nunca a la API.
      path: `/${this.globalPrefix}/live-socket`,
      cors: {
        origin: this.origins.includes('*') ? true : this.origins,
        credentials: true,
      },
      // Se empieza por WebSocket y solo se cae a sondeo largo si el entorno lo
      // impide: el sondeo multiplica la latencia de la señalización y en una
      // sala eso se nota como retrasos al conectar con cada participante.
      transports: ['websocket', 'polling'],
    } as ServerOptions);
  }
}

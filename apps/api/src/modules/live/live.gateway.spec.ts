import type { Namespace, Socket } from 'socket.io';
import { LiveGateway } from './live.gateway';
import type { LiveBoardService } from './live-board.service';
import type { LivePresenceService } from './live-presence.service';
import type { LiveService } from './live.service';
import type { AuthService } from '../auth/auth.service';

/** Namespace de mentira que solo se queda con el middleware registrado. */
type Middleware = (client: Socket, next: (err?: Error) => void) => void;

function namespaceFalso(): { server: Namespace; middleware: () => Middleware } {
  let registrado: Middleware | null = null;
  const server = {
    use(fn: Middleware) {
      registrado = fn;
      return this;
    },
  } as unknown as Namespace;
  return {
    server,
    middleware: () => {
      if (!registrado) throw new Error('no se registró ningún middleware');
      return registrado;
    },
  };
}

function socketFalso(token: string | null): Socket {
  return {
    id: 'sock-1',
    data: {} as Record<string, unknown>,
    handshake: { auth: token ? { token } : {}, headers: {} },
  } as unknown as Socket;
}

interface Entorno {
  gateway: LiveGateway;
  /** Suelta la consulta de identidad, que hasta entonces queda pendiente. */
  resolverIdentidad: () => void;
}

function construir(overrides: { tokenValido?: boolean } = {}): Entorno {
  let soltar = () => undefined as void;
  const identidad = new Promise<void>((resolve) => {
    soltar = () => resolve();
  });

  const auth = {
    // Reconocer a alguien cuesta varias consultas: aquí se controla a mano
    // cuándo terminan para poder mirar qué pasa mientras tanto.
    buildSessionUser: async () => {
      await identidad;
      return {
        id: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
        capabilities: ['live:join'],
        fullName: 'Ada Lovelace',
        avatarUrl: null,
      };
    },
  } as unknown as AuthService;

  const jwt = {
    verifyAsync: async () => {
      if (overrides.tokenValido === false) throw new Error('firma inválida');
      return { sub: 'u1', type: 'access' };
    },
  } as unknown as ConstructorParameters<typeof LiveGateway>[4];

  const config = {
    getOrThrow: () => ({ accessSecret: 's', issuer: 'i', audience: 'a' }),
  } as unknown as ConstructorParameters<typeof LiveGateway>[5];

  const gateway = new LiveGateway(
    {} as unknown as LiveService,
    {} as unknown as LiveBoardService,
    {} as unknown as LivePresenceService,
    auth,
    jwt,
    config,
  );

  return { gateway, resolverIdentidad: () => soltar() };
}

describe('LiveGateway · entrada a la sala', () => {
  it('no deja pasar la conexión hasta saber quién llama', async () => {
    const { server, middleware } = namespaceFalso();
    const { gateway, resolverIdentidad } = construir();
    gateway.afterInit(server);

    const client = socketFalso('testigo');
    let terminado = false;
    let fallo: Error | undefined;
    middleware()(client, (err) => {
      terminado = true;
      fallo = err;
    });

    // Mientras la identidad está en vuelo, el cliente todavía no ha recibido
    // el `connect`: es justo lo que impide que su `live:join` se adelante.
    await Promise.resolve();
    expect(terminado).toBe(false);
    expect(client.data.user).toBeUndefined();

    resolverIdentidad();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(terminado).toBe(true);
    expect(fallo).toBeUndefined();
    expect(client.data.user).toMatchObject({ id: 'u1', tenantId: 't1' });
    expect(client.data.fullName).toBe('Ada Lovelace');
  });

  it('rechaza la conexión sin testigo con un mensaje legible', async () => {
    const { server, middleware } = namespaceFalso();
    const { gateway } = construir();
    gateway.afterInit(server);

    const client = socketFalso(null);
    const fallo = await new Promise<Error | undefined>((resolve) => {
      middleware()(client, resolve);
    });

    expect(fallo?.message).toBe('Sesión no válida o caducada.');
    expect(client.data.user).toBeUndefined();
  });

  it('rechaza la conexión con un testigo que no vale', async () => {
    const { server, middleware } = namespaceFalso();
    const { gateway } = construir({ tokenValido: false });
    gateway.afterInit(server);

    const client = socketFalso('testigo-roto');
    const fallo = await new Promise<Error | undefined>((resolve) => {
      middleware()(client, resolve);
    });

    expect(fallo?.message).toBe('Sesión no válida o caducada.');
  });
});

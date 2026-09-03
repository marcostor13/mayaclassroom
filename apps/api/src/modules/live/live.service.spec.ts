import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  CAP,
  DEFAULT_LIVE_SETTINGS,
  LiveParticipantRole,
  LiveSessionMode,
  LiveSessionStatus,
} from '@maya/shared';
import { LivePresenceService } from './live-presence.service';
import { LiveService } from './live.service';
import type { LiveRequester } from './live.service';
import type { LiveSessionDocument } from './schemas/live-session.schema';

const TENANT = new Types.ObjectId();
const PROFESOR = new Types.ObjectId();
const ALUMNA = new Types.ObjectId();
const CURSO = new Types.ObjectId();

const live = {
  stunUrls: ['stun:stun.ejemplo.com:3478'],
  turnUrls: ['turn:turn.ejemplo.com:3478'],
  turnSecret: '',
  turnUsername: '',
  turnPassword: '',
  turnTtl: 3600,
  forceRelay: false,
  maxParticipants: 25,
  recordingChunkSize: 1024,
  recordingMaxSize: 4096,
  recordingStagingPath: './storage/.live-chunks',
};

/** Sesión de mentira con lo justo que mira el servicio. */
function sesion(overrides: Partial<LiveSessionDocument> = {}): LiveSessionDocument {
  return {
    id: 'sesion-1',
    _id: new Types.ObjectId(),
    tenant: TENANT,
    title: 'Clase 3',
    roomCode: 'maya-bcdf-ghjk-mnp',
    status: LiveSessionStatus.Live,
    mode: LiveSessionMode.Class,
    course: CURSO,
    host: PROFESOR,
    coHosts: [],
    scheduledStart: new Date(Date.now() - 60_000),
    settings: { ...DEFAULT_LIVE_SETTINGS },
    openToTenant: false,
    deletedAt: null,
    ...overrides,
  } as unknown as LiveSessionDocument;
}

interface Entorno {
  service: LiveService;
  presence: LivePresenceService;
  enrolments: { isEnrolled: ReturnType<typeof mockDe> };
}

function mockDe(valor: unknown) {
  const fn = (..._args: unknown[]) => Promise.resolve(valor);
  return fn as (...args: unknown[]) => Promise<unknown>;
}

function construir(
  overrides: { turnSecret?: string; forceRelay?: boolean; matriculada?: boolean } = {},
): Entorno {
  const presence = new LivePresenceService();
  const enrolments = { isEnrolled: mockDe(overrides.matriculada ?? true) };
  const config = {
    getOrThrow: (clave: string) =>
      clave === 'live'
        ? { ...live, turnSecret: overrides.turnSecret ?? '', forceRelay: overrides.forceRelay ?? false }
        : { webUrl: 'https://aula.ejemplo.com', url: '', globalPrefix: 'api' },
  };

  // El resto de colaboradores no interviene en lo que se comprueba aquí: el
  // servicio solo los toca al crear, listar o serializar.
  const nada = {} as never;
  const service = new LiveService(
    nada,
    nada,
    nada,
    presence,
    nada,
    enrolments as never,
    nada,
    nada,
    nada,
    { hasCapability: mockDe(false) } as never,
    { requireByInstance: () => Promise.reject(new Error('sin contexto')) } as never,
    config as never,
  );

  return { service, presence, enrolments };
}

const usuario = (id: Types.ObjectId, capabilities: string[] = []): LiveRequester => ({
  id: String(id),
  tenantId: String(TENANT),
  isPlatformAdmin: false,
  capabilities,
});

describe('LiveService · papeles dentro de la sala', () => {
  it('quien convocó la sesión es el anfitrión', async () => {
    const { service } = construir();

    await expect(service.resolveRole(usuario(PROFESOR), sesion())).resolves.toBe(
      LiveParticipantRole.Host,
    );
  });

  it('el alumnado entra como asistente', async () => {
    const { service } = construir();

    await expect(service.resolveRole(usuario(ALUMNA, [CAP.LIVE_JOIN]), sesion())).resolves.toBe(
      LiveParticipantRole.Attendee,
    );
  });

  it('quien gestiona las sesiones de la empresa entra moderando', async () => {
    const { service } = construir();

    await expect(
      service.resolveRole(usuario(ALUMNA, [CAP.LIVE_MANAGE_ANY]), sesion()),
    ).resolves.toBe(LiveParticipantRole.CoHost);
  });

  it('los co-anfitriones declarados moderan', async () => {
    const { service } = construir();
    const session = sesion({ coHosts: [ALUMNA] });

    await expect(service.resolveRole(usuario(ALUMNA), session)).resolves.toBe(
      LiveParticipantRole.CoHost,
    );
  });
});

describe('LiveService · quién puede entrar', () => {
  it('deja pasar al alumnado matriculado en el curso de la clase', async () => {
    const { service } = construir({ matriculada: true });

    await expect(
      service.authorizeJoin(usuario(ALUMNA, [CAP.LIVE_JOIN]), sesion()),
    ).resolves.toBe(LiveParticipantRole.Attendee);
  });

  it('rechaza a quien no está matriculado, aunque tenga el enlace', async () => {
    const { service } = construir({ matriculada: false });

    await expect(
      service.authorizeJoin(usuario(ALUMNA, [CAP.LIVE_JOIN]), sesion()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('una sesión abierta a la empresa no mira la matrícula', async () => {
    const { service } = construir({ matriculada: false });

    await expect(
      service.authorizeJoin(usuario(ALUMNA, [CAP.LIVE_JOIN]), sesion({ openToTenant: true })),
    ).resolves.toBe(LiveParticipantRole.Attendee);
  });

  it('sin la capacidad de entrar, no se entra', async () => {
    const { service } = construir();

    await expect(service.authorizeJoin(usuario(ALUMNA), sesion())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('una sesión terminada se cierra al alumnado pero no a quien la convocó', async () => {
    const { service } = construir();
    const session = sesion({ status: LiveSessionStatus.Ended });

    await expect(
      service.authorizeJoin(usuario(ALUMNA, [CAP.LIVE_JOIN]), session),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.authorizeJoin(usuario(PROFESOR), session)).resolves.toBe(
      LiveParticipantRole.Host,
    );
  });

  it('antes de la hora, el alumnado espera a que alguien abra la sala', async () => {
    const { service, presence } = construir();
    const session = sesion({
      status: LiveSessionStatus.Scheduled,
      scheduledStart: new Date(Date.now() + 6 * 60 * 60 * 1000),
    });

    await expect(
      service.authorizeJoin(usuario(ALUMNA, [CAP.LIVE_JOIN]), session),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Con quien presenta ya dentro, la antelación deja de importar.
    presence.add(session.id, {
      socketId: 'a',
      userId: String(PROFESOR),
      fullName: 'Profesor',
      avatarUrl: null,
      role: LiveParticipantRole.Host,
      audio: true,
      video: true,
      screen: false,
      hand: false,
      waiting: false,
      joinedAt: new Date().toISOString(),
    });

    await expect(
      service.authorizeJoin(usuario(ALUMNA, [CAP.LIVE_JOIN]), session),
    ).resolves.toBe(LiveParticipantRole.Attendee);
  });

  it('con el aforo lleno no entra nadie más', async () => {
    const { service, presence } = construir();
    const session = sesion({ settings: { ...DEFAULT_LIVE_SETTINGS, maxParticipants: 1 } });

    presence.add(session.id, {
      socketId: 'a',
      userId: String(PROFESOR),
      fullName: 'Profesor',
      avatarUrl: null,
      role: LiveParticipantRole.Host,
      audio: true,
      video: true,
      screen: false,
      hand: false,
      waiting: false,
      joinedAt: new Date().toISOString(),
    });

    await expect(
      service.authorizeJoin(usuario(ALUMNA, [CAP.LIVE_JOIN]), session),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('LiveService · servidores para atravesar cortafuegos', () => {
  it('sin secreto compartido, publica los servidores tal cual', () => {
    const { service } = construir();
    const config = service.iceConfig(String(ALUMNA));

    expect(config.iceServers).toHaveLength(2);
    expect(config.iceServers[1].username).toBeUndefined();
  });

  it('con secreto, emite credenciales TURN temporales por persona', () => {
    const { service } = construir({ turnSecret: 'secreto-de-coturn' });

    const config = service.iceConfig(String(ALUMNA));
    const turn = config.iceServers[1];

    expect(turn.username).toMatch(new RegExp(`^\\d+:${String(ALUMNA)}$`));
    expect(turn.credential).toBeTruthy();

    // Caducidad futura: una credencial ya vencida no serviría de nada.
    const caducidad = Number(String(turn.username).split(':')[0]);
    expect(caducidad).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('no fuerza el relevo si no hay TURN: dejaría la sala sin ninguna ruta', () => {
    const presence = new LivePresenceService();
    const config = {
      getOrThrow: (clave: string) =>
        clave === 'live'
          ? { ...live, turnUrls: [], forceRelay: true }
          : { webUrl: '', url: '', globalPrefix: 'api' },
    };
    const nada = {} as never;
    const service = new LiveService(
      nada, nada, nada, presence, nada, nada, nada, nada, nada, nada, nada,
      config as never,
    );

    expect(service.iceConfig(String(ALUMNA)).forceRelay).toBe(false);
  });
});

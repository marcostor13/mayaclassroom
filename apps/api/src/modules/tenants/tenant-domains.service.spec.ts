import { Types } from 'mongoose';
import { TenantDomainStatus, TenantStatus } from '@maya/shared';
import { TenantDomainsService } from './tenant-domains.service';
import type { TenantDocument } from './schemas/tenant.schema';

const DESTINO = 'dominios.mayaclassroom.pe';

/** Empresa de mentira con lo justo que toca el servicio. */
function empresa(overrides: Partial<TenantDocument> = {}): TenantDocument {
  return {
    _id: new Types.ObjectId(),
    slug: 'dulcelima',
    status: TenantStatus.Active,
    domain: null,
    domainStatus: TenantDomainStatus.None,
    domainToken: null,
    domainVerifiedAt: null,
    domainCheckedAt: null,
    domainError: null,
    domainProviderId: null,
    save: async () => undefined,
    ...overrides,
  } as unknown as TenantDocument;
}

/**
 * Respuestas de DNS por nombre y tipo, en la forma en la que las devuelve un
 * resolutor DNS-over-HTTPS.
 */
type Zona = Record<string, { type: number; data: string }[]>;

const clave = (name: string, type: number) => `${name.toLowerCase()}|${type}`;

interface Entorno {
  service: TenantDomainsService;
  /** Empresas que la consulta de ocupación encuentra, además de la propia. */
  otras: TenantDocument[];
}

function construir(
  tenant: TenantDocument,
  options: { zona?: Zona; target?: string; reserved?: string[] } = {},
): Entorno {
  const otras: TenantDocument[] = [];
  const zona = options.zona ?? {};

  const model = {
    findOne: (filtro: Record<string, unknown>) => ({
      exec: async () => {
        // La consulta de ocupación y la de resolución llevan `domainStatus`;
        // la de carga de la empresa propia va por `_id`.
        if ('domainStatus' in filtro) {
          const buscado = filtro.domain;
          return otras.find((o) => o.domain === buscado) ?? null;
        }
        return tenant;
      },
    }),
  };

  const config = {
    getOrThrow: () => ({
      target: options.target ?? DESTINO,
      resolver: 'https://resolutor.test/dns-query',
      reserved: options.reserved ?? [],
      cloudflareZoneId: '',
      cloudflareToken: '',
    }),
    get: () => ({ url: 'https://api.mayaclassroom.pe', webUrl: 'https://mayaclassroom.pe' }),
  };

  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    const name = (url.searchParams.get('name') ?? '').toLowerCase();
    const type = Number(url.searchParams.get('type'));
    const answer = zona[clave(name, type)] ?? [];
    return {
      ok: true,
      json: async () => ({ Status: 0, Answer: answer.map((a) => ({ name, ...a })) }),
    };
  }) as unknown as typeof fetch;

  const service = new TenantDomainsService(
    model as never,
    config as never,
  );
  return { service, otras };
}

/** Zona con los dos registros bien puestos para `host`. */
function zonaCorrecta(host: string, token: string): Zona {
  return {
    [clave(host, 5)]: [{ type: 5, data: `${DESTINO}.` }],
    [clave(`_maya-verificacion.${host}`, 16)]: [{ type: 16, data: `"${token}"` }],
  };
}

describe('TenantDomainsService · reservar el dominio', () => {
  it('normaliza lo que la gente pega de verdad', async () => {
    const tenant = empresa();
    const { service } = construir(tenant);

    const estado = await service.request(tenant._id, '  HTTPS://Cursos.DulceLima.pe/catalogo  ');

    expect(estado.hostname).toBe('cursos.dulcelima.pe');
    expect(estado.status).toBe(TenantDomainStatus.Pending);
  });

  it('entrega los dos registros que hay que crear', async () => {
    const tenant = empresa();
    const { service } = construir(tenant);

    const estado = await service.request(tenant._id, 'cursos.dulcelima.pe');

    expect(estado.records.map((r) => r.type)).toEqual(['CNAME', 'TXT']);
    expect(estado.records[0]).toMatchObject({ name: 'cursos.dulcelima.pe', value: DESTINO });
    expect(estado.records[1].name).toBe('_maya-verificacion.cursos.dulcelima.pe');
    expect(estado.records[1].value).toMatch(/^maya-verificacion=[0-9a-f]{32}$/);
  });

  it('no deja reclamar un dominio de la propia plataforma', async () => {
    const tenant = empresa();
    const { service } = construir(tenant);

    // Quien se quedase con estos nombres se quedaría con el tráfico de todas
    // las empresas, no solo con el suyo.
    await expect(service.request(tenant._id, 'mayaclassroom.pe')).rejects.toThrow(/reservado/i);
    await expect(service.request(tenant._id, 'api.mayaclassroom.pe')).rejects.toThrow(/reservado/i);
    await expect(service.request(tenant._id, DESTINO)).rejects.toThrow(/reservado/i);
  });

  it('rechaza lo que no es un nombre de dominio', async () => {
    const tenant = empresa();
    const { service } = construir(tenant);

    await expect(service.request(tenant._id, 'localhost')).rejects.toThrow(/dominio completo/i);
    await expect(service.request(tenant._id, '203.0.113.10')).rejects.toThrow(/dirección IP/i);
    await expect(service.request(tenant._id, 'cursos.dulcelima.pe:8080')).rejects.toThrow(/puerto/i);
    await expect(service.request(tenant._id, '-mal.dulcelima.pe')).rejects.toThrow(/guion/i);
  });

  it('no deja quedarse con el dominio que otra empresa ya reservó', async () => {
    const tenant = empresa();
    const { service, otras } = construir(tenant);
    otras.push(empresa({ domain: 'cursos.dulcelima.pe', domainStatus: TenantDomainStatus.Active }));

    await expect(service.request(tenant._id, 'cursos.dulcelima.pe')).rejects.toThrow(/ya está reservado/i);
  });

  it('queda apagado si el despliegue no tiene destino configurado', async () => {
    const tenant = empresa();
    const { service } = construir(tenant, { target: '' });

    expect(service.habilitado).toBe(false);
    await expect(service.request(tenant._id, 'cursos.dulcelima.pe')).rejects.toThrow(/no admite/i);
    // También al consultar: la pantalla lo dice antes de ofrecer nada, en vez
    // de dejar que el fallo aparezca al pulsar el botón.
    await expect(service.state(tenant._id)).rejects.toThrow(/no admite/i);
  });
});

describe('TenantDomainsService · comprobar el DNS', () => {
  const token = 'maya-verificacion=abc';

  it('activa el dominio cuando los dos registros están puestos', async () => {
    const tenant = empresa({
      domain: 'cursos.dulcelima.pe',
      domainStatus: TenantDomainStatus.Pending,
      domainToken: token,
    });
    const { service } = construir(tenant, { zona: zonaCorrecta('cursos.dulcelima.pe', token) });

    const estado = await service.verify(tenant._id);

    expect(estado.status).toBe(TenantDomainStatus.Active);
    expect(estado.lastError).toBeNull();
    expect(estado.verifiedAt).not.toBeNull();
  });

  it('cuenta qué falta en lugar de fallar la petición', async () => {
    const tenant = empresa({
      domain: 'cursos.dulcelima.pe',
      domainStatus: TenantDomainStatus.Pending,
      domainToken: token,
    });
    // El CNAME está, el TXT no.
    const { service } = construir(tenant, {
      zona: { [clave('cursos.dulcelima.pe', 5)]: [{ type: 5, data: `${DESTINO}.` }] },
    });

    const estado = await service.verify(tenant._id);

    expect(estado.status).toBe(TenantDomainStatus.Failed);
    expect(estado.lastError).toMatch(/falta el registro txt/i);
  });

  it('avisa cuando el TXT está pero con otro valor', async () => {
    const tenant = empresa({
      domain: 'cursos.dulcelima.pe',
      domainStatus: TenantDomainStatus.Pending,
      domainToken: token,
    });
    const { service } = construir(tenant, {
      zona: {
        ...zonaCorrecta('cursos.dulcelima.pe', 'otro-valor'),
      },
    });

    expect((await service.verify(tenant._id)).lastError).toMatch(/no coincide/i);
  });

  it('acepta la raíz de un dominio por coincidencia de direcciones', async () => {
    // En la raíz el CNAME no es legal: los proveedores lo resuelven con ALIAS
    // o aplanándolo, y mirar solo el CNAME rechazaría una configuración buena.
    const tenant = empresa({
      domain: 'dulcelima.pe',
      domainStatus: TenantDomainStatus.Pending,
      domainToken: token,
    });
    const { service } = construir(tenant, {
      zona: {
        [clave('_maya-verificacion.dulcelima.pe', 16)]: [{ type: 16, data: `"${token}"` }],
        [clave('dulcelima.pe', 1)]: [{ type: 1, data: '198.51.100.7' }],
        [clave(DESTINO, 1)]: [{ type: 1, data: '198.51.100.7' }],
      },
    });

    expect((await service.verify(tenant._id)).status).toBe(TenantDomainStatus.Active);
  });

  it('un dominio ya activo no se apaga porque una consulta falle', async () => {
    // Apagarlo dejaría a la empresa sin página por un tropiezo del DNS.
    const tenant = empresa({
      domain: 'cursos.dulcelima.pe',
      domainStatus: TenantDomainStatus.Active,
      domainToken: token,
      domainVerifiedAt: new Date('2026-01-01'),
    });
    const { service } = construir(tenant, { zona: {} });

    const estado = await service.verify(tenant._id);

    expect(estado.status).toBe(TenantDomainStatus.Active);
    expect(estado.lastError).toMatch(/falta el registro txt/i);
  });
});

describe('TenantDomainsService · a quién sirve un anfitrión', () => {
  it('solo responde por los dominios ya verificados', async () => {
    const tenant = empresa();
    const { service, otras } = construir(tenant);
    otras.push(
      empresa({ domain: 'cursos.dulcelima.pe', domainStatus: TenantDomainStatus.Active }),
    );

    expect(await service.resolveHost('Cursos.DulceLima.pe.')).toEqual({ tenantSlug: 'dulcelima' });
    expect(await service.resolveHost('otro.ejemplo.pe')).toEqual({ tenantSlug: null });
    expect(await service.resolveHost('')).toEqual({ tenantSlug: null });
  });

  it('una empresa suspendida no sirve ni en su propio dominio', async () => {
    const tenant = empresa();
    const { service, otras } = construir(tenant);
    otras.push(
      empresa({
        domain: 'cursos.dulcelima.pe',
        domainStatus: TenantDomainStatus.Active,
        status: TenantStatus.Suspended,
      }),
    );

    expect(await service.resolveHost('cursos.dulcelima.pe')).toEqual({ tenantSlug: null });
  });
});

describe('TenantDomainsService · retirar el dominio', () => {
  it('deja la empresa como estaba antes de pedirlo', async () => {
    const tenant = empresa({
      domain: 'cursos.dulcelima.pe',
      domainStatus: TenantDomainStatus.Active,
      domainToken: 'maya-verificacion=abc',
      domainVerifiedAt: new Date(),
    });
    const { service } = construir(tenant);

    const estado = await service.remove(tenant._id);

    expect(estado).toMatchObject({
      status: TenantDomainStatus.None,
      hostname: null,
      records: [],
      verifiedAt: null,
    });
  });
});

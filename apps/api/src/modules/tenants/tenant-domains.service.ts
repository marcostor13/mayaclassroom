import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { TenantDomainStatus, TenantStatus } from '@maya/shared';
import type { HostResolutionDto, TenantDomainDto, TenantDomainRecord } from '@maya/shared';
import type { AppConfig, DomainsConfig } from '../../config';
import { notDeleted } from '../../common/utils';
import { Tenant, TenantDocument } from './schemas/tenant.schema';

/** Prefijo del TXT con el que una empresa demuestra que el dominio es suyo. */
const PREFIJO_TXT = '_maya-verificacion';

/** Tipos de registro del protocolo, para las consultas DNS-over-HTTPS. */
const TIPO = { A: 1, CNAME: 5, TXT: 16 } as const;

/** Una respuesta de un resolutor DNS-over-HTTPS en su forma JSON. */
interface RespuestaDoh {
  Status: number;
  Answer?: { name: string; type: number; data: string }[];
}

/**
 * El dominio propio de cada empresa.
 *
 * ## Por qué así
 *
 * La página pública de una empresa vive en `…/p/su-identificador`, y a un
 * cliente que vende cursos eso le sirve de poco: quiere `cursos.suescuela.pe`.
 * El obstáculo no es la aplicación —ya sabe servir cualquier empresa— sino
 * llegar hasta ella: este despliegue no tiene IP pública, Cloudflare entrega
 * el tráfico por un túnel, y a un túnel solo apuntan los dominios de la propia
 * cuenta de Cloudflare. El de un cliente no lo es.
 *
 * De ahí la forma de la solución, que es la de Cloudflare for SaaS: el cliente
 * apunta su nombre por CNAME a un nombre nuestro (`domains.target`), Cloudflare
 * emite el certificado de *su* nombre y entrega el tráfico por el túnel de
 * siempre. Ni una pieza nueva de infraestructura, ni un despliegue por cada
 * dominio, ni certificados que renovar a mano.
 *
 * ## Por qué se comprueba antes de activar
 *
 * Quien administra una empresa escribe el nombre que quiera, y sin prueba de
 * propiedad podría escribir el de otro. Mientras el dominio no enrute no pasa
 * nada, pero en cuanto enruta sería servir la página de una empresa en el
 * nombre de otra. Por eso se piden dos registros y se comprueban los dos: el
 * CNAME dice a dónde va el tráfico y el TXT dice quién manda en ese nombre.
 */
@Injectable()
export class TenantDomainsService {
  private readonly logger = new Logger(TenantDomainsService.name);

  constructor(
    @InjectModel(Tenant.name) private readonly model: Model<TenantDocument>,
    private readonly config: ConfigService,
  ) {}

  private get ajustes(): DomainsConfig {
    return this.config.getOrThrow<DomainsConfig>('domains');
  }

  /** ¿Tiene sentido ofrecer esto en este despliegue? */
  get habilitado(): boolean {
    return Boolean(this.ajustes.target);
  }

  private exigirHabilitado(): DomainsConfig {
    const ajustes = this.ajustes;
    if (!ajustes.target) {
      throw new ServiceUnavailableException(
        'Este despliegue no admite dominios propios todavía.',
      );
    }
    return ajustes;
  }

  /* -------------------------------- Consulta ------------------------------ */

  /**
   * Exige el despliegue configurado aunque solo esté leyendo: la pantalla usa
   * ese 503 para decir que la función no está disponible aquí. Sin él
   * ofrecería reservar un dominio y el fallo llegaría al pulsar, que es el
   * peor momento para enterarse.
   */
  async state(tenantId: string | Types.ObjectId): Promise<TenantDomainDto> {
    this.exigirHabilitado();
    return this.toDto(await this.requireTenant(tenantId));
  }

  /**
   * Qué empresa sirve este anfitrión.
   *
   * La llama el cliente al arrancar para saber si está en el dominio de la
   * plataforma o en el de una empresa. Solo cuenta un dominio activo: uno a
   * medio configurar no debe empezar a servir por su cuenta el día que alguien
   * apunte el DNS.
   */
  async resolveHost(hostname: string): Promise<HostResolutionDto> {
    const host = normalizar(hostname);
    if (!host) return { tenantSlug: null };

    const tenant = await this.model
      .findOne({ domain: host, domainStatus: TenantDomainStatus.Active, ...notDeleted })
      .exec();

    // Una empresa suspendida no sirve su página ni en su dominio: dejarla
    // sería una puerta trasera al cierre de una cuenta.
    if (!tenant || tenant.status === TenantStatus.Suspended || tenant.status === TenantStatus.Archived) {
      return { tenantSlug: null };
    }
    return { tenantSlug: tenant.slug };
  }

  /* -------------------------------- Alta ---------------------------------- */

  /**
   * Registra el dominio que la empresa quiere y devuelve lo que tiene que
   * poner en su DNS. No activa nada: activar es cosa de `verify`.
   */
  async request(tenantId: string | Types.ObjectId, hostname: string): Promise<TenantDomainDto> {
    const ajustes = this.exigirHabilitado();
    const host = this.validarHostname(hostname, ajustes);
    const tenant = await this.requireTenant(tenantId);

    if (tenant.domain === host && tenant.domainStatus === TenantDomainStatus.Active) {
      return this.toDto(tenant);
    }

    const ocupado = await this.model
      .findOne({
        _id: { $ne: tenant._id },
        domain: host,
        domainStatus: { $in: [TenantDomainStatus.Active, TenantDomainStatus.Pending] },
        ...notDeleted,
      })
      .exec();
    if (ocupado) {
      // Sin decir de quién: a quien lo pide no le sirve de nada saberlo y a la
      // otra empresa no le conviene que se sepa.
      throw new ConflictException(`El dominio «${host}» ya está reservado por otra empresa.`);
    }

    tenant.domain = host;
    tenant.domainStatus = TenantDomainStatus.Pending;
    // El testigo se renueva con cada nombre: reutilizarlo dejaría válida la
    // prueba de un dominio que ya no se está pidiendo.
    tenant.domainToken = `maya-verificacion=${randomBytes(16).toString('hex')}`;
    tenant.domainVerifiedAt = null;
    tenant.domainCheckedAt = null;
    tenant.domainError = null;
    await tenant.save();

    return this.toDto(tenant);
  }

  /** Quita el dominio y devuelve la empresa a la dirección de la plataforma. */
  async remove(tenantId: string | Types.ObjectId): Promise<TenantDomainDto> {
    const tenant = await this.requireTenant(tenantId);
    const providerId = tenant.domainProviderId;

    tenant.domain = null;
    tenant.domainStatus = TenantDomainStatus.None;
    tenant.domainToken = null;
    tenant.domainVerifiedAt = null;
    tenant.domainCheckedAt = null;
    tenant.domainError = null;
    tenant.domainProviderId = null;
    await tenant.save();

    // Se hace después de guardar y sin romper la operación si falla: el
    // certificado sobrante en Cloudflare es basura que se limpia, pero dejar
    // el dominio puesto en la base porque un servicio de fuera no responde
    // sería no poder quitarlo nunca.
    if (providerId) {
      await this.borrarNombreEnCloudflare(providerId).catch((error: unknown) =>
        this.logger.warn(`No se pudo retirar el nombre ${providerId}: ${String(error)}`),
      );
    }

    return this.toDto(tenant);
  }

  /* ----------------------------- Comprobación ----------------------------- */

  /**
   * Comprueba el DNS y activa el dominio si está como debe.
   *
   * Un fallo aquí no es un error de la petición: es el resultado de la
   * comprobación, y se devuelve en el propio estado para que la pantalla lo
   * enseñe junto a las instrucciones. Lanzar una excepción obligaría a pintar
   * el mismo texto en dos sitios.
   */
  async verify(tenantId: string | Types.ObjectId): Promise<TenantDomainDto> {
    const ajustes = this.exigirHabilitado();
    const tenant = await this.requireTenant(tenantId);

    if (!tenant.domain || !tenant.domainToken) {
      throw new BadRequestException('Esta empresa no tiene ningún dominio pendiente.');
    }

    const fallo = await this.comprobarDns(tenant.domain, tenant.domainToken, ajustes);
    tenant.domainCheckedAt = new Date();

    if (fallo) {
      tenant.domainError = fallo;
      // Un dominio que ya servía y deja de resolver no se apaga al primer
      // tropiezo del DNS: se marca y se sigue sirviendo. Apagarlo dejaría a la
      // empresa sin página por una consulta que falló una vez.
      if (tenant.domainStatus !== TenantDomainStatus.Active) {
        tenant.domainStatus = TenantDomainStatus.Failed;
      }
      await tenant.save();
      return this.toDto(tenant);
    }

    tenant.domainError = null;
    tenant.domainStatus = TenantDomainStatus.Active;
    tenant.domainVerifiedAt ??= new Date();

    // El certificado se pide ahora y no al reservar el nombre: Cloudflare solo
    // puede emitirlo cuando el DNS ya apunta aquí, que es justo lo que se
    // acaba de comprobar.
    try {
      const id = await this.altaNombreEnCloudflare(tenant.domain);
      if (id) tenant.domainProviderId = id;
    } catch (error) {
      tenant.domainError =
        'El dominio apunta bien, pero el certificado todavía se está emitiendo. ' +
        'Vuelva a comprobar en unos minutos.';
      this.logger.warn(`Cloudflare for SaaS rechazó ${tenant.domain}: ${String(error)}`);
    }

    await tenant.save();
    return this.toDto(tenant);
  }

  /**
   * Los dos registros que tienen que estar puestos.
   *
   * Devuelve el primer problema encontrado, en el orden en el que quien lo
   * está configurando los va a resolver, o `null` si todo está en su sitio.
   */
  private async comprobarDns(
    host: string,
    token: string,
    ajustes: DomainsConfig,
  ): Promise<string | null> {
    const [txt, apunta] = await Promise.all([
      this.consultar(`${PREFIJO_TXT}.${host}`, TIPO.TXT, ajustes),
      this.apuntaAlDestino(host, ajustes),
    ]);

    const valores = txt.map((v) => v.replace(/^"|"$/g, ''));
    if (!valores.includes(token)) {
      return valores.length
        ? `El registro TXT de ${PREFIJO_TXT}.${host} existe pero no coincide con el valor que se pide.`
        : `Falta el registro TXT de ${PREFIJO_TXT}.${host}.`;
    }

    if (!apunta) {
      return `${host} todavía no apunta a ${ajustes.target}. El DNS puede tardar unos minutos en propagarse.`;
    }

    return null;
  }

  /**
   * ¿Lleva este nombre hasta el nuestro?
   *
   * Vale por CNAME, que es lo que se pide, y también si las direcciones del
   * nombre coinciden con las del destino: en la raíz de un dominio el CNAME no
   * es legal y los proveedores lo resuelven con ALIAS o aplanándolo, así que
   * mirar solo el CNAME rechazaría configuraciones correctas.
   */
  private async apuntaAlDestino(host: string, ajustes: DomainsConfig): Promise<boolean> {
    const destino = normalizar(ajustes.target);
    const cnames = await this.consultar(host, TIPO.CNAME, ajustes);
    if (cnames.some((valor) => normalizar(valor) === destino)) return true;

    const [propias, suyas] = await Promise.all([
      this.consultar(host, TIPO.A, ajustes),
      this.consultar(destino, TIPO.A, ajustes),
    ]);
    if (!propias.length || !suyas.length) return false;
    return propias.some((ip) => suyas.includes(ip));
  }

  /** Una consulta DNS por HTTPS. Sin respuesta útil devuelve la lista vacía. */
  private async consultar(name: string, type: number, ajustes: DomainsConfig): Promise<string[]> {
    const url = `${ajustes.resolver}?name=${encodeURIComponent(name)}&type=${type}`;
    try {
      const respuesta = await fetch(url, { headers: { accept: 'application/dns-json' } });
      if (!respuesta.ok) return [];
      const cuerpo = (await respuesta.json()) as RespuestaDoh;
      return (cuerpo.Answer ?? []).filter((a) => a.type === type).map((a) => a.data);
    } catch (error) {
      // Un resolutor caído no es un dominio mal configurado: se registra y se
      // trata como «todavía no está», que es lo que la pantalla sabe explicar.
      this.logger.warn(`Consulta DNS de ${name} fallida: ${String(error)}`);
      return [];
    }
  }

  /* --------------------------- Cloudflare for SaaS ------------------------ */

  /**
   * Da de alta el nombre del cliente para que Cloudflare le emita certificado.
   *
   * Sin zona ni testigo configurados no hace nada y lo dice devolviendo `null`:
   * en desarrollo no hay Cloudflare delante, y la comprobación de DNS sigue
   * teniendo sentido por sí sola.
   */
  private async altaNombreEnCloudflare(hostname: string): Promise<string | null> {
    const { cloudflareZoneId, cloudflareToken } = this.ajustes;
    if (!cloudflareZoneId || !cloudflareToken) return null;

    const respuesta = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/custom_hostnames`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cloudflareToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          hostname,
          ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
        }),
      },
    );

    const cuerpo = (await respuesta.json()) as {
      success: boolean;
      result?: { id: string };
      errors?: { code: number; message: string }[];
    };

    // 81100 es «ya existe»: se pide en cada comprobación, así que reencontrarlo
    // es lo normal y no un error.
    if (!cuerpo.success && !cuerpo.errors?.some((e) => e.code === 81100)) {
      throw new Error(cuerpo.errors?.map((e) => e.message).join('; ') ?? 'respuesta sin detalle');
    }
    return cuerpo.result?.id ?? null;
  }

  private async borrarNombreEnCloudflare(id: string): Promise<void> {
    const { cloudflareZoneId, cloudflareToken } = this.ajustes;
    if (!cloudflareZoneId || !cloudflareToken) return;

    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/custom_hostnames/${id}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${cloudflareToken}` } },
    );
  }

  /* -------------------------------- Ayudas -------------------------------- */

  /**
   * Deja el nombre en su forma canónica o explica por qué no vale.
   *
   * Se admite lo que la gente pega de verdad —con `https://`, con barra final,
   * en mayúsculas— porque rechazarlo por la forma y no por el fondo obliga a
   * quien lo escribe a adivinar qué se esperaba.
   */
  private validarHostname(entrada: string, ajustes: DomainsConfig): string {
    const host = normalizar(entrada.trim().replace(/^https?:\/\//i, '').split('/')[0]);

    if (!host) throw new BadRequestException('Escriba el dominio que quiere usar.');
    if (host.length > 253) throw new BadRequestException('Ese dominio es demasiado largo.');
    if (host.includes(':')) {
      throw new BadRequestException('El dominio va sin puerto: solo el nombre.');
    }
    if (/^\d+(\.\d+)*$/.test(host)) {
      throw new BadRequestException('Hace falta un nombre de dominio, no una dirección IP.');
    }

    const etiquetas = host.split('.');
    if (etiquetas.length < 2) {
      throw new BadRequestException('Escriba el dominio completo, por ejemplo cursos.suescuela.pe.');
    }
    if (!etiquetas.every((e) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(e))) {
      throw new BadRequestException(
        'El dominio solo admite letras, números y guiones, y ninguna parte puede empezar ni acabar en guion.',
      );
    }

    // Los nombres de la plataforma no se reclaman: quien se quedase con ellos
    // se quedaría con el tráfico de todas las empresas, no solo con el suyo.
    const reservados = [
      ...ajustes.reserved,
      ajustes.target,
      hostDe(this.config.get<AppConfig>('app')?.url),
      hostDe(this.config.get<AppConfig>('app')?.webUrl),
    ]
      .map(normalizar)
      .filter(Boolean);

    if (reservados.some((r) => host === r || host.endsWith(`.${r}`))) {
      throw new BadRequestException(`El dominio «${host}» está reservado por la plataforma.`);
    }

    return host;
  }

  private async requireTenant(id: string | Types.ObjectId): Promise<TenantDocument> {
    const tenant = await this.model.findOne({ _id: id, ...notDeleted }).exec();
    if (!tenant) throw new BadRequestException('La empresa no existe.');
    return tenant;
  }

  /**
   * El estado tal y como lo enseña la pantalla.
   *
   * Las instrucciones se calculan siempre, incluso con el dominio ya activo:
   * quien cambia de proveedor de DNS necesita volver a ponerlas, y esconderlas
   * al activar obligaría a quitar el dominio para volver a leerlas.
   */
  private toDto(tenant: TenantDocument): TenantDomainDto {
    const host = tenant.domain;
    const records: TenantDomainRecord[] =
      host && tenant.domainToken
        ? [
            {
              type: 'CNAME',
              name: host,
              value: this.ajustes.target,
              purpose: 'Lleva las visitas de su dominio hasta la plataforma.',
            },
            {
              type: 'TXT',
              name: `${PREFIJO_TXT}.${host}`,
              value: tenant.domainToken,
              purpose: 'Demuestra que el dominio es suyo. Puede retirarlo una vez activado.',
            },
          ]
        : [];

    return {
      status: tenant.domainStatus,
      hostname: host,
      records,
      checkedAt: tenant.domainCheckedAt?.toISOString() ?? null,
      verifiedAt: tenant.domainVerifiedAt?.toISOString() ?? null,
      lastError: tenant.domainError,
    };
  }
}

/** Minúsculas y sin el punto final que traen las respuestas del DNS. */
function normalizar(valor: string | null | undefined): string {
  return (valor ?? '').trim().toLowerCase().replace(/\.$/, '');
}

/** El anfitrión de una URL de configuración, si es una URL. */
function hostDe(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

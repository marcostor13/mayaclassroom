import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { ContextLevel, SYSTEM_TENANT_SLUG, TenantDomainStatus, TenantStatus } from '@maya/shared';
import { Tenant, TenantDocument } from './schemas/tenant.schema';
import { ContextsService } from '../contexts/contexts.service';
import { RolesService } from '../rbac/roles.service';
import { PaginatedResult } from '../../common/dto';
import { notDeleted, searchRegex, toObjectId } from '../../common/utils';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateTenantDto, TenantQueryDto, UpdateTenantDto } from './dto/tenant.dto';

/** Empresa serializada con el número de usuarios que tiene dados de alta. */
export type TenantListItem = Record<string, unknown> & { userCount: number };

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectModel(Tenant.name) private readonly model: Model<TenantDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly contexts: ContextsService,
    private readonly roles: RolesService,
  ) {}

  async paginate(query: TenantQueryDto): Promise<PaginatedResult<TenantListItem>> {
    const filter: Record<string, unknown> = { ...notDeleted };
    if (query.status) filter.status = query.status;
    if (query.plan) filter.plan = query.plan;
    if (query.search) {
      filter.$or = [
        { name: searchRegex(query.search) },
        { slug: searchRegex(query.search) },
        { contactEmail: searchRegex(query.search) },
      ];
    }
    const [items, total] = await Promise.all([
      this.model.find(filter).sort(query.sortObject).skip(query.skip).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    const counts = await this.userCounts(items.map((tenant) => tenant._id));
    const rows = items.map((tenant) => ({
      ...(tenant.toJSON() as Record<string, unknown>),
      userCount: counts.get(tenant._id.toString()) ?? 0,
    }));
    return PaginatedResult.of(rows, total, query.page, query.limit);
  }

  /** Usuarios vivos por empresa, en una sola consulta para toda la página. */
  private async userCounts(ids: Types.ObjectId[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await this.userModel
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { tenant: { $in: ids }, deletedAt: null } },
        { $group: { _id: '$tenant', count: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((row) => [row._id.toString(), row.count]));
  }

  async findById(id: string | Types.ObjectId): Promise<TenantDocument> {
    const tenant = await this.model.findById(toObjectId(id)).exec();
    if (!tenant) throw new NotFoundException('Empresa no encontrada.');
    return tenant;
  }

  async findBySlug(slug: string): Promise<TenantDocument | null> {
    return this.model.findOne({ slug: slug.toLowerCase(), ...notDeleted }).exec();
  }

  async requireBySlug(slug: string): Promise<TenantDocument> {
    const tenant = await this.findBySlug(slug);
    if (!tenant) throw new NotFoundException(`La empresa «${slug}» no existe.`);
    return tenant;
  }

  /**
   * La empresa que sirve un dominio propio, solo si está verificado.
   *
   * El nombre se guarda desde que se pide, así que filtrar por el estado no es
   * un detalle: sin él, un dominio a medio configurar empezaría a servir el
   * día que alguien apuntase el DNS, sin haber demostrado que es suyo.
   */
  async findByDomain(domain: string): Promise<TenantDocument | null> {
    return this.model
      .findOne({
        domain: domain.trim().toLowerCase().replace(/\.$/, ''),
        domainStatus: TenantDomainStatus.Active,
        ...notDeleted,
      })
      .exec();
  }

  /** Datos públicos usados por la pantalla de acceso (marca y políticas). */
  async publicProfile(slug: string) {
    const tenant = await this.requireBySlug(slug);
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      branding: tenant.branding,
      allowSelfRegistration: tenant.settings.allowSelfRegistration,
      allowGuestAccess: tenant.settings.allowGuestAccess,
      sitePolicyUrl: tenant.settings.sitePolicyUrl,
      supportEmail: tenant.settings.supportEmail,
      defaultLanguage: tenant.settings.defaultLanguage,
    };
  }

  async create(dto: CreateTenantDto): Promise<TenantDocument> {
    const slug = dto.slug.toLowerCase().trim();
    // Incluye las dadas de baja: el identificador sigue ocupado (el índice
    // único de `slug` no distingue entre activas y archivadas).
    const existing = await this.model.findOne({ slug }).exec();
    if (existing) throw new ConflictException(`El identificador «${dto.slug}» ya está en uso.`);

    if (dto.domain) {
      const clash = await this.model.findOne({ domain: dto.domain.toLowerCase() }).exec();
      if (clash) throw new ConflictException(`El dominio «${dto.domain}» ya está en uso.`);
    }

    // Los datos del administrador no forman parte del documento de la empresa:
    // los consume `TenantProvisioningService` para crear su cuenta.
    const {
      adminEmail: _adminEmail,
      adminUsername: _adminUsername,
      adminFirstName: _adminFirstName,
      adminLastName: _adminLastName,
      ...tenantFields
    } = dto;

    const tenant = await this.model.create({
      ...tenantFields,
      slug,
      status: dto.status ?? TenantStatus.Trial,
      isSystem: slug === SYSTEM_TENANT_SLUG,
    });

    await this.provision(tenant);
    this.logger.log(`Empresa creada: ${tenant.slug}`);
    return tenant;
  }

  /** Crea el contexto y los roles arquetípicos de la empresa. */
  async provision(tenant: TenantDocument): Promise<void> {
    const systemContext = await this.contexts.getSystemContext();
    await this.contexts.ensureContext({
      level: ContextLevel.Tenant,
      instanceId: tenant._id,
      parentId: systemContext._id,
      tenantId: tenant._id,
      label: tenant.name,
    });
    await this.roles.provisionPresetRoles(tenant._id);
  }

  async update(id: string | Types.ObjectId, dto: UpdateTenantDto): Promise<TenantDocument> {
    const tenant = await this.findById(id);
    if (dto.slug && dto.slug !== tenant.slug) {
      const clash = await this.model.findOne({ slug: dto.slug.toLowerCase() }).exec();
      if (clash) throw new ConflictException(`El identificador «${dto.slug}» ya está en uso.`);
      tenant.slug = dto.slug.toLowerCase();
    }
    // Un dominio nuevo entra siempre sin verificar, lo ponga quien lo ponga: la
    // administración de plataforma es de fiar, pero el DNS del cliente no está
    // puesto todavía, y darlo por activo dejaría a la empresa con un dominio
    // que la pantalla anuncia y el navegador no encuentra. Se asigna a mano y
    // se saca del volcado de abajo, porque un `undefined` en `Object.assign`
    // no borra el campo: lo deja como estaba.
    if (dto.domain !== undefined) {
      const host = dto.domain ? dto.domain.trim().toLowerCase().replace(/\.$/, '') : null;
      if (host !== tenant.domain) {
        tenant.domain = host;
        tenant.domainStatus = host ? TenantDomainStatus.Pending : TenantDomainStatus.None;
        tenant.domainToken = host ? `maya-verificacion=${randomBytes(16).toString('hex')}` : null;
        tenant.domainVerifiedAt = null;
        tenant.domainCheckedAt = null;
        tenant.domainError = null;
      }
    }

    if (dto.branding) Object.assign(tenant.branding, dto.branding);
    if (dto.settings) {
      const { passwordPolicy, ...rest } = dto.settings;
      Object.assign(tenant.settings, rest);
      if (passwordPolicy) Object.assign(tenant.settings.passwordPolicy, passwordPolicy);
    }
    const {
      branding: _branding,
      settings: _settings,
      slug: _slug,
      domain: _domain,
      ...rest
    } = dto;
    Object.assign(tenant, rest);
    await tenant.save();

    await this.contexts.ensureContext({
      level: ContextLevel.Tenant,
      instanceId: tenant._id,
      tenantId: tenant._id,
      label: tenant.name,
    });
    return tenant;
  }

  async setStatus(id: string | Types.ObjectId, status: TenantStatus): Promise<TenantDocument> {
    const tenant = await this.findById(id);
    tenant.status = status;
    await tenant.save();
    return tenant;
  }

  async softDelete(id: string | Types.ObjectId): Promise<void> {
    const tenant = await this.findById(id);
    if (tenant.isSystem) throw new ConflictException('La empresa del sistema no puede eliminarse.');
    tenant.deletedAt = new Date();
    tenant.status = TenantStatus.Archived;
    await tenant.save();
  }

  /**
   * Borrado físico de una empresa recién creada. Es la compensación del alta
   * cuando esta falla a medias (`TenantProvisioningService`): deja la base
   * como estaba, sin identificadores ocupados ni roles huérfanos. La baja que
   * pide la interfaz es `softDelete`, que conserva el histórico.
   */
  async purge(id: string | Types.ObjectId): Promise<void> {
    const tenant = toObjectId(id);
    await this.userModel.deleteMany({ tenant }).exec();
    await this.roles.purgeTenantRoles(tenant);
    await this.contexts.deleteForInstance(ContextLevel.Tenant, tenant);
    await this.model.deleteOne({ _id: tenant }).exec();
  }

  /** Suma o resta espacio consumido en almacenamiento. */
  async adjustStorage(id: string | Types.ObjectId, deltaBytes: number): Promise<void> {
    await this.model
      .updateOne({ _id: toObjectId(id) }, { $inc: { 'limits.usedStorageBytes': deltaBytes } })
      .exec();
  }

  async isWithinUserLimit(id: string | Types.ObjectId, currentUsers: number): Promise<boolean> {
    const tenant = await this.findById(id);
    return currentUsers < tenant.limits.maxUsers;
  }
}

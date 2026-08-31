import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContextLevel, SYSTEM_TENANT_SLUG, TenantStatus } from '@maya/shared';
import { Tenant, TenantDocument } from './schemas/tenant.schema';
import { ContextsService } from '../contexts/contexts.service';
import { RolesService } from '../rbac/roles.service';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto';
import { notDeleted, searchRegex, toObjectId } from '../../common/utils';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectModel(Tenant.name) private readonly model: Model<TenantDocument>,
    private readonly contexts: ContextsService,
    private readonly roles: RolesService,
  ) {}

  async paginate(query: PaginationQueryDto): Promise<PaginatedResult<TenantDocument>> {
    const filter: Record<string, unknown> = { ...notDeleted };
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
    return PaginatedResult.of(items, total, query.page, query.limit);
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

  async findByDomain(domain: string): Promise<TenantDocument | null> {
    return this.model.findOne({ domain: domain.toLowerCase(), ...notDeleted }).exec();
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
    const existing = await this.model.findOne({ slug: dto.slug.toLowerCase() }).exec();
    if (existing) throw new ConflictException(`El identificador «${dto.slug}» ya está en uso.`);

    const tenant = await this.model.create({
      ...dto,
      slug: dto.slug.toLowerCase(),
      status: dto.status ?? TenantStatus.Trial,
      isSystem: dto.slug.toLowerCase() === SYSTEM_TENANT_SLUG,
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
    if (dto.branding) Object.assign(tenant.branding, dto.branding);
    if (dto.settings) {
      const { passwordPolicy, ...rest } = dto.settings;
      Object.assign(tenant.settings, rest);
      if (passwordPolicy) Object.assign(tenant.settings.passwordPolicy, passwordPolicy);
    }
    const { branding: _branding, settings: _settings, slug: _slug, ...rest } = dto;
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

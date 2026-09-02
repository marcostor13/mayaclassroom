import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import * as argon2 from 'argon2';
import { ContextLevel, UserStatus, fullName } from '@maya/shared';
import { User, UserDocument } from './schemas/user.schema';
import { PaginatedResult } from '../../common/dto';
import { notDeleted, searchRegex, toObjectId } from '../../common/utils';
import { ContextsService } from '../contexts/contexts.service';
import { RolesService } from '../rbac/roles.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  BulkUserActionDto,
  CreateUserDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateUserDto,
  UserQueryDto,
} from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly model: Model<UserDocument>,
    private readonly contexts: ContextsService,
    private readonly roles: RolesService,
    private readonly tenants: TenantsService,
  ) {}

  /* ------------------------------ Lectura -------------------------------- */

  async paginate(
    tenantId: string | Types.ObjectId,
    query: UserQueryDto,
  ): Promise<PaginatedResult<UserDocument>> {
    const filter: FilterQuery<UserDocument> = {
      tenant: toObjectId(tenantId),
      ...notDeleted,
    };
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { firstName: searchRegex(query.search) },
        { lastName: searchRegex(query.search) },
        { email: searchRegex(query.search) },
        { username: searchRegex(query.search) },
        { idNumber: searchRegex(query.search) },
      ];
    }

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort(query.sort ? query.sortObject : { lastName: 1, firstName: 1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return PaginatedResult.of(items, total, query.page, query.limit);
  }

  async findById(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.model.findById(toObjectId(id)).exec();
    if (!user || user.deletedAt) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }

  async findByIdInTenant(
    id: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
  ): Promise<UserDocument> {
    const user = await this.model
      .findOne({ _id: toObjectId(id), tenant: toObjectId(tenantId), ...notDeleted })
      .exec();
    if (!user) throw new NotFoundException('Usuario no encontrado en esta empresa.');
    return user;
  }

  async findByEmail(
    email: string,
    tenantId: string | Types.ObjectId,
    withSecrets = false,
  ): Promise<UserDocument | null> {
    const query = this.model.findOne({
      email: email.toLowerCase().trim(),
      tenant: toObjectId(tenantId),
      ...notDeleted,
    });
    if (withSecrets) {
      query.select('+passwordHash +twoFactorSecret +twoFactorRecoveryCodes');
    }
    return query.exec();
  }

  async findByLogin(
    login: string,
    tenantId: string | Types.ObjectId,
    withSecrets = false,
  ): Promise<UserDocument | null> {
    const value = login.toLowerCase().trim();
    const query = this.model.findOne({
      tenant: toObjectId(tenantId),
      $or: [{ email: value }, { username: value }],
      ...notDeleted,
    });
    if (withSecrets) query.select('+passwordHash +twoFactorSecret +twoFactorRecoveryCodes');
    return query.exec();
  }

  /** Consulta cruda incluyendo los campos sensibles (uso interno de Auth). */
  async findOneWithSecrets(filter: FilterQuery<UserDocument>): Promise<UserDocument | null> {
    return this.model
      .findOne(filter)
      .select(
        '+passwordHash +passwordResetToken +passwordResetExpires +emailVerificationToken +emailVerificationExpires +twoFactorSecret +twoFactorRecoveryCodes',
      )
      .exec();
  }

  async findManyByIds(ids: (string | Types.ObjectId)[]): Promise<UserDocument[]> {
    return this.model.find({ _id: { $in: ids.map(toObjectId) }, ...notDeleted }).exec();
  }

  async countInTenant(tenantId: string | Types.ObjectId): Promise<number> {
    return this.model.countDocuments({ tenant: toObjectId(tenantId), ...notDeleted }).exec();
  }

  /* ------------------------------ Escritura ------------------------------ */

  async create(tenantId: string | Types.ObjectId, dto: CreateUserDto): Promise<UserDocument> {
    const tenant = toObjectId(tenantId);
    const email = dto.email.toLowerCase().trim();
    const username = dto.username.toLowerCase().trim();

    const clash = await this.model
      .findOne({ tenant, $or: [{ email }, { username }] })
      .exec();
    if (clash) {
      throw new ConflictException(
        clash.email === email
          ? 'Ya existe un usuario con ese correo electrónico.'
          : 'Ya existe un usuario con ese nombre de usuario.',
      );
    }

    const currentUsers = await this.countInTenant(tenant);
    if (!(await this.tenants.isWithinUserLimit(tenant, currentUsers))) {
      throw new BadRequestException('Se ha alcanzado el límite de usuarios del plan contratado.');
    }

    const { password, initialRole, ...rest } = dto;
    const user = await this.model.create({
      ...rest,
      email,
      username,
      tenant,
      passwordHash: password ? await this.hashPassword(password) : null,
      passwordChangedAt: password ? new Date() : null,
      status: dto.status ?? (password ? UserStatus.Active : UserStatus.Pending),
    });

    await this.provisionUserContext(user);
    await this.roles.assignByShortName({
      userId: user._id,
      shortName: initialRole ?? 'student',
      contextId: (await this.contexts.requireByInstance(ContextLevel.Tenant, tenant))._id,
      tenantId: tenant,
      component: 'manual',
    });

    this.logger.log(`Usuario creado: ${user.email}`);
    return user;
  }

  /** Contexto de usuario, necesario para permisos a nivel de perfil. */
  async provisionUserContext(user: UserDocument): Promise<void> {
    const tenantContext = await this.contexts.requireByInstance(ContextLevel.Tenant, user.tenant);
    await this.contexts.ensureContext({
      level: ContextLevel.User,
      instanceId: user._id,
      parentId: tenantContext._id,
      tenantId: user.tenant,
      label: fullName(user.firstName, user.lastName),
    });
  }

  async update(id: string | Types.ObjectId, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.findById(id);
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const clash = await this.model
        .findOne({ tenant: user.tenant, email: dto.email.toLowerCase() })
        .exec();
      if (clash) throw new ConflictException('Ya existe un usuario con ese correo electrónico.');
      user.email = dto.email.toLowerCase();
      user.emailVerified = false;
    }
    if (dto.username && dto.username.toLowerCase() !== user.username) {
      const clash = await this.model
        .findOne({ tenant: user.tenant, username: dto.username.toLowerCase() })
        .exec();
      if (clash) throw new ConflictException('Ya existe un usuario con ese nombre de usuario.');
      user.username = dto.username.toLowerCase();
    }
    const { email: _email, username: _username, ...rest } = dto;
    Object.assign(user, rest);
    await user.save();
    return user;
  }

  async updateProfile(id: string | Types.ObjectId, dto: UpdateProfileDto): Promise<UserDocument> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    await user.save();
    return user;
  }

  async updatePreferences(
    id: string | Types.ObjectId,
    dto: UpdatePreferencesDto,
  ): Promise<UserDocument> {
    const user = await this.findById(id);
    Object.assign(user.preferences, dto);
    user.markModified('preferences');
    await user.save();
    return user;
  }

  async setAvatar(id: string | Types.ObjectId, url: string | null): Promise<UserDocument> {
    const user = await this.findById(id);
    user.avatarUrl = url;
    await user.save();
    return user;
  }

  async setStatus(id: string | Types.ObjectId, status: UserStatus): Promise<UserDocument> {
    const user = await this.findById(id);
    user.status = status;
    await user.save();
    return user;
  }

  async softDelete(id: string | Types.ObjectId): Promise<void> {
    const user = await this.findById(id);
    user.deletedAt = new Date();
    user.status = UserStatus.Deleted;
    // Se anonimiza el correo para liberar el índice único.
    user.email = `deleted+${user._id.toString()}@maya.invalid`;
    user.username = `deleted_${user._id.toString()}`;
    await user.save();
  }

  async bulkAction(
    tenantId: string | Types.ObjectId,
    dto: BulkUserActionDto,
  ): Promise<{ affected: number }> {
    const ids = dto.userIds.map(toObjectId);
    const filter = { _id: { $in: ids }, tenant: toObjectId(tenantId) };

    switch (dto.action) {
      case 'suspend':
        await this.model.updateMany(filter, { $set: { status: UserStatus.Suspended } }).exec();
        break;
      case 'activate':
        await this.model.updateMany(filter, { $set: { status: UserStatus.Active } }).exec();
        break;
      case 'delete':
        for (const id of ids) await this.softDelete(id);
        break;
      case 'resend-invitation':
        break;
      default:
        throw new BadRequestException('Acción no soportada.');
    }
    return { affected: ids.length };
  }

  /* -------------------------- Contraseñas y accesos ---------------------- */

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async setPassword(id: string | Types.ObjectId, password: string): Promise<void> {
    await this.writePassword(id, password, false);
  }

  /**
   * Igual que `setPassword`, pero deja la cuenta obligada a cambiarla al
   * entrar. Es la que corresponde a las contraseñas que emite la plataforma
   * —altas y reposiciones—, frente a las que elige la propia persona.
   */
  async setTemporaryPassword(id: string | Types.ObjectId, password: string): Promise<void> {
    await this.writePassword(id, password, true);
  }

  private async writePassword(
    id: string | Types.ObjectId,
    password: string,
    mustChange: boolean,
  ): Promise<void> {
    const hash = await this.hashPassword(password);
    await this.model
      .updateOne(
        { _id: toObjectId(id) },
        {
          $set: {
            passwordHash: hash,
            passwordChangedAt: new Date(),
            mustChangePassword: mustChange,
            // La reposición desbloquea: si la cuenta quedó cerrada por intentos
            // fallidos, la contraseña nueva no serviría de nada.
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        },
      )
      .exec();
  }

  async touchLogin(id: string | Types.ObjectId, ip: string): Promise<void> {
    await this.model
      .updateOne(
        { _id: toObjectId(id) },
        {
          $set: {
            lastLoginAt: new Date(),
            lastAccessAt: new Date(),
            lastLoginIp: ip,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        },
      )
      .exec();
  }

  async touchAccess(id: string | Types.ObjectId): Promise<void> {
    await this.model
      .updateOne({ _id: toObjectId(id) }, { $set: { lastAccessAt: new Date() } })
      .exec();
  }

  async registerFailedLogin(
    user: UserDocument,
    maxAttempts: number,
    lockMinutes: number,
  ): Promise<void> {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= maxAttempts) {
      user.lockedUntil = new Date(Date.now() + lockMinutes * 60_000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
  }

  /* --------------------------- Favoritos y varios ------------------------ */

  async toggleFavouriteCourse(
    userId: string | Types.ObjectId,
    courseId: string | Types.ObjectId,
  ): Promise<boolean> {
    const user = await this.findById(userId);
    const id = toObjectId(courseId);
    const index = user.favouriteCourses.findIndex((c) => String(c) === String(id));
    if (index >= 0) {
      user.favouriteCourses.splice(index, 1);
      await user.save();
      return false;
    }
    user.favouriteCourses.push(id);
    await user.save();
    return true;
  }

  async acceptPolicy(userId: string | Types.ObjectId): Promise<void> {
    await this.model
      .updateOne({ _id: toObjectId(userId) }, { $set: { policyAcceptedAt: new Date() } })
      .exec();
  }

  /** Proyección ligera para listados y menciones. */
  toBrief(user: UserDocument) {
    return {
      id: user.id,
      fullName: fullName(user.firstName, user.lastName),
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  }
}

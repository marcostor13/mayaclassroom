import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { authenticator } from 'otplib';
import {
  AuthProvider,
  AuthTokens,
  AuthenticatedUser,
  ContextLevel,
  DemoRole,
  LoginResponse,
  SessionRoleAssignment,
  TenantStatus,
  UserStatus,
  fullName,
} from '@maya/shared';
import type { DemoAccessDto } from '@maya/shared';
import { JwtConfig, SecurityConfig, AppConfig } from '../../config';
import type { DemoConfig } from '../../config';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RolesService } from '../rbac/roles.service';
import { AccessService } from '../rbac/access.service';
import { ContextsService } from '../contexts/contexts.service';
import { MailService } from '../mail/mail.service';
import { UserDocument } from '../users/schemas/user.schema';
import type { TenantDocument } from '../tenants/schemas/tenant.schema';
import { toObjectId } from '../../common/utils';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

interface ClientInfo {
  ip: string;
  userAgent: string;
}

/** Una cuenta y la empresa en la que vive, mientras se resuelve la entrada. */
interface LoginCandidate {
  user: UserDocument;
  tenant: TenantDocument;
}

/** Tipo del testigo que autoriza el segundo paso de la elección de empresa. */
const TENANT_CHOICE = 'tenant-choice';

/**
 * Qué rol de la empresa representa a cada papel de la demostración.
 *
 * `editingteacher` y no `teacher`: el papel enseña el taller —crear cursos,
 * subir contenido, calificar—, y el rol `teacher` a secas no puede editar, así
 * que la visita se quedaría mirando una pantalla sin botones.
 */
const ROL_DE_DEMOSTRACION: Record<DemoRole, string> = {
  [DemoRole.Admin]: 'manager',
  [DemoRole.Teacher]: 'editingteacher',
  [DemoRole.Student]: 'student',
};

/** Una empresa suspendida o archivada no deja entrar a nadie. */
function isTenantOpen(status: TenantStatus): boolean {
  return status !== TenantStatus.Suspended && status !== TenantStatus.Archived;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(RefreshToken.name)
    private readonly refreshModel: Model<RefreshTokenDocument>,
    private readonly users: UsersService,
    private readonly tenants: TenantsService,
    private readonly roles: RolesService,
    private readonly access: AccessService,
    private readonly contexts: ContextsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private get jwtConfig(): JwtConfig {
    return this.config.getOrThrow<JwtConfig>('jwt');
  }

  private get security(): SecurityConfig {
    return this.config.getOrThrow<SecurityConfig>('security');
  }

  private get app(): AppConfig {
    return this.config.getOrThrow<AppConfig>('app');
  }

  /* -------------------------------- Login -------------------------------- */

  /**
   * Entrada a la plataforma.
   *
   * La empresa ya no se pide en el formulario: se deduce de las credenciales.
   * Se buscan las cuentas con ese correo o usuario en toda la plataforma y se
   * comprueba la contraseña contra cada una; las que casan son las empresas a
   * las que esa persona puede entrar. Con una sola se entra directo, y con
   * varias hay que elegir.
   *
   * El orden importa para no filtrar nada: la lista de empresas se construye
   * **después** de validar la contraseña, así que un tercero no puede
   * averiguar en qué empresas existe un correo ajeno.
   *
   * `tenantSlug` sigue aceptándose para quien entre por el dominio de una
   * empresa concreta; entonces solo se mira ahí.
   */
  async login(dto: LoginDto, client: ClientInfo): Promise<LoginResponse> {
    const candidates = await this.candidateAccounts(dto.login, dto.tenantSlug);
    if (candidates.length === 0) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const now = new Date();
    const unlocked = candidates.filter((c) => !(c.user.lockedUntil && c.user.lockedUntil > now));
    if (unlocked.length === 0) {
      throw new UnauthorizedException(
        'La cuenta está bloqueada temporalmente por intentos fallidos. Inténtelo más tarde.',
      );
    }

    const matches: LoginCandidate[] = [];
    for (const candidate of unlocked) {
      if (!candidate.user.passwordHash) continue;
      if (await this.users.verifyPassword(candidate.user.passwordHash, dto.password)) {
        matches.push(candidate);
      }
    }

    if (matches.length === 0) {
      // El fallo se anota en todas las cuentas con ese correo, no solo en una:
      // son la misma persona en distintas empresas y el bloqueo por intentos
      // no tendría sentido si bastara con ir probando empresa por empresa.
      for (const candidate of unlocked) {
        await this.users.registerFailedLogin(
          candidate.user,
          this.security.loginMaxAttempts,
          this.security.loginLockMinutes,
        );
      }
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    if (matches.length > 1) return this.buildTenantChoice(matches);

    return this.finishLogin(matches[0], dto.totp, client);
  }

  /**
   * Segundo paso cuando las credenciales valen en varias empresas: completa la
   * entrada en la elegida sin volver a pedir la contraseña.
   *
   * El testigo lleva dentro las cuentas que ya pasaron la comprobación, así
   * que elegir una empresa que no estuviera entre ellas no sirve de nada.
   */
  async chooseTenant(
    tenantChoiceToken: string,
    tenantId: string,
    totp: string | undefined,
    client: ClientInfo,
  ): Promise<LoginResponse> {
    let payload: { type?: string; users?: string[] };
    try {
      payload = await this.jwt.verifyAsync(tenantChoiceToken, {
        secret: this.jwtConfig.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('La elección de empresa ha caducado. Vuelva a entrar.');
    }
    if (payload.type !== TENANT_CHOICE || !payload.users?.length) {
      throw new UnauthorizedException('El testigo de elección no es válido.');
    }

    const user = await this.users.findOneWithSecrets({
      _id: { $in: payload.users.map((id) => toObjectId(id)) },
      tenant: toObjectId(tenantId),
      deletedAt: null,
    });
    if (!user) {
      throw new UnauthorizedException('La empresa elegida no está entre las disponibles.');
    }

    const tenant = await this.tenants.findById(user.tenant);
    return this.finishLogin({ user, tenant }, totp, client);
  }

  /**
   * Cuentas que podrían corresponder a esas credenciales, ya descartadas las
   * empresas cerradas. Todavía no se ha comprobado ninguna contraseña.
   */
  private async candidateAccounts(login: string, tenantSlug?: string): Promise<LoginCandidate[]> {
    if (tenantSlug) {
      const tenant = await this.tenants.requireBySlug(tenantSlug);
      if (!isTenantOpen(tenant.status)) {
        throw new ForbiddenException('El acceso a esta empresa está deshabilitado.');
      }
      const user = await this.users.findByLogin(login, tenant._id, true);
      return user ? [{ user, tenant }] : [];
    }

    const users = await this.users.findAllByLogin(login);
    const candidates: LoginCandidate[] = [];
    for (const user of users) {
      const tenant = await this.tenants.findById(user.tenant);
      if (isTenantOpen(tenant.status)) candidates.push({ user, tenant });
    }
    return candidates;
  }

  /**
   * Devuelve las empresas entre las que elegir. El perfil que acompaña es el
   * de la primera cuenta y no destapa nada: para llegar aquí ha habido que
   * acertar la contraseña de todas ellas.
   */
  private async buildTenantChoice(matches: LoginCandidate[]): Promise<LoginResponse> {
    return {
      user: await this.buildSessionUser(matches[0].user._id),
      tokens: { accessToken: '', refreshToken: '', expiresIn: 0, tokenType: 'Bearer' },
      requiresTenantChoice: true,
      tenants: matches.map(({ tenant }) => ({
        id: tenant.id as string,
        slug: tenant.slug,
        name: tenant.name,
        logoUrl: tenant.branding?.logoUrl ?? null,
      })),
      tenantChoiceToken: await this.jwt.signAsync(
        {
          sub: matches[0].user._id.toString(),
          type: TENANT_CHOICE,
          users: matches.map((m) => m.user._id.toString()),
        },
        { secret: this.jwtConfig.accessSecret, expiresIn: '5m' } as JwtSignOptions,
      ),
    };
  }

  /** Comprobaciones de estado, doble factor y emisión de la sesión. */
  private async finishLogin(
    { user, tenant }: LoginCandidate,
    totp: string | undefined,
    client: ClientInfo,
  ): Promise<LoginResponse> {
    if (user.status === UserStatus.Suspended) {
      throw new ForbiddenException('Su cuenta está suspendida. Contacte con el administrador.');
    }
    if (user.status === UserStatus.Pending && tenant.settings.requireEmailVerification) {
      throw new ForbiddenException('Debe verificar su correo electrónico antes de acceder.');
    }

    if (user.twoFactorEnabled) {
      if (!totp) {
        return {
          user: await this.buildSessionUser(user._id),
          tokens: { accessToken: '', refreshToken: '', expiresIn: 0, tokenType: 'Bearer' },
          requiresTwoFactor: true,
          twoFactorToken: await this.issueTwoFactorChallenge(user),
        };
      }
      if (!this.verifyTotp(user, totp)) {
        throw new UnauthorizedException('El código de verificación no es válido.');
      }
    }

    await this.users.touchLogin(user._id, client.ip);
    const sessionUser = await this.buildSessionUser(user._id);
    const tokens = await this.issueTokens(user, client, randomUUID());
    return { user: sessionUser, tokens };
  }

  /* -------------------------- Acceso de demostración ---------------------- */

  private get demo(): DemoConfig {
    return this.config.getOrThrow<DemoConfig>('demo');
  }

  /**
   * Qué papeles de la demostración tienen de verdad una cuenta detrás.
   *
   * Se comprueba en lugar de darlo por hecho porque la pantalla de acceso
   * ofrece un botón por papel, y un botón que lleva a un error es peor que no
   * tener botón: quien lo pulsa es justo quien todavía no conoce el producto.
   */
  async demoAccess(): Promise<DemoAccessDto> {
    const { enabled, tenantSlug } = this.demo;
    if (!enabled) return { enabled: false, tenantSlug, roles: [] };

    const roles: DemoRole[] = [];
    // El orden es el del selector: de lo que menos compromete a lo que más
    // enseña. Se recorre la lista entera aunque falle alguno, para que una
    // siembra sin profesorado siga ofreciendo los otros dos.
    for (const role of [DemoRole.Student, DemoRole.Teacher, DemoRole.Admin]) {
      if (await this.findDemoUser(role).catch(() => null)) roles.push(role);
    }
    return { enabled: roles.length > 0, tenantSlug, roles };
  }

  /**
   * Entra en la demostración sin credenciales.
   *
   * No hay contraseña que comprobar: el permiso lo concede la configuración
   * del despliegue, no quien llama. Por eso todo lo que decide quién entra
   * está aquí y no en la petición —el papel es lo único que llega de fuera, y
   * se traduce a una cuenta concreta de una empresa concreta—.
   */
  async demoLogin(role: DemoRole, client: ClientInfo): Promise<LoginResponse> {
    if (!this.demo.enabled) {
      throw new NotFoundException('El acceso de demostración no está disponible.');
    }
    // El papel llega en la dirección, así que se comprueba contra la lista en
    // vez de confiar en el tipo: cualquier otra cosa caería en el `else` y
    // entraría como estudiante sin haberlo pedido.
    if (!Object.values(DemoRole).includes(role)) {
      throw new NotFoundException('Ese papel no existe en la demostración.');
    }

    const user = await this.findDemoUser(role);
    await this.users.touchLogin(user._id, client.ip);

    return {
      user: await this.buildSessionUser(user._id),
      tokens: await this.issueTokens(user, client, randomUUID()),
    };
  }

  /**
   * La cuenta que representa a ese papel en la empresa de demostración.
   *
   * Se resuelve por rol y no por un correo fijo en la configuración: así la
   * siembra puede cambiar los nombres sin dejar la demostración rota.
   *
   * Se descartan las cuentas de administración de plataforma aunque tengan el
   * rol pedido: entrar como ellas daría a un visitante anónimo el control de
   * todas las empresas del despliegue, no solo de la de demostración.
   */
  private async findDemoUser(role: DemoRole): Promise<UserDocument> {
    const tenant = await this.tenants.requireBySlug(this.demo.tenantSlug);
    const context = await this.contexts.requireByInstance(ContextLevel.Tenant, tenant._id);
    const shortName = ROL_DE_DEMOSTRACION[role];

    const candidatos = await this.roles.assigneesByShortName(shortName, context._id, tenant._id);

    for (const id of candidatos) {
      const user = await this.users.findById(id).catch(() => null);
      if (!user) continue;
      if (user.isPlatformAdmin) continue;
      if (user.status !== UserStatus.Active) continue;
      // Una cuenta con contraseña temporal entra y rebota a la pantalla de
      // cambio de contraseña: no sirve para enseñar nada.
      if (user.mustChangePassword) continue;
      return user;
    }

    throw new NotFoundException(
      `La empresa de demostración no tiene ninguna cuenta con el rol «${shortName}».`,
    );
  }

  /* ------------------------------ Registro ------------------------------- */

  async register(dto: RegisterDto, client: ClientInfo): Promise<LoginResponse> {
    const tenant = await this.tenants.requireBySlug(dto.tenantSlug);
    if (!tenant.settings.allowSelfRegistration) {
      throw new ForbiddenException('El registro autónomo está deshabilitado en esta empresa.');
    }

    this.assertPasswordPolicy(dto.password, tenant.settings.passwordPolicy);

    const user = await this.users.create(tenant._id, {
      email: dto.email,
      username: dto.username,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      status: tenant.settings.requireEmailVerification ? UserStatus.Pending : UserStatus.Active,
      initialRole: 'student',
    });

    if (tenant.settings.requireEmailVerification) {
      await this.sendVerificationEmail(user);
    }

    const sessionUser = await this.buildSessionUser(user._id);
    const tokens = await this.issueTokens(user, client, randomUUID());
    return { user: sessionUser, tokens };
  }

  /* ------------------------------- Tokens -------------------------------- */

  async issueTokens(
    user: UserDocument,
    client: ClientInfo,
    familyId: string,
  ): Promise<AuthTokens> {
    const tenant = await this.tenants.findById(user.tenant);
    const payload = {
      sub: user._id.toString(),
      tenant: user.tenant.toString(),
      tenantSlug: tenant.slug,
      email: user.email,
      admin: user.isPlatformAdmin,
      type: 'access' as const,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig.accessExpiresIn,
      issuer: this.jwtConfig.issuer,
      audience: this.jwtConfig.audience,
    } as JwtSignOptions);

    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = this.refreshExpiry();

    await this.refreshModel.create({
      user: user._id,
      tenant: user.tenant,
      tokenHash: this.hashToken(refreshToken),
      familyId,
      expiresAt,
      userAgent: client.userAgent.slice(0, 400),
      ip: client.ip,
      device: this.detectDevice(client.userAgent),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpirySeconds(),
      tokenType: 'Bearer',
    };
  }

  /**
   * Rotación de refresh token con detección de reuso: si llega un token ya
   * rotado, se revoca toda la familia (posible robo de credenciales).
   */
  async refresh(refreshToken: string, client: ClientInfo): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshModel.findOne({ tokenHash }).exec();

    if (!stored) throw new UnauthorizedException('El token de refresco no es válido.');

    if (stored.revokedAt) {
      await this.refreshModel
        .updateMany(
          { familyId: stored.familyId, revokedAt: null },
          { $set: { revokedAt: new Date() } },
        )
        .exec();
      this.logger.warn(`Reuso de refresh token detectado (familia ${stored.familyId})`);
      throw new UnauthorizedException(
        'Se ha detectado un uso indebido de la sesión. Vuelva a iniciar sesión.',
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('La sesión ha caducado.');
    }

    const user = await this.users.findById(stored.user);
    if (user.status !== UserStatus.Active) {
      throw new UnauthorizedException('La cuenta no está activa.');
    }

    const tokens = await this.issueTokens(
      user,
      client,
      this.security.refreshTokenRotation ? stored.familyId : stored.familyId,
    );

    stored.revokedAt = new Date();
    stored.replacedByHash = this.hashToken(tokens.refreshToken);
    stored.lastUsedAt = new Date();
    await stored.save();

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshModel
      .updateOne({ tokenHash: this.hashToken(refreshToken) }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  async logoutAll(userId: string | Types.ObjectId): Promise<void> {
    await this.refreshModel
      .updateMany({ user: toObjectId(userId), revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  async sessions(userId: string | Types.ObjectId, currentToken?: string) {
    const sessions = await this.refreshModel
      .find({ user: toObjectId(userId), revokedAt: null })
      .sort({ lastUsedAt: -1 })
      .exec();
    const currentHash = currentToken ? this.hashToken(currentToken) : null;
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      device: s.device,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      current: currentHash === s.tokenHash,
    }));
  }

  async revokeSession(userId: string | Types.ObjectId, sessionId: string): Promise<void> {
    await this.refreshModel
      .updateOne(
        { _id: toObjectId(sessionId), user: toObjectId(userId) },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  /* --------------------------- Sesión de usuario ------------------------- */

  /** Construye el objeto de sesión con roles y capacidades precalculadas. */
  async buildSessionUser(userId: string | Types.ObjectId): Promise<AuthenticatedUser> {
    const user = await this.users.findById(userId);
    const tenant = await this.tenants.findById(user.tenant);
    const assignments = await this.access.allAssignments(user._id);

    const roles: SessionRoleAssignment[] = assignments
      .filter((a) => a.role && a.context)
      .map((a) => {
        const role = a.role as unknown as { _id: Types.ObjectId; shortName: string; name: string };
        const context = a.context as unknown as {
          _id: Types.ObjectId;
          level: ContextLevel;
          path: string;
          instanceId: Types.ObjectId | null;
        };
        return {
          roleId: role._id.toString(),
          roleShortName: role.shortName,
          roleName: role.name,
          contextId: context._id.toString(),
          contextLevel: context.level,
          contextPath: context.path,
          instanceId: context.instanceId ? context.instanceId.toString() : null,
        };
      });

    const tenantContext = await this.contexts.findByInstance(ContextLevel.Tenant, user.tenant);
    const capabilities = tenantContext
      ? await this.access.effectiveCapabilities(
          { userId: user._id, isPlatformAdmin: user.isPlatformAdmin },
          tenantContext,
        )
      : [];

    return {
      id: user.id,
      tenantId: user.tenant.toString(),
      tenantSlug: tenant.slug,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: fullName(user.firstName, user.lastName),
      avatarUrl: user.avatarUrl,
      status: user.status,
      provider: user.provider as AuthProvider,
      language: user.language,
      timezone: user.timezone,
      isPlatformAdmin: user.isPlatformAdmin,
      twoFactorEnabled: user.twoFactorEnabled,
      mustChangePassword: user.mustChangePassword,
      roles,
      capabilities,
    };
  }

  /* ------------------------- Contraseñas y correo ------------------------ */

  /**
   * Envía el enlace de recuperación, igual que el acceso, sin pedir la empresa:
   * quien no recuerda su contraseña tampoco tiene por qué recordar en qué
   * empresa está dada de alta.
   *
   * Si el correo existe en varias, sale un enlace por cada una. No hace falta
   * elegir aquí, como sí ocurre al entrar, porque cada enlace ya lleva dentro
   * la cuenta a la que pertenece: `resetPassword` deduce la empresa del propio
   * testigo.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    // Se reutiliza la búsqueda del acceso, que casa por correo o por usuario:
    // aquí el DTO ya obliga a que sea un correo.
    const accounts = dto.tenantSlug
      ? await this.singleAccountIn(dto.tenantSlug, dto.email)
      : await this.users.findAllByLogin(dto.email);

    // Respuesta uniforme pase lo que pase: no se revela si el correo existe ni
    // en cuántas empresas.
    for (const user of accounts) {
      const tenant = await this.tenants.findById(user.tenant);
      if (!isTenantOpen(tenant.status)) continue;
      await this.sendPasswordReset(user, tenant.slug);
    }
  }

  private async singleAccountIn(tenantSlug: string, email: string): Promise<UserDocument[]> {
    const tenant = await this.tenants.requireBySlug(tenantSlug);
    const user = await this.users.findByEmail(email, tenant._id);
    return user ? [user] : [];
  }

  private async sendPasswordReset(user: UserDocument, tenantSlug: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    user.passwordResetToken = this.hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const link = `${this.app.webUrl}/auth/reset-password?token=${token}&tenant=${tenantSlug}`;
    await this.mail.sendPasswordReset(user.email, fullName(user.firstName, user.lastName), link);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const hashed = this.hashToken(dto.token);
    const user = await this.usersWithSecret({ passwordResetToken: hashed });
    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('El enlace de recuperación no es válido o ha caducado.');
    }
    const tenant = await this.tenants.findById(user.tenant);
    this.assertPasswordPolicy(dto.password, tenant.settings.passwordPolicy);

    await this.users.setPassword(user._id, dto.password);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    if (user.status === UserStatus.Pending) user.status = UserStatus.Active;
    await user.save();
    await this.logoutAll(user._id);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersWithSecret({ _id: toObjectId(userId) });
    if (!user?.passwordHash) throw new NotFoundException('Usuario no encontrado.');

    const valid = await this.users.verifyPassword(user.passwordHash, dto.currentPassword);
    if (!valid) throw new BadRequestException('La contraseña actual no es correcta.');

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual.');
    }

    const tenant = await this.tenants.findById(user.tenant);
    this.assertPasswordPolicy(dto.newPassword, tenant.settings.passwordPolicy);
    await this.users.setPassword(user._id, dto.newPassword);
    // `setPassword` levanta la marca de contraseña temporal; al revocar las
    // sesiones, el siguiente acceso ya entra sin restricciones.
    await this.logoutAll(user._id);
  }

  async sendVerificationEmail(user: UserDocument): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    user.emailVerificationToken = this.hashToken(token);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const tenant = await this.tenants.findById(user.tenant);
    const link = `${this.app.webUrl}/auth/verify-email?token=${token}&tenant=${tenant.slug}`;
    await this.mail.sendEmailVerification(
      user.email,
      fullName(user.firstName, user.lastName),
      link,
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.usersWithSecret({ emailVerificationToken: this.hashToken(token) });
    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('El enlace de verificación no es válido o ha caducado.');
    }
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    if (user.status === UserStatus.Pending) user.status = UserStatus.Active;
    await user.save();
  }

  /* --------------------------------- 2FA --------------------------------- */

  async startTwoFactorSetup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.usersWithSecret({ _id: toObjectId(userId) });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const tenant = await this.tenants.findById(user.tenant);

    const secret = authenticator.generateSecret();
    user.twoFactorSecret = secret;
    await user.save();

    const otpauthUrl = authenticator.keyuri(user.email, `Maya Classroom (${tenant.name})`, secret);
    return { secret, otpauthUrl };
  }

  async confirmTwoFactor(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.usersWithSecret({ _id: toObjectId(userId) });
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('No hay una configuración de 2FA en curso.');
    }
    if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
      throw new BadRequestException('El código introducido no es válido.');
    }
    const recoveryCodes = Array.from({ length: 8 }, () =>
      randomBytes(5).toString('hex').toUpperCase(),
    );
    user.twoFactorEnabled = true;
    user.twoFactorRecoveryCodes = recoveryCodes.map((c) => this.hashToken(c));
    await user.save();
    return { recoveryCodes };
  }

  async disableTwoFactor(userId: string, password: string): Promise<void> {
    const user = await this.usersWithSecret({ _id: toObjectId(userId) });
    if (!user?.passwordHash) throw new NotFoundException('Usuario no encontrado.');
    if (!(await this.users.verifyPassword(user.passwordHash, password))) {
      throw new BadRequestException('La contraseña no es correcta.');
    }
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorRecoveryCodes = [];
    await user.save();
  }

  private verifyTotp(user: UserDocument, code: string): boolean {
    if (user.twoFactorSecret && authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
      return true;
    }
    const hashed = this.hashToken(code.toUpperCase());
    const index = user.twoFactorRecoveryCodes.indexOf(hashed);
    if (index >= 0) {
      user.twoFactorRecoveryCodes.splice(index, 1);
      void user.save();
      return true;
    }
    return false;
  }

  private async issueTwoFactorChallenge(user: UserDocument): Promise<string> {
    return this.jwt.signAsync(
      { sub: user._id.toString(), type: '2fa' },
      { secret: this.jwtConfig.accessSecret, expiresIn: '5m' } as JwtSignOptions,
    );
  }

  /* ------------------------------ Auxiliares ----------------------------- */

  private assertPasswordPolicy(
    password: string,
    policy: {
      minLength: number;
      requireUppercase: boolean;
      requireNumber: boolean;
      requireSymbol: boolean;
    },
  ): void {
    const errors: string[] = [];
    if (password.length < policy.minLength) {
      errors.push(`debe tener al menos ${policy.minLength} caracteres`);
    }
    if (policy.requireUppercase && !/[A-ZÁÉÍÓÚÑ]/.test(password)) {
      errors.push('debe incluir una letra mayúscula');
    }
    if (policy.requireNumber && !/[0-9]/.test(password)) errors.push('debe incluir un número');
    if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('debe incluir un símbolo');
    }
    if (errors.length) {
      throw new BadRequestException(`La contraseña ${errors.join(', ')}.`);
    }
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private accessExpirySeconds(): number {
    const value = this.jwtConfig.accessExpiresIn;
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 900;
    const amount = Number(match[1]);
    const unit = match[2];
    const factor = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return amount * factor;
  }

  private refreshExpiry(): Date {
    const value = this.jwtConfig.refreshExpiresIn;
    const match = /^(\d+)([smhd])$/.exec(value);
    const days = match && match[2] === 'd' ? Number(match[1]) : 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private detectDevice(userAgent: string): string | null {
    if (/mobile|android|iphone/i.test(userAgent)) return 'Móvil';
    if (/ipad|tablet/i.test(userAgent)) return 'Tableta';
    if (userAgent) return 'Escritorio';
    return null;
  }

  private async usersWithSecret(filter: Record<string, unknown>): Promise<UserDocument | null> {
    return this.users.findOneWithSecrets(filter);
  }
}

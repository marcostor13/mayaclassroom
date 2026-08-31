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
  LoginResponse,
  SessionRoleAssignment,
  TenantStatus,
  UserStatus,
  fullName,
} from '@maya/shared';
import { JwtConfig, SecurityConfig, AppConfig } from '../../config';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RolesService } from '../rbac/roles.service';
import { AccessService } from '../rbac/access.service';
import { ContextsService } from '../contexts/contexts.service';
import { MailService } from '../mail/mail.service';
import { UserDocument } from '../users/schemas/user.schema';
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

  async login(dto: LoginDto, client: ClientInfo): Promise<LoginResponse> {
    const tenant = await this.tenants.requireBySlug(dto.tenantSlug);
    if (tenant.status === TenantStatus.Suspended || tenant.status === TenantStatus.Archived) {
      throw new ForbiddenException('El acceso a esta empresa está deshabilitado.');
    }

    const user = await this.users.findByLogin(dto.login, tenant._id, true);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'La cuenta está bloqueada temporalmente por intentos fallidos. Inténtelo más tarde.',
      );
    }

    const valid = await this.users.verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      await this.users.registerFailedLogin(
        user,
        this.security.loginMaxAttempts,
        this.security.loginLockMinutes,
      );
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    if (user.status === UserStatus.Suspended) {
      throw new ForbiddenException('Su cuenta está suspendida. Contacte con el administrador.');
    }
    if (user.status === UserStatus.Pending && tenant.settings.requireEmailVerification) {
      throw new ForbiddenException('Debe verificar su correo electrónico antes de acceder.');
    }

    if (user.twoFactorEnabled) {
      if (!dto.totp) {
        return {
          user: await this.buildSessionUser(user._id),
          tokens: { accessToken: '', refreshToken: '', expiresIn: 0, tokenType: 'Bearer' },
          requiresTwoFactor: true,
          twoFactorToken: await this.issueTwoFactorChallenge(user),
        };
      }
      const ok = this.verifyTotp(user, dto.totp);
      if (!ok) throw new UnauthorizedException('El código de verificación no es válido.');
    }

    await this.users.touchLogin(user._id, client.ip);
    const sessionUser = await this.buildSessionUser(user._id);
    const tokens = await this.issueTokens(user, client, randomUUID());
    return { user: sessionUser, tokens };
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
      roles,
      capabilities,
    };
  }

  /* ------------------------- Contraseñas y correo ------------------------ */

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const tenant = await this.tenants.requireBySlug(dto.tenantSlug);
    const user = await this.users.findByEmail(dto.email, tenant._id);
    // Respuesta uniforme: no se revela si el correo existe.
    if (!user) return;

    const token = randomBytes(32).toString('base64url');
    user.passwordResetToken = this.hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const link = `${this.app.webUrl}/auth/reset-password?token=${token}&tenant=${tenant.slug}`;
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

    const tenant = await this.tenants.findById(user.tenant);
    this.assertPasswordPolicy(dto.newPassword, tenant.settings.passwordPolicy);
    await this.users.setPassword(user._id, dto.newPassword);
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

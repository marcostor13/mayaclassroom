import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { ContextLevel, TenantCreatedDto, UserStatus, fullName } from '@maya/shared';
import type { TenantAdminCredentials } from '@maya/shared';
import { TenantsService } from './tenants.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RolesService } from '../rbac/roles.service';
import { ContextsService } from '../contexts/contexts.service';
import type { TenantDocument } from './schemas/tenant.schema';
import type { PasswordPolicySchema } from './schemas/tenant.schema';
import type { CreateTenantDto } from './dto/tenant.dto';

/** Alfabetos sin caracteres ambiguos: la contraseña se dicta o se copia a mano. */
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%*?';

/** Longitud mínima de la temporal, por encima de cualquier política razonable. */
const MIN_TEMPORARY_LENGTH = 14;

/**
 * Alta completa de una empresa: la empresa en sí más la cuenta de
 * administración con la que su responsable entra por primera vez.
 *
 * Vive aparte de `TenantsService` porque necesita `UsersService`, y este a su
 * vez depende de `TenantsService` (límite de usuarios del plan): meter ambas
 * cosas en el mismo servicio crearía una dependencia circular. Aquí la
 * dirección es única —provisioning → tenants/users— y Nest la resuelve sin
 * `forwardRef`.
 */
@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(
    private readonly tenants: TenantsService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly roles: RolesService,
    private readonly contexts: ContextsService,
  ) {}

  /**
   * Emite una contraseña temporal nueva para quien administra la empresa.
   *
   * La del alta no se puede recuperar: se guarda con hash y solo viaja en la
   * respuesta de creación y en el correo de bienvenida. Cuando se pierde
   * —basta con recargar la pantalla— la única salida es emitir otra, así que
   * esto no es una comodidad sino el único camino de vuelta.
   *
   * Se elige la cuenta de administración más antigua, que es la que se creó
   * junto con la empresa.
   */
  async resetAdminPassword(tenantId: string): Promise<TenantAdminCredentials> {
    const tenant = await this.tenants.findById(tenantId);
    const context = await this.contexts.requireByInstance(ContextLevel.Tenant, tenant._id);
    const [adminId] = await this.roles.assigneesByShortName('manager', context._id, tenant._id);
    if (!adminId) {
      throw new NotFoundException(`«${tenant.name}» no tiene ninguna cuenta de administración.`);
    }

    const admin = await this.users.findByIdInTenant(adminId, tenant._id);
    const temporaryPassword = this.generatePassword(tenant.settings.passwordPolicy);
    await this.users.setTemporaryPassword(admin._id, temporaryPassword);

    const emailSent = await this.sendWelcome(tenant, admin.email, {
      name: fullName(admin.firstName, admin.lastName),
      username: admin.username,
      temporaryPassword,
    });

    this.logger.log(`Contraseña de administración renovada en «${tenant.slug}»: ${admin.email}`);

    return {
      userId: admin.id,
      email: admin.email,
      username: admin.username,
      temporaryPassword,
      emailSent,
    };
  }

  /**
   * Crea la empresa y su administrador. Si la cuenta de administración falla,
   * la empresa recién creada se retira: una empresa sin nadie que pueda entrar
   * no sirve de nada y su identificador quedaría ocupado para siempre.
   */
  async createTenantWithAdmin(dto: CreateTenantDto): Promise<TenantCreatedDto> {
    const tenant = await this.tenants.create(dto);

    try {
      const admin = await this.createAdmin(tenant, dto);
      return { tenant: tenant.toJSON() as unknown as TenantCreatedDto['tenant'], admin };
    } catch (error) {
      this.logger.error(
        `No se pudo crear la cuenta de administración de «${tenant.slug}»; se deshace el alta.`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.tenants.purge(tenant._id);
      throw error;
    }
  }

  private async createAdmin(
    tenant: TenantDocument,
    dto: CreateTenantDto,
  ): Promise<TenantAdminCredentials> {
    const email = (dto.adminEmail ?? tenant.contactEmail).toLowerCase().trim();
    const username = dto.adminUsername ?? this.usernameFrom(email);
    const firstName = dto.adminFirstName?.trim() || 'Administración';
    const lastName = dto.adminLastName?.trim() || tenant.name;
    const temporaryPassword = this.generatePassword(tenant.settings.passwordPolicy);

    const user = await this.users.create(tenant._id, {
      email,
      username,
      password: temporaryPassword,
      firstName,
      lastName,
      // Activo y con el correo dado por bueno: el alta la hace la plataforma,
      // no un registro autónomo, así que no procede verificarlo de nuevo. Sin
      // esto, `requireEmailVerification` le impediría entrar.
      status: UserStatus.Active,
      mustChangePassword: true,
      // «manager» es el arquetipo que administra una empresa completa.
      initialRole: 'manager',
      language: tenant.settings.defaultLanguage,
      timezone: tenant.settings.timezone,
    });

    user.emailVerified = true;
    await user.save();

    const emailSent = await this.sendWelcome(tenant, user.email, {
      name: fullName(firstName, lastName),
      username,
      temporaryPassword,
    });

    this.logger.log(`Administrador de «${tenant.slug}» creado: ${user.email}`);

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      temporaryPassword,
      emailSent,
    };
  }

  private async sendWelcome(
    tenant: TenantDocument,
    to: string,
    admin: { name: string; username: string; temporaryPassword: string },
  ): Promise<boolean> {
    try {
      await this.mail.sendTenantAdminWelcome({
        to,
        name: admin.name,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        username: admin.username,
        temporaryPassword: admin.temporaryPassword,
      });
      return true;
    } catch (error) {
      // El alta no se deshace por un fallo de correo: quien crea la empresa ve
      // la contraseña en pantalla y puede entregarla por otra vía.
      this.logger.warn(`No se pudo enviar el correo de bienvenida a ${to}: ${String(error)}`);
      return false;
    }
  }

  /** `ana.perez@acme.com` → `ana.perez`, saneado y sin colisionar con el vacío. */
  private usernameFrom(email: string): string {
    const base = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '.')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 60);
    return base.length >= 3 ? base : `admin.${randomInt(1000, 9999)}`;
  }

  /**
   * Contraseña temporal que cumple la política de la empresa por
   * construcción: un carácter de cada clase exigida y el resto aleatorio.
   */
  private generatePassword(policy: PasswordPolicySchema): string {
    const required: string[] = [this.pick(LOWER)];
    let alphabet = LOWER;

    if (policy.requireUppercase) {
      required.push(this.pick(UPPER));
      alphabet += UPPER;
    }
    if (policy.requireNumber) {
      required.push(this.pick(DIGITS));
      alphabet += DIGITS;
    }
    if (policy.requireSymbol) {
      required.push(this.pick(SYMBOLS));
      alphabet += SYMBOLS;
    }
    // Aunque la política no lo exija, una temporal siempre lleva mayúscula y
    // dígito: así sigue valiendo si la política se endurece después.
    if (!policy.requireUppercase) alphabet += UPPER;
    if (!policy.requireNumber) alphabet += DIGITS;

    const length = Math.max(policy.minLength ?? 8, MIN_TEMPORARY_LENGTH);
    const chars = [...required];
    while (chars.length < length) chars.push(this.pick(alphabet));

    // Barajado de Fisher-Yates: si no, las clases exigidas caerían siempre en
    // las primeras posiciones.
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  private pick(alphabet: string): string {
    return alphabet[randomInt(alphabet.length)];
  }
}

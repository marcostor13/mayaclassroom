import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel, LogAction, TenantStatus } from '@maya/shared';
import {
  Audit,
  CurrentUser,
  PlatformAdminOnly,
  Public,
  RequireCapability,
} from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { TenantsService } from './tenants.service';
import { TenantDomainsService } from './tenant-domains.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import {
  CreateTenantDto,
  SetTenantDomainDto,
  TenantQueryDto,
  UpdateTenantDto,
} from './dto/tenant.dto';

@ApiTags('Empresas')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly provisioning: TenantProvisioningService,
    private readonly domains: TenantDomainsService,
  ) {}

  @Public()
  @Get('public/:slug')
  @ApiOperation({ summary: 'Perfil público de una empresa (marca y políticas de acceso)' })
  publicProfile(@Param('slug') slug: string) {
    return this.tenants.publicProfile(slug);
  }

  @Get()
  @ApiBearerAuth()
  @PlatformAdminOnly()
  @ApiOperation({ summary: 'Listar empresas (administración de plataforma)' })
  list(@Query() query: TenantQueryDto) {
    return this.tenants.paginate(query);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Empresa del usuario autenticado' })
  me(@CurrentUser() user: RequestUser) {
    return this.tenants.findById(user.tenantId);
  }

  @Public()
  @Get('resolve')
  @ApiOperation({
    summary: 'Qué empresa sirve un anfitrión',
    description:
      'Lo consulta el cliente al arrancar para saber si está en el dominio de la ' +
      'plataforma o en el de una empresa. Devuelve `null` si el nombre no es de nadie.',
  })
  resolveHost(@Query('host') host: string) {
    return this.domains.resolveHost(host ?? '');
  }

  @Get(':id')
  @ApiBearerAuth()
  @PlatformAdminOnly()
  findOne(@Param('id') id: string) {
    return this.tenants.findById(id);
  }

  @Post()
  @ApiBearerAuth()
  @PlatformAdminOnly()
  @ApiOperation({
    summary: 'Crear una empresa junto con su cuenta de administración',
    description:
      'Devuelve la empresa y las credenciales del administrador. La contraseña temporal ' +
      'solo se entrega en esta respuesta y en el correo de bienvenida: al usarla, la ' +
      'plataforma obliga a sustituirla.',
  })
  create(@Body() dto: CreateTenantDto) {
    return this.provisioning.createTenantWithAdmin(dto);
  }

  @Post(':id/admin-password')
  @ApiBearerAuth()
  @PlatformAdminOnly()
  @Audit(LogAction.Updated, 'tenant')
  @ApiOperation({
    summary: 'Emitir una contraseña temporal nueva para la administración de la empresa',
    description:
      'La contraseña del alta no se puede recuperar: se guarda con hash y solo se entrega ' +
      'una vez. Esta ruta emite otra para la cuenta de administración más antigua, la vuelve ' +
      'a enviar por correo y obliga a cambiarla al entrar.',
  })
  resetAdminPassword(@Param('id') id: string) {
    return this.provisioning.resetAdminPassword(id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @RequireCapability(CAP.TENANT_UPDATE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Actualizar la empresa propia' })
  updateMine(@CurrentUser() user: RequestUser, @Body() dto: UpdateTenantDto) {
    // El identificador y el dominio se caen aquí a propósito. El primero es la
    // dirección de la empresa dentro de la plataforma; el segundo enruta
    // tráfico y necesita prueba de propiedad, que es lo que hacen las rutas de
    // más abajo. Aceptarlo en este parche dejaría a cualquier empresa reclamar
    // el nombre de otra sin comprobar nada.
    const { slug: _slug, domain: _domain, ...safe } = dto;
    return this.tenants.update(user.tenantId, safe);
  }

  /* ----------------------------- Dominio propio --------------------------- */

  @Get('me/domain')
  @ApiBearerAuth()
  @RequireCapability(CAP.TENANT_UPDATE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Estado del dominio propio y registros de DNS que hacen falta' })
  domain(@CurrentUser() user: RequestUser) {
    return this.domains.state(user.tenantId);
  }

  @Put('me/domain')
  @ApiBearerAuth()
  @RequireCapability(CAP.TENANT_UPDATE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Updated, 'tenant-domain')
  @ApiOperation({
    summary: 'Reservar un dominio propio',
    description:
      'Devuelve los registros de DNS que hay que crear. El dominio no sirve nada ' +
      'hasta que la comprobación lo activa.',
  })
  setDomain(@CurrentUser() user: RequestUser, @Body() dto: SetTenantDomainDto) {
    return this.domains.request(user.tenantId, dto.hostname);
  }

  @Post('me/domain/verify')
  @ApiBearerAuth()
  @RequireCapability(CAP.TENANT_UPDATE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Updated, 'tenant-domain')
  @ApiOperation({
    summary: 'Comprobar el DNS y activar el dominio',
    description:
      'Si algo falta, la respuesta lo cuenta en `lastError` en lugar de fallar: es ' +
      'el resultado de la comprobación, no un error de la petición.',
  })
  verifyDomain(@CurrentUser() user: RequestUser) {
    return this.domains.verify(user.tenantId);
  }

  @Delete('me/domain')
  @ApiBearerAuth()
  @RequireCapability(CAP.TENANT_UPDATE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Deleted, 'tenant-domain')
  @ApiOperation({ summary: 'Quitar el dominio propio y volver al de la plataforma' })
  removeDomain(@CurrentUser() user: RequestUser) {
    return this.domains.remove(user.tenantId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @PlatformAdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @PlatformAdminOnly()
  setStatus(@Param('id') id: string, @Body('status') status: TenantStatus) {
    return this.tenants.setStatus(id, status);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @PlatformAdminOnly()
  async remove(@Param('id') id: string) {
    await this.tenants.softDelete(id);
    return { deleted: true };
  }
}

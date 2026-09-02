import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
import { TenantProvisioningService } from './tenant-provisioning.service';
import { CreateTenantDto, TenantQueryDto, UpdateTenantDto } from './dto/tenant.dto';

@ApiTags('Empresas')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly provisioning: TenantProvisioningService,
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
    const { slug: _slug, ...safe } = dto;
    return this.tenants.update(user.tenantId, safe);
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

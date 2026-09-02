import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, CAPABILITY_CATALOG, ContextLevel, groupCapabilitiesByComponent } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { RolesService } from './roles.service';
import { AccessService } from './access.service';
import {
  AssignRoleDto,
  BulkAssignRoleDto,
  BulkSetCapabilitiesDto,
  CheckCapabilityDto,
  CreateRoleDto,
  SetCapabilityDto,
  UpdateRoleDto,
} from './dto/role.dto';

@ApiTags('Roles y permisos')
@ApiBearerAuth()
@Controller('rbac')
export class RbacController {
  constructor(
    private readonly roles: RolesService,
    private readonly access: AccessService,
  ) {}

  @Get('capabilities')
  @ApiOperation({ summary: 'Catálogo completo de capacidades' })
  catalog() {
    return {
      total: CAPABILITY_CATALOG.length,
      byComponent: groupCapabilitiesByComponent(),
      items: CAPABILITY_CATALOG,
    };
  }

  @Get('roles')
  @ApiOperation({ summary: 'Roles disponibles en la empresa' })
  listRoles(@CurrentUser() user: RequestUser) {
    return this.roles.list(user.tenantId, { isPlatformAdmin: user.isPlatformAdmin });
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Un rol de la empresa' })
  getRole(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.roles.findForTenant(id, user.tenantId, {
      isPlatformAdmin: user.isPlatformAdmin,
      forAssignment: true,
    });
  }

  @Post('roles')
  @RequireCapability(CAP.ROLE_MANAGE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Crear un rol personalizado' })
  createRole(@CurrentUser() user: RequestUser, @Body() dto: CreateRoleDto) {
    return this.roles.create(user.tenantId, dto);
  }

  @Patch('roles/:id')
  @RequireCapability(CAP.ROLE_MANAGE, { contextLevel: ContextLevel.Tenant })
  updateRole(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roles.update(id, dto, this.scope(user));
  }

  @Delete('roles/:id')
  @RequireCapability(CAP.ROLE_MANAGE, { contextLevel: ContextLevel.Tenant })
  async removeRole(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.roles.remove(id, this.scope(user));
    return { deleted: true };
  }

  @Get('roles/:id/capabilities')
  @ApiOperation({ summary: 'Matriz de capacidades de un rol' })
  roleCapabilities(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('contextId') contextId?: string,
  ) {
    return this.roles.capabilitiesOf(id, this.scope(user), contextId);
  }

  @Patch('roles/:id/capabilities')
  @RequireCapability([CAP.ROLE_MANAGE, CAP.ROLE_OVERRIDE], { contextLevel: ContextLevel.Tenant })
  async setRoleCapability(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SetCapabilityDto,
  ) {
    await this.roles.setCapability(id, dto, this.scope(user));
    return { updated: true };
  }

  @Post('roles/:id/capabilities/bulk')
  @RequireCapability([CAP.ROLE_MANAGE, CAP.ROLE_OVERRIDE], { contextLevel: ContextLevel.Tenant })
  async setRoleCapabilities(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: BulkSetCapabilitiesDto,
  ) {
    await this.roles.setCapabilities(id, dto.items, this.scope(user), dto.contextId);
    return { updated: dto.items.length };
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Asignaciones de rol en un contexto' })
  assignments(@CurrentUser() user: RequestUser, @Query('contextId') contextId: string) {
    return this.roles.assignmentsInContext(contextId, this.scope(user));
  }

  @Post('assignments')
  @RequireCapability(CAP.ROLE_ASSIGN, { contextLevel: ContextLevel.Tenant })
  assign(@CurrentUser() user: RequestUser, @Body() dto: AssignRoleDto) {
    return this.roles.assign(dto, this.scope(user));
  }

  @Post('assignments/bulk')
  @RequireCapability(CAP.ROLE_ASSIGN, { contextLevel: ContextLevel.Tenant })
  async assignMany(@CurrentUser() user: RequestUser, @Body() dto: BulkAssignRoleDto) {
    const count = await this.roles.assignMany(dto, this.scope(user));
    return { assigned: count };
  }

  @Delete('assignments')
  @RequireCapability(CAP.ROLE_ASSIGN, { contextLevel: ContextLevel.Tenant })
  async unassign(
    @CurrentUser() user: RequestUser,
    @Query('userId') userId: string,
    @Query('roleId') roleId: string,
    @Query('contextId') contextId: string,
  ) {
    await this.roles.unassign({ userId, roleId, contextId, scope: this.scope(user) });
    return { deleted: true };
  }

  @Post('check')
  @ApiOperation({ summary: 'Comprobar capacidades del usuario actual en un contexto' })
  async check(@CurrentUser() user: RequestUser, @Body() dto: CheckCapabilityDto) {
    const input = { userId: user.id, isPlatformAdmin: user.isPlatformAdmin };
    const granted = dto.requireAll
      ? await this.access.hasAll(input, dto.capabilities, dto.contextId)
      : await this.access.hasAny(input, dto.capabilities, dto.contextId);
    return { granted };
  }

  /**
   * La empresa de quien pregunta.
   *
   * Todas las rutas que tocan roles o asignaciones lo pasan al servicio: la
   * capacidad dice *qué* puede hacer, y esto *sobre qué* puede hacerlo.
   */
  private scope(user: RequestUser) {
    return { tenantId: user.tenantId, isPlatformAdmin: user.isPlatformAdmin };
  }

  @Get('my-capabilities')
  @ApiOperation({ summary: 'Capacidades efectivas del usuario en un contexto' })
  myCapabilities(@CurrentUser() user: RequestUser, @Query('contextId') contextId: string) {
    return this.access.effectiveCapabilities(
      { userId: user.id, isPlatformAdmin: user.isPlatformAdmin },
      contextId,
    );
  }
}

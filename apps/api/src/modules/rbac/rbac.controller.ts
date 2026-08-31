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
import { RequestUser } from '../../common/types/request-context';
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
    return this.roles.list(user.tenantId);
  }

  @Get('roles/:id')
  getRole(@Param('id') id: string) {
    return this.roles.findById(id);
  }

  @Post('roles')
  @RequireCapability(CAP.ROLE_MANAGE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Crear un rol personalizado' })
  createRole(@CurrentUser() user: RequestUser, @Body() dto: CreateRoleDto) {
    return this.roles.create(user.tenantId, dto);
  }

  @Patch('roles/:id')
  @RequireCapability(CAP.ROLE_MANAGE, { contextLevel: ContextLevel.Tenant })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Delete('roles/:id')
  @RequireCapability(CAP.ROLE_MANAGE, { contextLevel: ContextLevel.Tenant })
  async removeRole(@Param('id') id: string) {
    await this.roles.remove(id);
    return { deleted: true };
  }

  @Get('roles/:id/capabilities')
  @ApiOperation({ summary: 'Matriz de capacidades de un rol' })
  roleCapabilities(@Param('id') id: string, @Query('contextId') contextId?: string) {
    return this.roles.capabilitiesOf(id, contextId);
  }

  @Patch('roles/:id/capabilities')
  @RequireCapability([CAP.ROLE_MANAGE, CAP.ROLE_OVERRIDE], { contextLevel: ContextLevel.Tenant })
  async setRoleCapability(@Param('id') id: string, @Body() dto: SetCapabilityDto) {
    await this.roles.setCapability(id, dto);
    return { updated: true };
  }

  @Post('roles/:id/capabilities/bulk')
  @RequireCapability([CAP.ROLE_MANAGE, CAP.ROLE_OVERRIDE], { contextLevel: ContextLevel.Tenant })
  async setRoleCapabilities(@Param('id') id: string, @Body() dto: BulkSetCapabilitiesDto) {
    await this.roles.setCapabilities(id, dto.items, dto.contextId);
    return { updated: dto.items.length };
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Asignaciones de rol en un contexto' })
  assignments(@Query('contextId') contextId: string) {
    return this.roles.assignmentsInContext(contextId);
  }

  @Post('assignments')
  @RequireCapability(CAP.ROLE_ASSIGN, { contextLevel: ContextLevel.Tenant })
  assign(@Body() dto: AssignRoleDto) {
    return this.roles.assign(dto);
  }

  @Post('assignments/bulk')
  @RequireCapability(CAP.ROLE_ASSIGN, { contextLevel: ContextLevel.Tenant })
  async assignMany(@Body() dto: BulkAssignRoleDto) {
    const count = await this.roles.assignMany(dto);
    return { assigned: count };
  }

  @Delete('assignments')
  @RequireCapability(CAP.ROLE_ASSIGN, { contextLevel: ContextLevel.Tenant })
  async unassign(
    @Query('userId') userId: string,
    @Query('roleId') roleId: string,
    @Query('contextId') contextId: string,
  ) {
    await this.roles.unassign({ userId, roleId, contextId });
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

  @Get('my-capabilities')
  @ApiOperation({ summary: 'Capacidades efectivas del usuario en un contexto' })
  myCapabilities(@CurrentUser() user: RequestUser, @Query('contextId') contextId: string) {
    return this.access.effectiveCapabilities(
      { userId: user.id, isPlatformAdmin: user.isPlatformAdmin },
      contextId,
    );
  }
}

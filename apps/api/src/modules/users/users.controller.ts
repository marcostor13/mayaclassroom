import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel, LogAction, UserStatus } from '@maya/shared';
import { Audit, CurrentUser, RequireCapability } from '../../common/decorators';
import { RequestUser } from '../../common/types/request-context';
import { UsersService } from './users.service';
import {
  BulkUserActionDto,
  CreateUserDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateUserDto,
  UserQueryDto,
} from './dto/user.dto';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequireCapability([CAP.TENANT_MANAGE_USERS, CAP.USER_VIEW_ALL_DETAILS], {
    contextLevel: ContextLevel.Tenant,
  })
  @ApiOperation({ summary: 'Listar usuarios de la empresa' })
  list(@CurrentUser() user: RequestUser, @Query() query: UserQueryDto) {
    return this.users.paginate(user.tenantId, query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  me(@CurrentUser() user: RequestUser) {
    return this.users.findById(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar el perfil propio' })
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('me/preferences')
  updatePreferences(@CurrentUser() user: RequestUser, @Body() dto: UpdatePreferencesDto) {
    return this.users.updatePreferences(user.id, dto);
  }

  @Post('me/accept-policy')
  async acceptPolicy(@CurrentUser() user: RequestUser) {
    await this.users.acceptPolicy(user.id);
    return { accepted: true };
  }

  @Get(':id')
  @RequireCapability([CAP.USER_VIEW_DETAILS, CAP.USER_VIEW_ALL_DETAILS], {
    contextLevel: ContextLevel.Tenant,
  })
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.users.findByIdInTenant(id, user.tenantId);
  }

  @Post()
  @RequireCapability(CAP.USER_CREATE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Created, 'user')
  @ApiOperation({ summary: 'Crear un usuario en la empresa' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateUserDto) {
    return this.users.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequireCapability(CAP.USER_UPDATE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Updated, 'user')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    await this.users.findByIdInTenant(id, user.tenantId);
    return this.users.update(id, dto);
  }

  @Patch(':id/status')
  @RequireCapability(CAP.USER_UPDATE, { contextLevel: ContextLevel.Tenant })
  async setStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ) {
    await this.users.findByIdInTenant(id, user.tenantId);
    return this.users.setStatus(id, status);
  }

  @Post('bulk')
  @RequireCapability(CAP.USER_UPDATE, { contextLevel: ContextLevel.Tenant })
  bulk(@CurrentUser() user: RequestUser, @Body() dto: BulkUserActionDto) {
    return this.users.bulkAction(user.tenantId, dto);
  }

  @Delete(':id')
  @RequireCapability(CAP.USER_DELETE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Deleted, 'user')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.users.findByIdInTenant(id, user.tenantId);
    await this.users.softDelete(id);
    return { deleted: true };
  }
}

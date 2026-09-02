import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DemoRole } from '@maya/shared';
import { AllowPasswordChangePending, CurrentUser, Public } from '../../common/decorators';
import type { MayaRequest, RequestUser } from '../../common/types/request-context';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  TenantChoiceDto,
  ResetPasswordDto,
  DisableTwoFactorDto,
  TwoFactorSetupDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private client(req: MayaRequest) {
    return {
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '',
      userAgent: (req.headers['user-agent'] as string) ?? '',
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'La empresa se deduce de las credenciales. Si las mismas valen en varias, la respuesta ' +
      'llega con «requiresTenantChoice» y la lista para elegir, que se resuelve en ' +
      '«/auth/login/tenant».',
  })
  login(@Body() dto: LoginDto, @Req() req: MayaRequest) {
    return this.auth.login(dto, this.client(req));
  }

  @Public()
  @Get('demo')
  @ApiOperation({
    summary: 'Si el despliegue ofrece acceso de demostración',
    description:
      'Apagado salvo que el despliegue lo encienda. La pantalla de acceso lo consulta para ' +
      'decidir si enseña los botones de la demostración.',
  })
  demoAccess() {
    return this.auth.demoAccess();
  }

  @Public()
  // Sin credenciales de por medio: el límite evita que se use como una fuente
  // barata de sesiones válidas.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('demo/:role')
  @ApiOperation({
    summary: 'Entrar en la demostración con un papel concreto',
    description: 'Solo funciona en la empresa de demostración y con el acceso encendido.',
  })
  demoLogin(@Param('role') role: DemoRole, @Req() req: MayaRequest) {
    return this.auth.demoLogin(role, this.client(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login/tenant')
  @ApiOperation({ summary: 'Elegir empresa cuando las credenciales valen en varias' })
  chooseTenant(@Body() dto: TenantChoiceDto, @Req() req: MayaRequest) {
    return this.auth.chooseTenant(dto.tenantChoiceToken, dto.tenantId, dto.totp, this.client(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Registro autónomo (si la empresa lo permite)' })
  register(@Body() dto: RegisterDto, @Req() req: MayaRequest) {
    return this.auth.register(dto, this.client(req));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar el token de acceso' })
  refresh(@Body() dto: RefreshDto, @Req() req: MayaRequest) {
    return this.auth.refresh(dto.refreshToken, this.client(req));
  }

  @Public()
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return { loggedOut: true };
  }

  @ApiBearerAuth()
  @AllowPasswordChangePending()
  @Post('logout-all')
  @ApiOperation({ summary: 'Cerrar la sesión en todos los dispositivos' })
  async logoutAll(@CurrentUser() user: RequestUser) {
    await this.auth.logoutAll(user.id);
    return { loggedOut: true };
  }

  @ApiBearerAuth()
  @AllowPasswordChangePending()
  @Get('me')
  @ApiOperation({ summary: 'Sesión actual con roles y capacidades' })
  me(@CurrentUser() user: RequestUser) {
    return this.auth.buildSessionUser(user.id);
  }

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'Dispositivos con sesión abierta' })
  sessions(@CurrentUser() user: RequestUser) {
    return this.auth.sessions(user.id);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  async revokeSession(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.auth.revokeSession(user.id, id);
    return { revoked: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar el restablecimiento de contraseña' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto);
    return { sent: true };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto);
    return { reset: true };
  }

  @ApiBearerAuth()
  @AllowPasswordChangePending()
  @Post('change-password')
  async changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto);
    return { changed: true };
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { verified: true };
  }

  @ApiBearerAuth()
  @Post('2fa/setup')
  @ApiOperation({ summary: 'Iniciar la configuración del segundo factor' })
  setupTwoFactor(@CurrentUser() user: RequestUser) {
    return this.auth.startTwoFactorSetup(user.id);
  }

  @ApiBearerAuth()
  @Post('2fa/confirm')
  confirmTwoFactor(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorSetupDto) {
    return this.auth.confirmTwoFactor(user.id, dto.code);
  }

  @ApiBearerAuth()
  @Post('2fa/disable')
  async disableTwoFactor(@CurrentUser() user: RequestUser, @Body() dto: DisableTwoFactorDto) {
    await this.auth.disableTwoFactor(user.id, dto.password);
    return { disabled: true };
  }
}

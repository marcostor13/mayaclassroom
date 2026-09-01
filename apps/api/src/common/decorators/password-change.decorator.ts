import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_PENDING_KEY = 'maya:allowPasswordPending';

/**
 * Permite el acceso a un endpoint aunque el usuario arrastre una contraseña
 * temporal sin cambiar. Solo lo llevan las rutas imprescindibles para
 * completar ese cambio (sesión actual, cambio de contraseña y cierre de
 * sesión); el resto las bloquea `PasswordChangeGuard`.
 */
export const AllowPasswordChangePending = () => SetMetadata(ALLOW_PASSWORD_PENDING_KEY, true);

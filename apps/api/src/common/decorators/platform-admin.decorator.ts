import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ADMIN_KEY = 'maya:platformAdmin';

/** Restringe el endpoint a administradores de plataforma. */
export const PlatformAdminOnly = () => SetMetadata(PLATFORM_ADMIN_KEY, true);

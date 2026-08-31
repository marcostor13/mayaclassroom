import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'maya:isPublic';

/** Marca un endpoint como accesible sin autenticación. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

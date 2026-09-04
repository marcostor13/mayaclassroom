import { SetMetadata } from '@nestjs/common';

export const ALLOW_IN_DEMO_KEY = 'maya:allowInDemo';

/**
 * Permite escribir desde una sesión de demostración.
 *
 * `DemoGuard` deniega **toda** escritura de una sesión de demostración salvo
 * lo que lleve esta marca. El sentido de la regla es el orden en el que se
 * equivoca: un endpoint nuevo nace cerrado para la demostración, y quien lo
 * escribe decide si abrirlo. Al revés —una lista de lo prohibido— cada
 * endpoint que se añadiera quedaría abierto sin que nadie lo hubiera pensado,
 * y nadie se enteraría hasta que un visitante lo usara.
 *
 * Se puede poner en el controlador entero, cuando todo lo que hace es
 * contenido docente, o en un método suelto dentro de un controlador que
 * mezcle contenido y administración.
 */
export const AllowInDemo = () => SetMetadata(ALLOW_IN_DEMO_KEY, true);

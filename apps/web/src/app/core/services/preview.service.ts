import { Injectable, signal } from '@angular/core';

/**
 * Vista de alumno: ver el curso sin los controles de edición y sin lo que está
 * oculto, que es como lo verá quien lo curse.
 *
 * **No es entrar como otra persona.** Los datos siguen siendo los de quien
 * mira: sus calificaciones, su progreso y sus matrículas. Lo que cambia es lo
 * que se muestra, que es lo que se quiere comprobar al terminar de montar un
 * tema: si se entiende, si falta algo y si lo oculto está realmente oculto.
 *
 * Una impersonación de verdad exige emitir una sesión en nombre de otro
 * —`USER_LOGIN_AS` existe como capacidad pero no está implementada— y arrastra
 * decisiones de auditoría que no se resuelven de paso.
 *
 * El estado vive en memoria a propósito: al recargar se vuelve a la vista
 * normal, para no dejar a nadie atrapado sin botones de edición sin saber por qué.
 */
@Injectable({ providedIn: 'root' })
export class PreviewService {
  private readonly asStudent = signal(false);

  readonly studentView = this.asStudent.asReadonly();

  toggle(): void {
    this.asStudent.update((value) => !value);
  }

  exit(): void {
    this.asStudent.set(false);
  }
}

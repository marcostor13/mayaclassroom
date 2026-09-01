import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ConfirmRequest {
  title: string;
  message: string;
  /** Texto del botón que confirma. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta el botón en rojo: acción destructiva. */
  danger?: boolean;
  /**
   * Si se indica, hay que teclear exactamente este texto para poder confirmar.
   * Reservado a lo irreversible: dar de baja una empresa, borrar un curso.
   */
  requireText?: string;
}

interface PendingConfirm extends ConfirmRequest {
  answer: Subject<boolean>;
}

/**
 * Confirmación de acciones destructivas. El diálogo lo pinta
 * `maya-confirm-host`, montado una sola vez en el armazón.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  /** Emite `true` si se confirma y `false` si se cancela, y completa. */
  ask(request: ConfirmRequest): Observable<boolean> {
    // Una confirmación pendiente se cancela: nunca hay dos diálogos a la vez.
    this.resolve(false);
    const answer = new Subject<boolean>();
    this.pending.set({ ...request, answer });
    return answer.asObservable();
  }

  resolve(confirmed: boolean): void {
    const current = this.pending();
    if (!current) return;
    this.pending.set(null);
    current.answer.next(confirmed);
    current.answer.complete();
  }
}

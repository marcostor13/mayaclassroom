import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  timeout: number;
}

/** Avisos flotantes accesibles, anunciados mediante una región `aria-live`. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private readonly items = signal<Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  show(kind: ToastKind, title: string, message?: string, timeout = 5000): void {
    const toast: Toast = { id: ++this.counter, kind, title, message, timeout };
    this.items.update((list) => [...list, toast]);
    if (timeout > 0) {
      setTimeout(() => this.dismiss(toast.id), timeout);
    }
  }

  success(title: string, message?: string): void {
    this.show('success', title, message);
  }

  error(title: string, message?: string): void {
    this.show('danger', title, message, 8000);
  }

  warning(title: string, message?: string): void {
    this.show('warning', title, message);
  }

  info(title: string, message?: string): void {
    this.show('info', title, message);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((toast) => toast.id !== id));
  }
}

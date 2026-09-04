import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StudentReportDto } from '@maya/shared';
import { ApiService } from './api.service';

/** Expediente del alumno: consulta y descargas. */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(ApiService);

  student(userId: string): Observable<StudentReportDto> {
    return this.api.get<StudentReportDto>(`/reports/students/${userId}`);
  }

  mine(): Observable<StudentReportDto> {
    return this.api.get<StudentReportDto>('/reports/students/me');
  }

  /**
   * Las exportaciones se piden como binario y no por enlace directo.
   *
   * Un `<a href>` no lleva la cabecera de autorización, así que el servidor
   * respondería 401 y el navegador enseñaría su propia página de error. Pasando
   * por el cliente HTTP, el interceptor añade el testigo y aquí se convierte el
   * resultado en una descarga.
   */
  excel(userId: string): Observable<Blob> {
    return this.api.download(`/reports/students/${userId}/export.xlsx`);
  }

  printable(userId: string): Observable<Blob> {
    return this.api.download(`/reports/students/${userId}/print`);
  }
}

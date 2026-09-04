import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SignatureRecordDto, SignatureUse, UserSignatureDto } from '@maya/shared';
import { ApiService } from './api.service';

/** Firma electrónica: la de referencia del perfil y sus usos. */
@Injectable({ providedIn: 'root' })
export class SignaturesService {
  private readonly api = inject(ApiService);

  mine(): Observable<UserSignatureDto | null> {
    return this.api.get<UserSignatureDto | null>('/signatures/me');
  }

  save(payload: {
    imageDataUrl: string;
    width?: number;
    height?: number;
  }): Observable<UserSignatureDto> {
    return this.api.put<UserSignatureDto>('/signatures/me', payload);
  }

  remove(): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>('/signatures/me');
  }

  /** Estampa la firma sobre una asistencia o una visualización. */
  sign(payload: {
    use: SignatureUse;
    courseId?: string;
    referenceId?: string;
    referenceLabel?: string;
  }): Observable<SignatureRecordDto> {
    return this.api.post<SignatureRecordDto>('/signatures/records', payload);
  }

  myRecords(): Observable<SignatureRecordDto[]> {
    return this.api.get<SignatureRecordDto[]>('/signatures/records/me');
  }

  ofUser(userId: string): Observable<(UserSignatureDto & { valid: boolean }) | null> {
    return this.api.get<(UserSignatureDto & { valid: boolean }) | null>(
      `/signatures/users/${userId}`,
    );
  }

  courseRecords(courseId: string, referenceId?: string): Observable<SignatureRecordDto[]> {
    return this.api.get<SignatureRecordDto[]>(`/signatures/courses/${courseId}/records`, {
      referenceId,
    });
  }
}

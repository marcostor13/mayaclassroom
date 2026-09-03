import { Injectable } from '@nestjs/common';
import { LiveParticipantRole } from '@maya/shared';
import type { LiveParticipantDto } from '@maya/shared';

/**
 * Quién está dentro de cada sala, ahora mismo.
 *
 * Vive en memoria a propósito: es un estado que solo tiene sentido mientras la
 * conexión existe, y escribirlo en Mongo obligaría a limpiar filas fantasma
 * cada vez que un proceso se reinicia. Lo que sí se persiste es la asistencia
 * acumulada (`LiveAttendance`), que es el dato que se consulta después.
 *
 * Consecuencia a tener presente al escalar: con varias réplicas de la API haría
 * falta un adaptador de Socket.IO con Redis y mover esto al mismo sitio. Hasta
 * entonces, una sala tiene que caer siempre en el mismo proceso.
 */
@Injectable()
export class LivePresenceService {
  /** sesión → conexión → participante. */
  private readonly rooms = new Map<string, Map<string, LiveParticipantDto>>();

  /** conexión → sesión, para resolver la desconexión sin recorrer todo. */
  private readonly socketRoom = new Map<string, string>();

  add(sessionId: string, participant: LiveParticipantDto): void {
    const room = this.rooms.get(sessionId) ?? new Map<string, LiveParticipantDto>();
    room.set(participant.socketId, participant);
    this.rooms.set(sessionId, room);
    this.socketRoom.set(participant.socketId, sessionId);
  }

  remove(socketId: string): { sessionId: string; participant: LiveParticipantDto } | null {
    const sessionId = this.socketRoom.get(socketId);
    if (!sessionId) return null;
    this.socketRoom.delete(socketId);

    const room = this.rooms.get(sessionId);
    const participant = room?.get(socketId);
    room?.delete(socketId);
    if (room && room.size === 0) this.rooms.delete(sessionId);

    return participant ? { sessionId, participant } : null;
  }

  update(socketId: string, patch: Partial<LiveParticipantDto>): LiveParticipantDto | null {
    const sessionId = this.socketRoom.get(socketId);
    if (!sessionId) return null;
    const current = this.rooms.get(sessionId)?.get(socketId);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.rooms.get(sessionId)?.set(socketId, next);
    return next;
  }

  get(socketId: string): { sessionId: string; participant: LiveParticipantDto } | null {
    const sessionId = this.socketRoom.get(socketId);
    if (!sessionId) return null;
    const participant = this.rooms.get(sessionId)?.get(socketId);
    return participant ? { sessionId, participant } : null;
  }

  /** Participantes admitidos; los de la sala de espera no cuentan como público. */
  participants(sessionId: string): LiveParticipantDto[] {
    return Array.from(this.rooms.get(sessionId)?.values() ?? []).filter((p) => !p.waiting);
  }

  waiting(sessionId: string): LiveParticipantDto[] {
    return Array.from(this.rooms.get(sessionId)?.values() ?? []).filter((p) => p.waiting);
  }

  everyone(sessionId: string): LiveParticipantDto[] {
    return Array.from(this.rooms.get(sessionId)?.values() ?? []);
  }

  count(sessionId: string): number {
    return this.participants(sessionId).length;
  }

  /** Recuento para varias sesiones a la vez, para los listados. */
  counts(sessionIds: string[]): Record<string, number> {
    return sessionIds.reduce<Record<string, number>>((acc, id) => {
      acc[id] = this.count(id);
      return acc;
    }, {});
  }

  /** Conexiones de una persona concreta dentro de una sala. */
  socketsOfUser(sessionId: string, userId: string): string[] {
    return this.everyone(sessionId)
      .filter((p) => p.userId === userId)
      .map((p) => p.socketId);
  }

  /** ¿Hay alguien con mando en la sala? Decide si se puede entrar sin anfitrión. */
  hasHost(sessionId: string): boolean {
    return this.participants(sessionId).some(
      (p) => p.role === LiveParticipantRole.Host || p.role === LiveParticipantRole.CoHost,
    );
  }

  /** Sesiones con gente dentro. */
  activeSessionIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  clear(sessionId: string): void {
    for (const socketId of this.rooms.get(sessionId)?.keys() ?? []) {
      this.socketRoom.delete(socketId);
    }
    this.rooms.delete(sessionId);
  }
}

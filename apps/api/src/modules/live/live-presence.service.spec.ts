import { LiveParticipantRole } from '@maya/shared';
import type { LiveParticipantDto } from '@maya/shared';
import { LivePresenceService } from './live-presence.service';

const participante = (
  socketId: string,
  userId: string,
  overrides: Partial<LiveParticipantDto> = {},
): LiveParticipantDto => ({
  socketId,
  userId,
  fullName: `Usuario ${userId}`,
  avatarUrl: null,
  role: LiveParticipantRole.Attendee,
  audio: true,
  video: false,
  screen: false,
  hand: false,
  waiting: false,
  joinedAt: new Date().toISOString(),
  ...overrides,
});

describe('LivePresenceService · quién está en cada sala', () => {
  it('separa a quien espera de quien ya está dentro', () => {
    const presence = new LivePresenceService();
    presence.add('s1', participante('a', 'u1'));
    presence.add('s1', participante('b', 'u2', { waiting: true }));

    expect(presence.count('s1')).toBe(1);
    expect(presence.waiting('s1').map((p) => p.socketId)).toEqual(['b']);
    expect(presence.everyone('s1')).toHaveLength(2);
  });

  it('reconoce a quien modera para decidir si la sala está abierta', () => {
    const presence = new LivePresenceService();
    presence.add('s1', participante('a', 'u1'));
    expect(presence.hasHost('s1')).toBe(false);

    presence.add('s1', participante('b', 'u2', { role: LiveParticipantRole.Host }));
    expect(presence.hasHost('s1')).toBe(true);
  });

  it('quien modera desde la sala de espera todavía no abre la sala', () => {
    const presence = new LivePresenceService();
    presence.add('s1', participante('a', 'u1', { role: LiveParticipantRole.CoHost, waiting: true }));

    expect(presence.hasHost('s1')).toBe(false);
  });

  it('al irse devuelve de qué sala salió y olvida la conexión', () => {
    const presence = new LivePresenceService();
    presence.add('s1', participante('a', 'u1'));

    expect(presence.remove('a')?.sessionId).toBe('s1');
    expect(presence.get('a')).toBeNull();
    expect(presence.remove('a')).toBeNull();
    expect(presence.activeSessionIds()).toEqual([]);
  });

  it('agrupa las conexiones de una misma persona: dos pestañas, una persona', () => {
    const presence = new LivePresenceService();
    presence.add('s1', participante('a', 'u1'));
    presence.add('s1', participante('b', 'u1'));

    expect(presence.socketsOfUser('s1', 'u1')).toEqual(['a', 'b']);

    presence.remove('a');
    expect(presence.socketsOfUser('s1', 'u1')).toEqual(['b']);
  });

  it('actualiza el estado de medios sin perder el resto del participante', () => {
    const presence = new LivePresenceService();
    presence.add('s1', participante('a', 'u1', { fullName: 'Ada Lovelace' }));

    const actualizado = presence.update('a', { audio: false, hand: true });

    expect(actualizado?.fullName).toBe('Ada Lovelace');
    expect(actualizado?.audio).toBe(false);
    expect(actualizado?.hand).toBe(true);
  });

  it('vaciar la sala desengancha también sus conexiones', () => {
    const presence = new LivePresenceService();
    presence.add('s1', participante('a', 'u1'));
    presence.add('s1', participante('b', 'u2'));

    presence.clear('s1');

    expect(presence.count('s1')).toBe(0);
    expect(presence.get('a')).toBeNull();
    expect(presence.get('b')).toBeNull();
  });
});

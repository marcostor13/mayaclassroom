import {
  LiveParticipantRole,
  LiveRecordingStatus,
  LiveSessionMode,
  LiveSessionStatus,
  WhiteboardTool,
} from '../enums';

/* -------------------------------------------------------------------------- */
/*  Aulas en vivo — contratos compartidos                                      */
/*                                                                            */
/*  La videoconferencia es nativa: el navegador habla WebRTC directamente con  */
/*  los demás navegadores y la API solo hace de señalización, de registro y de */
/*  almacén de las grabaciones. Estos tipos son el idioma común entre ambos.   */
/* -------------------------------------------------------------------------- */

/** Referencia mínima a una persona dentro de la sala. */
export interface LiveUserRef {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

/** Ajustes de una sesión. Se guardan enteros para poder añadir sin migrar. */
export interface LiveSessionSettings {
  /** Sala de espera: nadie entra hasta que quien presenta lo admite. */
  lobby: boolean;
  /** Entrar con el micrófono cerrado. */
  muteOnJoin: boolean;
  allowChat: boolean;
  allowWhiteboard: boolean;
  allowAttendeeScreenShare: boolean;
  /** En modo clase, si el alumnado puede encender su cámara sin permiso. */
  allowAttendeeCamera: boolean;
  /** Empezar a grabar en cuanto se abre la sala. */
  autoRecord: boolean;
  /** Publicar las grabaciones al alumnado matriculado. */
  recordingVisibleToStudents: boolean;
  /** Minutos de antelación con los que se puede entrar sin quien presenta. */
  joinBeforeHostMinutes: number;
  /** Tope de asistentes simultáneos. */
  maxParticipants: number;
}

export const DEFAULT_LIVE_SETTINGS: LiveSessionSettings = {
  lobby: false,
  muteOnJoin: true,
  allowChat: true,
  allowWhiteboard: true,
  allowAttendeeScreenShare: false,
  allowAttendeeCamera: true,
  autoRecord: false,
  recordingVisibleToStudents: true,
  joinBeforeHostMinutes: 15,
  maxParticipants: 25,
};

export interface LiveSessionDto {
  id: string;
  title: string;
  description: string | null;
  /** Código corto y legible de la sala: es el enlace que se comparte. */
  roomCode: string;
  /** Dirección completa para entrar, lista para copiar y pegar. */
  joinUrl: string;
  status: LiveSessionStatus;
  mode: LiveSessionMode;
  courseId: string | null;
  courseName: string | null;
  groupId: string | null;
  host: LiveUserRef;
  coHosts: LiveUserRef[];
  calendarEventId: string | null;
  scheduledStart: string;
  scheduledEnd: string | null;
  startedAt: string | null;
  endedAt: string | null;
  settings: LiveSessionSettings;
  /**
   * `true`: entra cualquiera de la empresa con el enlace. `false`: solo el
   * alumnado matriculado en el curso al que pertenece la sesión.
   */
  openToTenant: boolean;
  /** Personas conectadas ahora mismo. */
  liveParticipants: number;
  recordingCount: number;
  /** Calculado para quien pregunta: si puede editar y moderar la sesión. */
  canManage: boolean;
  canRecord: boolean;
  createdAt: string;
}

/** Estado de una persona conectada, tal y como lo reparte la señalización. */
export interface LiveParticipantDto {
  /** Identificador de la conexión: una persona puede abrir dos pestañas. */
  socketId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: LiveParticipantRole;
  audio: boolean;
  video: boolean;
  /** Está compartiendo pantalla o pestaña. */
  screen: boolean;
  /** Ha pedido la palabra. */
  hand: boolean;
  /** Espera en la sala de espera a que le admitan. */
  waiting: boolean;
  joinedAt: string;
}

export interface LiveRecordingDto {
  id: string;
  sessionId: string;
  sessionTitle: string;
  title: string;
  status: LiveRecordingStatus;
  startedAt: string;
  durationSeconds: number;
  size: number;
  mimeType: string;
  /** Dirección de descarga; `null` mientras no esté lista. */
  url: string | null;
  recordedBy: LiveUserRef;
  visibleToStudents: boolean;
  canManage: boolean;
  createdAt: string;
}

export interface LiveChatMessageDto {
  id: string;
  sessionId: string;
  author: LiveUserRef | null;
  body: string;
  /** Avisos de la propia sala («X ha entrado»), sin autor. */
  system: boolean;
  createdAt: string;
}

/** Una fila del informe de asistencia de una sesión. */
export interface LiveAttendanceRowDto {
  user: LiveUserRef;
  role: LiveParticipantRole;
  firstJoinAt: string;
  lastLeaveAt: string | null;
  /** Tiempo total dentro de la sala, sumando todas las entradas. */
  totalSeconds: number;
  /** Veces que entró (reconexiones incluidas). */
  joins: number;
  /** Presente ahora mismo. */
  present: boolean;
}

/* ------------------------------- Pizarra -------------------------------- */

/**
 * Trazo o figura de la pizarra. Los puntos van en una lista plana de pares
 * `x, y` normalizados entre 0 y 1: así el dibujo se ve igual en cualquier
 * tamaño de pantalla y ocupa la mitad que una lista de objetos.
 */
export interface WhiteboardItem {
  id: string;
  tool: WhiteboardTool;
  color: string;
  /** Grosor del trazo en píxeles de la pizarra de referencia (1000 px). */
  width: number;
  points: number[];
  text?: string | null;
  fontSize?: number;
  /** Figuras rellenas en lugar de solo contorno. */
  filled?: boolean;
  authorId: string;
  createdAt: number;
}

export interface WhiteboardPageDto {
  id: string;
  name: string;
  items: WhiteboardItem[];
}

export interface WhiteboardStateDto {
  pages: WhiteboardPageDto[];
  activePageId: string;
}

/** Operación de pizarra que viaja por la señalización. */
export type WhiteboardOp =
  | { kind: 'add'; pageId: string; item: WhiteboardItem }
  | { kind: 'remove'; pageId: string; itemIds: string[] }
  | { kind: 'clear'; pageId: string }
  | { kind: 'page-add'; page: WhiteboardPageDto }
  | { kind: 'page-remove'; pageId: string }
  | { kind: 'page-select'; pageId: string };

/* --------------------------- Configuración ICE --------------------------- */

export interface IceServerDto {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface LiveIceConfigDto {
  iceServers: IceServerDto[];
  /** Segundos que valen las credenciales TURN temporales. */
  ttlSeconds: number;
  /**
   * Obliga a pasar por TURN. Útil en redes corporativas que bloquean el
   * tráfico directo, y para comprobar que el TURN está bien configurado.
   */
  forceRelay: boolean;
}

/* --------------------------- Señalización -------------------------------- */

/** Espacio de nombres de Socket.IO donde vive la señalización. */
export const LIVE_NAMESPACE = '/live';

/**
 * Nombres de los mensajes de señalización. Constantes compartidas porque una
 * errata en una cadena suelta se manifiesta como «la sala no hace nada», que
 * es de lo más caro de depurar.
 */
export const LIVE_EVENT = {
  /* Cliente → servidor */
  Join: 'room:join',
  Leave: 'room:leave',
  Offer: 'signal:offer',
  Answer: 'signal:answer',
  Ice: 'signal:ice',
  MediaState: 'media:state',
  ChatSend: 'chat:send',
  BoardOp: 'board:op',
  HostMute: 'host:mute',
  HostKick: 'host:kick',
  HostAdmit: 'host:admit',
  HostPromote: 'host:promote',
  HostLowerHand: 'host:lower-hand',
  RecordingState: 'recording:state',
  SessionEnd: 'session:end',

  /* Servidor → cliente */
  Joined: 'room:joined',
  PeerJoined: 'peer:joined',
  PeerLeft: 'peer:left',
  PeerState: 'peer:state',
  ChatMessage: 'chat:message',
  Waiting: 'room:waiting',
  Admitted: 'room:admitted',
  Kicked: 'room:kicked',
  Muted: 'host:muted',
  RoleChanged: 'peer:role',
  SessionEnded: 'session:ended',
  Error: 'live:error',
} as const;

export type LiveEventName = (typeof LIVE_EVENT)[keyof typeof LIVE_EVENT];

/** Respuesta al entrar: todo lo que la sala necesita para pintarse. */
export interface LiveJoinedPayload {
  self: LiveParticipantDto;
  participants: LiveParticipantDto[];
  session: LiveSessionDto;
  board: WhiteboardStateDto;
  chat: LiveChatMessageDto[];
  /** Alguien está grabando la sesión ahora mismo. */
  recording: boolean;
}

export interface LiveSignalPayload {
  /** Conexión de origen o destino, según la dirección del mensaje. */
  peer: string;
  description?: { type: 'offer' | 'answer'; sdp: string };
  candidate?: unknown;
}

/** Datos que el cliente envía al entrar. */
export interface LiveJoinPayload {
  /** Identificador de la sesión o su código de sala; vale cualquiera. */
  room: string;
  audio: boolean;
  video: boolean;
}

/** Cambio de estado de medios que se propaga a la sala. */
export interface LiveMediaStatePayload {
  audio?: boolean;
  video?: boolean;
  screen?: boolean;
  hand?: boolean;
}

export const LIVE_SESSION_STATUS_LABEL: Record<LiveSessionStatus, string> = {
  [LiveSessionStatus.Scheduled]: 'Programada',
  [LiveSessionStatus.Live]: 'En directo',
  [LiveSessionStatus.Ended]: 'Terminada',
  [LiveSessionStatus.Cancelled]: 'Cancelada',
};

export const LIVE_SESSION_MODE_LABEL: Record<LiveSessionMode, string> = {
  [LiveSessionMode.Meeting]: 'Reunión',
  [LiveSessionMode.Class]: 'Clase',
};

export const LIVE_PARTICIPANT_ROLE_LABEL: Record<LiveParticipantRole, string> = {
  [LiveParticipantRole.Host]: 'Anfitrión',
  [LiveParticipantRole.CoHost]: 'Co-anfitrión',
  [LiveParticipantRole.Attendee]: 'Asistente',
};

export const LIVE_RECORDING_STATUS_LABEL: Record<LiveRecordingStatus, string> = {
  [LiveRecordingStatus.Recording]: 'Grabando',
  [LiveRecordingStatus.Processing]: 'Procesando',
  [LiveRecordingStatus.Ready]: 'Disponible',
  [LiveRecordingStatus.Failed]: 'Fallida',
};

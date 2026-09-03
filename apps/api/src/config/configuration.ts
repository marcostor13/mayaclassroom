import { registerAs } from '@nestjs/config';

export interface AppConfig {
  env: string;
  port: number;
  host: string;
  name: string;
  url: string;
  webUrl: string;
  corsOrigins: string[];
  globalPrefix: string;
  logLevel: string;
}

export interface DatabaseConfig {
  uri: string;
  dbName: string;
  autoIndex: boolean;
  maxPoolSize: number;
  /** Servidores DNS explícitos para la resolución SRV de `mongodb+srv://`. */
  dnsServers: string[];
}

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
}

export interface MailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface StorageConfig {
  /**
   * `r2` es Cloudflare R2, que habla el protocolo de S3 pero necesita unos
   * ajustes propios (región «auto», ruta con el bucket delante y sin los
   * checksums que envía el SDK moderno). Se declara aparte de `s3` para no
   * obligar a recordarlos en cada despliegue.
   */
  driver: 'local' | 's3' | 'r2';
  localPath: string;
  publicBaseUrl: string;
  maxFileSize: number;
  s3: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
    forcePathStyle: boolean;
  };
}

/**
 * Acceso de demostración.
 *
 * Va tras un interruptor de configuración y apagado por defecto: mientras esté
 * encendido, cualquiera que llegue a la pantalla de acceso entra en la empresa
 * de demostración sin credenciales. Eso es exactamente lo que se quiere en el
 * despliegue que enseña la plataforma, y lo último que se quiere en el de un
 * cliente.
 */
export interface DemoConfig {
  enabled: boolean;
  /** Empresa que se enseña. Solo se entra a esta, nunca a otra. */
  tenantSlug: string;
}

/**
 * Aulas en vivo. La conferencia es WebRTC entre navegadores: el servidor solo
 * señaliza. Lo único que necesita configurarse es por dónde atraviesan los
 * cortafuegos (STUN/TURN) y cuánto puede durar una grabación.
 */
export interface LiveConfig {
  /** Servidores STUN, separados por comas. */
  stunUrls: string[];
  /** Servidores TURN. Sin ellos, las redes con NAT simétrico no conectan. */
  turnUrls: string[];
  /**
   * Secreto compartido con coturn (`static-auth-secret`). Cuando está, las
   * credenciales TURN se emiten firmadas y caducan solas, que es lo que
   * recomienda el propio coturn: un usuario y una contraseña fijos en el
   * cliente acaban en el portapapeles de cualquiera.
   */
  turnSecret: string;
  turnUsername: string;
  turnPassword: string;
  /** Validez de las credenciales TURN temporales, en segundos. */
  turnTtl: number;
  /** Obliga a que todo el tráfico pase por TURN (diagnóstico y redes cerradas). */
  forceRelay: boolean;
  /** Tope de asistentes por sala. La malla se degrada por encima de esto. */
  maxParticipants: number;
  /** Tamaño máximo de un trozo de grabación, en bytes. */
  recordingChunkSize: number;
  /**
   * Tamaño máximo de una grabación completa, en bytes. El ensamblado carga el
   * fichero en memoria una vez para entregárselo al almacenamiento, así que
   * subir este tope exige subir también la memoria del contenedor.
   */
  recordingMaxSize: number;
  /** Directorio donde se acumulan los trozos hasta ensamblar la grabación. */
  recordingStagingPath: string;
}

/**
 * Dominios propios de las empresas.
 *
 * Una empresa puede servir su página pública en su propio nombre
 * —`cursos.dulcelima.pe`— en lugar de en el de la plataforma. Esta
 * infraestructura no expone una IP pública: Cloudflare entrega el tráfico por
 * un túnel, y a un túnel solo puede apuntar un dominio de la propia cuenta de
 * Cloudflare. El dominio de un cliente no lo es, así que no puede apuntar al
 * túnel directamente.
 *
 * La salida es Cloudflare for SaaS: el cliente apunta su nombre por CNAME a
 * `target`, que sí es un dominio nuestro, y Cloudflare emite el certificado
 * del nombre del cliente y entrega el tráfico por el mismo túnel de siempre.
 * Sin infraestructura nueva y sin un despliegue por cada dominio.
 *
 * Con `target` vacío la función queda apagada: las pantallas lo dicen y los
 * endpoints responden que no está disponible, en vez de aceptar dominios que
 * nunca van a resolver.
 */
export interface DomainsConfig {
  /** Nombre al que apuntan por CNAME los dominios de las empresas. */
  target: string;
  /** Resolutor DNS-over-HTTPS con el que se comprueban los registros. */
  resolver: string;
  /** Nombres que ninguna empresa puede reclamar (los de la propia plataforma). */
  reserved: string[];
  /**
   * Zona de Cloudflare donde se dan de alta los nombres de cliente. Vacía, la
   * comprobación de DNS funciona igual pero nadie emite el certificado: sirve
   * para desarrollo y para despliegues que lo gestionen por su cuenta.
   */
  cloudflareZoneId: string;
  cloudflareToken: string;
}

export interface SecurityConfig {
  bcryptRounds: number;
  throttleTtl: number;
  throttleLimit: number;
  loginMaxAttempts: number;
  loginLockMinutes: number;
  refreshTokenRotation: boolean;
}

const toBool = (value: string | undefined, fallback = false): boolean =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

const toInt = (value: string | undefined, fallback: number): number => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const toList = (value: string | undefined, fallback: string[]): string[] =>
  value ? value.split(',').map((v) => v.trim()).filter(Boolean) : fallback;

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    env: process.env.NODE_ENV ?? 'development',
    port: toInt(process.env.PORT, 3000),
    host: process.env.HOST ?? '0.0.0.0',
    name: process.env.APP_NAME ?? 'Maya Classroom',
    url: process.env.API_URL ?? 'http://localhost:3000',
    webUrl: process.env.WEB_URL ?? 'http://localhost:4205',
    // Debe coincidir con el puerto del cliente en desarrollo (`apps/web`), o
    // el navegador bloquea cada petición por CORS antes de que llegue nada.
    corsOrigins: toList(process.env.CORS_ORIGINS, ['http://localhost:4205']),
    globalPrefix: process.env.API_PREFIX ?? 'api',
    logLevel: process.env.LOG_LEVEL ?? 'log',
  }),
);

export const databaseConfig = registerAs(
  'database',
  (): DatabaseConfig => ({
    uri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/maya_classroom',
    dbName: process.env.MONGODB_DB ?? 'maya_classroom',
    autoIndex: toBool(process.env.MONGODB_AUTO_INDEX, true),
    maxPoolSize: toInt(process.env.MONGODB_POOL_SIZE, 20),
    dnsServers: toList(process.env.NODE_DNS_SERVERS, []),
  }),
);

export const jwtConfig = registerAs(
  'jwt',
  (): JwtConfig => ({
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'maya-classroom-dev-access-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'maya-classroom-dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES ?? '30d',
    issuer: process.env.JWT_ISSUER ?? 'maya-classroom',
    audience: process.env.JWT_AUDIENCE ?? 'maya-classroom-web',
  }),
);

export const mailConfig = registerAs(
  'mail',
  (): MailConfig => ({
    enabled: toBool(process.env.MAIL_ENABLED, false),
    host: process.env.MAIL_HOST ?? 'localhost',
    port: toInt(process.env.MAIL_PORT, 1025),
    secure: toBool(process.env.MAIL_SECURE, false),
    user: process.env.MAIL_USER ?? '',
    password: process.env.MAIL_PASSWORD ?? '',
    from: process.env.MAIL_FROM ?? 'Maya Classroom <no-reply@mayaclassroom.app>',
  }),
);

export const storageConfig = registerAs('storage', (): StorageConfig => {
  const driver = (process.env.STORAGE_DRIVER as StorageConfig['driver']) ?? 'local';
  const esR2 = driver === 'r2';

  // R2 admite las dos variables: las suyas propias, más claras de leer en el
  // panel de Cloudflare, y las de S3 para quien venga de allí.
  const bucket = process.env.R2_BUCKET ?? process.env.S3_BUCKET ?? '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID ?? '';
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY ?? '';

  // El extremo de R2 se deduce de la cuenta, que es el único dato que hay que
  // copiar del panel; se puede sobreescribir para un dominio propio.
  const r2Endpoint = process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined;

  return {
    driver,
    localPath: process.env.STORAGE_LOCAL_PATH ?? './storage',
    publicBaseUrl:
      process.env.R2_PUBLIC_URL ??
      process.env.STORAGE_PUBLIC_URL ??
      'http://localhost:3000/api/v1/files',
    maxFileSize: toInt(process.env.STORAGE_MAX_FILE_SIZE, 50 * 1024 * 1024),
    s3: {
      bucket,
      // R2 ignora la región, pero el SDK exige una: «auto» es la que
      // documenta Cloudflare.
      region: esR2 ? 'auto' : (process.env.S3_REGION ?? 'us-east-1'),
      accessKeyId,
      secretAccessKey,
      endpoint: process.env.R2_ENDPOINT ?? r2Endpoint ?? process.env.S3_ENDPOINT,
      // R2 sirve el bucket en la ruta, no como subdominio.
      forcePathStyle: esR2 || process.env.S3_FORCE_PATH_STYLE === 'true',
    },
  };
});

export const demoConfig = registerAs(
  'demo',
  (): DemoConfig => ({
    enabled: toBool(process.env.DEMO_ENABLED, false),
    tenantSlug: process.env.DEMO_TENANT_SLUG ?? 'demo',
  }),
);

export const liveConfig = registerAs(
  'live',
  (): LiveConfig => ({
    stunUrls: toList(process.env.LIVE_STUN_URLS, [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
    ]),
    turnUrls: toList(process.env.LIVE_TURN_URLS, []),
    turnSecret: process.env.LIVE_TURN_SECRET ?? '',
    turnUsername: process.env.LIVE_TURN_USERNAME ?? '',
    turnPassword: process.env.LIVE_TURN_PASSWORD ?? '',
    turnTtl: toInt(process.env.LIVE_TURN_TTL, 8 * 60 * 60),
    forceRelay: toBool(process.env.LIVE_FORCE_RELAY, false),
    maxParticipants: toInt(process.env.LIVE_MAX_PARTICIPANTS, 25),
    recordingChunkSize: toInt(process.env.LIVE_RECORDING_CHUNK_SIZE, 8 * 1024 * 1024),
    recordingMaxSize: toInt(process.env.LIVE_RECORDING_MAX_SIZE, 1024 * 1024 * 1024),
    recordingStagingPath: process.env.LIVE_RECORDING_STAGING_PATH ?? './storage/.live-chunks',
  }),
);

export const securityConfig = registerAs(
  'security',
  (): SecurityConfig => ({
    bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 12),
    throttleTtl: toInt(process.env.THROTTLE_TTL, 60_000),
    throttleLimit: toInt(process.env.THROTTLE_LIMIT, 300),
    loginMaxAttempts: toInt(process.env.LOGIN_MAX_ATTEMPTS, 8),
    loginLockMinutes: toInt(process.env.LOGIN_LOCK_MINUTES, 15),
    refreshTokenRotation: toBool(process.env.REFRESH_TOKEN_ROTATION, true),
  }),
);

export const domainsConfig = registerAs(
  'domains',
  (): DomainsConfig => ({
    target: process.env.CUSTOM_DOMAIN_TARGET ?? '',
    resolver: process.env.CUSTOM_DOMAIN_RESOLVER ?? 'https://cloudflare-dns.com/dns-query',
    // Los nombres de la propia plataforma se reservan siempre, se listen o no:
    // una empresa que reclamase el dominio del cliente se quedaría con el
    // tráfico de todas las demás.
    reserved: toList(process.env.CUSTOM_DOMAIN_RESERVED, []),
    cloudflareZoneId: process.env.CLOUDFLARE_SAAS_ZONE_ID ?? '',
    cloudflareToken: process.env.CLOUDFLARE_API_TOKEN ?? '',
  }),
);

export const configurations = [
  appConfig,
  databaseConfig,
  jwtConfig,
  mailConfig,
  storageConfig,
  securityConfig,
  demoConfig,
  liveConfig,
  domainsConfig,
];

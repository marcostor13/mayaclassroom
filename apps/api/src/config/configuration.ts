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
  driver: 'local' | 's3';
  localPath: string;
  publicBaseUrl: string;
  maxFileSize: number;
  s3: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  };
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
    webUrl: process.env.WEB_URL ?? 'http://localhost:4200',
    corsOrigins: toList(process.env.CORS_ORIGINS, ['http://localhost:4200']),
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

export const storageConfig = registerAs(
  'storage',
  (): StorageConfig => ({
    driver: (process.env.STORAGE_DRIVER as 'local' | 's3') ?? 'local',
    localPath: process.env.STORAGE_LOCAL_PATH ?? './storage',
    publicBaseUrl: process.env.STORAGE_PUBLIC_URL ?? 'http://localhost:3000/files',
    maxFileSize: toInt(process.env.STORAGE_MAX_FILE_SIZE, 50 * 1024 * 1024),
    s3: {
      bucket: process.env.S3_BUCKET ?? '',
      region: process.env.S3_REGION ?? 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      endpoint: process.env.S3_ENDPOINT,
    },
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

export const configurations = [
  appConfig,
  databaseConfig,
  jwtConfig,
  mailConfig,
  storageConfig,
  securityConfig,
];

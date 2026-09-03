import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuthProvider, DEFAULT_TIMEZONE, UserStatus } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ _id: false })
export class UserPreferences {
  @Prop({ default: 'system' }) theme!: 'light' | 'dark' | 'system';
  @Prop({ default: true }) emailDigest!: boolean;
  @Prop({ default: 'never' }) forumAutoSubscribe!: string;
  @Prop({ default: true }) showCourseImages!: boolean;
  @Prop({ default: 'cards' }) courseView!: 'cards' | 'list' | 'summary';
  @Prop({ type: Object, default: {} }) extra!: Record<string, unknown>;
}

/** Usuario de la plataforma. Siempre pertenece a una empresa (tenant). */
@Schema({ collection: 'users', timestamps: true })
export class User extends TenantScopedDocument {
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  username!: string;

  /** Hash Argon2id. Ausente en cuentas federadas. */
  @Prop({ type: String, default: null, select: false })
  passwordHash!: string | null;

  @Prop({ type: Date, default: null })
  passwordChangedAt!: Date | null;

  /**
   * Contraseña provisional pendiente de sustituir. Mientras sea cierto,
   * `PasswordChangeGuard` bloquea toda la API salvo el propio cambio de
   * contraseña, la sesión actual y el cierre de sesión.
   */
  @Prop({ default: false })
  mustChangePassword!: boolean;

  @Prop({ required: true, trim: true }) firstName!: string;
  @Prop({ required: true, trim: true }) lastName!: string;

  @Prop({ type: String, default: null }) idNumber!: string | null;
  @Prop({ type: String, default: null }) avatarUrl!: string | null;
  @Prop({ type: String, default: null }) description!: string | null;
  @Prop({ type: String, default: null }) phone!: string | null;
  @Prop({ type: String, default: null }) city!: string | null;
  @Prop({ type: String, default: null }) country!: string | null;
  @Prop({ default: DEFAULT_TIMEZONE }) timezone!: string;
  @Prop({ default: 'es' }) language!: string;
  @Prop({ type: String, default: null }) department!: string | null;
  @Prop({ type: String, default: null }) institution!: string | null;
  @Prop({ type: [String], default: [] }) interests!: string[];

  @Prop({ type: String, enum: Object.values(UserStatus), default: UserStatus.Pending, index: true })
  status!: UserStatus;

  @Prop({ type: String, enum: Object.values(AuthProvider), default: AuthProvider.Local })
  provider!: AuthProvider;

  @Prop({ type: String, default: null }) providerId!: string | null;

  @Prop({ default: false }) emailVerified!: boolean;
  @Prop({ type: String, default: null, select: false }) emailVerificationToken!: string | null;
  @Prop({ type: Date, default: null, select: false }) emailVerificationExpires!: Date | null;

  @Prop({ type: String, default: null, select: false }) passwordResetToken!: string | null;
  @Prop({ type: Date, default: null, select: false }) passwordResetExpires!: Date | null;

  @Prop({ default: false }) twoFactorEnabled!: boolean;
  @Prop({ type: String, default: null, select: false }) twoFactorSecret!: string | null;
  @Prop({ type: [String], default: [], select: false }) twoFactorRecoveryCodes!: string[];

  /** Administrador de plataforma: atraviesa el aislamiento entre empresas. */
  @Prop({ default: false, index: true })
  isPlatformAdmin!: boolean;

  @Prop({ default: 0 }) failedLoginAttempts!: number;
  @Prop({ type: Date, default: null }) lockedUntil!: Date | null;
  @Prop({ type: Date, default: null }) lastLoginAt!: Date | null;
  @Prop({ type: Date, default: null, index: true }) lastAccessAt!: Date | null;
  @Prop({ type: String, default: null }) lastLoginIp!: string | null;

  @Prop({ type: UserPreferences, default: () => ({}) })
  preferences!: UserPreferences;

  /** Valores de campos personalizados (`shortName` → valor). */
  @Prop({ type: Object, default: {} })
  customFields!: Record<string, unknown>;

  /** Cursos marcados como favoritos por el usuario. */
  @Prop({ type: [Types.ObjectId], ref: 'Course', default: [] })
  favouriteCourses!: Types.ObjectId[];

  /** Aceptación de las políticas del sitio (RGPD). */
  @Prop({ type: Date, default: null })
  policyAcceptedAt!: Date | null;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ tenant: 1, email: 1 }, { unique: true });
UserSchema.index({ tenant: 1, username: 1 }, { unique: true });
UserSchema.index({ tenant: 1, status: 1 });
UserSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

UserSchema.virtual('fullName').get(function (this: User) {
  return `${this.firstName} ${this.lastName}`.trim();
});

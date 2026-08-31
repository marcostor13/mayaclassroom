import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Types } from 'mongoose';
import { UserStatus } from '@maya/shared';
import { JwtConfig } from '../../../config';
import { RequestUser } from '../../../common/types/request-context';
import { AuthService } from '../auth.service';

export interface JwtPayload {
  sub: string;
  tenant: string;
  tenantSlug: string;
  email: string;
  admin: boolean;
  type: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    const jwt = config.getOrThrow<JwtConfig>('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.accessSecret,
      issuer: jwt.issuer,
      audience: jwt.audience,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('El token no es de acceso.');
    }
    const user = await this.auth.buildSessionUser(payload.sub);
    if (user.status !== UserStatus.Active) {
      throw new UnauthorizedException('La cuenta no está activa.');
    }
    return {
      ...user,
      _id: new Types.ObjectId(user.id),
      _tenantId: new Types.ObjectId(user.tenantId),
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes, createHmac } from 'node:crypto';
import { WebServiceTokenDto, WebhookDto } from '@maya/shared';
import {
  WebServiceToken,
  WebServiceTokenDocument,
  Webhook,
  WebhookDocument,
} from './schemas/platform.schema';
import { toObjectId } from '../../common/utils';

@Injectable()
export class WebServicesService {
  constructor(
    @InjectModel(WebServiceToken.name)
    private readonly tokenModel: Model<WebServiceTokenDocument>,
    @InjectModel(Webhook.name) private readonly webhookModel: Model<WebhookDocument>,
  ) {}

  /* -------------------------------- Tokens ------------------------------- */

  async tokens(tenantId: string | Types.ObjectId): Promise<WebServiceTokenDto[]> {
    const tokens = await this.tokenModel
      .find({ tenant: toObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .exec();
    return tokens.map((t) => this.tokenToDto(t));
  }

  /** Crea un token; el valor en claro solo se devuelve en esta llamada. */
  async createToken(
    tenantId: string | Types.ObjectId,
    ownerId: string | Types.ObjectId,
    dto: { name: string; scopes?: string[]; expiresAt?: string },
  ): Promise<WebServiceTokenDto & { token: string }> {
    const raw = `maya_${randomBytes(32).toString('base64url')}`;
    const token = await this.tokenModel.create({
      tenant: toObjectId(tenantId),
      owner: toObjectId(ownerId),
      name: dto.name,
      tokenHash: this.hash(raw),
      tokenPreview: `${raw.slice(0, 12)}…${raw.slice(-4)}`,
      scopes: dto.scopes ?? ['read'],
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return { ...this.tokenToDto(token), token: raw };
  }

  async revokeToken(id: string | Types.ObjectId): Promise<void> {
    await this.tokenModel.deleteOne({ _id: toObjectId(id) }).exec();
  }

  /** Valida un token de servicio web y devuelve sus ámbitos. */
  async validateToken(raw: string): Promise<WebServiceTokenDocument> {
    const token = await this.tokenModel.findOne({ tokenHash: this.hash(raw) }).exec();
    if (!token || !token.enabled) throw new UnauthorizedException('Token no válido.');
    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new UnauthorizedException('El token ha caducado.');
    }
    token.lastUsedAt = new Date();
    await token.save();
    return token;
  }

  /* ------------------------------- Webhooks ------------------------------ */

  async webhooks(tenantId: string | Types.ObjectId): Promise<WebhookDto[]> {
    const hooks = await this.webhookModel.find({ tenant: toObjectId(tenantId) }).exec();
    return hooks.map((h) => this.webhookToDto(h));
  }

  async createWebhook(
    tenantId: string | Types.ObjectId,
    dto: { name: string; url: string; events: string[]; secret?: string },
  ): Promise<WebhookDto> {
    const hook = await this.webhookModel.create({
      tenant: toObjectId(tenantId),
      name: dto.name,
      url: dto.url,
      events: dto.events,
      secret: dto.secret ?? randomBytes(16).toString('hex'),
    });
    return this.webhookToDto(hook);
  }

  async removeWebhook(id: string | Types.ObjectId): Promise<void> {
    await this.webhookModel.deleteOne({ _id: toObjectId(id) }).exec();
  }

  /** Entrega un evento a todos los webhooks suscritos. */
  async dispatch(
    tenantId: string | Types.ObjectId,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const hooks = await this.webhookModel
      .find({ tenant: toObjectId(tenantId), enabled: true, events: event })
      .exec();

    await Promise.all(
      hooks.map(async (hook) => {
        const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
        const signature = hook.secret
          ? createHmac('sha256', hook.secret).update(body).digest('hex')
          : undefined;
        try {
          const response = await fetch(hook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Maya-Event': event,
              ...(signature ? { 'X-Maya-Signature': signature } : {}),
            },
            body,
          });
          hook.lastStatus = response.status;
        } catch {
          hook.lastStatus = 0;
        }
        hook.lastDeliveredAt = new Date();
        await hook.save();
      }),
    );
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private tokenToDto(token: WebServiceTokenDocument): WebServiceTokenDto {
    return {
      id: token.id,
      name: token.name,
      tokenPreview: token.tokenPreview,
      scopes: token.scopes,
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      expiresAt: token.expiresAt?.toISOString() ?? null,
      createdAt: token.createdAt.toISOString(),
      enabled: token.enabled,
    };
  }

  private webhookToDto(hook: WebhookDocument): WebhookDto {
    return {
      id: hook.id,
      name: hook.name,
      url: hook.url,
      events: hook.events,
      enabled: hook.enabled,
      lastStatus: hook.lastStatus,
      lastDeliveredAt: hook.lastDeliveredAt?.toISOString() ?? null,
    };
  }
}

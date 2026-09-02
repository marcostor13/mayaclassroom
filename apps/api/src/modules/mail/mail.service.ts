import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import Handlebars from 'handlebars';
import { MAYA_BRAND } from '@maya/shared';
import { AppConfig, MailConfig } from '../../config';

interface MailPayload {
  to: string;
  subject: string;
  title: string;
  greeting?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}

/**
 * Envío de correo transaccional. Si `MAIL_ENABLED` es falso los mensajes se
 * registran en el log, lo que permite desarrollar sin servidor SMTP.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly template = Handlebars.compile(BASE_TEMPLATE);

  constructor(private readonly config: ConfigService) {}

  private get mail(): MailConfig {
    return this.config.getOrThrow<MailConfig>('mail');
  }

  private get app(): AppConfig {
    return this.config.getOrThrow<AppConfig>('app');
  }

  private getTransporter(): Transporter | null {
    if (!this.mail.enabled) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.mail.host,
        port: this.mail.port,
        secure: this.mail.secure,
        auth: this.mail.user ? { user: this.mail.user, pass: this.mail.password } : undefined,
      });
    }
    return this.transporter;
  }

  async send(payload: MailPayload): Promise<void> {
    const html = this.template({
      ...payload,
      brand: MAYA_BRAND.name,
      primary: MAYA_BRAND.colors.primary,
      pastel: MAYA_BRAND.colors.pastelSoft,
      surface: MAYA_BRAND.colors.surfaceTint,
      ink: MAYA_BRAND.colors.ink,
      year: new Date().getFullYear(),
      appUrl: this.app.webUrl,
    });

    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.debug(`[correo simulado] Para: ${payload.to} · Asunto: ${payload.subject}`);
      if (payload.ctaUrl) this.logger.debug(`[correo simulado] Enlace: ${payload.ctaUrl}`);
      return;
    }

    try {
      await transporter.sendMail({
        from: this.mail.from,
        to: payload.to,
        subject: payload.subject,
        html,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar el correo a ${payload.to}: ${String(error)}`);
    }
  }

  sendEmailVerification(to: string, name: string, link: string): Promise<void> {
    return this.send({
      to,
      subject: 'Confirme su correo electrónico · Maya Classroom',
      title: 'Bienvenido a Maya Classroom',
      greeting: `Hola, ${name}`,
      body: 'Para activar su cuenta y empezar a aprender solo falta confirmar su dirección de correo electrónico.',
      ctaLabel: 'Confirmar mi correo',
      ctaUrl: link,
      footnote: 'Este enlace caduca en 24 horas.',
    });
  }

  sendPasswordReset(to: string, name: string, link: string): Promise<void> {
    return this.send({
      to,
      subject: 'Restablecer su contraseña · Maya Classroom',
      title: 'Restablecer contraseña',
      greeting: `Hola, ${name}`,
      body: 'Hemos recibido una solicitud para restablecer su contraseña. Si no ha sido usted, puede ignorar este mensaje.',
      ctaLabel: 'Crear una nueva contraseña',
      ctaUrl: link,
      footnote: 'Este enlace caduca en 1 hora.',
    });
  }

  /**
   * Alta de la persona que administrará una empresa recién creada. Incluye la
   * contraseña temporal porque es la única vía de entrada: al usarla, la
   * plataforma obliga a sustituirla antes de dejar hacer nada más.
   */
  sendTenantAdminWelcome(params: {
    to: string;
    name: string;
    tenantName: string;
    tenantSlug: string;
    username: string;
    temporaryPassword: string;
  }): Promise<void> {
    return this.send({
      to: params.to,
      subject: `Su cuenta de administración de ${params.tenantName} · Maya Classroom`,
      title: `Bienvenido a ${params.tenantName}`,
      greeting: `Hola, ${params.name}`,
      body:
        `Se ha creado el aula virtual de <strong>${params.tenantName}</strong> y usted es su ` +
        'administrador. Estos son sus datos de acceso:<br><br>' +
        `<strong>Empresa:</strong> ${params.tenantSlug}<br>` +
        `<strong>Usuario:</strong> ${params.username}<br>` +
        `<strong>Contraseña temporal:</strong> ${params.temporaryPassword}`,
      ctaLabel: 'Entrar y cambiar mi contraseña',
      ctaUrl: `${this.app.webUrl}/auth/login?tenant=${params.tenantSlug}`,
      footnote:
        'Por seguridad, la plataforma le pedirá una contraseña nueva la primera vez que entre.',
    });
  }

  /**
   * Acceso a un curso recién comprado.
   *
   * Lleva la contraseña temporal solo cuando la cuenta se acaba de crear: a
   * quien ya tenía cuenta no se le cambia nada, y recibir una contraseña que
   * no es la suya haría pensar que le han entrado en el aula.
   */
  sendCourseAccess(params: {
    to: string;
    name: string;
    tenantName: string;
    tenantSlug: string;
    courseTitle: string;
    reference: string;
    temporaryPassword: string | null;
  }): Promise<void> {
    const credenciales = params.temporaryPassword
      ? '<br><br>Estos son sus datos de acceso:<br>' +
        `<strong>Usuario:</strong> ${params.to}<br>` +
        `<strong>Contraseña temporal:</strong> ${params.temporaryPassword}`
      : '<br><br>Entre con la cuenta que ya tenía en la plataforma.';

    return this.send({
      to: params.to,
      subject: `Ya tiene acceso a «${params.courseTitle}» · ${params.tenantName}`,
      title: '¡Su curso le espera!',
      greeting: `Hola, ${params.name}`,
      body:
        `Su compra de <strong>${params.courseTitle}</strong> está confirmada ` +
        `(pedido ${params.reference}).${credenciales}`,
      ctaLabel: 'Entrar en mi curso',
      ctaUrl: `${this.app.webUrl}/auth/login?tenant=${params.tenantSlug}`,
      footnote: params.temporaryPassword
        ? 'Por seguridad, le pediremos una contraseña nueva la primera vez que entre.'
        : undefined,
    });
  }

  sendInvitation(to: string, name: string, tenantName: string, link: string): Promise<void> {
    return this.send({
      to,
      subject: `Le han invitado a ${tenantName} · Maya Classroom`,
      title: `Su acceso a ${tenantName}`,
      greeting: `Hola, ${name}`,
      body: `Se ha creado una cuenta para usted en el aula virtual de ${tenantName}. Establezca su contraseña para empezar.`,
      ctaLabel: 'Activar mi cuenta',
      ctaUrl: link,
    });
  }

  sendNotification(to: string, subject: string, body: string, url?: string): Promise<void> {
    return this.send({
      to,
      subject,
      title: subject,
      body,
      ctaLabel: url ? 'Ver en Maya Classroom' : undefined,
      ctaUrl: url,
    });
  }
}

const BASE_TEMPLATE = `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:{{surface}};font-family:'Segoe UI',system-ui,sans-serif;color:{{ink}};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(142,42,34,.08);">
          <tr><td style="background:linear-gradient(135deg,{{primary}},#8E2A22);padding:28px 32px;">
            <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-.02em;">{{brand}}</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;">{{title}}</h1>
            {{#if greeting}}<p style="margin:0 0 16px;font-size:15px;color:#6b5f5b;">{{greeting}},</p>{{/if}}
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">{{body}}</p>
            {{#if ctaUrl}}
              <a href="{{ctaUrl}}" style="display:inline-block;background:{{primary}};color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:600;font-size:15px;">{{ctaLabel}}</a>
              <p style="margin:20px 0 0;font-size:12px;color:#948a86;word-break:break-all;">O copie este enlace: {{ctaUrl}}</p>
            {{/if}}
            {{#if footnote}}<p style="margin:24px 0 0;font-size:13px;color:#948a86;">{{footnote}}</p>{{/if}}
          </td></tr>
          <tr><td style="background:{{pastel}};padding:18px 32px;font-size:12px;color:#8e2a22;">
            © {{year}} {{brand}} · <a href="{{appUrl}}" style="color:#8e2a22;">{{appUrl}}</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

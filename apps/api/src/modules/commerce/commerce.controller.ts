import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CAP, ContextLevel, LogAction, OrderStatus, PaymentProvider } from '@maya/shared';
import type { OrderDto, PaymentSettingsDto } from '@maya/shared';
import { Audit, CurrentUser, Public, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
import {
  CreateCheckoutDto,
  SimulatePaymentDto,
  UpdateOrderStatusDto,
  UpdatePaymentSettingsDto,
} from './dto/commerce.dto';

/**
 * Venta de cursos: lo público (comprar, volver de la pasarela) y lo interno
 * (configurar el cobro, ver los pedidos).
 *
 * Las rutas públicas cuelgan de `site/public/:slug` y no de `commerce/…`
 * porque son parte del escaparate: quien las llama no tiene sesión y la
 * empresa se identifica por su dirección, igual que en el resto de la página.
 */
@ApiTags('Venta de cursos')
@Controller()
export class CommerceController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  /* --------------------------------- Público ------------------------------ */

  @Public()
  // Sin sesión detrás y creando pedidos: el límite evita que alguien llene la
  // tabla de pedidos basura desde un bucle.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('site/public/:slug/checkout')
  @ApiOperation({ summary: 'Iniciar la compra de un curso' })
  checkout(@Param('slug') slug: string, @Body() dto: CreateCheckoutDto) {
    return this.orders.checkout(slug, dto);
  }

  @Public()
  @Get('site/public/:slug/orders/:reference')
  @ApiOperation({
    summary: 'Estado de una compra',
    description:
      'Se consulta a la pasarela: la dirección de vuelta la controla el navegador y no basta.',
  })
  orderStatus(@Param('slug') slug: string, @Param('reference') reference: string) {
    return this.orders.resolveReturn(slug, reference);
  }

  @Public()
  // Mismo límite que la compra: sin sesión detrás y con matrícula al final.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('site/public/:slug/orders/:reference/simulate')
  @ApiOperation({
    summary: 'Resolver un pedido de la pasarela de prueba',
    description:
      'Solo funciona sobre pedidos de la pasarela simulada y con la empresa teniéndola activada.',
  })
  simulate(
    @Param('slug') slug: string,
    @Param('reference') reference: string,
    @Body() dto: SimulatePaymentDto,
  ) {
    return this.orders.simulate(slug, reference, dto.approve);
  }

  @Public()
  @Get('site/public/:slug/payment-methods')
  @ApiOperation({ summary: 'Formas de pago disponibles en la página de una empresa' })
  async methods(@Param('slug') slug: string) {
    return this.payments.publicMethodsBySlug(slug);
  }

  @Public()
  @Post('site/public/:slug/webhooks/:provider')
  @ApiOperation({
    summary: 'Aviso automático de la pasarela',
    description: 'El aviso solo indica qué pago mirar; el estado se consulta a la pasarela.',
  })
  webhook(
    @Param('slug') slug: string,
    @Param('provider') provider: PaymentProvider,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request,
  ) {
    return this.orders.handleWebhook(
      slug,
      provider,
      payload ?? {},
      request.query as Record<string, string>,
    );
  }

  /* ------------------------------ Ajustes de cobro ------------------------ */

  @Get('payments/settings')
  @ApiBearerAuth()
  @RequireCapability(CAP.PAYMENT_MANAGE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Ajustes de cobro de la empresa' })
  async settings(@CurrentUser() user: RequestUser): Promise<PaymentSettingsDto> {
    return this.payments.toDto(await this.payments.forTenant(user.tenantId));
  }

  @Patch('payments/settings')
  @ApiBearerAuth()
  @RequireCapability(CAP.PAYMENT_MANAGE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Updated, 'payment-settings')
  @ApiOperation({
    summary: 'Guardar los ajustes de cobro',
    description: 'Las credenciales se guardan cifradas y nunca se devuelven.',
  })
  async updateSettings(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsDto> {
    return this.payments.toDto(await this.payments.update(user.tenantId, dto));
  }

  /* --------------------------------- Pedidos ------------------------------ */

  @Get('orders')
  @ApiBearerAuth()
  @RequireCapability(CAP.ORDER_MANAGE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Pedidos recibidos' })
  list(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: OrderStatus,
  ): Promise<OrderDto[]> {
    return this.orders.list(user.tenantId, status);
  }

  @Patch('orders/:id')
  @ApiBearerAuth()
  @RequireCapability(CAP.ORDER_MANAGE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Updated, 'order')
  @ApiOperation({
    summary: 'Confirmar, cancelar o reembolsar un pedido',
    description: 'Confirmarlo matricula al comprador y le envía sus datos de acceso.',
  })
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderDto> {
    return this.orders.updateStatus(user.tenantId, id, dto);
  }
}

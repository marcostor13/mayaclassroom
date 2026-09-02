import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './schemas/order.schema';
import { PaymentSettings, PaymentSettingsSchema } from './schemas/payment-settings.schema';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
import { CommerceController } from './commerce.controller';
import { SiteModule } from '../site/site.module';

/**
 * La venta de cursos.
 *
 * Importa `SiteModule` para resolver el curso a la venta con las mismas reglas
 * que la ficha pública: si el escaparate no lo enseña, tampoco se puede
 * comprar.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: PaymentSettings.name, schema: PaymentSettingsSchema },
    ]),
    SiteModule,
  ],
  controllers: [CommerceController],
  providers: [OrdersService, PaymentsService],
  exports: [OrdersService, PaymentsService],
})
export class CommerceModule {}

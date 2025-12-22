import { Module } from '@nestjs/common';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { UserModule } from '../user/user.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [UserModule, OrdersModule],
  providers: [WhatsappWebhookService],
  controllers: [WhatsappWebhookController],
})
export class WhatsappWebhookModule {}

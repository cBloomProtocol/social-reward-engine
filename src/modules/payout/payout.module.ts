import { Module, forwardRef } from '@nestjs/common';
import { X402ClientService } from './x402-client.service';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';
import { X402Module } from '../x402/x402.module';

@Module({
  imports: [forwardRef(() => X402Module)],
  controllers: [PayoutController],
  providers: [X402ClientService, PayoutService],
  exports: [X402ClientService, PayoutService],
})
export class PayoutModule {}

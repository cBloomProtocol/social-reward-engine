import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PayoutModule } from '../payout/payout.module';
import { X402Module } from '../x402/x402.module';

@Module({
  imports: [PayoutModule, X402Module],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}

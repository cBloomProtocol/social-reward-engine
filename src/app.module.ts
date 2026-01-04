import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageModule } from './storage/storage.module';
import { FetcherModule } from './modules/fetcher/fetcher.module';
import { ScorerModule } from './modules/scorer/scorer.module';
import { PayoutModule } from './modules/payout/payout.module';
import { X402Module } from './modules/x402/x402.module';
import { PostsModule } from './modules/posts/posts.module';
import { RewardConfigModule } from './modules/config/config.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Database
    StorageModule,

    // Reward config (global)
    RewardConfigModule,

    // Feature modules
    FetcherModule,
    ScorerModule,
    PayoutModule,
    X402Module,
    PostsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

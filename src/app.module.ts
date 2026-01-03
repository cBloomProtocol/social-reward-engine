import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageModule } from './storage/storage.module';
import { FetcherModule } from './modules/fetcher/fetcher.module';
import { ScorerModule } from './modules/scorer/scorer.module';
import { PayoutModule } from './modules/payout/payout.module';

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

    // Feature modules
    FetcherModule,
    ScorerModule,
    PayoutModule,
    // PipelineModule,
    // AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

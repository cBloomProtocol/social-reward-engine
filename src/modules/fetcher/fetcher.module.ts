import { Module } from '@nestjs/common';
import { XApiService } from './x-api.service';
import { CrawlerService } from './crawler.service';
import { FetcherController } from './fetcher.controller';

@Module({
  controllers: [FetcherController],
  providers: [XApiService, CrawlerService],
  exports: [XApiService, CrawlerService],
})
export class FetcherModule {}

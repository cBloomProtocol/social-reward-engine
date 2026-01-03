import { Controller, Get, Post, Query } from '@nestjs/common';
import { CrawlerService, CrawlerState } from './crawler.service';
import { MongoDBService } from '../../storage/mongodb.service';

@Controller('fetcher')
export class FetcherController {
  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly mongoService: MongoDBService,
  ) {}

  /**
   * Get crawler status
   */
  @Get('status')
  async getStatus(): Promise<{ success: boolean; data: CrawlerState | null }> {
    const status = await this.crawlerService.getStatus();
    return {
      success: true,
      data: status,
    };
  }

  /**
   * Trigger manual crawl
   */
  @Post('trigger')
  async triggerCrawl() {
    const result = await this.crawlerService.triggerCrawl();
    return result;
  }

  /**
   * Get fetched posts
   */
  @Get('posts')
  async getPosts(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const total = await this.mongoService.posts.countDocuments();
    const posts = await this.mongoService.posts
      .find()
      .sort({ crawledAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .toArray();

    return {
      success: true,
      data: posts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get stats
   */
  @Get('stats')
  async getStats() {
    const total = await this.mongoService.posts.countDocuments();
    const pending = await this.mongoService.posts.countDocuments({ scoredAt: { $exists: false } });
    const scored = await this.mongoService.posts.countDocuments({ scoredAt: { $exists: true } });

    return {
      success: true,
      data: {
        total,
        pending,
        scored,
      },
    };
  }
}

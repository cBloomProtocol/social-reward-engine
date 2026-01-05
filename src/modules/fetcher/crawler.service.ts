import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { MongoDBService, SocialPost } from '../../storage/mongodb.service';
import { XApiService, RateLimitError, XApiMentionsResponse, XApiTweet, XApiUser } from './x-api.service';

export interface CrawlerState {
  _id?: string;
  jobName: string;
  lastNewestId?: string;
  lastRunAt?: Date;
  lastSuccessAt?: Date;
  status: 'idle' | 'running' | 'error';
  rateLimitUntil?: Date;
  error?: string;
  updatedAt: Date;
}

@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly userId: string;
  private readonly isDev: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly mongoService: MongoDBService,
    private readonly xApiService: XApiService,
  ) {
    this.userId = this.configService.get<string>('X_API_USER_ID') || '';
    this.isDev = this.configService.get<string>('NODE_ENV') === 'development';
  }

  async onModuleInit() {
    if (!this.xApiService.isConfigured()) {
      this.logger.warn('X API not configured - crawler disabled');
      return;
    }

    if (!this.userId) {
      this.logger.warn('X_API_USER_ID not configured - crawler disabled');
      return;
    }

    this.logger.log(`Crawler initialized for user: ${this.userId}`);
  }

  /**
   * Cron job: Fetch mentions every 5 minutes
   */
  @Cron('*/5 * * * *')
  async crawlMentions() {
    // Skip if not configured
    if (!this.xApiService.isConfigured() || !this.userId) {
      return;
    }

    // Skip in development mode (optional)
    if (this.isDev) {
      this.logger.debug('Skipping crawl in development mode');
      return;
    }

    try {
      await this.executeCrawl();
    } catch (error) {
      this.logger.error('Crawl failed:', error);
    }
  }

  /**
   * Manual trigger for crawling
   */
  async triggerCrawl(): Promise<{ success: boolean; message: string; count?: number }> {
    if (!this.xApiService.isConfigured()) {
      return { success: false, message: 'X API not configured' };
    }

    if (!this.userId) {
      return { success: false, message: 'X_API_USER_ID not configured' };
    }

    try {
      const count = await this.executeCrawl();
      return { success: true, message: `Crawled ${count} mentions`, count };
    } catch (error) {
      const err = error as Error;
      return { success: false, message: err.message };
    }
  }

  /**
   * Execute the crawl job
   */
  private async executeCrawl(): Promise<number> {
    const stateCollection = this.mongoService.database.collection<CrawlerState>('crawler_state');

    // Get or create state
    let existingState = await stateCollection.findOne({ jobName: 'mentions_crawler' });

    if (!existingState) {
      const newState: CrawlerState = {
        jobName: 'mentions_crawler',
        status: 'idle',
        updatedAt: new Date(),
      };
      await stateCollection.insertOne(newState as any);
      existingState = newState as any;
    }

    // Use non-null assertion after the check
    const state: CrawlerState = existingState!;

    // Check rate limit
    if (state.rateLimitUntil && new Date() < state.rateLimitUntil) {
      const waitMinutes = Math.ceil((state.rateLimitUntil.getTime() - Date.now()) / 60000);
      this.logger.warn(`Rate limited. Waiting ${waitMinutes} more minutes.`);
      return 0;
    }

    // Update status to running
    await stateCollection.updateOne(
      { jobName: 'mentions_crawler' },
      { $set: { status: 'running', lastRunAt: new Date(), updatedAt: new Date() } },
    );

    let totalInserted = 0;
    const sinceId = state.lastNewestId;

    try {
      // Fetch mentions with pagination
      for await (const response of this.xApiService.fetchMentionsWithPagination({
        userId: this.userId,
        maxResults: 20,
        sinceId,
      })) {
        const inserted = await this.processMentionsResponse(response);
        totalInserted += inserted;

        // Update newest ID after first page
        if (response.meta?.newest_id && !sinceId) {
          await stateCollection.updateOne(
            { jobName: 'mentions_crawler' },
            { $set: { lastNewestId: response.meta.newest_id, updatedAt: new Date() } },
          );
        }
      }

      // Update state on success
      await stateCollection.updateOne(
        { jobName: 'mentions_crawler' },
        {
          $set: {
            status: 'idle',
            lastSuccessAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: { error: '' },
        },
      );

      this.logger.log(`Crawl completed: ${totalInserted} new mentions`);
      return totalInserted;
    } catch (error) {
      const err = error as Error;

      if (error instanceof RateLimitError) {
        // Set rate limit wait period (20 minutes)
        const rateLimitUntil = new Date(Date.now() + 20 * 60 * 1000);

        await stateCollection.updateOne(
          { jobName: 'mentions_crawler' },
          {
            $set: {
              status: 'error',
              rateLimitUntil,
              error: err.message,
              updatedAt: new Date(),
            },
          },
        );

        this.logger.warn(`Rate limited. Will retry at ${rateLimitUntil.toISOString()}`);
      } else {
        await stateCollection.updateOne(
          { jobName: 'mentions_crawler' },
          {
            $set: {
              status: 'error',
              error: err.message,
              updatedAt: new Date(),
            },
          },
        );
      }

      throw error;
    }
  }

  /**
   * Process API response and insert posts
   */
  private async processMentionsResponse(response: XApiMentionsResponse): Promise<number> {
    if (!response.data || response.data.length === 0) {
      return 0;
    }

    // Build user map for quick lookup
    const userMap: Record<string, XApiUser> = {};
    if (response.includes?.users) {
      for (const user of response.includes.users) {
        userMap[user.id] = user;
      }
    }

    // Transform tweets to posts
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const posts: SocialPost[] = response.data
      .map((tweet: XApiTweet) => {
        const user = userMap[tweet.author_id] || { username: 'unknown', name: 'Unknown' };

        return {
          tweetId: tweet.id,
          text: tweet.text,
          authorId: tweet.author_id,
          authorUsername: user.username,
          authorName: user.name,
          publishedAt: new Date(tweet.created_at),
          crawledAt: now,
          createdAt: now,
          updatedAt: now,
        };
      })
      .filter((post) => post.publishedAt >= threeMonthsAgo);

    if (posts.length < response.data.length) {
      this.logger.debug(`Filtered out ${response.data.length - posts.length} posts older than 3 months`);
    }

    // Upsert posts (avoid duplicates)
    let insertedCount = 0;
    for (const post of posts) {
      try {
        await this.mongoService.posts.updateOne(
          { tweetId: post.tweetId },
          { $setOnInsert: post },
          { upsert: true },
        );
        insertedCount++;
      } catch (error) {
        const err = error as any;
        // Ignore duplicate key errors
        if (err.code !== 11000) {
          this.logger.error(`Failed to insert post ${post.tweetId}:`, error);
        }
      }
    }

    return insertedCount;
  }

  /**
   * Get crawler status
   */
  async getStatus(): Promise<CrawlerState | null> {
    const stateCollection = this.mongoService.database.collection<CrawlerState>('crawler_state');
    const state = await stateCollection.findOne({ jobName: 'mentions_crawler' });
    return state as CrawlerState | null;
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ObjectId } from 'mongodb';
import { MongoDBService } from '../../storage/mongodb.service';
import { LlmClientService, ScoringResult } from './llm-client.service';

export interface ScorerState {
  _id?: string;
  jobName: string;
  lastRunAt?: Date;
  lastSuccessAt?: Date;
  status: 'idle' | 'running' | 'error';
  processedCount?: number;
  error?: string;
  updatedAt: Date;
}

@Injectable()
export class ScorerService implements OnModuleInit {
  private readonly logger = new Logger(ScorerService.name);
  private readonly isDev: boolean;
  private readonly batchSize: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly mongoService: MongoDBService,
    private readonly llmClient: LlmClientService,
  ) {
    this.isDev = this.configService.get<string>('NODE_ENV') === 'development';
    this.batchSize = this.configService.get<number>('SCORER_BATCH_SIZE') || 10;
  }

  async onModuleInit() {
    if (!this.llmClient.isConfigured()) {
      this.logger.warn('LLM service not configured - scorer disabled');
      return;
    }

    this.logger.log('Scorer service initialized');
  }

  /**
   * Cron job: Score pending posts every 5 minutes
   */
  @Cron('*/5 * * * *')
  async scorePendingPosts() {
    // Skip if not configured
    if (!this.llmClient.isConfigured()) {
      return;
    }

    // Skip in development mode
    if (this.isDev) {
      this.logger.debug('Skipping scoring in development mode');
      return;
    }

    try {
      await this.executeScoring();
    } catch (error) {
      this.logger.error('Scoring job failed:', error);
    }
  }

  /**
   * Manual trigger for scoring
   */
  async triggerScoring(): Promise<{ success: boolean; message: string; count?: number }> {
    if (!this.llmClient.isConfigured()) {
      return { success: false, message: 'LLM service not configured' };
    }

    try {
      const count = await this.executeScoring();
      return { success: true, message: `Scored ${count} posts`, count };
    } catch (error) {
      const err = error as Error;
      return { success: false, message: err.message };
    }
  }

  /**
   * Execute the scoring job
   */
  private async executeScoring(): Promise<number> {
    const stateCollection = this.mongoService.database.collection<ScorerState>('scorer_state');

    // Try to acquire lock (atomic operation)
    const lockResult = await stateCollection.findOneAndUpdate(
      { jobName: 'post_scorer', status: { $ne: 'running' } },
      {
        $set: { status: 'running', lastRunAt: new Date(), updatedAt: new Date() },
        $setOnInsert: { jobName: 'post_scorer' },
      },
      { upsert: true, returnDocument: 'after' },
    );

    if (!lockResult) {
      this.logger.debug('Scoring already in progress, skipping...');
      return 0;
    }

    let processedCount = 0;

    try {
      // Find unscored posts
      const pendingPosts = await this.mongoService.posts
        .find({ scoredAt: { $exists: false } })
        .sort({ crawledAt: 1 }) // Oldest first
        .limit(this.batchSize)
        .toArray();

      if (pendingPosts.length === 0) {
        this.logger.debug('No pending posts to score');
        await this.updateStateSuccess(stateCollection, 0);
        return 0;
      }

      this.logger.log(`Scoring ${pendingPosts.length} posts...`);

      // Score each post
      for (const post of pendingPosts) {
        try {
          const result = await this.llmClient.scorePost(post.text, post.authorUsername);

          await this.mongoService.posts.updateOne(
            { _id: post._id },
            {
              $set: {
                qualityScore: result.qualityScore,
                aiLikelihood: result.aiLikelihood,
                spamScore: result.spamScore,
                scoredAt: new Date(),
                updatedAt: new Date(),
              },
            },
          );

          processedCount++;
          this.logger.debug(
            `Scored post ${post.tweetId}: quality=${result.qualityScore}, ai=${result.aiLikelihood}`,
          );
        } catch (error) {
          const err = error as Error;
          this.logger.error(`Failed to score post ${post.tweetId}: ${err.message}`);

          // Mark as scored with error to avoid infinite retries
          await this.mongoService.posts.updateOne(
            { _id: post._id },
            {
              $set: {
                qualityScore: 0,
                aiLikelihood: 100,
                spamScore: 100,
                scoringError: err.message,
                scoredAt: new Date(),
                updatedAt: new Date(),
              },
            },
          );
        }
      }

      await this.updateStateSuccess(stateCollection, processedCount);
      this.logger.log(`Scoring completed: ${processedCount} posts processed`);

      return processedCount;
    } catch (error) {
      const err = error as Error;

      await stateCollection.updateOne(
        { jobName: 'post_scorer' },
        {
          $set: {
            status: 'error',
            error: err.message,
            updatedAt: new Date(),
          },
        },
      );

      throw error;
    }
  }

  private async updateStateSuccess(stateCollection: any, processedCount: number) {
    await stateCollection.updateOne(
      { jobName: 'post_scorer' },
      {
        $set: {
          status: 'idle',
          lastSuccessAt: new Date(),
          processedCount,
          updatedAt: new Date(),
        },
        $unset: { error: '' },
      },
    );
  }

  /**
   * Score a single post by ID
   */
  async scorePostById(postId: string): Promise<ScoringResult | null> {
    if (!this.llmClient.isConfigured()) {
      throw new Error('LLM service not configured');
    }

    const post = await this.mongoService.posts.findOne({ _id: new ObjectId(postId) });

    if (!post) {
      return null;
    }

    const result = await this.llmClient.scorePost(post.text, post.authorUsername);

    await this.mongoService.posts.updateOne(
      { _id: post._id },
      {
        $set: {
          qualityScore: result.qualityScore,
          aiLikelihood: result.aiLikelihood,
          spamScore: result.spamScore,
          scoredAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    return result;
  }

  /**
   * Get scorer status
   */
  async getStatus(): Promise<ScorerState | null> {
    const stateCollection = this.mongoService.database.collection<ScorerState>('scorer_state');
    const state = await stateCollection.findOne({ jobName: 'post_scorer' });
    return state as ScorerState | null;
  }

  /**
   * Get scoring statistics
   */
  async getStats() {
    const total = await this.mongoService.posts.countDocuments();
    const scored = await this.mongoService.posts.countDocuments({ scoredAt: { $exists: true } });
    const pending = await this.mongoService.posts.countDocuments({ scoredAt: { $exists: false } });
    const withErrors = await this.mongoService.posts.countDocuments({
      scoringError: { $exists: true },
    });

    // Average scores
    const avgScores = await this.mongoService.posts
      .aggregate([
        { $match: { scoredAt: { $exists: true }, scoringError: { $exists: false } } },
        {
          $group: {
            _id: null,
            avgQuality: { $avg: '$qualityScore' },
            avgAiLikelihood: { $avg: '$aiLikelihood' },
            avgSpam: { $avg: '$spamScore' },
          },
        },
      ])
      .toArray();

    return {
      total,
      scored,
      pending,
      withErrors,
      averages: avgScores[0] || { avgQuality: 0, avgAiLikelihood: 0, avgSpam: 0 },
    };
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ObjectId } from 'mongodb';
import { MongoDBService, PayoutRecord } from '../../storage/mongodb.service';
import { X402ClientService, PaymentResponse } from './x402-client.service';

export interface PayoutState {
  _id?: string;
  jobName: string;
  lastRunAt?: Date;
  lastSuccessAt?: Date;
  status: 'idle' | 'running' | 'error';
  processedCount?: number;
  totalPaid?: number;
  error?: string;
  updatedAt: Date;
}

export interface PayoutEligibility {
  eligible: boolean;
  reason?: string;
  amount?: number;
}

@Injectable()
export class PayoutService implements OnModuleInit {
  private readonly logger = new Logger(PayoutService.name);
  private readonly isDev: boolean;
  private readonly batchSize: number;

  // Reward configuration
  private readonly baseAmount: number;
  private readonly token: string;
  private readonly network: string;
  private readonly minQualityScore: number;
  private readonly maxAiLikelihood: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly mongoService: MongoDBService,
    private readonly x402Client: X402ClientService,
  ) {
    this.isDev = this.configService.get<string>('NODE_ENV') === 'development';
    this.batchSize = this.configService.get<number>('PAYOUT_BATCH_SIZE') || 10;

    // Reward config
    this.baseAmount = this.configService.get<number>('REWARD_BASE_AMOUNT') || 1.0;
    this.token = this.configService.get<string>('REWARD_TOKEN') || 'USDT';
    this.network = this.configService.get<string>('X402_NETWORK') || 'bsc';
    this.minQualityScore = this.configService.get<number>('REWARD_MIN_QUALITY_SCORE') || 80;
    this.maxAiLikelihood = this.configService.get<number>('REWARD_MAX_AI_LIKELIHOOD') || 30;
  }

  async onModuleInit() {
    if (!this.x402Client.isConfigured()) {
      this.logger.warn('X402 not configured - payouts disabled');
      return;
    }

    this.logger.log(
      `Payout service initialized: ${this.baseAmount} ${this.token} on ${this.network}`,
    );
  }

  /**
   * Cron job: Process pending payouts every 10 minutes
   */
  @Cron('*/10 * * * *')
  async processPendingPayouts() {
    if (!this.x402Client.isConfigured()) {
      return;
    }

    if (this.isDev) {
      this.logger.debug('Skipping payouts in development mode');
      return;
    }

    try {
      await this.executePayouts();
    } catch (error) {
      this.logger.error('Payout job failed:', error);
    }
  }

  /**
   * Manual trigger for payouts
   */
  async triggerPayouts(): Promise<{ success: boolean; message: string; count?: number }> {
    if (!this.x402Client.isConfigured()) {
      return { success: false, message: 'X402 not configured' };
    }

    try {
      const count = await this.executePayouts();
      return { success: true, message: `Processed ${count} payouts`, count };
    } catch (error) {
      const err = error as Error;
      return { success: false, message: err.message };
    }
  }

  /**
   * Execute payout job
   */
  private async executePayouts(): Promise<number> {
    const stateCollection = this.mongoService.database.collection<PayoutState>('payout_state');

    // Get or create state
    let existingState = await stateCollection.findOne({ jobName: 'reward_payout' });

    if (!existingState) {
      const newState: PayoutState = {
        jobName: 'reward_payout',
        status: 'idle',
        updatedAt: new Date(),
      };
      await stateCollection.insertOne(newState as any);
    }

    // Update status to running
    await stateCollection.updateOne(
      { jobName: 'reward_payout' },
      { $set: { status: 'running', lastRunAt: new Date(), updatedAt: new Date() } },
    );

    let processedCount = 0;
    let totalPaid = 0;

    try {
      // Step 1: Find eligible posts and queue payouts
      await this.queueEligiblePayouts();

      // Step 2: Process pending payouts
      const pendingPayouts = await this.mongoService.payouts
        .find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(this.batchSize)
        .toArray();

      if (pendingPayouts.length === 0) {
        this.logger.debug('No pending payouts');
        await this.updateStateSuccess(stateCollection, 0, 0);
        return 0;
      }

      this.logger.log(`Processing ${pendingPayouts.length} payouts...`);

      for (const payout of pendingPayouts) {
        const result = await this.processPayoutRecord(payout);

        if (result.success) {
          processedCount++;
          totalPaid += payout.amount;
        }
      }

      await this.updateStateSuccess(stateCollection, processedCount, totalPaid);
      this.logger.log(`Payouts completed: ${processedCount} processed, ${totalPaid} ${this.token} paid`);

      return processedCount;
    } catch (error) {
      const err = error as Error;

      await stateCollection.updateOne(
        { jobName: 'reward_payout' },
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

  /**
   * Queue eligible posts for payout
   */
  private async queueEligiblePayouts(): Promise<number> {
    // Find scored posts that haven't been processed for payout
    const eligiblePosts = await this.mongoService.posts
      .find({
        scoredAt: { $exists: true },
        payoutStatus: { $exists: false },
        qualityScore: { $gte: this.minQualityScore },
        aiLikelihood: { $lte: this.maxAiLikelihood },
        authorWallet: { $exists: true, $ne: '' },
      } as any)
      .limit(this.batchSize * 2)
      .toArray();

    let queuedCount = 0;

    for (const post of eligiblePosts) {
      const eligibility = this.checkEligibility(post);

      if (eligibility.eligible) {
        // Create payout record - Worker will lookup wallet by authorId
        const payoutRecord: PayoutRecord = {
          tweetId: post.tweetId,
          authorId: post.authorId,
          recipientAddress: post.authorWallet, // optional - Worker will lookup if not provided
          amount: eligibility.amount || this.baseAmount,
          token: this.token,
          network: this.network,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.mongoService.payouts.insertOne(payoutRecord);

        // Update post status
        await this.mongoService.posts.updateOne(
          { _id: post._id },
          {
            $set: {
              payoutStatus: 'queued',
              payoutAmount: eligibility.amount,
              updatedAt: new Date(),
            },
          },
        );

        queuedCount++;
      } else {
        // Mark as ineligible
        await this.mongoService.posts.updateOne(
          { _id: post._id },
          {
            $set: {
              payoutStatus: 'ineligible',
              payoutReason: eligibility.reason,
              updatedAt: new Date(),
            },
          },
        );
      }
    }

    if (queuedCount > 0) {
      this.logger.log(`Queued ${queuedCount} posts for payout`);
    }

    return queuedCount;
  }

  /**
   * Check if a post is eligible for reward
   */
  private checkEligibility(post: any): PayoutEligibility {
    // Check quality score
    if (!post.qualityScore || post.qualityScore < this.minQualityScore) {
      return {
        eligible: false,
        reason: `Quality score ${post.qualityScore || 0} below minimum ${this.minQualityScore}`,
      };
    }

    // Check AI likelihood
    if (post.aiLikelihood && post.aiLikelihood > this.maxAiLikelihood) {
      return {
        eligible: false,
        reason: `AI likelihood ${post.aiLikelihood} exceeds maximum ${this.maxAiLikelihood}`,
      };
    }

    // Note: Wallet check happens during payout processing
    // User may not have linked wallet yet - Worker will check

    // Calculate reward amount (could be dynamic based on quality)
    const amount = this.calculateRewardAmount(post);

    return {
      eligible: true,
      amount,
    };
  }

  /**
   * Calculate reward amount based on post quality
   */
  private calculateRewardAmount(post: any): number {
    // Base amount with quality multiplier
    const qualityMultiplier = (post.qualityScore || 0) / 100;
    const amount = this.baseAmount * (0.5 + qualityMultiplier * 0.5);

    // Round to 2 decimal places
    return Math.round(amount * 100) / 100;
  }

  /**
   * Process a single payout record
   */
  private async processPayoutRecord(payout: PayoutRecord): Promise<PaymentResponse> {
    // Update status to processing
    await this.mongoService.payouts.updateOne(
      { _id: payout._id },
      { $set: { status: 'processing', updatedAt: new Date() } },
    );

    try {
      // Use authorId (Twitter ID) for payment - Worker will lookup wallet
      const result = await this.x402Client.sendPayment({
        twitterId: payout.authorId || payout.tweetId, // fallback to tweetId if no authorId
        amount: payout.amount,
        network: payout.network as 'base' | 'solana',
      });

      if (result.success) {
        // Update payout record
        await this.mongoService.payouts.updateOne(
          { _id: payout._id },
          {
            $set: {
              status: 'completed',
              txHash: result.txHash,
              updatedAt: new Date(),
            },
          },
        );

        // Update post status
        await this.mongoService.posts.updateOne(
          { tweetId: payout.tweetId },
          {
            $set: {
              payoutStatus: 'paid',
              payoutTxHash: result.txHash,
              paidAt: new Date(),
              updatedAt: new Date(),
            },
          },
        );

        this.logger.log(
          `Payout completed: ${payout.amount} ${payout.token} to ${payout.recipientAddress}`,
        );
      } else {
        // Mark as failed
        await this.mongoService.payouts.updateOne(
          { _id: payout._id },
          {
            $set: {
              status: 'failed',
              error: result.error,
              updatedAt: new Date(),
            },
          },
        );

        await this.mongoService.posts.updateOne(
          { tweetId: payout.tweetId },
          {
            $set: {
              payoutStatus: 'failed',
              updatedAt: new Date(),
            },
          },
        );

        this.logger.warn(`Payout failed for ${payout.tweetId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const err = error as Error;

      await this.mongoService.payouts.updateOne(
        { _id: payout._id },
        {
          $set: {
            status: 'failed',
            error: err.message,
            updatedAt: new Date(),
          },
        },
      );

      return { success: false, error: err.message };
    }
  }

  private async updateStateSuccess(stateCollection: any, processedCount: number, totalPaid: number) {
    await stateCollection.updateOne(
      { jobName: 'reward_payout' },
      {
        $set: {
          status: 'idle',
          lastSuccessAt: new Date(),
          processedCount,
          totalPaid,
          updatedAt: new Date(),
        },
        $unset: { error: '' },
      },
    );
  }

  /**
   * Get payout status
   */
  async getStatus(): Promise<PayoutState | null> {
    const stateCollection = this.mongoService.database.collection<PayoutState>('payout_state');
    const state = await stateCollection.findOne({ jobName: 'reward_payout' });
    return state as PayoutState | null;
  }

  /**
   * Get payout statistics
   */
  async getStats() {
    const total = await this.mongoService.payouts.countDocuments();
    const pending = await this.mongoService.payouts.countDocuments({ status: 'pending' });
    const processing = await this.mongoService.payouts.countDocuments({ status: 'processing' });
    const completed = await this.mongoService.payouts.countDocuments({ status: 'completed' });
    const failed = await this.mongoService.payouts.countDocuments({ status: 'failed' });

    // Total paid amount
    const paidAgg = await this.mongoService.payouts
      .aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .toArray();

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      totalPaid: paidAgg[0]?.total || 0,
      token: this.token,
      network: this.network,
    };
  }

  /**
   * Get payout history
   */
  async getPayoutHistory(page: number = 1, limit: number = 20) {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));

    const total = await this.mongoService.payouts.countDocuments();
    const payouts = await this.mongoService.payouts
      .find()
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .toArray();

    return {
      data: payouts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }
}

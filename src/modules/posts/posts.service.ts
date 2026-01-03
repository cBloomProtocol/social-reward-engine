import { Injectable, Logger } from '@nestjs/common';
import { MongoDBService, SocialPost } from '../../storage/mongodb.service';
import { X402ClientService } from '../payout/x402-client.service';
import { X402Service } from '../x402/x402.service';

export interface PostInfo {
  tweetId: string;
  text: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorWallet?: string;
  qualityScore?: number;
  aiLikelihood?: number;
  payoutStatus?: string;
  payoutAmount?: number;
  payoutTxHash?: string;
  publishedAt: Date;
}

export interface ClaimResult {
  success: boolean;
  txHash?: string;
  error?: string;
  status?: string;
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly mongoService: MongoDBService,
    private readonly x402Client: X402ClientService,
    private readonly x402Service: X402Service,
  ) {}

  /**
   * Get post by tweet ID
   */
  async getPostByTweetId(tweetId: string): Promise<PostInfo | null> {
    // Demo mode for UI preview
    if (tweetId === 'demo') {
      return {
        tweetId: 'demo',
        text: 'This is a demo post for testing the claim UI! 🎉 The Social Reward Engine automatically scores quality content and rewards creators with USDC.',
        authorId: 'demo_user',
        authorUsername: 'demo_creator',
        authorName: 'Demo Creator',
        qualityScore: 92,
        aiLikelihood: 5,
        payoutStatus: 'pending',
        payoutAmount: 0.96,
        publishedAt: new Date(),
      };
    }

    const post = await this.mongoService.posts.findOne({ tweetId });

    if (!post) {
      return null;
    }

    return {
      tweetId: post.tweetId,
      text: post.text,
      authorId: post.authorId,
      authorUsername: post.authorUsername,
      authorName: post.authorName,
      authorWallet: post.authorWallet,
      qualityScore: post.qualityScore,
      aiLikelihood: post.aiLikelihood,
      payoutStatus: post.payoutStatus,
      payoutAmount: post.payoutAmount,
      payoutTxHash: post.payoutTxHash,
      publishedAt: post.publishedAt,
    };
  }

  /**
   * Claim reward for a post
   */
  async claimReward(tweetId: string): Promise<ClaimResult> {
    // Get post
    const post = await this.mongoService.posts.findOne({ tweetId });

    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    // Check if already claimed
    if (post.payoutStatus === 'paid' && post.payoutTxHash) {
      return {
        success: true,
        txHash: post.payoutTxHash,
        status: 'already_claimed',
      };
    }

    // Check if eligible (scored and passed quality check)
    if (!post.scoredAt) {
      return { success: false, error: 'Post not yet scored' };
    }

    if (!post.qualityScore || post.qualityScore < 80) {
      return { success: false, error: 'Post does not meet quality threshold' };
    }

    if (post.aiLikelihood && post.aiLikelihood > 30) {
      return { success: false, error: 'Post flagged as AI-generated' };
    }

    // Check if user has linked wallet
    const wallet = await this.x402Service.getUserWallet(post.authorId, 'base');

    if (!wallet) {
      return { success: false, error: 'Wallet not linked. Please sign in first.' };
    }

    // Check if X402 is configured
    if (!this.x402Client.isConfigured()) {
      return { success: false, error: 'Payment system not configured' };
    }

    // Calculate reward amount
    const qualityMultiplier = (post.qualityScore || 0) / 100;
    const baseAmount = 1.0;
    const amount = Math.round(baseAmount * (0.5 + qualityMultiplier * 0.5) * 100) / 100;

    try {
      // Update status to processing
      await this.mongoService.posts.updateOne(
        { _id: post._id },
        {
          $set: {
            payoutStatus: 'processing',
            payoutAmount: amount,
            updatedAt: new Date(),
          },
        },
      );

      // Send payment
      const result = await this.x402Client.sendPayment({
        twitterId: post.authorId,
        amount,
        network: 'base',
      });

      if (result.success) {
        // Update post with success
        await this.mongoService.posts.updateOne(
          { _id: post._id },
          {
            $set: {
              payoutStatus: 'paid',
              payoutTxHash: result.txHash,
              paidAt: new Date(),
              updatedAt: new Date(),
            },
          },
        );

        this.logger.log(`Claim successful for ${tweetId}: ${amount} USDC`);

        return {
          success: true,
          txHash: result.txHash,
          status: 'claimed',
        };
      } else {
        // Update post with failure
        await this.mongoService.posts.updateOne(
          { _id: post._id },
          {
            $set: {
              payoutStatus: 'failed',
              updatedAt: new Date(),
            },
          },
        );

        return { success: false, error: result.error || 'Payment failed' };
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Claim failed for ${tweetId}: ${err.message}`);

      // Update post with failure
      await this.mongoService.posts.updateOne(
        { _id: post._id },
        {
          $set: {
            payoutStatus: 'failed',
            updatedAt: new Date(),
          },
        },
      );

      return { success: false, error: err.message };
    }
  }

  /**
   * Get claim status for a post
   */
  async getClaimStatus(tweetId: string): Promise<{
    eligible: boolean;
    status: string;
    amount?: number;
    txHash?: string;
    reason?: string;
  }> {
    const post = await this.mongoService.posts.findOne({ tweetId });

    if (!post) {
      return { eligible: false, status: 'not_found', reason: 'Post not found' };
    }

    if (post.payoutStatus === 'paid') {
      return {
        eligible: true,
        status: 'claimed',
        amount: post.payoutAmount,
        txHash: post.payoutTxHash,
      };
    }

    if (!post.scoredAt) {
      return { eligible: false, status: 'pending_score', reason: 'Awaiting quality score' };
    }

    if (!post.qualityScore || post.qualityScore < 80) {
      return {
        eligible: false,
        status: 'ineligible',
        reason: `Quality score ${post.qualityScore || 0} below threshold`,
      };
    }

    if (post.aiLikelihood && post.aiLikelihood > 30) {
      return {
        eligible: false,
        status: 'ineligible',
        reason: 'Content flagged as AI-generated',
      };
    }

    // Calculate potential reward
    const qualityMultiplier = (post.qualityScore || 0) / 100;
    const baseAmount = 1.0;
    const amount = Math.round(baseAmount * (0.5 + qualityMultiplier * 0.5) * 100) / 100;

    return {
      eligible: true,
      status: 'claimable',
      amount,
    };
  }
}

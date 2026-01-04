import { Injectable, Logger } from '@nestjs/common';
import { MongoDBService, RewardConfig } from '../../storage/mongodb.service';

const DEFAULT_CONFIG: Omit<RewardConfig, '_id' | 'key' | 'updatedAt'> = {
  minQualityScore: 80,
  maxAiLikelihood: 30,
  baseAmount: 1.0,
  token: 'USDC',
  minMultiplier: 0.5,
};

@Injectable()
export class RewardConfigService {
  private readonly logger = new Logger(RewardConfigService.name);
  private cachedConfig: RewardConfig | null = null;

  constructor(private readonly mongoService: MongoDBService) {}

  async getConfig(): Promise<RewardConfig> {
    // Return cached config if available
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    // Try to get from DB
    let config = await this.mongoService.config.findOne({ key: 'reward' });

    // If not exists, create with defaults
    if (!config) {
      this.logger.log('Creating default reward config');
      const now = new Date();
      await this.mongoService.config.insertOne({
        key: 'reward',
        ...DEFAULT_CONFIG,
        updatedAt: now,
      });
      config = await this.mongoService.config.findOne({ key: 'reward' });
    }

    this.cachedConfig = config!;
    return this.cachedConfig;
  }

  async updateConfig(
    updates: Partial<Omit<RewardConfig, '_id' | 'key' | 'updatedAt'>>,
  ): Promise<RewardConfig> {
    const now = new Date();

    // Ensure config exists first
    await this.getConfig();

    // Extract only allowed fields to prevent _id/key modification
    const { minQualityScore, maxAiLikelihood, baseAmount, token, minMultiplier } = updates as any;
    const safeUpdates: Record<string, any> = { updatedAt: now };

    if (minQualityScore !== undefined) safeUpdates.minQualityScore = minQualityScore;
    if (maxAiLikelihood !== undefined) safeUpdates.maxAiLikelihood = maxAiLikelihood;
    if (baseAmount !== undefined) safeUpdates.baseAmount = baseAmount;
    if (token !== undefined) safeUpdates.token = token;
    if (minMultiplier !== undefined) safeUpdates.minMultiplier = minMultiplier;

    // Now just update the fields
    await this.mongoService.config.updateOne(
      { key: 'reward' },
      { $set: safeUpdates },
    );

    // Invalidate cache
    this.cachedConfig = null;

    return this.getConfig();
  }

  /**
   * Calculate reward amount based on quality score
   */
  async calculateRewardAmount(qualityScore: number): Promise<number> {
    const config = await this.getConfig();
    const qualityMultiplier = qualityScore / 100;
    const amount =
      config.baseAmount *
      (config.minMultiplier + qualityMultiplier * (1 - config.minMultiplier));
    return Math.round(amount * 100) / 100;
  }

  /**
   * Check if a post is eligible for reward
   */
  async isEligible(qualityScore: number, aiLikelihood: number): Promise<boolean> {
    const config = await this.getConfig();
    return (
      qualityScore >= config.minQualityScore &&
      aiLikelihood <= config.maxAiLikelihood
    );
  }
}

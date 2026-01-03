import { Controller, Get, Post, Param } from '@nestjs/common';
import { ScorerService, ScorerState } from './scorer.service';
import { LlmClientService } from './llm-client.service';

@Controller('scorer')
export class ScorerController {
  constructor(
    private readonly scorerService: ScorerService,
    private readonly llmClient: LlmClientService,
  ) {}

  /**
   * Get scorer status
   */
  @Get('status')
  async getStatus(): Promise<{ success: boolean; data: ScorerState | null }> {
    const status = await this.scorerService.getStatus();
    return {
      success: true,
      data: status,
    };
  }

  /**
   * Trigger manual scoring
   */
  @Post('trigger')
  async triggerScoring() {
    const result = await this.scorerService.triggerScoring();
    return result;
  }

  /**
   * Score a specific post
   */
  @Post('posts/:id/score')
  async scorePost(@Param('id') id: string) {
    try {
      const result = await this.scorerService.scorePostById(id);
      if (!result) {
        return { success: false, message: 'Post not found' };
      }
      return { success: true, data: result };
    } catch (error) {
      const err = error as Error;
      return { success: false, message: err.message };
    }
  }

  /**
   * Get scoring statistics
   */
  @Get('stats')
  async getStats() {
    const stats = await this.scorerService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Check LLM service health
   */
  @Get('health')
  async checkHealth() {
    const isHealthy = await this.llmClient.healthCheck();
    return {
      success: true,
      data: {
        llmService: isHealthy ? 'healthy' : 'unavailable',
        configured: this.llmClient.isConfigured(),
      },
    };
  }
}

import { Controller, Get, Post, Query } from '@nestjs/common';
import { PayoutService, PayoutState } from './payout.service';
import { X402ClientService } from './x402-client.service';

@Controller('payout')
export class PayoutController {
  constructor(
    private readonly payoutService: PayoutService,
    private readonly x402Client: X402ClientService,
  ) {}

  /**
   * Get payout status
   */
  @Get('status')
  async getStatus(): Promise<{ success: boolean; data: PayoutState | null }> {
    const status = await this.payoutService.getStatus();
    return {
      success: true,
      data: status,
    };
  }

  /**
   * Trigger manual payout processing
   */
  @Post('trigger')
  async triggerPayouts() {
    const result = await this.payoutService.triggerPayouts();
    return result;
  }

  /**
   * Get payout statistics
   */
  @Get('stats')
  async getStats() {
    const stats = await this.payoutService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Get payout history
   */
  @Get('history')
  async getHistory(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const result = await this.payoutService.getPayoutHistory(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Check X402 service health
   */
  @Get('health')
  async checkHealth() {
    const health = await this.x402Client.healthCheck();
    return {
      success: true,
      data: {
        x402Service: health.healthy ? 'healthy' : 'unavailable',
        configured: this.x402Client.isConfigured(),
        network: health.network,
        walletAddress: health.wallet,
      },
    };
  }
}

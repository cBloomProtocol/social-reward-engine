import { Controller, Get, Put, Body } from '@nestjs/common';
import { RewardConfigService } from './reward-config.service';
import { RewardConfig } from '../../storage/mongodb.service';

class UpdateRewardConfigDto {
  minQualityScore?: number;
  maxAiLikelihood?: number;
  baseAmount?: number;
  token?: string;
  minMultiplier?: number;
}

@Controller('config')
export class ConfigController {
  constructor(private readonly rewardConfigService: RewardConfigService) {}

  @Get('reward')
  async getRewardConfig(): Promise<{ data: RewardConfig }> {
    const config = await this.rewardConfigService.getConfig();
    return { data: config };
  }

  @Put('reward')
  async updateRewardConfig(
    @Body() dto: UpdateRewardConfigDto,
  ): Promise<{ data: RewardConfig }> {
    const config = await this.rewardConfigService.updateConfig(dto);
    return { data: config };
  }
}

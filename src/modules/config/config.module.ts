import { Module, Global } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { RewardConfigService } from './reward-config.service';
import { StorageModule } from '../../storage/storage.module';

@Global()
@Module({
  imports: [StorageModule],
  controllers: [ConfigController],
  providers: [RewardConfigService],
  exports: [RewardConfigService],
})
export class RewardConfigModule {}

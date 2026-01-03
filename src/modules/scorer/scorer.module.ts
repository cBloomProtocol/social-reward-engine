import { Module } from '@nestjs/common';
import { LlmClientService } from './llm-client.service';
import { ScorerService } from './scorer.service';
import { ScorerController } from './scorer.controller';

@Module({
  controllers: [ScorerController],
  providers: [LlmClientService, ScorerService],
  exports: [LlmClientService, ScorerService],
})
export class ScorerModule {}

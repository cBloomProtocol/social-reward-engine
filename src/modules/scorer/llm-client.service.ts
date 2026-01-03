import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface LlmProcessRequest {
  content: string;
  templateName: string;
  variables?: Record<string, string>;
  provider?: 'deepseek' | 'anthropic' | 'openai' | 'gemini';
  parserName?: 'json' | 'number' | 'text';
  source?: string;
}

export interface LlmProcessResponse {
  success: boolean;
  statusCode: number;
  data: {
    rawText: string;
    requestId: string;
    responseTime: number;
    provider: string;
    parsed?: any;
    parseError?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

export interface ScoringResult {
  qualityScore: number;
  aiLikelihood: number;
  spamScore: number;
  reasoning?: string;
}

// LLM may return snake_case or camelCase
interface RawScoringResult {
  qualityScore?: number;
  quality_score?: number;
  aiLikelihood?: number;
  ai_likelihood?: number;
  spamScore?: number;
  spam_score?: number;
  reasoning?: string;
}

// Supported LLM providers
type LlmProvider = 'anthropic' | 'openai' | 'deepseek' | 'gemini';
const VALID_PROVIDERS: LlmProvider[] = ['anthropic', 'openai', 'deepseek', 'gemini'];

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);
  private readonly client: AxiosInstance | null = null;
  private readonly apiKey: string;
  private readonly provider: LlmProvider;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>('LLM_SERVICE_URL');
    this.apiKey = this.configService.get<string>('LLM_API_KEY') || '';

    // Validate and set provider
    const configuredProvider = this.configService.get<string>('LLM_PROVIDER') || 'anthropic';
    if (VALID_PROVIDERS.includes(configuredProvider as LlmProvider)) {
      this.provider = configuredProvider as LlmProvider;
    } else {
      this.logger.warn(`Invalid LLM_PROVIDER "${configuredProvider}", using "anthropic"`);
      this.provider = 'anthropic';
    }

    if (baseURL && this.apiKey) {
      this.client = axios.create({
        baseURL,
        timeout: 60000, // 60 seconds
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
      });
      this.logger.log(`LLM client initialized: ${baseURL} (provider: ${this.provider})`);
    } else {
      this.logger.warn('LLM service not configured - scoring will be disabled');
    }
  }

  /**
   * Check if LLM service is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Process content with LLM
   */
  async process(request: LlmProcessRequest): Promise<LlmProcessResponse> {
    if (!this.client) {
      throw new Error('LLM service not configured');
    }

    const correlationId = `sre-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

    try {
      const response = await this.client.post<LlmProcessResponse>('/llm/process', request, {
        headers: {
          'x-correlation-id': correlationId,
        },
      });

      return response.data;
    } catch (error) {
      const err = error as any;
      this.logger.error(`LLM request failed: ${err.message}`);

      if (err.response) {
        throw new Error(`LLM API error: ${err.response.status} - ${err.response.statusText}`);
      }

      throw error;
    }
  }

  /**
   * Score a social post for quality and AI likelihood
   */
  async scorePost(text: string, authorUsername: string): Promise<ScoringResult> {
    const response = await this.process({
      content: text,
      templateName: 'scoring/quality-score',
      variables: {
        AUTHOR_USERNAME: authorUsername,
      },
      provider: this.provider,
      parserName: 'json',
      source: 'social-reward-engine',
    });

    if (!response.success || response.data.parseError) {
      this.logger.warn(`Scoring failed: ${response.data.parseError || 'Unknown error'}`);

      // Return default scores on error
      return {
        qualityScore: 0,
        aiLikelihood: 100,
        spamScore: 100,
        reasoning: response.data.parseError || 'Scoring failed',
      };
    }

    const parsed = response.data.parsed as RawScoringResult;

    return {
      qualityScore: parsed.qualityScore ?? parsed.quality_score ?? 0,
      aiLikelihood: parsed.aiLikelihood ?? parsed.ai_likelihood ?? 0,
      spamScore: parsed.spamScore ?? parsed.spam_score ?? 0,
      reasoning: parsed.reasoning,
    };
  }

  /**
   * Health check for LLM service
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const response = await this.client.get('/llm/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

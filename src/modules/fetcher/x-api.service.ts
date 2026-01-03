import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// X API Response Types
export interface XApiTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  in_reply_to_user_id?: string;
  edit_history_tweet_ids?: string[];
}

export interface XApiUser {
  id: string;
  username: string;
  name: string;
  verified_type?: string;
}

export interface XApiMeta {
  newest_id?: string;
  oldest_id?: string;
  result_count: number;
  next_token?: string;
}

export interface XApiMentionsResponse {
  data?: XApiTweet[];
  includes?: {
    users: XApiUser[];
  };
  meta: XApiMeta;
}

export interface FetchMentionsParams {
  userId: string;
  maxResults?: number;
  sinceId?: string;
  paginationToken?: string;
}

// Custom Errors
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class XApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'XApiError';
  }
}

@Injectable()
export class XApiService {
  private readonly logger = new Logger(XApiService.name);
  private readonly baseUrl = 'https://api.x.com/2';
  private readonly bearerToken: string;

  constructor(private readonly configService: ConfigService) {
    this.bearerToken = this.configService.get<string>('X_API_BEARER_TOKEN') || '';

    if (!this.bearerToken) {
      this.logger.warn('X_API_BEARER_TOKEN not configured - fetcher will be disabled');
    }
  }

  /**
   * Check if X API is configured
   */
  isConfigured(): boolean {
    return !!this.bearerToken;
  }

  /**
   * Fetch mentions for a user
   * Rate limit: 10 requests per 15 minutes
   */
  async fetchMentions(params: FetchMentionsParams): Promise<XApiMentionsResponse> {
    const { userId, maxResults = 100, sinceId, paginationToken } = params;

    // Build URL with query parameters
    const queryParams = new URLSearchParams({
      max_results: String(Math.min(maxResults, 100)),
      'tweet.fields': 'created_at,in_reply_to_user_id',
      expansions: 'author_id',
      'user.fields': 'verified_type',
    });

    if (sinceId) {
      queryParams.append('since_id', sinceId);
    }

    if (paginationToken) {
      queryParams.append('pagination_token', paginationToken);
    }

    const url = `${this.baseUrl}/users/${userId}/mentions?${queryParams.toString()}`;

    this.logger.debug(`Fetching mentions: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();

      if (response.status === 429) {
        this.logger.warn('X API rate limit exceeded (429)');
        throw new RateLimitError('X API rate limit exceeded. Wait 15 minutes before retrying.');
      }

      this.logger.error(`X API error: ${response.status} - ${body}`);
      throw new XApiError(response.status, `X API error: ${response.status}`);
    }

    const data = (await response.json()) as XApiMentionsResponse;

    this.logger.debug(`Fetched ${data.meta?.result_count || 0} mentions`);

    return data;
  }

  /**
   * Fetch mentions with pagination support (generator)
   */
  async *fetchMentionsWithPagination(
    params: FetchMentionsParams,
  ): AsyncGenerator<XApiMentionsResponse> {
    let nextToken: string | undefined = params.paginationToken;

    do {
      const response = await this.fetchMentions({
        ...params,
        paginationToken: nextToken,
      });

      yield response;

      nextToken = response.meta?.next_token;
    } while (nextToken);
  }
}

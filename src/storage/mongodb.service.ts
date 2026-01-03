import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

export interface SocialPost {
  _id?: ObjectId;
  tweetId: string;
  text: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorWallet?: string;
  publishedAt: Date;
  crawledAt: Date;
  // Scoring
  qualityScore?: number;
  aiLikelihood?: number;
  spamScore?: number;
  scoredAt?: Date;
  // Payout
  payoutStatus?: 'pending' | 'queued' | 'paid' | 'failed' | 'ineligible';
  payoutAmount?: number;
  payoutTxHash?: string;
  payoutReason?: string;
  paidAt?: Date;
  scoringError?: string;
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutRecord {
  _id?: ObjectId;
  tweetId: string;
  recipientAddress: string;
  amount: number;
  token: string;
  network: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MongoDBService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoDBService.name);
  private client: MongoClient;
  private db: Db;

  // Collections
  private _posts: Collection<SocialPost>;
  private _payouts: Collection<PayoutRecord>;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const uri = this.configService.get<string>('MONGODB_URI');
    if (!uri) {
      throw new Error('MONGODB_URI is required');
    }

    try {
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db('social_reward_engine');

      // Initialize collections
      this._posts = this.db.collection<SocialPost>('posts');
      this._payouts = this.db.collection<PayoutRecord>('payouts');

      // Create indexes
      await this.createIndexes();

      this.logger.log('MongoDB connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
      this.logger.log('MongoDB connection closed');
    }
  }

  private async createIndexes() {
    // Posts indexes
    await this._posts.createIndex({ tweetId: 1 }, { unique: true });
    await this._posts.createIndex({ authorId: 1 });
    await this._posts.createIndex({ crawledAt: -1 });
    await this._posts.createIndex({ scoredAt: 1 });
    await this._posts.createIndex({ payoutStatus: 1 });

    // Payouts indexes
    await this._payouts.createIndex({ tweetId: 1 });
    await this._payouts.createIndex({ status: 1 });
    await this._payouts.createIndex({ createdAt: -1 });

    this.logger.log('MongoDB indexes created');
  }

  get posts(): Collection<SocialPost> {
    return this._posts;
  }

  get payouts(): Collection<PayoutRecord> {
    return this._payouts;
  }

  get database(): Db {
    return this.db;
  }
}

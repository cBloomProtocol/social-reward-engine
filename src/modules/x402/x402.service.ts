import { Injectable, Logger } from '@nestjs/common';
import { MongoDBService } from '../../storage/mongodb.service';
import { ObjectId, Collection } from 'mongodb';

export interface UserWallet {
  _id?: ObjectId;
  twitterId: string;
  walletAddress: string;
  network: 'base' | 'solana';
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletInfo {
  walletAddress: string;
  network: string;
}

@Injectable()
export class X402Service {
  private readonly logger = new Logger(X402Service.name);
  private wallets: Collection<UserWallet>;

  constructor(private readonly mongoService: MongoDBService) {
    // Initialize collection after MongoDB connects
    this.initializeCollection();
  }

  private async initializeCollection() {
    // Wait a bit for MongoDB to connect
    setTimeout(async () => {
      try {
        this.wallets = this.mongoService.database.collection<UserWallet>('user_wallets');

        // Create indexes
        await this.wallets.createIndex({ twitterId: 1, network: 1 }, { unique: true });
        await this.wallets.createIndex({ walletAddress: 1 });

        this.logger.log('User wallets collection initialized');
      } catch (error) {
        this.logger.error('Failed to initialize wallets collection:', error);
      }
    }, 1000);
  }

  private getCollection(): Collection<UserWallet> {
    if (!this.wallets) {
      this.wallets = this.mongoService.database.collection<UserWallet>('user_wallets');
    }
    return this.wallets;
  }

  /**
   * Get user wallet for a specific network
   */
  async getUserWallet(
    twitterId: string,
    network: 'base' | 'solana' = 'base',
  ): Promise<WalletInfo | null> {
    const collection = this.getCollection();

    const wallet = await collection.findOne({
      twitterId,
      network,
    });

    if (!wallet) {
      return null;
    }

    return {
      walletAddress: wallet.walletAddress,
      network: wallet.network,
    };
  }

  /**
   * Set user wallet for a network
   */
  async setUserWallet(
    twitterId: string,
    walletAddress: string,
    network: 'base' | 'solana',
  ): Promise<UserWallet> {
    const collection = this.getCollection();
    const now = new Date();

    // Upsert wallet
    const result = await collection.findOneAndUpdate(
      { twitterId, network },
      {
        $set: {
          walletAddress,
          updatedAt: now,
        },
        $setOnInsert: {
          twitterId,
          network,
          isPrimary: true,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    this.logger.log(`Wallet set for user ${twitterId} on ${network}: ${walletAddress}`);

    // Also update posts with this author's wallet
    await this.updatePostsWithWallet(twitterId, walletAddress);

    return result!;
  }

  /**
   * Get all wallets for a user
   */
  async getAllUserWallets(twitterId: string): Promise<UserWallet[]> {
    const collection = this.getCollection();

    const wallets = await collection.find({ twitterId }).toArray();

    return wallets;
  }

  /**
   * Update posts with author's wallet address
   */
  private async updatePostsWithWallet(twitterId: string, walletAddress: string): Promise<void> {
    try {
      const result = await this.mongoService.posts.updateMany(
        { authorId: twitterId, authorWallet: { $exists: false } },
        { $set: { authorWallet: walletAddress, updatedAt: new Date() } },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`Updated ${result.modifiedCount} posts with wallet for user ${twitterId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update posts with wallet: ${error}`);
    }
  }

  /**
   * Check if user has wallet for network
   */
  async hasWallet(twitterId: string, network: 'base' | 'solana' = 'base'): Promise<boolean> {
    const wallet = await this.getUserWallet(twitterId, network);
    return wallet !== null;
  }
}

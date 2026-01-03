import { Controller, Get, Post, Param, Body, Query, HttpStatus, HttpException } from '@nestjs/common';
import { X402Service } from './x402.service';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class SetWalletDto {
  @IsString()
  walletAddress: string;

  @IsString()
  @IsIn(['base', 'solana'])
  network: 'base' | 'solana';

  @IsString()
  @IsOptional()
  signature?: string; // Optional signature for verification
}

@Controller('x402')
export class X402Controller {
  constructor(private readonly x402Service: X402Service) {}

  /**
   * Get user wallet by Twitter ID
   * Used by Worker to lookup recipient address
   *
   * GET /x402/user/:twitterId/wallet?network=base
   */
  @Get('user/:twitterId/wallet')
  async getUserWallet(
    @Param('twitterId') twitterId: string,
    @Query('network') network?: string,
  ) {
    const wallet = await this.x402Service.getUserWallet(
      twitterId,
      (network as 'base' | 'solana') || 'base',
    );

    if (!wallet) {
      throw new HttpException(
        { success: false, error: 'Wallet not found for user' },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      data: wallet,
    };
  }

  /**
   * Set user wallet (called from Claim UI after Crossmint login)
   *
   * POST /x402/user/:twitterId/wallet
   */
  @Post('user/:twitterId/wallet')
  async setUserWallet(
    @Param('twitterId') twitterId: string,
    @Body() dto: SetWalletDto,
  ) {
    // TODO: Add authentication/verification
    // In production, verify the request comes from authenticated user

    const result = await this.x402Service.setUserWallet(
      twitterId,
      dto.walletAddress,
      dto.network,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get all wallets for a user
   *
   * GET /x402/user/:twitterId/wallets
   */
  @Get('user/:twitterId/wallets')
  async getUserWallets(@Param('twitterId') twitterId: string) {
    const wallets = await this.x402Service.getAllUserWallets(twitterId);

    return {
      success: true,
      data: wallets,
    };
  }
}

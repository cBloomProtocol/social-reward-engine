import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { createWalletClient, http, parseUnits, type WalletClient, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

// CDP Facilitator addresses
const CDP_FACILITATOR_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Get from CDP docs
const CDP_FACILITATOR_TESTNET = '0x0000000000000000000000000000000000000000';

// USDC addresses
const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export interface PaymentRequest {
  twitterId: string; // Worker will lookup wallet
  amount: number;
  token?: string;
  network?: 'base' | 'solana';
  metadata?: Record<string, unknown>;
}

export interface PaymentResponse {
  success: boolean;
  txHash?: string;
  error?: string;
  network?: string;
  amount?: number;
  twitterId?: string;
}

export interface X402PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: {
      token: string;
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
      needApprove: boolean;
    };
  };
}

@Injectable()
export class X402ClientService {
  private readonly logger = new Logger(X402ClientService.name);
  private readonly workerClient: AxiosInstance | null = null;
  private readonly evmWalletClient: WalletClient | null = null;
  private readonly evmAccount: ReturnType<typeof privateKeyToAccount> | null = null;
  private readonly network: 'base' | 'solana';
  private readonly isTestnet: boolean;
  private readonly chain: Chain;
  private readonly usdcAddress: `0x${string}`;
  private readonly facilitatorAddress: `0x${string}`;

  constructor(private readonly configService: ConfigService) {
    const workerUrl = this.configService.get<string>('X402_WORKER_URL');
    this.network = (this.configService.get<string>('X402_NETWORK') as 'base' | 'solana') || 'base';
    this.isTestnet = this.configService.get<string>('NODE_ENV') !== 'production';

    // Set chain config
    this.chain = this.isTestnet ? baseSepolia : base;
    this.usdcAddress = this.isTestnet ? USDC_BASE_SEPOLIA : USDC_BASE_MAINNET;
    this.facilitatorAddress = this.isTestnet ? CDP_FACILITATOR_TESTNET : CDP_FACILITATOR_ADDRESS;

    // Initialize Worker client
    if (workerUrl) {
      this.workerClient = axios.create({
        baseURL: workerUrl,
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' },
      });
      this.logger.log(`X402 Worker client initialized: ${workerUrl}`);
    } else {
      this.logger.warn('X402_WORKER_URL not configured - payouts disabled');
    }

    // Initialize EVM wallet (Base)
    const evmPrivateKey = this.configService.get<string>('X402_EVM_PRIVATE_KEY');
    if (evmPrivateKey && this.network === 'base') {
      try {
        const formattedKey = evmPrivateKey.startsWith('0x')
          ? (evmPrivateKey as `0x${string}`)
          : (`0x${evmPrivateKey}` as `0x${string}`);

        this.evmAccount = privateKeyToAccount(formattedKey);
        this.evmWalletClient = createWalletClient({
          account: this.evmAccount,
          chain: this.chain,
          transport: http(),
        });

        this.logger.log(`EVM wallet initialized: ${this.evmAccount.address} on ${this.chain.name}`);
      } catch (error) {
        this.logger.error('Failed to initialize EVM wallet:', error);
      }
    }

    // TODO: Initialize Solana wallet when needed
  }

  /**
   * Check if X402 is properly configured
   */
  isConfigured(): boolean {
    if (!this.workerClient) return false;

    if (this.network === 'base') {
      return this.evmWalletClient !== null;
    }

    // Solana not yet implemented
    return false;
  }

  /**
   * Get current network
   */
  getNetwork(): string {
    return this.network;
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string | null {
    if (this.network === 'base' && this.evmAccount) {
      return this.evmAccount.address;
    }
    return null;
  }

  /**
   * Send payment via X402 Worker
   */
  async sendPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.workerClient) {
      return { success: false, error: 'X402 Worker not configured' };
    }

    const { twitterId, amount, network = this.network } = request;

    if (network === 'base') {
      return this.sendEvmPayment(twitterId, amount);
    } else if (network === 'solana') {
      return this.sendSolanaPayment(twitterId, amount);
    }

    return { success: false, error: `Unsupported network: ${network}` };
  }

  /**
   * Send EVM payment (Base)
   */
  private async sendEvmPayment(twitterId: string, amount: number): Promise<PaymentResponse> {
    if (!this.evmWalletClient || !this.evmAccount) {
      return { success: false, error: 'EVM wallet not configured' };
    }

    try {
      // Create payment payload with EIP-712 signature
      const paymentPayload = await this.createEvmPaymentPayload(amount);

      if (!paymentPayload) {
        return { success: false, error: 'Failed to create payment payload' };
      }

      // Encode payload as base64
      const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

      // Call Worker
      this.logger.debug(`Sending payment to Worker for ${twitterId}: ${amount} USDC`);

      const response = await this.workerClient!.post(
        `/reward/${twitterId}`,
        { amount },
        {
          headers: { 'X-PAYMENT': xPaymentHeader },
        },
      );

      // Parse response
      if (response.data?.success) {
        return {
          success: true,
          txHash: response.data.txHash,
          network: 'base',
          amount,
          twitterId,
        };
      }

      // Check X-PAYMENT-RESPONSE header
      const paymentResponseHeader = response.headers['x-payment-response'];
      if (paymentResponseHeader) {
        const decoded = JSON.parse(Buffer.from(paymentResponseHeader, 'base64').toString());
        return {
          success: true,
          txHash: decoded.transaction,
          network: decoded.network,
          amount,
          twitterId,
        };
      }

      return {
        success: false,
        error: response.data?.error || 'Unknown error from Worker',
        twitterId,
      };
    } catch (error: unknown) {
      const err = error as Error & { response?: { data?: { error?: string } } };
      this.logger.error(`EVM payment failed: ${err.message}`);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        network: 'base',
        twitterId,
      };
    }
  }

  /**
   * Create EVM payment payload with EIP-712 signature
   */
  private async createEvmPaymentPayload(amount: number): Promise<X402PaymentPayload | null> {
    if (!this.evmWalletClient || !this.evmAccount) {
      return null;
    }

    try {
      // Convert amount to USDC units (6 decimals)
      const value = parseUnits(amount.toString(), 6);

      // Create authorization params
      const validAfter = BigInt(0);
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour validity
      const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;

      // EIP-712 typed data for CDP Facilitator
      const domain = {
        name: 'Facilitator',
        version: '1',
        chainId: this.chain.id,
        verifyingContract: this.facilitatorAddress,
      };

      const types = {
        TokenTransferWithAuthorization: [
          { name: 'token', type: 'address' },
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
          { name: 'needApprove', type: 'bool' },
        ],
      };

      const message = {
        token: this.usdcAddress,
        from: this.evmAccount.address,
        to: this.facilitatorAddress, // Will be replaced by Worker with actual recipient
        value,
        validAfter,
        validBefore,
        nonce: nonce as `0x${string}`,
        needApprove: true, // CDP handles approval
      };

      // Sign the typed data
      const signature = await this.evmWalletClient.signTypedData({
        account: this.evmAccount,
        domain,
        types,
        primaryType: 'TokenTransferWithAuthorization',
        message,
      });

      return {
        x402Version: 1,
        scheme: 'exact',
        network: this.isTestnet ? 'base-sepolia' : 'base',
        payload: {
          signature,
          authorization: {
            token: this.usdcAddress,
            from: this.evmAccount.address,
            to: this.facilitatorAddress,
            value: value.toString(),
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
            needApprove: true,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to create EVM payment payload:', error);
      return null;
    }
  }

  /**
   * Send Solana payment (placeholder)
   */
  private async sendSolanaPayment(twitterId: string, amount: number): Promise<PaymentResponse> {
    // TODO: Implement Solana payment
    // Will need: @solana/web3.js, @solana/spl-token
    this.logger.warn('Solana payments not yet implemented');
    return {
      success: false,
      error: 'Solana payments not yet implemented',
      network: 'solana',
      twitterId,
      amount,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; network: string; wallet?: string }> {
    const result = {
      healthy: false,
      network: this.network,
      wallet: this.getWalletAddress() || undefined,
    };

    if (!this.workerClient) {
      return result;
    }

    try {
      await this.workerClient.get('/health');
      result.healthy = true;
    } catch {
      // Worker might not have /health endpoint
      result.healthy = this.isConfigured();
    }

    return result;
  }
}

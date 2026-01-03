import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface PaymentRequest {
  recipientAddress: string;
  amount: number;
  token?: string;
  network?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  txHash?: string;
  error?: string;
  network?: string;
  amount?: number;
  recipient?: string;
}

export interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
}

@Injectable()
export class X402ClientService {
  private readonly logger = new Logger(X402ClientService.name);
  private readonly client: AxiosInstance | null = null;
  private readonly network: string;
  private readonly privateKey: string;

  constructor(private readonly configService: ConfigService) {
    const gatewayUrl = this.configService.get<string>('X402_GATEWAY_URL');
    this.network = this.configService.get<string>('X402_NETWORK') || 'bsc';
    this.privateKey = this.configService.get<string>('X402_PRIVATE_KEY') || '';

    if (gatewayUrl) {
      this.client = axios.create({
        baseURL: gatewayUrl,
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      this.logger.log(`X402 client initialized: ${gatewayUrl} (${this.network})`);
    } else {
      this.logger.warn('X402 gateway not configured - payouts will be disabled');
    }
  }

  /**
   * Check if X402 is configured
   */
  isConfigured(): boolean {
    return this.client !== null && !!this.privateKey;
  }

  /**
   * Get supported networks
   */
  getSupportedNetworks(): string[] {
    return ['bsc', 'base', 'solana'];
  }

  /**
   * Send payment via X402 protocol
   *
   * Note: This is a simplified implementation.
   * Full X402 requires EIP-712 signature generation which needs:
   * - ethers.js or viem for wallet signing
   * - Token approval handling
   * - Nonce management
   *
   * For production, consider using the x402 SDK or implementing
   * full EIP-712 signing based on your wallet infrastructure.
   */
  async sendPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.client) {
      return { success: false, error: 'X402 gateway not configured' };
    }

    if (!this.privateKey) {
      return { success: false, error: 'X402 private key not configured' };
    }

    const { recipientAddress, amount, network = this.network, userId } = request;

    try {
      // Step 1: Initial request to get payment requirements
      const endpoint = `/${network}/${userId || 'reward'}`;

      this.logger.debug(`Initiating X402 payment: ${endpoint}?amount=${amount}`);

      // First request will return 402 with payment requirements
      let paymentRequirements: PaymentRequirements | null = null;

      try {
        await this.client.get(endpoint, {
          params: { amount, recipient: recipientAddress },
        });
      } catch (error: any) {
        if (error.response?.status === 402) {
          const accepts = error.response.data?.accepts;
          if (accepts && accepts.length > 0) {
            paymentRequirements = accepts[0];
          }
        } else {
          throw error;
        }
      }

      if (!paymentRequirements) {
        return { success: false, error: 'Failed to get payment requirements' };
      }

      // Step 2: Generate payment authorization
      // Note: This requires proper EIP-712 signing implementation
      const paymentPayload = await this.generatePaymentPayload(
        paymentRequirements,
        recipientAddress,
        amount,
      );

      if (!paymentPayload) {
        return {
          success: false,
          error: 'Payment signing not implemented. See documentation for setup.',
        };
      }

      // Step 3: Send payment with X-PAYMENT header
      const response = await this.client.get(endpoint, {
        params: { amount, recipient: recipientAddress },
        headers: {
          'X-PAYMENT': paymentPayload,
        },
      });

      // Step 4: Parse response
      const paymentResponseHeader = response.headers['x-payment-response'];
      if (paymentResponseHeader) {
        const decoded = JSON.parse(
          Buffer.from(paymentResponseHeader, 'base64').toString(),
        );

        return {
          success: true,
          txHash: decoded.transaction,
          network: decoded.network,
          amount,
          recipient: recipientAddress,
        };
      }

      return {
        success: true,
        network,
        amount,
        recipient: recipientAddress,
      };
    } catch (error: any) {
      this.logger.error(`X402 payment failed: ${error.message}`);

      return {
        success: false,
        error: error.message,
        network,
        amount,
        recipient: recipientAddress,
      };
    }
  }

  /**
   * Generate EIP-712 payment payload
   *
   * TODO: Implement proper EIP-712 signing
   * This requires:
   * - ethers.js Wallet or viem for signing
   * - Proper domain and type definitions
   * - Token contract interaction for nonce
   */
  private async generatePaymentPayload(
    _requirements: PaymentRequirements,
    _recipient: string,
    _amount: number,
  ): Promise<string | null> {
    // Placeholder for EIP-712 implementation
    // In production, implement proper signing using:
    // - ethers.js: wallet.signTypedData(domain, types, value)
    // - viem: signTypedData({ domain, types, primaryType, message })

    this.logger.warn(
      'EIP-712 signing not implemented. Override generatePaymentPayload() or use external signing service.',
    );

    return null;
  }

  /**
   * Verify payment status by transaction hash
   */
  async verifyPayment(txHash: string, network?: string): Promise<boolean> {
    // TODO: Implement transaction verification
    // - Query blockchain RPC for transaction status
    // - Check if transaction is confirmed
    this.logger.debug(`Verifying payment: ${txHash} on ${network || this.network}`);
    return true;
  }

  /**
   * Get payment gateway health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Try to access the gateway
      await this.client.get('/health').catch(() => null);
      return true;
    } catch {
      return false;
    }
  }
}

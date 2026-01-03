/**
 * Social Reward Worker
 *
 * Handles X402 payment settlement via CDP (Coinbase Developer Platform).
 * Based on bp-x402-cdp implementation.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { getAddress } from 'viem';

// Buffer polyfill for Cloudflare Workers
if (typeof globalThis.Buffer === 'undefined') {
  // Helper to wrap Uint8Array with Buffer-like methods
  const wrapBuffer = (bytes: Uint8Array): any => {
    const wrapped = Object.assign(bytes, {
      toString: (enc?: string) => {
        if (enc === 'base64') {
          return btoa(String.fromCharCode(...bytes));
        }
        if (enc === 'base64url') {
          // base64url: replace + with -, replace / with _, strip padding =
          const base64 = btoa(String.fromCharCode(...bytes));
          return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
        if (enc === 'hex') {
          return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        return new TextDecoder().decode(bytes);
      },
      // Override subarray to return wrapped Buffer
      subarray: (start?: number, end?: number) => {
        return wrapBuffer(Uint8Array.prototype.subarray.call(bytes, start, end));
      },
    });
    return wrapped;
  };

  (globalThis as any).Buffer = {
    from: (data: string, encoding?: string) => {
      let bytes: Uint8Array;
      if (encoding === 'base64') {
        const binaryString = atob(data);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } else if (encoding === 'hex') {
        const cleanHex = data.startsWith('0x') ? data.slice(2) : data;
        const paddedHex = cleanHex.length % 2 ? '0' + cleanHex : cleanHex;
        bytes = new Uint8Array(paddedHex.length / 2);
        for (let i = 0; i < paddedHex.length; i += 2) {
          bytes[i / 2] = parseInt(paddedHex.substr(i, 2), 16);
        }
      } else {
        const encoder = new TextEncoder();
        bytes = encoder.encode(data);
      }
      return wrapBuffer(bytes);
    },
    alloc: (size: number) => wrapBuffer(new Uint8Array(size)),
    isBuffer: (obj: any) => obj instanceof Uint8Array,
  } as any;
}

// Environment bindings
interface Env {
  CDP_API_KEY_ID: string;
  CDP_API_KEY_SECRET: string;
  BACKEND_API_URL: string;
  NETWORK: string;
  USDC_ADDRESS?: string;
}

// USDC addresses per network
const USDC_ADDRESSES: Record<string, string> = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('/*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Process reward payment
 * POST /reward/:twitterId
 */
app.post('/reward/:twitterId', async (c) => {
  const twitterId = c.req.param('twitterId');
  const xPaymentHeader = c.req.header('X-PAYMENT');
  const network = c.env.NETWORK || 'base';

  console.log(`[reward] Processing reward for ${twitterId} on ${network}`);

  // Validate X-PAYMENT header
  if (!xPaymentHeader) {
    return c.json({ success: false, error: 'X-PAYMENT header required' }, 400);
  }

  try {
    // Decode payment payload
    const paymentPayload = JSON.parse(
      Buffer.from(xPaymentHeader, 'base64').toString('utf-8')
    );

    console.log(`[reward] Payment payload received`);

    // Get user wallet from backend
    const walletResponse = await fetch(
      `${c.env.BACKEND_API_URL}/x402/user/${twitterId}/wallet?network=${network}`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!walletResponse.ok) {
      const errorText = await walletResponse.text();
      console.log(`[reward] Wallet lookup failed:`, errorText);
      return c.json({ success: false, error: 'User wallet not found' }, 404);
    }

    const walletData = (await walletResponse.json()) as {
      success: boolean;
      data: { walletAddress: string; network: string };
    };
    const userWallet = walletData.data.walletAddress;

    console.log(`[reward] User wallet: ${userWallet}`);

    // Get USDC address for network
    const usdcAddress = c.env.USDC_ADDRESS || USDC_ADDRESSES[network];
    if (!usdcAddress) {
      return c.json({ success: false, error: `Unsupported network: ${network}` }, 400);
    }

    // Create payment requirements
    const paymentRequirements = {
      scheme: 'exact',
      network,
      maxAmountRequired: paymentPayload.payload?.authorization?.value || '0',
      resource: `reward://${twitterId}`,
      description: 'Social reward payment',
      mimeType: 'application/json',
      payTo: getAddress(userWallet),
      maxTimeoutSeconds: 300,
      asset: getAddress(usdcAddress),
      outputSchema: undefined,
      extra: {
        name: 'USD Coin',
        version: '2',
      },
    };

    // Generate JWT for CDP authentication
    console.log(`[reward] Generating CDP JWT...`);
    const jwt = await generateJwt({
      apiKeyId: c.env.CDP_API_KEY_ID,
      apiKeySecret: c.env.CDP_API_KEY_SECRET,
      requestMethod: 'POST',
      requestHost: 'api.cdp.coinbase.com',
      requestPath: '/platform/v2/x402/settle',
    });

    // Call CDP settle endpoint
    console.log(`[reward] Calling CDP settle...`);
    const settleResponse = await fetch(
      'https://api.cdp.coinbase.com/platform/v2/x402/settle',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'Correlation-Context': 'sdk_version=1.38.6,sdk_language=typescript,source=social-reward-worker',
        },
        body: JSON.stringify({
          x402Version: 1,
          paymentPayload,
          paymentRequirements,
        }),
      }
    );

    console.log(`[reward] CDP response status:`, settleResponse.status);

    const settleData = (await settleResponse.json()) as any;
    console.log(`[reward] CDP response:`, JSON.stringify(settleData));

    if (!settleResponse.ok || !settleData.success) {
      return c.json(
        { success: false, error: settleData.error || `CDP error: ${settleResponse.status}` },
        500
      );
    }

    // Log to backend
    await logPaymentToBackend(c.env, {
      twitterId,
      userWallet,
      txHash: settleData.transaction,
      amount: paymentPayload.payload?.authorization?.value || '0',
      network,
    });

    return c.json({
      success: true,
      txHash: settleData.transaction,
      network: settleData.network || network,
    });
  } catch (error: any) {
    console.error(`[reward] Error:`, error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * Log payment to backend
 */
async function logPaymentToBackend(
  env: Env,
  data: {
    twitterId: string;
    userWallet: string;
    txHash: string;
    amount: string;
    network: string;
  }
): Promise<void> {
  try {
    await fetch(`${env.BACKEND_API_URL}/x402/payment-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'reward',
        twitterId: data.twitterId,
        recipientAddress: data.userWallet,
        txHash: data.txHash,
        amount: data.amount,
        network: data.network,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error(`[log] Failed to log payment:`, error);
  }
}

export default app;

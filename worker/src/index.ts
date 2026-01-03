/**
 * Social Reward Worker
 *
 * Handles X402 payment settlement via CDP (Coinbase Developer Platform).
 *
 * Flow:
 * 1. Receive signed payment from Backend
 * 2. Query user wallet address
 * 3. Settle payment via CDP Facilitator
 * 4. Return transaction hash
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Buffer polyfill for Cloudflare Workers
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = {
    from: (data: string, encoding?: string) => {
      let bytes: Uint8Array;
      if (encoding === 'base64') {
        const binaryString = atob(data);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } else {
        const encoder = new TextEncoder();
        bytes = encoder.encode(data);
      }
      return Object.assign(bytes, {
        toString: (enc?: string) => {
          if (enc === 'base64') {
            return btoa(String.fromCharCode(...bytes));
          }
          return new TextDecoder().decode(bytes);
        },
      });
    },
  };
}

// Environment bindings
interface Env {
  CDP_API_KEY_ID: string;
  CDP_API_KEY_SECRET: string;
  BACKEND_API_URL: string;
  NETWORK: string;
  API_KEY?: string;
}

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

  console.log(`[reward] Processing reward for ${twitterId}`);

  // Validate API key if configured
  const apiKey = c.req.header('Authorization')?.replace('Bearer ', '');
  if (c.env.API_KEY && apiKey !== c.env.API_KEY) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  // Validate X-PAYMENT header
  if (!xPaymentHeader) {
    return c.json({ success: false, error: 'X-PAYMENT header required' }, 400);
  }

  try {
    // Decode payment payload
    const paymentPayload = JSON.parse(
      Buffer.from(xPaymentHeader, 'base64').toString('utf-8')
    );

    console.log(`[reward] Payment payload:`, JSON.stringify(paymentPayload));

    // Get user wallet from backend
    const walletResponse = await fetch(
      `${c.env.BACKEND_API_URL}/x402/user/${twitterId}/wallet?network=${c.env.NETWORK}`,
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

    // Settle payment via CDP
    const settleResult = await settleCdpPayment(c.env, paymentPayload, userWallet);

    if (!settleResult.success) {
      return c.json(
        { success: false, error: settleResult.error },
        500
      );
    }

    // Log to backend
    await logPaymentToBackend(c.env, {
      twitterId,
      userWallet,
      txHash: settleResult.txHash,
      amount: paymentPayload.payload?.authorization?.value || '0',
      network: c.env.NETWORK,
    });

    return c.json({
      success: true,
      txHash: settleResult.txHash,
      network: settleResult.network,
    });
  } catch (error: any) {
    console.error(`[reward] Error:`, error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * Settle payment via CDP Facilitator
 */
async function settleCdpPayment(
  env: Env,
  paymentPayload: any,
  recipientWallet: string
): Promise<{ success: boolean; txHash?: string; network?: string; error?: string }> {
  try {
    // Generate JWT for CDP authentication
    const jwt = await generateCdpJwt(env);

    // Create payment requirements for settlement
    const paymentRequirements = {
      scheme: 'exact',
      network: env.NETWORK,
      maxAmountRequired: paymentPayload.payload?.authorization?.value || '0',
      resource: `reward://${recipientWallet}`,
      description: 'Social reward payment',
      mimeType: 'application/json',
      payTo: recipientWallet,
      maxTimeoutSeconds: 60,
      asset: 'USDC',
      outputSchema: null,
      extra: null,
    };

    // Call CDP settle endpoint
    const response = await fetch('https://api.cdp.coinbase.com/platform/v2/x402/settle', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'Correlation-Context': 'sdk_version=1.29.0,sdk_language=typescript,source=social-reward-worker',
      },
      body: JSON.stringify({
        x402Version: 1,
        paymentPayload,
        paymentRequirements,
      }),
    });

    const data = (await response.json()) as any;
    console.log(`[settle] CDP response:`, JSON.stringify(data));

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `CDP error: ${response.status}`,
      };
    }

    return {
      success: true,
      txHash: data.transaction,
      network: data.network || env.NETWORK,
    };
  } catch (error: any) {
    console.error(`[settle] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate JWT for CDP API authentication
 * Based on @coinbase/cdp-sdk/auth
 */
async function generateCdpJwt(env: Env): Promise<string> {
  const header = { alg: 'ES256', kid: env.CDP_API_KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'cdp',
    sub: env.CDP_API_KEY_ID,
    aud: ['cdp_service'],
    nbf: now,
    exp: now + 120,
    uri: 'https://api.cdp.coinbase.com/platform/v2/x402/settle',
  };

  // Encode header and payload
  const encodeBase64Url = (str: string) =>
    btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const headerB64 = encodeBase64Url(JSON.stringify(header));
  const payloadB64 = encodeBase64Url(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;

  // Sign with CDP API key secret (ES256)
  // Note: In production, use proper crypto library
  // For now, this is a placeholder - actual implementation needs webcrypto
  const signature = await signES256(env.CDP_API_KEY_SECRET, message);

  return `${message}.${signature}`;
}

/**
 * Sign message with ES256 (ECDSA P-256)
 */
async function signES256(privateKeyPem: string, message: string): Promise<string> {
  // Import the private key
  const pemContents = privateKeyPem
    .replace('-----BEGIN EC PRIVATE KEY-----', '')
    .replace('-----END EC PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign the message
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data);

  // Convert to base64url
  const signatureArray = new Uint8Array(signature);
  const signatureB64 = btoa(String.fromCharCode(...signatureArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return signatureB64;
}

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

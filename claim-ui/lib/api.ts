const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7200";

export interface PostInfo {
  tweetId: string;
  text: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  qualityScore?: number;
  payoutStatus?: string;
  payoutAmount?: number;
  payoutTxHash?: string;
}

export interface ClaimResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Get post info by tweet ID
 */
export async function getPostInfo(tweetId: string): Promise<PostInfo | null> {
  try {
    const response = await fetch(`${API_URL}/posts/${tweetId}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error("Failed to get post info:", error);
    return null;
  }
}

/**
 * Link wallet to Twitter user
 */
export async function linkWallet(
  twitterId: string,
  walletAddress: string,
  network: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/x402/user/${twitterId}/wallet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, network }),
    });

    const data = await response.json();
    return { success: data.success };
  } catch (error) {
    console.error("Failed to link wallet:", error);
    return { success: false, error: "Failed to link wallet" };
  }
}

/**
 * Trigger claim (payout) for a post
 */
export async function claimReward(tweetId: string): Promise<ClaimResult> {
  try {
    const response = await fetch(`${API_URL}/claim/${tweetId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    return {
      success: data.success,
      txHash: data.txHash,
      error: data.error,
    };
  } catch (error) {
    console.error("Failed to claim reward:", error);
    return { success: false, error: "Failed to claim reward" };
  }
}

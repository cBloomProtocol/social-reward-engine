"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { getPostInfo, linkWallet, claimReward, PostInfo } from "@/lib/api";

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "base";

export default function ClaimPage() {
  const params = useParams();
  const tweetId = params.tweetId as string;

  const { login, logout, user, status: authStatus } = useAuth();
  const { wallet, status: walletStatus } = useWallet();

  const [postInfo, setPostInfo] = useState<PostInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [walletLinked, setWalletLinked] = useState(false);
  const [claimResult, setClaimResult] = useState<{
    success?: boolean;
    txHash?: string;
    error?: string;
  } | null>(null);

  // Load post info
  useEffect(() => {
    async function loadPost() {
      setLoading(true);
      const info = await getPostInfo(tweetId);
      setPostInfo(info);
      setLoading(false);
    }
    if (tweetId) {
      loadPost();
    }
  }, [tweetId]);

  // Link wallet when user logs in and wallet is ready
  useEffect(() => {
    async function linkUserWallet() {
      if (
        authStatus === "logged-in" &&
        walletStatus === "loaded" &&
        wallet?.address &&
        postInfo?.authorId &&
        !walletLinked
      ) {
        const result = await linkWallet(postInfo.authorId, wallet.address, NETWORK);
        if (result.success) {
          setWalletLinked(true);
        }
      }
    }
    linkUserWallet();
  }, [authStatus, walletStatus, wallet?.address, postInfo?.authorId, walletLinked]);

  // Handle claim
  const handleClaim = async () => {
    if (!wallet?.address || !postInfo) return;

    setClaiming(true);
    setClaimResult(null);

    try {
      const result = await claimReward(tweetId);
      setClaimResult(result);
    } catch (error) {
      setClaimResult({ success: false, error: "Failed to claim reward" });
    } finally {
      setClaiming(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </main>
    );
  }

  // Post not found
  if (!postInfo) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Post Not Found</h1>
          <p className="text-gray-400">The tweet ID &quot;{tweetId}&quot; was not found.</p>
        </div>
      </main>
    );
  }

  // Already claimed
  if (postInfo.payoutStatus === "paid" && postInfo.payoutTxHash) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-500">Already Claimed!</h1>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400">Amount</p>
              <p className="text-xl font-bold">{postInfo.payoutAmount} USDC</p>
            </div>

            <a
              href={`https://sepolia.basescan.org/tx/${postInfo.payoutTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-gray-800 hover:bg-gray-700 text-center py-3 rounded-lg transition"
            >
              View Transaction →
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-xl p-6 border border-gray-800">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Claim Your Reward</h1>
          <p className="text-gray-400 text-sm">@{postInfo.authorUsername}</p>
        </div>

        {/* Post Preview */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-300 line-clamp-3">{postInfo.text}</p>
          {postInfo.qualityScore && (
            <p className="text-xs text-gray-500 mt-2">
              Quality Score: {postInfo.qualityScore}
            </p>
          )}
        </div>

        {/* Reward Amount */}
        {postInfo.payoutAmount && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6 text-center">
            <p className="text-sm text-green-400">Reward Amount</p>
            <p className="text-3xl font-bold text-green-500">
              {postInfo.payoutAmount} USDC
            </p>
          </div>
        )}

        {/* Auth & Wallet Status */}
        {authStatus === "logged-out" ? (
          <button
            onClick={login}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
          >
            Sign in with Twitter
          </button>
        ) : walletStatus === "loading" ? (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Creating wallet...</p>
          </div>
        ) : walletStatus === "loaded" && wallet?.address ? (
          <div className="space-y-4">
            {/* Wallet Info */}
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Your Wallet</p>
              <p className="font-mono text-sm truncate">{wallet.address}</p>
              {walletLinked && (
                <p className="text-xs text-green-500 mt-1">✓ Wallet linked</p>
              )}
            </div>

            {/* Claim Button */}
            {claimResult?.success ? (
              <div className="text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-green-500 font-medium mb-2">Reward Claimed!</p>
                {claimResult.txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${claimResult.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline"
                  >
                    View Transaction →
                  </a>
                )}
              </div>
            ) : claimResult?.error ? (
              <div className="text-center">
                <p className="text-red-500 mb-3">{claimResult.error}</p>
                <button
                  onClick={handleClaim}
                  disabled={claiming || !walletLinked}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <button
                onClick={handleClaim}
                disabled={claiming || !walletLinked}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                {claiming ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    Claiming...
                  </>
                ) : !walletLinked ? (
                  "Linking wallet..."
                ) : (
                  "Claim Reward"
                )}
              </button>
            )}

            {/* Logout */}
            <button
              onClick={logout}
              className="w-full text-gray-400 hover:text-white text-sm py-2 transition"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-400">Loading wallet...</p>
          </div>
        )}

        {/* User Info */}
        {user && (
          <p className="text-xs text-gray-500 text-center mt-4">
            Signed in as {user.email || "User"}
          </p>
        )}
      </div>
    </main>
  );
}

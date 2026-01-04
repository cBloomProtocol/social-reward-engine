"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { getPostInfo, linkWallet, claimReward, PostInfo } from "@/lib/api";

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "base";

// Icons
const IconCheck = () => (
  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const IconExternalLink = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const IconTwitter = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const IconWallet = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
  </svg>
);

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
      const twitterId = (user as any)?.twitter?.id;

      if (
        authStatus === "logged-in" &&
        walletStatus === "loaded" &&
        wallet?.address &&
        twitterId &&
        !walletLinked
      ) {
        const result = await linkWallet(twitterId, wallet.address, NETWORK);
        if (result.success) {
          setWalletLinked(true);
        }
      }
    }
    linkUserWallet();
  }, [authStatus, walletStatus, wallet?.address, walletLinked, user]);

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
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-animated">
        <div className="text-center animate-fade-in">
          <div className="spinner mx-auto mb-4" />
          <p className="text-muted text-sm">Loading reward details...</p>
        </div>
      </main>
    );
  }

  // Post not found
  if (!postInfo) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-animated">
        <div className="gradient-card p-8 max-w-md w-full animate-fade-in">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-red-400 mb-2">Post Not Found</h1>
            <p className="text-muted text-sm">
              The tweet ID &quot;{tweetId}&quot; was not found or is not eligible for rewards.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Already claimed
  if (postInfo.payoutStatus === "paid" && postInfo.payoutTxHash) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-animated">
        <div className="gradient-card gradient-card-success glow-green p-8 max-w-md w-full animate-fade-in">
          <div className="text-center mb-6">
            <div className="success-icon mb-4">
              <IconCheck />
            </div>
            <h1 className="text-2xl font-bold text-success">Already Claimed!</h1>
            <p className="text-muted text-sm mt-1">This reward has been successfully claimed</p>
          </div>

          <div className="space-y-4">
            <div className="reward-display">
              <p className="text-muted text-xs uppercase tracking-wider mb-1">Amount Received</p>
              <p className="reward-amount">{postInfo.payoutAmount} USDC</p>
            </div>

            <a
              href={`https://basescan.org/tx/${postInfo.payoutTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              View Transaction <IconExternalLink />
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-animated">
      <div className="gradient-card glow-cyan p-8 max-w-md w-full animate-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1">Claim Your Reward</h1>
          <p className="text-primary font-medium">@{postInfo.authorUsername}</p>
        </div>

        {/* Post Preview */}
        <div className="info-box mb-5">
          <p className="text-sm leading-relaxed line-clamp-3">{postInfo.text}</p>
          {postInfo.qualityScore && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
              <span className="text-xs text-muted">Quality Score:</span>
              <span className="text-xs font-mono-nums text-success font-medium">{postInfo.qualityScore}</span>
            </div>
          )}
        </div>

        {/* Reward Amount */}
        {postInfo.payoutAmount && (
          <div className="reward-display mb-6">
            <p className="text-muted text-xs uppercase tracking-wider mb-1">Your Reward</p>
            <p className="reward-amount">{postInfo.payoutAmount} USDC</p>
          </div>
        )}

        {/* Auth & Wallet Status */}
        {authStatus === "logged-out" ? (
          <button onClick={login} className="btn-primary">
            <IconTwitter />
            Sign in with X
          </button>
        ) : walletStatus === "loading" ? (
          <div className="text-center py-6">
            <div className="spinner mx-auto mb-3" />
            <p className="text-muted text-sm">Creating your wallet...</p>
          </div>
        ) : walletStatus === "loaded" && wallet?.address ? (
          <div className="space-y-4">
            {/* Wallet Info */}
            <div className="info-box">
              <div className="flex items-center gap-2 mb-2">
                <IconWallet />
                <span className="text-xs text-muted uppercase tracking-wider">Your Wallet</span>
              </div>
              <p className="font-mono-nums text-sm truncate">{wallet.address}</p>
              {walletLinked && (
                <p className="text-xs text-success mt-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Wallet linked to your account
                </p>
              )}
            </div>

            {/* Claim Button */}
            {claimResult?.success ? (
              <div className="text-center py-4">
                <div className="success-icon mb-3">
                  <IconCheck />
                </div>
                <p className="text-success font-medium mb-2">Reward Claimed!</p>
                {claimResult.txHash && (
                  <a
                    href={`https://basescan.org/tx/${claimResult.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View Transaction <IconExternalLink />
                  </a>
                )}
              </div>
            ) : claimResult?.error ? (
              <div className="text-center">
                <p className="text-red-400 text-sm mb-3">{claimResult.error}</p>
                <button
                  onClick={handleClaim}
                  disabled={claiming || !walletLinked}
                  className="btn-success"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <button
                onClick={handleClaim}
                disabled={claiming || !walletLinked}
                className="btn-success"
              >
                {claiming ? (
                  <>
                    <div className="spinner spinner-small spinner-white" />
                    Claiming...
                  </>
                ) : !walletLinked ? (
                  <>
                    <div className="spinner spinner-small spinner-white" />
                    Linking wallet...
                  </>
                ) : (
                  "Claim Reward"
                )}
              </button>
            )}

            {/* Logout */}
            <button onClick={logout} className="btn-ghost text-sm">
              Sign out
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="spinner mx-auto mb-3" />
            <p className="text-muted text-sm">Connecting wallet...</p>
          </div>
        )}

        {/* User Info */}
        {user && (
          <p className="text-xs text-muted text-center mt-4 pt-4 border-t border-white/5">
            Signed in as {user.email || (user as any)?.twitter?.username || "User"}
          </p>
        )}
      </div>
    </main>
  );
}

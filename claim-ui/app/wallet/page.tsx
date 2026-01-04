"use client";

import { useEffect, useState } from "react";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";

// Icons
const IconWallet = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
  </svg>
);

const IconTwitter = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const IconRefresh = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconCopy = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const IconExternalLink = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const IconSend = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

interface Balances {
  nativeToken?: { amount: string };
  usdc?: { amount: string };
}

interface TransferResult {
  success: boolean;
  explorerLink?: string;
  error?: string;
}

export default function WalletPage() {
  const { login, logout, user, status: authStatus } = useAuth();
  const { wallet, status: walletStatus } = useWallet();

  const [balances, setBalances] = useState<Balances | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Load balances when wallet is ready
  useEffect(() => {
    if (walletStatus === "loaded" && wallet) {
      loadBalances();
    }
  }, [walletStatus, wallet]);

  const loadBalances = async () => {
    if (!wallet) return;
    setLoadingBalances(true);
    try {
      const bal = await wallet.balances();
      setBalances(bal);
    } catch (error) {
      console.error("Failed to load balances:", error);
    } finally {
      setLoadingBalances(false);
    }
  };

  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleSend = async () => {
    if (!wallet || !recipient || !amount) return;
    if (!isValidAddress(recipient)) {
      setTransferResult({ success: false, error: "Invalid recipient address" });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setTransferResult({ success: false, error: "Invalid amount" });
      return;
    }

    setSending(true);
    setTransferResult(null);

    try {
      const tx = await wallet.send(recipient, "usdc", amount);
      setTransferResult({ success: true, explorerLink: tx.explorerLink });
      setRecipient("");
      setAmount("");
      // Refresh balances after successful transfer
      setTimeout(() => loadBalances(), 2000);
    } catch (error: any) {
      setTransferResult({
        success: false,
        error: error?.message || "Transfer failed"
      });
    } finally {
      setSending(false);
    }
  };

  const handleMaxAmount = () => {
    if (balances?.usdc?.amount) {
      setAmount(balances.usdc.amount);
    }
  };

  const copyAddress = async () => {
    if (wallet?.address) {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getOwnerDisplay = () => {
    if (user?.twitter?.username) {
      return `@${user.twitter.username}`;
    }
    if (user?.email) {
      return user.email;
    }
    return "Unknown";
  };

  // Loading state
  if (authStatus === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-animated">
        <div className="text-center animate-fade-in">
          <div className="spinner mx-auto mb-4" />
          <p className="text-muted text-sm">Loading...</p>
        </div>
      </main>
    );
  }

  // Logged out state
  if (authStatus === "logged-out") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-animated">
        <div className="gradient-card glow-cyan p-8 max-w-md w-full animate-fade-in">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 mb-4">
              <IconWallet />
            </div>
            <h1 className="text-2xl font-bold mb-2">Wallet Management</h1>
            <p className="text-muted text-sm">
              Sign in to view your balance and manage your wallet
            </p>
          </div>

          <button onClick={login} className="btn-primary">
            <IconTwitter />
            Sign in with X
          </button>
        </div>
      </main>
    );
  }

  // Wallet loading state
  if (walletStatus === "loading" || walletStatus !== "loaded") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-animated">
        <div className="gradient-card glow-cyan p-8 max-w-md w-full animate-fade-in">
          <div className="text-center">
            <div className="spinner mx-auto mb-4" />
            <p className="text-muted text-sm">Loading your wallet...</p>
          </div>
        </div>
      </main>
    );
  }

  // Main wallet UI
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-animated">
      <div className="gradient-card glow-cyan p-6 max-w-md w-full animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <IconWallet />
            </div>
            <div>
              <h1 className="text-lg font-bold">Your Wallet</h1>
              <p className="text-primary text-sm">{getOwnerDisplay()}</p>
            </div>
          </div>
          <span className="text-xs text-muted bg-muted/30 px-2 py-1 rounded">Base</span>
        </div>

        {/* Balance Section */}
        <div className="info-box mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted uppercase tracking-wider">Balance</span>
            <button
              onClick={loadBalances}
              disabled={loadingBalances}
              className="text-muted hover:text-foreground transition-colors"
            >
              <IconRefresh className={loadingBalances ? "animate-spin" : ""} />
            </button>
          </div>

          {loadingBalances && !balances ? (
            <div className="flex items-center gap-2">
              <div className="spinner spinner-small" />
              <span className="text-sm text-muted">Loading balances...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">USDC</span>
                <span className="text-lg font-bold text-success font-mono-nums">
                  {balances?.usdc?.amount || "0.00"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">ETH</span>
                <span className="text-sm font-mono-nums text-foreground/70">
                  {balances?.nativeToken?.amount || "0.0000"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Transfer Section */}
        <div className="info-box mb-4">
          <h3 className="text-xs text-muted uppercase tracking-wider mb-3">Transfer USDC</h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono-nums placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Amount</label>
              <div className="relative">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 pr-20 text-sm font-mono-nums placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={handleMaxAmount}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary/80 font-medium"
                >
                  MAX
                </button>
              </div>
            </div>

            {transferResult && (
              <div className={`text-sm p-3 rounded-lg ${
                transferResult.success
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}>
                {transferResult.success ? (
                  <div className="flex items-center gap-2">
                    <IconCheck />
                    <span>Transfer successful!</span>
                    {transferResult.explorerLink && (
                      <a
                        href={transferResult.explorerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline ml-auto"
                      >
                        View <IconExternalLink />
                      </a>
                    )}
                  </div>
                ) : (
                  <span>{transferResult.error}</span>
                )}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={sending || !recipient || !amount}
              className="btn-success"
            >
              {sending ? (
                <>
                  <div className="spinner spinner-small spinner-white" />
                  Sending...
                </>
              ) : (
                <>
                  <IconSend />
                  Send USDC
                </>
              )}
            </button>
          </div>
        </div>

        {/* Wallet Details Section */}
        <div className="info-box mb-4">
          <h3 className="text-xs text-muted uppercase tracking-wider mb-3">Wallet Details</h3>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Address</span>
              <div className="flex items-center gap-2">
                <span className="font-mono-nums">{formatAddress(wallet?.address || "")}</span>
                <button
                  onClick={copyAddress}
                  className="text-muted hover:text-foreground transition-colors"
                >
                  {copied ? <IconCheck className="text-success" /> : <IconCopy />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Owner</span>
              <span className="text-primary">{getOwnerDisplay()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Chain</span>
              <span>Base (EVM)</span>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <button onClick={logout} className="btn-ghost text-sm w-full">
          Sign Out
        </button>
      </div>
    </main>
  );
}

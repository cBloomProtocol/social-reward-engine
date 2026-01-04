"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCall } from "@/lib/utils";

interface Post {
  _id: string;
  tweetId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  text: string;
  publishedAt: string;
  qualityScore?: number;
  aiLikelihood?: number;
  spamScore?: number;
  scoredAt?: string;
  payoutStatus?: string;
  payoutAmount?: number;
  payoutTxHash?: string;
}

interface PostsResponse {
  data: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Stats {
  fetcher: {
    total: number;
    pending: number;
    scored: number;
  };
  scorer: {
    total: number;
    scored: number;
    pending: number;
    withErrors: number;
    averages: {
      avgQuality: number;
      avgAiLikelihood: number;
      avgSpam: number;
    };
  };
  payout: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
    totalPaid: number;
    token: string;
  };
}

interface Status {
  fetcher: { status: string; lastSuccessAt?: string } | null;
  scorer: { status: string; lastSuccessAt?: string } | null;
  payout: { status: string; lastSuccessAt?: string } | null;
}

interface ConfigStatus {
  fetcher: { configured: boolean } | null;
  scorer: { configured: boolean } | null;
  payout: { configured: boolean; supportedNetworks?: string[] } | null;
}

interface RewardConfig {
  minQualityScore: number;
  maxAiLikelihood: number;
  baseAmount: number;
  token: string;
  minMultiplier: number;
  updatedAt: string;
}

// Icons as simple SVG components
const IconCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const IconX = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconChevronUp = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const IconChevronDown = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const IconExternalLink = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const IconCopy = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconSettings = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Status indicator component
const StatusIndicator = ({ configured, optional = false }: { configured: boolean; optional?: boolean }) => {
  if (configured) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium badge-success">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Connected
      </span>
    );
  }
  if (optional) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium badge-neutral">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Optional
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium badge-error">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 status-dot status-dot-error" />
      Missing
    </span>
  );
};

// Stat card component
const StatCard = ({
  label,
  value,
  subtext,
  color = "sky",
}: {
  label: string;
  value: string | number;
  subtext?: string;
  color?: "sky" | "emerald" | "amber" | "red";
}) => {
  const colorClasses = {
    sky: "text-sky-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
  };

  return (
    <div className="rounded-lg bg-secondary/50 border border-border/50 p-4 stat-card">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-semibold font-mono ${colorClasses[color]}`}>{value}</div>
      {subtext && <div className="text-xs text-muted-foreground mt-1">{subtext}</div>}
    </div>
  );
};

// Progress bar component
const ProgressBar = ({
  value,
  color = "sky",
}: {
  value: number;
  color?: "sky" | "emerald" | "amber" | "red";
}) => {
  const colorClasses = {
    sky: "bg-sky-500 text-sky-500",
    emerald: "bg-emerald-500 text-emerald-500",
    amber: "bg-amber-500 text-amber-500",
    red: "bg-red-500 text-red-500",
  };

  return (
    <div className="progress-bar">
      <div
        className={`progress-bar-fill ${colorClasses[color]}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [triggering, setTriggering] = useState<Record<string, boolean>>({});
  const [copiedPost, setCopiedPost] = useState<{ tweetId: string; countdown: number } | null>(null);
  const [rewardConfig, setRewardConfig] = useState<RewardConfig | null>(null);
  const [editingConfig, setEditingConfig] = useState<RewardConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'quality' | 'ai'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchPosts = async (page: number = 1, sort: string = sortBy, dir: string = sortDir) => {
    try {
      const response = await apiCall<PostsResponse>(`/fetcher/posts?page=${page}&limit=20&sortBy=${sort}&sortDir=${dir}`);
      setPosts(response.data);
      setPagination({
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
        total: response.pagination.total,
      });
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    }
  };

  const handleSort = (newSort: 'time' | 'quality' | 'ai') => {
    let newDir: 'asc' | 'desc';
    if (sortBy === newSort) {
      newDir = sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      newDir = newSort === 'ai' ? 'asc' : 'desc';
    }
    setSortBy(newSort);
    setSortDir(newDir);
    fetchPosts(1, newSort, newDir);
  };

  const fetchRewardConfig = async () => {
    try {
      const response = await apiCall<{ data: RewardConfig }>("/config/reward");
      setRewardConfig(response.data);
    } catch (error) {
      console.error("Failed to fetch reward config:", error);
    }
  };

  const saveRewardConfig = async () => {
    if (!editingConfig) return;
    setSavingConfig(true);
    try {
      const response = await apiCall<{ data: RewardConfig }>("/config/reward", {
        method: "PUT",
        body: JSON.stringify(editingConfig),
      });
      setRewardConfig(response.data);
      setEditingConfig(null);
    } catch (error) {
      console.error("Failed to save reward config:", error);
    } finally {
      setSavingConfig(false);
    }
  };

  const fetchData = async () => {
    try {
      const [
        fetcherStats, scorerStats, payoutStats,
        fetcherStatus, scorerStatus, payoutStatus,
        fetcherHealth, scorerHealth, payoutHealth
      ] = await Promise.all([
        apiCall<any>("/fetcher/stats"),
        apiCall<any>("/scorer/stats"),
        apiCall<any>("/payout/stats"),
        apiCall<any>("/fetcher/status"),
        apiCall<any>("/scorer/status"),
        apiCall<any>("/payout/status"),
        apiCall<any>("/fetcher/health").catch(() => ({ data: null })),
        apiCall<any>("/scorer/health").catch(() => ({ data: null })),
        apiCall<any>("/payout/health").catch(() => ({ data: null })),
      ]);

      setStats({
        fetcher: fetcherStats.data,
        scorer: scorerStats.data,
        payout: payoutStats.data,
      });

      setStatus({
        fetcher: fetcherStatus.data,
        scorer: scorerStatus.data,
        payout: payoutStatus.data,
      });

      setConfigStatus({
        fetcher: fetcherHealth.data,
        scorer: scorerHealth.data,
        payout: payoutHealth.data,
      });
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchPosts();
    fetchRewardConfig();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerJob = async (job: "fetcher" | "scorer" | "payout") => {
    if (triggering[job]) return;

    setTriggering((prev) => ({ ...prev, [job]: true }));
    try {
      await apiCall(`/${job}/trigger`, { method: "POST" });
      fetchData();
      fetchPosts(pagination.page);
    } catch (error) {
      console.error(`Failed to trigger ${job}:`, error);
    } finally {
      setTriggering((prev) => ({ ...prev, [job]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
          <div className="text-sm text-muted-foreground font-mono">Initializing...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                <span className="text-gradient">Social Reward Engine</span>
              </h1>
              <p className="text-sm text-muted-foreground font-mono mt-0.5">admin dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground font-mono">
                v1.0.0
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Setup Status - Compact Horizontal */}
        <div className="gradient-border p-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
                <IconSettings />
              </div>
              <span className="text-sm font-medium">System Status</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">X/Twitter API</span>
                <StatusIndicator configured={configStatus?.fetcher?.configured ?? false} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">LLM Service</span>
                <StatusIndicator configured={configStatus?.scorer?.configured ?? false} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">X402 Payment</span>
                <StatusIndicator configured={configStatus?.payout?.configured ?? false} optional />
              </div>
            </div>
          </div>
        </div>

        {/* Reward Rules - Full Width */}
        <div className="gradient-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="font-medium">Reward Rules</h2>
            </div>
            {!editingConfig && rewardConfig && (
              <Button
                size="sm"
                variant="ghost"
                className="text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                onClick={() => setEditingConfig({ ...rewardConfig })}
              >
                Edit
              </Button>
            )}
          </div>
            {rewardConfig ? (
              editingConfig ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="minQualityScore" className="text-xs text-muted-foreground">Min Quality Score</Label>
                      <Input
                        id="minQualityScore"
                        type="number"
                        className="mt-1 bg-background/50 border-border/50 font-mono"
                        value={editingConfig.minQualityScore}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            minQualityScore: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxAiLikelihood" className="text-xs text-muted-foreground">Max AI Likelihood (%)</Label>
                      <Input
                        id="maxAiLikelihood"
                        type="number"
                        className="mt-1 bg-background/50 border-border/50 font-mono"
                        value={editingConfig.maxAiLikelihood}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            maxAiLikelihood: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="baseAmount" className="text-xs text-muted-foreground">Base Amount ({editingConfig.token})</Label>
                      <Input
                        id="baseAmount"
                        type="number"
                        step="0.1"
                        className="mt-1 bg-background/50 border-border/50 font-mono"
                        value={editingConfig.baseAmount}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            baseAmount: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="minMultiplier" className="text-xs text-muted-foreground">Min Multiplier (0-1)</Label>
                      <Input
                        id="minMultiplier"
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        className="mt-1 bg-background/50 border-border/50 font-mono"
                        value={editingConfig.minMultiplier}
                        onChange={(e) =>
                          setEditingConfig({
                            ...editingConfig,
                            minMultiplier: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="bg-sky-500 hover:bg-sky-600 text-white btn-glow"
                      onClick={saveRewardConfig}
                      disabled={savingConfig}
                    >
                      {savingConfig ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => setEditingConfig(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Eligibility Gates */}
                  <div>
                    <div className="text-xs text-foreground/80 uppercase tracking-wider mb-3 font-medium">Eligibility Gates</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-foreground font-medium">Min Quality Score</span>
                          <span className="text-xl font-bold font-mono text-emerald-400">{rewardConfig.minQualityScore}</span>
                        </div>
                        <p className="text-sm text-foreground/80">Posts must score at least this quality level to be eligible for rewards</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-foreground font-medium">Max AI Likelihood</span>
                          <span className="text-xl font-bold font-mono text-amber-400">{rewardConfig.maxAiLikelihood}%</span>
                        </div>
                        <p className="text-sm text-foreground/80">Posts detected as AI-generated above this threshold are excluded</p>
                      </div>
                    </div>
                  </div>

                  {/* Reward Calculation */}
                  <div>
                    <div className="text-xs text-foreground/80 uppercase tracking-wider mb-3 font-medium">Reward Calculation</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-foreground font-medium">Base Amount</span>
                          <span className="text-xl font-bold font-mono text-sky-400">{rewardConfig.baseAmount} <span className="text-sm font-normal opacity-70">{rewardConfig.token}</span></span>
                        </div>
                        <p className="text-sm text-foreground/80">Maximum reward for a perfect quality score (100)</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-foreground font-medium">Min Multiplier</span>
                          <span className="text-xl font-bold font-mono text-foreground">{rewardConfig.minMultiplier}</span>
                        </div>
                        <p className="text-sm text-foreground/80">Floor multiplier — rewards scale from {(rewardConfig.baseAmount * rewardConfig.minMultiplier).toFixed(2)} to {rewardConfig.baseAmount} {rewardConfig.token}</p>
                      </div>
                    </div>
                  </div>

                  {/* Formula */}
                  <div className="p-4 rounded-lg bg-sky-500/10 border border-sky-500/30">
                    <div className="text-xs text-sky-300 uppercase tracking-wider mb-2 font-medium">Formula</div>
                    <p className="text-base text-foreground font-mono">
                      Reward = Base Amount × (Min Multiplier + Quality% × (1 - Min Multiplier))
                    </p>
                  </div>

                  {/* Examples - Posts that get rewarded vs not */}
                  <div>
                    <div className="text-xs text-foreground/80 uppercase tracking-wider mb-3 font-medium">Examples</div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {/* Eligible - High Quality */}
                      <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <IconCheck />
                          </span>
                          <span className="text-sm font-medium text-emerald-400">Eligible</span>
                        </div>
                        <div className="space-y-1 text-sm mb-3">
                          <div className="flex justify-between">
                            <span className="text-foreground/70">Quality</span>
                            <span className="font-mono text-foreground">92</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-foreground/70">AI %</span>
                            <span className="font-mono text-foreground">15%</span>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-emerald-500/20 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-foreground/70">Reward</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {(rewardConfig.baseAmount * (rewardConfig.minMultiplier + 0.92 * (1 - rewardConfig.minMultiplier))).toFixed(2)} {rewardConfig.token}
                            </span>
                          </div>
                          <div className="text-xs text-foreground/50 font-mono text-right">
                            = {rewardConfig.baseAmount} × ({rewardConfig.minMultiplier} + 0.92 × {(1 - rewardConfig.minMultiplier).toFixed(1)})
                          </div>
                        </div>
                      </div>

                      {/* Not Eligible - Low Quality */}
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                            <IconX />
                          </span>
                          <span className="text-sm font-medium text-red-400">Not Eligible</span>
                        </div>
                        <div className="space-y-1 text-sm mb-3">
                          <div className="flex justify-between">
                            <span className="text-foreground/70">Quality</span>
                            <span className="font-mono text-red-400">{rewardConfig.minQualityScore - 15}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-foreground/70">AI %</span>
                            <span className="font-mono text-foreground">10%</span>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-red-500/20">
                          <p className="text-sm text-red-400 font-bold">Quality below minimum threshold ({rewardConfig.minQualityScore})</p>
                        </div>
                      </div>

                      {/* Not Eligible - High AI */}
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                            <IconX />
                          </span>
                          <span className="text-sm font-medium text-red-400">Not Eligible</span>
                        </div>
                        <div className="space-y-1 text-sm mb-3">
                          <div className="flex justify-between">
                            <span className="text-foreground/70">Quality</span>
                            <span className="font-mono text-foreground">88</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-foreground/70">AI %</span>
                            <span className="font-mono text-red-400">{rewardConfig.maxAiLikelihood + 25}%</span>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-red-500/20">
                          <p className="text-sm text-red-400 font-bold">AI likelihood exceeds maximum ({rewardConfig.maxAiLikelihood}%)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="text-muted-foreground text-sm">Loading configuration...</div>
            )}
        </div>

        {/* Pipeline Controls */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="gradient-border p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Fetcher</h3>
                <div className="text-4xl font-semibold font-mono text-sky-400">{stats?.fetcher?.total || 0}</div>
                <p className="text-sm text-muted-foreground mt-1">posts collected</p>
              </div>
              <Button
                size="sm"
                className="bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 btn-glow"
                disabled={triggering.fetcher}
                onClick={() => triggerJob("fetcher")}
              >
                {triggering.fetcher ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
                    Fetching...
                  </span>
                ) : (
                  "Trigger Fetch"
                )}
              </Button>
            </div>
          </div>

          <div className="gradient-border p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Scorer</h3>
                <div className="text-4xl font-semibold font-mono text-emerald-400">{stats?.scorer?.scored || 0}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  scored <span className="text-amber-400">({stats?.scorer?.pending || 0} pending)</span>
                </p>
              </div>
              <Button
                size="sm"
                className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                disabled={triggering.scorer}
                onClick={() => triggerJob("scorer")}
              >
                {triggering.scorer ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                    Scoring...
                  </span>
                ) : (
                  "Trigger Score"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Scoring Metrics */}
        <div className="gradient-border p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Scoring Averages</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Quality Score</span>
                <span className="text-lg font-semibold font-mono text-emerald-400">
                  {stats?.scorer?.averages?.avgQuality?.toFixed(1) || 0}
                </span>
              </div>
              <ProgressBar value={stats?.scorer?.averages?.avgQuality || 0} color="emerald" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">AI Likelihood</span>
                <span className="text-lg font-semibold font-mono text-amber-400">
                  {stats?.scorer?.averages?.avgAiLikelihood?.toFixed(1) || 0}
                </span>
              </div>
              <ProgressBar value={stats?.scorer?.averages?.avgAiLikelihood || 0} color="amber" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Spam Score</span>
                <span className="text-lg font-semibold font-mono text-red-400">
                  {stats?.scorer?.averages?.avgSpam?.toFixed(1) || 0}
                </span>
              </div>
              <ProgressBar value={stats?.scorer?.averages?.avgSpam || 0} color="red" />
            </div>
          </div>
        </div>

        {/* Eligible Posts Section */}
        <div className="gradient-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium">Eligible Posts</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Quality &ge; {rewardConfig?.minQualityScore ?? 80}, AI &le; {rewardConfig?.maxAiLikelihood ?? 30}%
              </p>
            </div>
          </div>

          {(() => {
            const minQuality = rewardConfig?.minQualityScore ?? 80;
            const maxAi = rewardConfig?.maxAiLikelihood ?? 30;
            const baseAmount = rewardConfig?.baseAmount ?? 1.0;
            const minMultiplier = rewardConfig?.minMultiplier ?? 0.5;

            const calculateAmount = (qualityScore: number) => {
              const qualityMultiplier = qualityScore / 100;
              return Math.round(baseAmount * (minMultiplier + qualityMultiplier * (1 - minMultiplier)) * 100) / 100;
            };

            const eligiblePosts = posts.filter(
              (p) =>
                p.qualityScore !== undefined &&
                p.qualityScore >= minQuality &&
                (p.aiLikelihood === undefined || p.aiLikelihood <= maxAi)
            );

            const claimStats = {
              total: eligiblePosts.length,
              pending: eligiblePosts.filter((p) => !p.payoutStatus || p.payoutStatus === "pending").length,
              processing: eligiblePosts.filter((p) => p.payoutStatus === "processing").length,
              paid: eligiblePosts.filter((p) => p.payoutStatus === "paid").length,
              failed: eligiblePosts.filter((p) => p.payoutStatus === "failed").length,
              totalPaidAmount: eligiblePosts
                .filter((p) => p.payoutStatus === "paid" && p.payoutAmount)
                .reduce((sum, p) => sum + (p.payoutAmount || 0), 0),
              totalPendingAmount: eligiblePosts
                .filter((p) => !p.payoutStatus || p.payoutStatus === "pending")
                .reduce((sum, p) => sum + calculateAmount(p.qualityScore || 0), 0),
            };

            if (eligiblePosts.length === 0) {
              return (
                <div className="text-center text-muted-foreground py-12 border border-dashed border-border/50 rounded-lg">
                  No eligible posts found
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
                  <StatCard label="Total Eligible" value={claimStats.total} color="sky" />
                  <StatCard label="Pending" value={claimStats.pending} color="amber" />
                  <StatCard label="Paid" value={claimStats.paid} color="emerald" />
                  <StatCard label="Failed" value={claimStats.failed} color="red" />
                  <StatCard label="Total Paid" value={`${claimStats.totalPaidAmount.toFixed(2)}`} subtext="USDC" color="emerald" />
                  <StatCard label="Pending Amt" value={`${claimStats.totalPendingAmount.toFixed(2)}`} subtext="USDC" color="amber" />
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-lg border border-border/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Author</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Quality</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">AI %</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {eligiblePosts.map((post) => (
                        <tr key={post._id} className="table-row-hover">
                          <td className="p-3">
                            <span className="font-mono text-sky-400">@{post.authorUsername}</span>
                          </td>
                          <td className="p-3 font-mono text-emerald-400 font-medium">
                            {post.qualityScore}
                          </td>
                          <td className="p-3 font-mono text-emerald-400">
                            {post.aiLikelihood ?? 0}%
                          </td>
                          <td className="p-3 font-mono">
                            {post.payoutAmount
                              ? `${post.payoutAmount}`
                              : post.qualityScore
                                ? `${calculateAmount(post.qualityScore)}`
                                : "-"}
                            <span className="text-muted-foreground ml-1">USDC</span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              post.payoutStatus === "paid"
                                ? "badge-success"
                                : post.payoutStatus === "processing"
                                ? "badge-warning"
                                : post.payoutStatus === "failed"
                                ? "badge-error"
                                : "badge-neutral"
                            }`}>
                              {post.payoutStatus || "pending"}
                            </span>
                          </td>
                          <td className="p-3">
                            {post.payoutStatus === "paid" && post.payoutTxHash ? (
                              <a
                                href={`https://basescan.org/tx/${post.payoutTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 text-xs"
                              >
                                View Tx <IconExternalLink />
                              </a>
                            ) : (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin.replace(':7201', ':3100')}/claim/${post.tweetId}`
                                  );
                                  setCopiedPost({ tweetId: post.tweetId, countdown: 3 });
                                  let count = 3;
                                  const interval = setInterval(() => {
                                    count--;
                                    if (count > 0) {
                                      setCopiedPost({ tweetId: post.tweetId, countdown: count });
                                    } else {
                                      clearInterval(interval);
                                      window.open(
                                        `https://x.com/${post.authorUsername}/status/${post.tweetId}`,
                                        '_blank'
                                      );
                                      setCopiedPost(null);
                                    }
                                  }, 1000);
                                }}
                                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 text-xs transition-colors"
                              >
                                {copiedPost?.tweetId === post.tweetId ? (
                                  <>
                                    <IconCheck /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <IconCopy /> Copy claim link
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>

        {/* All Posts Section */}
        <div className="gradient-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium">All Fetched Posts</h3>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">{pagination.total} total</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Author</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Text</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th
                    className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('quality')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Quality
                      {sortBy === 'quality' && (sortDir === 'desc' ? <IconChevronDown /> : <IconChevronUp />)}
                    </span>
                  </th>
                  <th
                    className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('ai')}
                  >
                    <span className="inline-flex items-center gap-1">
                      AI %
                      {sortBy === 'ai' && (sortDir === 'asc' ? <IconChevronUp /> : <IconChevronDown />)}
                    </span>
                  </th>
                  <th
                    className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('time')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Date
                      {sortBy === 'time' && (sortDir === 'desc' ? <IconChevronDown /> : <IconChevronUp />)}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {posts.map((post) => (
                  <tr
                    key={post._id}
                    className="table-row-hover cursor-pointer"
                    onClick={() => setSelectedPost(post)}
                  >
                    <td className="p-3">
                      <div className="font-mono text-sky-400">@{post.authorUsername}</div>
                      <div className="text-xs text-muted-foreground">{post.authorName}</div>
                    </td>
                    <td className="p-3 max-w-md">
                      <div className="truncate text-muted-foreground">{post.text}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        post.payoutStatus === "completed"
                          ? "badge-success"
                          : post.payoutStatus === "pending"
                          ? "badge-warning"
                          : "badge-neutral"
                      }`}>
                        {post.payoutStatus || "unscored"}
                      </span>
                    </td>
                    <td className="p-3 font-mono">
                      {post.qualityScore !== undefined ? (
                        <span className={post.qualityScore >= (rewardConfig?.minQualityScore ?? 80) ? "text-emerald-400" : "text-amber-400"}>
                          {post.qualityScore}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 font-mono">
                      {post.aiLikelihood !== undefined ? (
                        <span className={post.aiLikelihood <= (rewardConfig?.maxAiLikelihood ?? 30) ? "text-emerald-400" : "text-red-400"}>
                          {post.aiLikelihood}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">
                      {new Date(post.publishedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {posts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No posts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-3 mt-4 pt-4 border-t border-border/30">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              disabled={pagination.page <= 1}
              onClick={() => fetchPosts(pagination.page - 1, sortBy, sortDir)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground font-mono">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchPosts(pagination.page + 1, sortBy, sortDir)}
            >
              Next
            </Button>
          </div>
        </div>
      </main>

      {/* Post Detail Dialog */}
      <Dialog open={!!selectedPost} onClose={() => setSelectedPost(null)}>
        <DialogHeader>
          <DialogTitle className="text-gradient">Post Details</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {selectedPost && (
            <div className="space-y-5">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Author</div>
                <div className="font-mono text-sky-400">@{selectedPost.authorUsername}</div>
                <div className="text-sm text-muted-foreground">{selectedPost.authorName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Content</div>
                <div className="mt-1 p-4 bg-muted/30 rounded-lg border border-border/50 whitespace-pre-wrap text-sm">
                  {selectedPost.text}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">Quality Score</div>
                  <div className="text-2xl font-semibold font-mono text-emerald-400">
                    {selectedPost.qualityScore !== undefined ? selectedPost.qualityScore : "-"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">AI Likelihood</div>
                  <div className="text-2xl font-semibold font-mono text-amber-400">
                    {selectedPost.aiLikelihood !== undefined ? `${selectedPost.aiLikelihood}%` : "-"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">Spam Score</div>
                  <div className="text-2xl font-semibold font-mono text-red-400">
                    {selectedPost.spamScore !== undefined ? selectedPost.spamScore : "-"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedPost.payoutStatus === "completed"
                      ? "badge-success"
                      : selectedPost.payoutStatus === "pending"
                      ? "badge-warning"
                      : "badge-neutral"
                  }`}>
                    {selectedPost.payoutStatus || "unscored"}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Published</div>
                  <div className="font-mono text-sm">{new Date(selectedPost.publishedAt).toLocaleString()}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tweet ID</div>
                <div className="font-mono text-sm text-muted-foreground">{selectedPost.tweetId}</div>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setSelectedPost(null)}>
            Close
          </Button>
          {selectedPost && (
            <Button
              className="bg-sky-500 hover:bg-sky-600 text-white btn-glow"
              onClick={() =>
                window.open(
                  `https://twitter.com/${selectedPost.authorUsername}/status/${selectedPost.tweetId}`,
                  "_blank"
                )
              }
            >
              <span className="flex items-center gap-2">
                View on X <IconExternalLink />
              </span>
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      {/* Toast notification */}
      {copiedPost && (
        <div className="fixed top-4 right-4 animate-slide-up z-50">
          <div className="bg-emerald-500/10 backdrop-blur-lg border border-emerald-500/30 text-emerald-400 px-6 py-4 rounded-lg shadow-lg glow-success">
            <div className="flex items-center gap-2 font-medium">
              <IconCheck /> Claim link copied!
            </div>
            <div className="mt-1 text-sm opacity-80">Reply to user&apos;s post with the claim link</div>
            <div className="mt-2 text-sm font-mono">Opening X in {copiedPost.countdown}...</div>
          </div>
        </div>
      )}
    </div>
  );
}

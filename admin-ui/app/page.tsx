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

  const fetchPosts = async (page: number = 1, sort: string = sortBy) => {
    try {
      const response = await apiCall<PostsResponse>(`/fetcher/posts?page=${page}&limit=20&sortBy=${sort}`);
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
    setSortBy(newSort);
    fetchPosts(1, newSort);
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
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
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
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Social Reward Engine</h1>
        <p className="text-muted-foreground">Admin Dashboard</p>
      </div>

      {/* Configuration Status */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span>X/Twitter API</span>
            <Badge variant={configStatus?.fetcher?.configured ? "success" : "destructive"}>
              {configStatus?.fetcher?.configured ? "OK" : "Missing"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>LLM Service</span>
            <Badge variant={configStatus?.scorer?.configured ? "success" : "destructive"}>
              {configStatus?.scorer?.configured ? "OK" : "Missing"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>X402 Payment</span>
            <Badge variant={configStatus?.payout?.configured ? "success" : "secondary"}>
              {configStatus?.payout?.configured ? "OK" : "Optional"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Reward Configuration */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Reward Configuration</span>
            {!editingConfig && rewardConfig && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingConfig({ ...rewardConfig })}
              >
                Edit
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rewardConfig ? (
            editingConfig ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minQualityScore">Min Quality Score</Label>
                    <Input
                      id="minQualityScore"
                      type="number"
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
                    <Label htmlFor="maxAiLikelihood">Max AI Likelihood (%)</Label>
                    <Input
                      id="maxAiLikelihood"
                      type="number"
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
                    <Label htmlFor="baseAmount">Base Amount</Label>
                    <Input
                      id="baseAmount"
                      type="number"
                      step="0.1"
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
                    <Label htmlFor="minMultiplier">Min Multiplier</Label>
                    <Input
                      id="minMultiplier"
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
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
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveRewardConfig} disabled={savingConfig}>
                    {savingConfig ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingConfig(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Min Quality</div>
                  <div className="text-lg font-semibold">{rewardConfig.minQualityScore}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Max AI %</div>
                  <div className="text-lg font-semibold">{rewardConfig.maxAiLikelihood}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Base Amount</div>
                  <div className="text-lg font-semibold">{rewardConfig.baseAmount} {rewardConfig.token}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Min Multiplier</div>
                  <div className="text-lg font-semibold">{rewardConfig.minMultiplier}</div>
                </div>
              </div>
            )
          ) : (
            <div className="text-muted-foreground">Loading...</div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Status */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fetcher</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.fetcher?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total posts fetched
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              disabled={triggering.fetcher}
              onClick={() => triggerJob("fetcher")}
            >
              {triggering.fetcher ? "Fetching..." : "Trigger Fetch"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Scorer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.scorer?.scored || 0}</div>
            <p className="text-xs text-muted-foreground">
              Posts scored ({stats?.scorer?.pending || 0} pending)
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              disabled={triggering.scorer}
              onClick={() => triggerJob("scorer")}
            >
              {triggering.scorer ? "Scoring..." : "Trigger Score"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Scoring Averages */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.scorer?.averages?.avgQuality?.toFixed(1) || 0}
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${stats?.scorer?.averages?.avgQuality || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg AI Likelihood</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.scorer?.averages?.avgAiLikelihood?.toFixed(1) || 0}
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div
                className="bg-yellow-500 h-2 rounded-full"
                style={{ width: `${stats?.scorer?.averages?.avgAiLikelihood || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Spam Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.scorer?.averages?.avgSpam?.toFixed(1) || 0}
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{ width: `${stats?.scorer?.averages?.avgSpam || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Eligible Posts - Claim Status */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>
            Eligible Posts
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              (Quality ≥ {rewardConfig?.minQualityScore ?? 80}, AI ≤ {rewardConfig?.maxAiLikelihood ?? 30}%)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const minQuality = rewardConfig?.minQualityScore ?? 80;
            const maxAi = rewardConfig?.maxAiLikelihood ?? 30;
            const baseAmount = rewardConfig?.baseAmount ?? 1.0;
            const minMultiplier = rewardConfig?.minMultiplier ?? 0.5;

            // Calculate reward amount for a post
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
                <div className="text-center text-muted-foreground py-8">
                  No eligible posts found
                </div>
              );
            }

            return (
              <div>
                {/* Claim Stats Summary */}
                <div className="grid gap-4 md:grid-cols-6 mb-6">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Total Eligible</div>
                    <div className="text-xl font-bold">{claimStats.total}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Pending</div>
                    <div className="text-xl font-bold">{claimStats.pending}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Paid</div>
                    <div className="text-xl font-bold text-green-600">{claimStats.paid}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Failed</div>
                    <div className="text-xl font-bold text-red-600">{claimStats.failed}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Total Paid</div>
                    <div className="text-xl font-bold text-green-600">{claimStats.totalPaidAmount.toFixed(2)} USDC</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Pending Amount</div>
                    <div className="text-xl font-bold text-yellow-600">{claimStats.totalPendingAmount.toFixed(2)} USDC</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Author</th>
                      <th className="text-left p-2">Quality</th>
                      <th className="text-left p-2">AI %</th>
                      <th className="text-left p-2">Amount</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Claim Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligiblePosts.map((post) => (
                      <tr key={post._id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <div className="font-medium">@{post.authorUsername}</div>
                        </td>
                        <td className="p-2 text-green-600 font-medium">
                          {post.qualityScore}
                        </td>
                        <td className="p-2 text-green-600">
                          {post.aiLikelihood ?? 0}%
                        </td>
                        <td className="p-2">
                          {post.payoutAmount
                            ? `${post.payoutAmount} USDC`
                            : post.qualityScore
                              ? `${calculateAmount(post.qualityScore)} USDC`
                              : "-"}
                        </td>
                        <td className="p-2">
                          <Badge
                            variant={
                              post.payoutStatus === "paid"
                                ? "success"
                                : post.payoutStatus === "processing"
                                ? "warning"
                                : post.payoutStatus === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {post.payoutStatus || "pending"}
                          </Badge>
                        </td>
                        <td className="p-2">
                          {post.payoutStatus === "paid" && post.payoutTxHash ? (
                            <a
                              href={`https://basescan.org/tx/${post.payoutTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs"
                            >
                              View Tx
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
                              className="text-blue-600 hover:underline text-xs"
                            >
                              {copiedPost?.tweetId === post.tweetId ? "Copied!" : "Send claimable link to user"}
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
        </CardContent>
      </Card>

      {/* Posts List */}
      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fetched Posts ({pagination.total})</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => fetchPosts(pagination.page - 1, sortBy)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchPosts(pagination.page + 1, sortBy)}
            >
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto min-h-[600px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Author</th>
                  <th className="text-left p-2">Text</th>
                  <th className="text-left p-2">Status</th>
                  <th
                    className="text-left p-2 cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('quality')}
                  >
                    Quality {sortBy === 'quality' && '↓'}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('ai')}
                  >
                    AI % {sortBy === 'ai' && '↑'}
                  </th>
                  <th
                    className="text-left p-2 cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('time')}
                  >
                    Date {sortBy === 'time' && '↓'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr
                    key={post._id}
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedPost(post)}
                  >
                    <td className="p-2">
                      <div className="font-medium">@{post.authorUsername}</div>
                      <div className="text-xs text-muted-foreground">{post.authorName}</div>
                    </td>
                    <td className="p-2 max-w-md truncate">{post.text}</td>
                    <td className="p-2">
                      <Badge
                        variant={
                          post.payoutStatus === "completed"
                            ? "success"
                            : post.payoutStatus === "pending"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {post.payoutStatus || "unscored"}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {post.qualityScore !== undefined ? (
                        <span className={post.qualityScore >= (rewardConfig?.minQualityScore ?? 80) ? "text-green-600" : "text-yellow-600"}>
                          {post.qualityScore}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2">
                      {post.aiLikelihood !== undefined ? (
                        <span className={post.aiLikelihood <= (rewardConfig?.maxAiLikelihood ?? 30) ? "text-green-600" : "text-red-600"}>
                          {post.aiLikelihood}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {new Date(post.publishedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {posts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No posts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Post Detail Dialog */}
      <Dialog open={!!selectedPost} onClose={() => setSelectedPost(null)}>
        <DialogHeader>
          <DialogTitle>Post Details</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {selectedPost && (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Author</div>
                <div className="font-medium">@{selectedPost.authorUsername}</div>
                <div className="text-sm text-muted-foreground">{selectedPost.authorName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Content</div>
                <div className="mt-1 p-3 bg-muted rounded-md whitespace-pre-wrap">
                  {selectedPost.text}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Quality Score</div>
                  <div className="text-xl font-bold">
                    {selectedPost.qualityScore !== undefined ? selectedPost.qualityScore : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">AI Likelihood</div>
                  <div className="text-xl font-bold">
                    {selectedPost.aiLikelihood !== undefined ? `${selectedPost.aiLikelihood}%` : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Spam Score</div>
                  <div className="text-xl font-bold">
                    {selectedPost.spamScore !== undefined ? selectedPost.spamScore : "-"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge
                    variant={
                      selectedPost.payoutStatus === "completed"
                        ? "success"
                        : selectedPost.payoutStatus === "pending"
                        ? "warning"
                        : "secondary"
                    }
                  >
                    {selectedPost.payoutStatus || "unscored"}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Published</div>
                  <div>{new Date(selectedPost.publishedAt).toLocaleString()}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Tweet ID</div>
                <div className="font-mono text-sm">{selectedPost.tweetId}</div>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedPost(null)}>
            Close
          </Button>
          {selectedPost && (
            <Button
              onClick={() =>
                window.open(
                  `https://twitter.com/${selectedPost.authorUsername}/status/${selectedPost.tweetId}`,
                  "_blank"
                )
              }
            >
              View on X
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      {/* Toast notification */}
      {copiedPost && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg z-50">
          <div className="font-bold text-lg">Claim link copied!</div>
          <div className="mt-1 text-sm opacity-90">Reply to user's post with the claim link</div>
          <div className="mt-2">Opening X in {copiedPost.countdown}...</div>
        </div>
      )}
    </div>
  );
}

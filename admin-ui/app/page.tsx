"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from "@/components/ui/dialog";
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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [triggering, setTriggering] = useState<Record<string, boolean>>({});

  const fetchPosts = async (page: number = 1) => {
    try {
      const response = await apiCall<PostsResponse>(`/fetcher/posts?page=${page}&limit=20`);
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

      {/* Pipeline Status */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.payout?.totalPaid?.toFixed(2) || 0} {stats?.payout?.token || "USDT"}
            </div>
            <p className="text-xs text-muted-foreground">
              Total paid ({stats?.payout?.completed || 0} transactions)
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              disabled={triggering.payout}
              onClick={() => triggerJob("payout")}
            >
              {triggering.payout ? "Paying out..." : "Trigger Payout"}
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

      {/* Payout Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">Pending</div>
              <div className="text-xl font-bold">{stats?.payout?.pending || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Completed</div>
              <div className="text-xl font-bold text-green-600">
                {stats?.payout?.completed || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Failed</div>
              <div className="text-xl font-bold text-red-600">
                {stats?.payout?.failed || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Transactions</div>
              <div className="text-xl font-bold">{stats?.payout?.total || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eligible Posts - Claim Status */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>
            Eligible Posts
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              (Quality ≥ 80, AI ≤ 30%)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const eligiblePosts = posts.filter(
              (p) =>
                p.scoredAt &&
                p.qualityScore !== undefined &&
                p.qualityScore >= 80 &&
                (p.aiLikelihood === undefined || p.aiLikelihood <= 30)
            );

            if (eligiblePosts.length === 0) {
              return (
                <div className="text-center text-muted-foreground py-8">
                  No eligible posts found
                </div>
              );
            }

            return (
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
                          {post.payoutAmount ? `${post.payoutAmount} USDC` : "-"}
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
                            {post.payoutStatus || "claimable"}
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
                              }}
                              className="text-blue-600 hover:underline text-xs"
                            >
                              Copy Link
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              onClick={() => fetchPosts(pagination.page - 1)}
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
              onClick={() => fetchPosts(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Author</th>
                  <th className="text-left p-2">Text</th>
                  <th className="text-left p-2">Quality</th>
                  <th className="text-left p-2">AI %</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Date</th>
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
                      {post.qualityScore !== undefined ? (
                        <span className={post.qualityScore >= 80 ? "text-green-600" : "text-yellow-600"}>
                          {post.qualityScore}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2">
                      {post.aiLikelihood !== undefined ? (
                        <span className={post.aiLikelihood <= 30 ? "text-green-600" : "text-red-600"}>
                          {post.aiLikelihood}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
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
    </div>
  );
}

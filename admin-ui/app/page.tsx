"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiCall } from "@/lib/utils";

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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [fetcherStats, scorerStats, payoutStats, fetcherStatus, scorerStatus, payoutStatus] =
        await Promise.all([
          apiCall<any>("/fetcher/stats"),
          apiCall<any>("/scorer/stats"),
          apiCall<any>("/payout/stats"),
          apiCall<any>("/fetcher/status"),
          apiCall<any>("/scorer/status"),
          apiCall<any>("/payout/status"),
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
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const triggerJob = async (job: "fetcher" | "scorer" | "payout") => {
    try {
      await apiCall(`/${job}/trigger`, { method: "POST" });
      fetchData();
    } catch (error) {
      console.error(`Failed to trigger ${job}:`, error);
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

      {/* Pipeline Status */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fetcher</CardTitle>
            <Badge variant={status?.fetcher?.status === "idle" ? "success" : "warning"}>
              {status?.fetcher?.status || "unknown"}
            </Badge>
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
              onClick={() => triggerJob("fetcher")}
            >
              Trigger Fetch
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Scorer</CardTitle>
            <Badge variant={status?.scorer?.status === "idle" ? "success" : "warning"}>
              {status?.scorer?.status || "unknown"}
            </Badge>
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
              onClick={() => triggerJob("scorer")}
            >
              Trigger Score
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Payout</CardTitle>
            <Badge variant={status?.payout?.status === "idle" ? "success" : "warning"}>
              {status?.payout?.status || "unknown"}
            </Badge>
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
              onClick={() => triggerJob("payout")}
            >
              Trigger Payout
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
    </div>
  );
}

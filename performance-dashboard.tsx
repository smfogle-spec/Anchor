import { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Database, Zap, Clock, HardDrive, Activity } from "lucide-react";
import { getScheduleCacheMetrics, invalidateScheduleCache } from "@/lib/schedule-cache";
import { getPerformanceReport, clearPerformanceMetrics } from "@/lib/performance-metrics";

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  hitRate: string;
  size: number;
}

interface PerfMetrics {
  totalOperations: number;
  averageDuration: number;
  slowOperations: number;
  operationsByType: Record<string, { count: number; avgDuration: number }>;
}

export default function PerformanceDashboard() {
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics | null>(null);
  const [perfMetrics, setPerfMetrics] = useState<PerfMetrics | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refreshMetrics = () => {
    setCacheMetrics(getScheduleCacheMetrics());
    const report = getPerformanceReport();
    setPerfMetrics({
      totalOperations: report.totalOperations,
      averageDuration: report.averageDuration,
      slowOperations: report.slowOperations.length,
      operationsByType: report.operationsByType,
    });
    setLastRefresh(new Date());
  };

  useEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    invalidateScheduleCache();
    refreshMetrics();
  };

  const handleClearPerfMetrics = () => {
    clearPerformanceMetrics();
    refreshMetrics();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-primary">Performance Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor cache performance and operation timing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <Button variant="outline" size="sm" onClick={refreshMetrics} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Cache Hit Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cacheMetrics?.hitRate || "N/A"}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {cacheMetrics?.hits || 0} hits / {cacheMetrics?.misses || 0} misses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary" />
                Cache Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cacheMetrics?.size || 0} / 10</div>
              <p className="text-xs text-muted-foreground mt-1">
                {cacheMetrics?.evictions || 0} evictions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Avg Operation Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {perfMetrics?.averageDuration.toFixed(0) || 0}ms
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {perfMetrics?.totalOperations || 0} total operations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Slow Operations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {perfMetrics?.slowOperations || 0}
                {(perfMetrics?.slowOperations || 0) > 0 && (
                  <Badge variant="destructive" className="text-xs">Warning</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Operations &gt; 1000ms
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Operations by Type
              </CardTitle>
              <CardDescription>
                Breakdown of operations and their average duration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {perfMetrics?.operationsByType && Object.keys(perfMetrics.operationsByType).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(perfMetrics.operationsByType).map(([type, data]) => (
                    <div key={type} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                      <div>
                        <span className="font-medium text-sm">{type}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({data.count} calls)
                        </span>
                      </div>
                      <Badge variant={data.avgDuration > 500 ? "destructive" : "secondary"}>
                        {data.avgDuration.toFixed(0)}ms avg
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No operations recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cache Management</CardTitle>
              <CardDescription>
                Clear cache or performance data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Schedule Cache</p>
                  <p className="text-xs text-muted-foreground">
                    Clears cached schedule calculations (5-min TTL)
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearCache}>
                  Clear Cache
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Performance Metrics</p>
                  <p className="text-xs text-muted-foreground">
                    Clears operation timing history
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearPerfMetrics}>
                  Clear Metrics
                </Button>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> Cache automatically expires after 5 minutes. 
                  Clear manually if you're seeing stale data after data changes.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

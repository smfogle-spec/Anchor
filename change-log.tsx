import { useState, useMemo } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, FileText, User, Users, Clock, ArrowRight, Filter, RefreshCw, MapPin } from "lucide-react";
import { Link } from "wouter";
import type { ScheduleChange, Staff, Client } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ChangeTypeBadge = ({ type }: { type: string }) => {
  const styles: Record<string, string> = {
    assignment: "border-blue-500/30 bg-blue-500/5 text-blue-600",
    location: "border-purple-500/30 bg-purple-500/5 text-purple-600",
    status: "border-amber-500/30 bg-amber-500/5 text-amber-600",
    sub: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600",
  };

  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold", styles[type] || styles.status)}>
      {type}
    </span>
  );
};

const SourceBadge = ({ source }: { source: string }) => {
  const styles: Record<string, string> = {
    exception: "border-amber-500/30 bg-amber-500/5 text-amber-600",
    repair: "border-blue-500/30 bg-blue-500/5 text-blue-600",
    sub: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600",
    manual: "border-purple-500/30 bg-purple-500/5 text-purple-600",
    template: "border-primary/30 bg-primary/5 text-primary",
  };

  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold", styles[source] || styles.template)}>
      {source}
    </span>
  );
};

export default function ChangeLog() {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  const todayDate = new Date().toISOString().split('T')[0];

  const { data: changes = [], isLoading, refetch } = useQuery<ScheduleChange[]>({
    queryKey: ["/api/schedule-changes", todayDate],
    queryFn: async () => {
      const response = await fetch(`/api/schedule-changes?date=${todayDate}`);
      if (!response.ok) throw new Error("Failed to fetch schedule changes");
      return response.json();
    },
  });

  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: async () => {
      const response = await fetch("/api/staff");
      if (!response.ok) throw new Error("Failed to fetch staff");
      return response.json();
    },
  });

  const { data: clientList = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const staffMap = useMemo(() => new Map(staffList.map(s => [s.id, s.name])), [staffList]);
  const clientMap = useMemo(() => new Map(clientList.map(c => [c.id, c.name])), [clientList]);

  const filteredChanges = useMemo(() => {
    return changes.filter(change => {
      if (filterType !== "all" && change.changeType !== filterType) return false;
      if (filterSource !== "all" && change.source !== filterSource) return false;
      return true;
    });
  }, [changes, filterType, filterSource]);

  const groupedChanges = useMemo(() => {
    const groups: Record<string, ScheduleChange[]> = {};
    filteredChanges.forEach(change => {
      const key = change.changeType;
      if (!groups[key]) groups[key] = [];
      groups[key].push(change);
    });
    return groups;
  }, [filteredChanges]);

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b pb-4 border-border/30">
          <div className="flex items-center gap-3">
            <Link href="/schedule">
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back-schedule">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-semibold text-foreground">
                Change Log
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {today}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="gap-2"
              data-testid="button-refresh-changes"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[130px] h-8" data-testid="select-filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="assignment">Assignment</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="sub">Sub</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[130px] h-8" data-testid="select-filter-source">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="exception">Exception</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="sub">Sub</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-spin" />
              <h3 className="text-lg font-medium text-foreground mb-2">Loading Changes...</h3>
            </CardContent>
          </Card>
        ) : filteredChanges.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Changes Today</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                The schedule matches the weekly template. Changes will appear here when exceptions are added or the schedule is modified.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="flex-1 min-h-0" style={{ height: 'calc(100vh - 200px)' }}>
            <div className="space-y-6 pb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="bg-muted/30">
                  {filteredChanges.length} Change{filteredChanges.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {Object.entries(groupedChanges).map(([type, typeChanges]) => (
                <Card key={type}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-medium capitalize">
                        {type} Changes
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {typeChanges.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {typeChanges.map((change) => {
                        const staffName = change.staffId ? staffMap.get(change.staffId) : null;
                        const clientName = change.clientId ? clientMap.get(change.clientId) : null;
                        
                        return (
                          <div 
                            key={change.id} 
                            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                            data-testid={`change-entry-${change.id}`}
                          >
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium">{change.timeBlock}</span>
                            </div>

                            <div className="flex items-center gap-2 min-w-[140px]">
                              {staffName ? (
                                <>
                                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm" data-testid={`text-staff-${change.id}`}>{staffName}</span>
                                </>
                              ) : clientName ? (
                                <>
                                  <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm" data-testid={`text-client-${change.id}`}>{clientName}</span>
                                </>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-sm text-muted-foreground line-through">
                                {change.beforeValue || "-"}
                              </span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium text-foreground">
                                {change.afterValue || "-"}
                              </span>
                            </div>

                            {change.locationBefore || change.locationAfter ? (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {change.locationBefore} → {change.locationAfter}
                                </span>
                              </div>
                            ) : null}

                            <div className="flex items-center gap-2">
                              <ChangeTypeBadge type={change.changeType} />
                              <SourceBadge source={change.source} />
                            </div>

                            <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={change.reason}>
                              {change.reason}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </Layout>
  );
}

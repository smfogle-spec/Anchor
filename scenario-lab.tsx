import { useState, useMemo } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, getDay, addDays } from "date-fns";
import { 
  Play, RotateCcw, FlaskConical, AlertTriangle, CheckCircle2, 
  XCircle, Clock, Users, Calendar, Lightbulb, ChevronRight,
  User, UserX, MapPin, GraduationCap, Utensils, FileText, CalendarIcon
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { type Exception, type ApprovalRequest, type ExceptionMode } from "@/lib/daily-run-data";
import { generateDailySchedule, type SchedulerTrainingSession, type LunchCoverageError } from "@/lib/schedule-engine";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Staff, Client, TemplateAssignment, ClientLocation } from "@shared/schema";

type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri";

interface SimulationResult {
  schedule: Array<{
    staffId: string;
    staffName: string;
    status: string;
    slots: Array<{
      id: string;
      block: string;
      value: string;
      source?: string;
    }>;
  }>;
  pendingApprovals: ApprovalRequest[];
  lunchCoverageErrors: LunchCoverageError[];
  trainingSessionUpdates: Array<{
    sessionId: string;
    newStatus: string;
    reason: string;
  }>;
  recommendations: string[];
  decisionTrace: string[];
  stats: {
    totalSlots: number;
    filledSlots: number;
    unfilledSlots: number;
    approvalCount: number;
    cancellationCount: number;
  };
}

const dayIndexToWeekDay: Record<number, WeekDay> = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri" };
const weekDayLabels: Record<WeekDay, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" };

function getNextWeekday(date: Date): Date {
  const day = getDay(date);
  if (day === 0) return addDays(date, 1);
  if (day === 6) return addDays(date, 2);
  return date;
}

export default function ScenarioLab() {
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(() => getNextWeekday(new Date()));
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [approvedSubs, setApprovedSubs] = useState<Array<{ clientId: string; subStaffId: string; block: "AM" | "PM" }>>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState("setup");

  const dayOfWeekNum = getDay(selectedDate);
  const selectedDay: WeekDay = dayIndexToWeekDay[dayOfWeekNum] || "mon";
  const isWeekend = dayOfWeekNum === 0 || dayOfWeekNum === 6;

  const { data: staff = [], isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: templateAssignments = [] } = useQuery<TemplateAssignment[]>({
    queryKey: ["/api/template"],
  });

  const { data: clientLocations = [] } = useQuery<ClientLocation[]>({
    queryKey: ["/api/client-locations"],
  });

  const { data: trainingSessions = [] } = useQuery<SchedulerTrainingSession[]>({
    queryKey: ["/api/training-sessions"],
  });

  const activeStaff = useMemo(() => 
    staff.filter(s => s.active).sort((a, b) => a.name.localeCompare(b.name)),
    [staff]
  );

  const activeClients = useMemo(() => 
    clients.filter(c => c.active).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );


  const toggleException = (type: "staff" | "client", entityId: string, mode: "out" | "in" = "out", allDay: boolean = true, block?: "AM" | "PM") => {
    const existingIndex = exceptions.findIndex(
      e => e.type === type && e.entityId === entityId && e.mode === mode
    );
    
    if (existingIndex >= 0) {
      setExceptions(exceptions.filter((_, i) => i !== existingIndex));
    } else {
      const newException: Exception = {
        id: `${type}-${entityId}-${mode}-${Date.now()}`,
        type,
        entityId,
        mode,
        allDay,
        ...(block && !allDay ? { timeWindow: { start: block === "AM" ? "08:30" : "12:30", end: block === "AM" ? "11:30" : "16:00" } } : {})
      };
      setExceptions([...exceptions, newException]);
    }
  };

  const handleApproveRequest = (approval: ApprovalRequest) => {
    if (approval.type === "sub_staffing" || approval.type === "lead_staffing" || approval.type === "lead_reserve") {
      if (approval.clientId && approval.proposedSubId && approval.block) {
        setApprovedSubs([...approvedSubs, {
          clientId: approval.clientId,
          subStaffId: approval.proposedSubId,
          block: approval.block
        }]);
        toast({ description: `Approved ${approval.proposedSubName || 'substitute'} for ${approval.clientName}` });
        handleRun();
      }
    }
  };

  const handleRun = () => {
    if (isWeekend) {
      toast({ description: "Cannot run simulation for weekends. Please select a weekday.", variant: "destructive" });
      return;
    }
    
    const dbData = {
      staff: staff as any[],
      clients: clients as any[],
      templateAssignments: templateAssignments as any[],
      clientLocations: clientLocations as any[],
      trainingSessions: trainingSessions as any[],
    };

    const engineResult = generateDailySchedule(
      exceptions,
      dbData,
      approvedSubs,
      dayOfWeekNum
    );

    const recommendations: string[] = [];
    const decisionTrace: string[] = [];

    decisionTrace.push(`[START] Running simulation for ${format(selectedDate, "EEEE, MMMM d, yyyy")}`);
    decisionTrace.push(`[DATA] ${activeStaff.length} active staff, ${activeClients.length} active clients`);
    decisionTrace.push(`[EXCEPTIONS] ${exceptions.length} exceptions configured`);

    const staffOutCount = exceptions.filter(e => e.type === "staff" && e.mode === "out").length;
    const clientOutCount = exceptions.filter(e => e.type === "client" && e.mode === "out").length;
    
    if (staffOutCount > 0) {
      decisionTrace.push(`[STAFF OUT] ${staffOutCount} staff members marked as unavailable`);
    }
    if (clientOutCount > 0) {
      decisionTrace.push(`[CLIENT OUT] ${clientOutCount} clients marked as unavailable`);
    }

    let filledSlots = 0;
    let unfilledSlots = 0;
    let totalSlots = 0;

    engineResult.schedule.forEach(s => {
      s.slots.forEach(slot => {
        totalSlots++;
        if (slot.value === "OPEN" || slot.source === "UNFILLED") {
          unfilledSlots++;
        } else if (slot.value !== "OUT") {
          filledSlots++;
        }
      });
    });

    const pendingApprovals = engineResult.pendingSubApprovals.filter(a => a.status === "pending");
    const cancellations = engineResult.pendingSubApprovals.filter(a => 
      a.type === "cancellation" || a.type === "cancel_protected" || a.type === "cancel_skipped"
    );

    if (unfilledSlots > 0) {
      decisionTrace.push(`[GAP] ${unfilledSlots} unfilled slots detected`);
    }

    if (pendingApprovals.length > 0) {
      decisionTrace.push(`[APPROVALS] ${pendingApprovals.length} pending approval requests generated`);
      
      const subApprovals = pendingApprovals.filter(a => a.type === "sub_staffing");
      if (subApprovals.length > 0) {
        recommendations.push(`Approving ${subApprovals.length} sub request(s) could help fill coverage gaps.`);
      }

      const leadApprovals = pendingApprovals.filter(a => a.type === "lead_staffing" || a.type === "lead_reserve");
      if (leadApprovals.length > 0) {
        recommendations.push(`${leadApprovals.length} Lead RBT staffing option(s) available as last resort.`);
      }
    }

    if (cancellations.length > 0) {
      decisionTrace.push(`[CANCELLATIONS] ${cancellations.length} cancellation decisions`);
      
      const protectedCancels = cancellations.filter(a => a.type === "cancel_protected");
      if (protectedCancels.length > 0) {
        recommendations.push(`${protectedCancels.length} client(s) protected from cancellation (30-day rule).`);
      }

      const skippedCancels = cancellations.filter(a => a.type === "cancel_skipped");
      if (skippedCancels.length > 0) {
        recommendations.push(`${skippedCancels.length} client(s) skipped for cancellation (skip rules applied).`);
      }
    }

    if (engineResult.lunchCoverageErrors.length > 0) {
      decisionTrace.push(`[LUNCH] ${engineResult.lunchCoverageErrors.length} lunch coverage issues`);
      recommendations.push(`Review lunch coverage - ${engineResult.lunchCoverageErrors.length} gap(s) detected.`);
    }

    if (engineResult.trainingSessionUpdates && engineResult.trainingSessionUpdates.length > 0) {
      const blocked = engineResult.trainingSessionUpdates.filter(u => u.newStatus === "blocked");
      const disrupted = engineResult.trainingSessionUpdates.filter(u => u.newStatus === "disrupted");
      
      if (blocked.length > 0) {
        decisionTrace.push(`[TRAINING] ${blocked.length} training session(s) blocked`);
        recommendations.push(`${blocked.length} training session(s) cannot proceed - trainee or client unavailable.`);
      }
      if (disrupted.length > 0) {
        decisionTrace.push(`[TRAINING] ${disrupted.length} training session(s) disrupted`);
        recommendations.push(`${disrupted.length} training session(s) affected - trainer unavailable.`);
      }
    }

    if (recommendations.length === 0 && unfilledSlots === 0) {
      recommendations.push("Schedule looks good! No gaps or issues detected.");
    }

    decisionTrace.push(`[COMPLETE] Simulation finished`);

    const output: SimulationResult = {
      schedule: engineResult.schedule.map(s => ({
        staffId: s.staffId,
        staffName: activeStaff.find(st => st.id === s.staffId)?.name || "Unknown",
        status: s.status,
        slots: s.slots
      })),
      pendingApprovals: engineResult.pendingSubApprovals,
      lunchCoverageErrors: engineResult.lunchCoverageErrors,
      trainingSessionUpdates: engineResult.trainingSessionUpdates || [],
      recommendations,
      decisionTrace,
      stats: {
        totalSlots,
        filledSlots,
        unfilledSlots,
        approvalCount: pendingApprovals.length,
        cancellationCount: cancellations.length
      }
    };

    setResult(output);
    setActiveTab("results");
    toast({ description: "Simulation complete" });
  };

  const handleReset = () => {
    setExceptions([]);
    setApprovedSubs([]);
    setResult(null);
    setActiveTab("setup");
  };

  const isLoading = staffLoading || clientsLoading;

  const staffExceptions = exceptions.filter(e => e.type === "staff");
  const clientExceptions = exceptions.filter(e => e.type === "client");

  return (
    <Layout>
      <div className="flex flex-col gap-4 p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary">Scenario Lab</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Test scenarios and see how the engine responds</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
            <Button 
              size="sm" 
              onClick={handleRun} 
              disabled={isLoading}
              className="bg-primary text-primary-foreground"
              data-testid="button-run-simulation"
            >
              <Play className="mr-2 h-4 w-4 fill-current" /> Run Simulation
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 md:w-auto md:inline-flex">
            <TabsTrigger value="setup" className="text-xs md:text-sm" data-testid="tab-setup">
              <Calendar className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Setup</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="text-xs md:text-sm" data-testid="tab-results">
              <FileText className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Results</span>
              {result && result.stats.unfilledSlots > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 text-[10px]">{result.stats.unfilledSlots}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="text-xs md:text-sm" data-testid="tab-approvals">
              <CheckCircle2 className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Approvals</span>
              {result && result.stats.approvalCount > 0 && (
                <Badge variant="outline" className="ml-1 h-5 text-[10px]">{result.stats.approvalCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs md:text-sm" data-testid="tab-insights">
              <Lightbulb className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Insights</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Simulation Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Simulation Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                          data-testid="select-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          disabled={(date) => getDay(date) === 0 || getDay(date) === 6}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {isWeekend && (
                      <p className="text-xs text-destructive">Weekends are not supported. Please select a weekday.</p>
                    )}
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Template Day:</span>
                      <span className="font-medium">{weekDayLabels[selectedDay]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Staff:</span>
                      <span className="font-medium">{activeStaff.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Clients:</span>
                      <span className="font-medium">{activeClients.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exceptions Set:</span>
                      <span className="font-medium">{exceptions.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserX className="h-4 w-4" />
                    Staff Exceptions
                  </CardTitle>
                  <CardDescription>Mark staff as unavailable</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2 pr-4">
                      {activeStaff.map(s => {
                        const isOut = staffExceptions.some(e => e.entityId === s.id && e.mode === "out");
                        return (
                          <div 
                            key={s.id} 
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg border",
                              isOut ? "bg-destructive/10 border-destructive/30" : "bg-card"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className={cn("text-sm", isOut && "line-through text-muted-foreground")}>{s.name}</span>
                              {s.role === "Lead RBT" && <Badge variant="secondary" className="text-[10px] h-4">Lead</Badge>}
                            </div>
                            <Switch
                              checked={isOut}
                              onCheckedChange={() => toggleException("staff", s.id, "out")}
                              data-testid={`switch-staff-${s.id}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Client Exceptions
                  </CardTitle>
                  <CardDescription>Mark clients as unavailable</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2 pr-4">
                      {activeClients.map(c => {
                        const isOut = clientExceptions.some(e => e.entityId === c.id && e.mode === "out");
                        return (
                          <div 
                            key={c.id} 
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg border",
                              isOut ? "bg-destructive/10 border-destructive/30" : "bg-card"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className={cn("text-sm", isOut && "line-through text-muted-foreground")}>{c.name}</span>
                            </div>
                            <Switch
                              checked={isOut}
                              onCheckedChange={() => toggleException("client", c.id, "out")}
                              data-testid={`switch-client-${c.id}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Active Exceptions
                  </CardTitle>
                  <CardDescription>Currently configured exceptions</CardDescription>
                </CardHeader>
                <CardContent>
                  {exceptions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No exceptions configured. Toggle staff or clients above.
                    </div>
                  ) : (
                    <ScrollArea className="h-64">
                      <div className="space-y-2 pr-4">
                        {exceptions.map(exc => {
                          const entity = exc.type === "staff" 
                            ? activeStaff.find(s => s.id === exc.entityId)
                            : activeClients.find(c => c.id === exc.entityId);
                          return (
                            <div key={exc.id} className="flex items-center justify-between p-2 rounded-lg border bg-destructive/5">
                              <div className="flex items-center gap-2">
                                <Badge variant={exc.type === "staff" ? "default" : "secondary"} className="text-[10px]">
                                  {exc.type}
                                </Badge>
                                <span className="text-sm font-medium">{entity?.name || "Unknown"}</span>
                                <Badge variant="outline" className="text-[10px]">{exc.mode.toUpperCase()}</Badge>
                                {exc.allDay && <Badge variant="outline" className="text-[10px]">All Day</Badge>}
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => toggleException(exc.type, exc.entityId, exc.mode as "out" | "in")}
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="results" className="mt-4">
            {!result ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Run a simulation to see results</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="p-3">
                    <div className="text-2xl font-bold text-primary">{result.stats.filledSlots}</div>
                    <div className="text-xs text-muted-foreground">Filled Slots</div>
                  </Card>
                  <Card className="p-3">
                    <div className={cn("text-2xl font-bold", result.stats.unfilledSlots > 0 ? "text-destructive" : "text-emerald-600")}>
                      {result.stats.unfilledSlots}
                    </div>
                    <div className="text-xs text-muted-foreground">Unfilled Gaps</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-2xl font-bold">{result.stats.approvalCount}</div>
                    <div className="text-xs text-muted-foreground">Pending Approvals</div>
                  </Card>
                  <Card className="p-3">
                    <div className={cn("text-2xl font-bold", result.stats.cancellationCount > 0 ? "text-amber-600" : "text-muted-foreground")}>
                      {result.stats.cancellationCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Cancellations</div>
                  </Card>
                  <Card className="p-3">
                    <div className={cn("text-2xl font-bold", result.lunchCoverageErrors.length > 0 ? "text-amber-600" : "text-emerald-600")}>
                      {result.lunchCoverageErrors.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Lunch Gaps</div>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Schedule Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {result.schedule.map(s => {
                          const isOut = s.status === "OUT";
                          const hasGaps = s.slots.some(slot => slot.value === "OPEN" || slot.source === "UNFILLED");
                          return (
                            <div 
                              key={s.staffId} 
                              className={cn(
                                "border rounded-lg p-3 space-y-2",
                                isOut ? "bg-muted/50 opacity-60" : hasGaps ? "border-amber-300 bg-amber-50" : "bg-card"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className={cn("font-medium text-sm", isOut && "line-through")}>{s.staffName}</span>
                                {isOut && <Badge variant="secondary" className="text-[10px]">OUT</Badge>}
                                {hasGaps && !isOut && <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">Gaps</Badge>}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {s.slots.map(slot => (
                                  <div 
                                    key={slot.id} 
                                    className={cn(
                                      "text-xs p-2 rounded border text-center",
                                      slot.value === "OUT" ? "bg-muted text-muted-foreground" :
                                      slot.value === "OPEN" || slot.source === "UNFILLED" ? "bg-amber-100 text-amber-800 border-amber-300" :
                                      "bg-primary/10 text-primary border-primary/20"
                                    )}
                                  >
                                    <div className="opacity-70 text-[10px] mb-1">{slot.block}</div>
                                    <div className="font-medium truncate">{slot.value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Decision Trace
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      <div className="space-y-1 font-mono text-xs">
                        {result.decisionTrace.map((log, i) => (
                          <div 
                            key={i} 
                            className={cn(
                              "p-2 rounded",
                              log.includes("[GAP]") || log.includes("[CANCELLATIONS]") ? "bg-amber-50 text-amber-800" :
                              log.includes("[COMPLETE]") ? "bg-emerald-50 text-emerald-800" :
                              "bg-muted/30"
                            )}
                          >
                            {log}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="approvals" className="mt-4">
            {!result ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Run a simulation to see pending approvals</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {result.pendingApprovals.filter(a => a.status === "pending").length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
                      <p>No pending approvals</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {result.pendingApprovals.filter(a => a.status === "pending").map(approval => (
                      <Card key={approval.id} className="overflow-hidden">
                        <div className={cn(
                          "p-4 border-l-4",
                          approval.type === "sub_staffing" ? "border-l-blue-500" :
                          approval.type === "lead_staffing" || approval.type === "lead_reserve" ? "border-l-purple-500" :
                          approval.type === "all_day_staffing" ? "border-l-amber-500" :
                          "border-l-muted"
                        )}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">{approval.type.replace(/_/g, " ")}</Badge>
                                {approval.block && <Badge variant="secondary" className="text-[10px]">{approval.block}</Badge>}
                              </div>
                              <p className="font-medium text-sm">{approval.description}</p>
                              <p className="text-xs text-muted-foreground">{approval.reason}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleApproveRequest(approval)}
                                data-testid={`button-approve-${approval.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {result.pendingApprovals.filter(a => a.type === "cancellation" || a.type === "cancel_protected" || a.type === "cancel_skipped").length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Cancellation Decisions
                    </h3>
                    <div className="grid gap-3">
                      {result.pendingApprovals.filter(a => a.type === "cancellation" || a.type === "cancel_protected" || a.type === "cancel_skipped").map(cancel => (
                        <Card key={cancel.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <Badge 
                                variant={cancel.type === "cancel_protected" ? "default" : cancel.type === "cancel_skipped" ? "secondary" : "destructive"}
                                className="text-[10px]"
                              >
                                {cancel.type === "cancel_protected" ? "PROTECTED" : cancel.type === "cancel_skipped" ? "SKIPPED" : "CANCEL"}
                              </Badge>
                              <div>
                                <p className="font-medium text-sm">{cancel.clientName}</p>
                                <p className="text-xs text-muted-foreground">{cancel.reason}</p>
                                {cancel.skipReason && (
                                  <p className="text-xs text-blue-600 mt-1">Skip reason: {cancel.skipReason}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="insights" className="mt-4">
            {!result ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Run a simulation to see recommendations</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {result.lunchCoverageErrors.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Utensils className="h-4 w-4 text-amber-600" />
                        Lunch Coverage Issues
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {result.lunchCoverageErrors.map((error, i) => (
                          <div key={i} className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                            <span className="font-medium">{error.clientName}</span>
                            <span className="mx-1">-</span>
                            <span>{error.reason}</span>
                            <span className="text-xs ml-2 opacity-70">({error.lunchSlot})</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {result.trainingSessionUpdates.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-purple-600" />
                        Training Session Impacts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {result.trainingSessionUpdates.map((update, i) => (
                          <div 
                            key={i} 
                            className={cn(
                              "p-3 rounded-lg border text-sm",
                              update.newStatus === "blocked" ? "bg-destructive/10 border-destructive/30" : "bg-amber-50 border-amber-200"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={update.newStatus === "blocked" ? "destructive" : "outline"} className="text-[10px]">
                                {update.newStatus.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">{update.reason}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

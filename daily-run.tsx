import { useState, useEffect, useRef } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Play, Plus, Trash2, Clock, AlertTriangle, CheckCircle2, XCircle, AlertCircle, Save, RefreshCw, Phone, Check, ChevronsUpDown, Bell } from "lucide-react";
import { MOCK_EXCEPTIONS, MOCK_OVERRIDES, type Exception, type ApprovalRequest, type ManualOverride } from "@/lib/daily-run-data";
import { generateDailySchedule, type LunchCoverageError, type SchedulerTrainingSession, type TrainingSessionUpdate } from "@/lib/schedule-engine";
import type { Staff, Client, TemplateAssignment, ClientLocation, School, IdealDaySegment } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useScheduleWebSocket } from "@/hooks/use-schedule-websocket";
import { useNotifications } from "@/lib/notification-manager";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

// Searchable Entity Combobox Component
function EntityCombobox({ 
  value, 
  onValueChange, 
  entities,
  placeholder = "Select..."
}: { 
  value: string; 
  onValueChange: (val: string) => void; 
  entities: { id: string; name: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedEntity = entities.find(e => e.id === value);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {selectedEntity?.name || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {entities.sort((a, b) => a.name.localeCompare(b.name)).map(entity => (
                <CommandItem
                  key={entity.id}
                  value={entity.name}
                  onSelect={() => {
                    onValueChange(entity.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === entity.id ? "opacity-100" : "opacity-0")} />
                  {entity.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ClientContact {
  name: string;
  relationship: string;
  phone: string;
}

// Helper for Time Input
const TimeInput = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => {
  const [hour, min] = value ? value.split(":").map(Number) : [8, 0];
  const isPM = hour >= 12;
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;

  const updateTime = (newH: number, newM: number, newIsPM: boolean) => {
    let finalH = newH;
    if (newIsPM && finalH !== 12) finalH += 12;
    if (!newIsPM && finalH === 12) finalH = 0;
    onChange(`${finalH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground uppercase">{label}</Label>
      <div className="flex items-center gap-1">
        <Select value={displayHour.toString()} onValueChange={(h) => updateTime(parseInt(h), min, isPM)}>
          <SelectTrigger className="w-[65px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
             {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
               <SelectItem key={h} value={h.toString()}>{h}</SelectItem>
             ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">:</span>
        <Select value={min.toString()} onValueChange={(m) => updateTime(displayHour, parseInt(m), isPM)}>
          <SelectTrigger className="w-[65px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
             {["00", "15", "30", "45"].map(m => (
               <SelectItem key={m} value={m === "00" ? "0" : m}>{m}</SelectItem>
             ))}
          </SelectContent>
        </Select>
        <Button 
           variant="outline" 
           size="sm" 
           className={cn("h-8 px-2 text-xs", isPM ? "bg-primary/10 text-primary" : "")}
           onClick={() => updateTime(displayHour, min, !isPM)}
        >
          {isPM ? "PM" : "AM"}
        </Button>
      </div>
    </div>
  );
};

export default function DailyRun() {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [overrides, setOverrides] = useState<ManualOverride[]>([]);
  const [exceptionsLoaded, setExceptionsLoaded] = useState(false);
  // Track whether user has made local edits to exceptions - prevents query hydration from overwriting
  const hasLocalExceptionEdits = useRef(false);
  // Keep a ref copy of exceptions that survives React's async state updates
  const exceptionsRef = useRef<Exception[]>([]);
  const [lunchCoverageErrors, setLunchCoverageErrors] = useState<LunchCoverageError[]>([]);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { isConnected: wsConnected } = useScheduleWebSocket({
    enabled: true,
    onUpdate: (update) => {
      if (update.type === "exception_added") {
        toast({
          title: "Exception Added",
          description: "An exception was added by another user.",
        });
      }
    },
  });

  const { isSupported: notificationsSupported, isGranted: notificationsGranted, requestPermission, notifyApprovalNeeded } = useNotifications();

  useKeyboardShortcuts([
    {
      key: "n",
      ctrl: true,
      handler: async () => {
        if (notificationsSupported && !notificationsGranted) {
          await requestPermission();
        }
      },
      description: "Enable notifications",
    },
  ], true);

  useEffect(() => {
    if (notificationsGranted && approvals.length > 0) {
      const pendingApprovals = approvals.filter(a => a.status === "pending");
      if (pendingApprovals.length > 0) {
        const first = pendingApprovals[0];
        notifyApprovalNeeded(first.reason.split(" ")[0] || "Client", first.type);
      }
    }
  }, [approvals, notificationsGranted, notifyApprovalNeeded]);
  
  // Cancellation popup state
  const [showCancellationPopup, setShowCancellationPopup] = useState(false);
  const [cancellationClientId, setCancellationClientId] = useState<string | null>(null);
  const [cancellationClientName, setCancellationClientName] = useState<string>("");
  const [cancellationBlock, setCancellationBlock] = useState<string>("");

  // Fetch the latest schedule to get existing exceptions
  const todayDate = new Date().toISOString().split('T')[0];
  const { data: latestSchedule, isLoading: isLoadingSchedule } = useQuery<{ snapshot: { exceptions?: Exception[] } } | null>({
    queryKey: ["/api/schedules/latest", todayDate],
    queryFn: async () => {
      const response = await fetch(`/api/schedules/${todayDate}/latest`);
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Load exceptions from latest schedule on mount
  // IMPORTANT: Only hydrate if user hasn't made local edits - prevents overwriting unsaved changes
  useEffect(() => {
    if (!exceptionsLoaded && !isLoadingSchedule && !hasLocalExceptionEdits.current) {
      if (latestSchedule?.snapshot?.exceptions && latestSchedule.snapshot.exceptions.length > 0) {
        setExceptions(latestSchedule.snapshot.exceptions);
        exceptionsRef.current = latestSchedule.snapshot.exceptions;
      }
      setExceptionsLoaded(true);
    }
  }, [latestSchedule, exceptionsLoaded, isLoadingSchedule]);

  // Sync exceptionsRef whenever exceptions state changes (backup safety)
  useEffect(() => {
    if (exceptions.length > 0) {
      exceptionsRef.current = exceptions;
    }
  }, [exceptions]);

  // Hydrate approvals from localStorage on mount (full ApprovalRequest objects)
  useEffect(() => {
    const storedApprovals = localStorage.getItem("daily_approvals_full");
    if (storedApprovals) {
      try {
        const parsed = JSON.parse(storedApprovals) as ApprovalRequest[];
        if (parsed.length > 0) {
          setApprovals(parsed);
        }
      } catch (e) {
        console.error("Failed to hydrate approvals from localStorage", e);
      }
    }
  }, []);

  // Fetch staff from API
  const { data: staffList = [], isLoading: isLoadingStaff } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: async () => {
      const response = await fetch("/api/staff");
      if (!response.ok) throw new Error("Failed to fetch staff");
      return response.json();
    },
  });

  // Fetch clients from API
  const { data: clientList = [], isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Fetch template from API
  const { data: templateAssignments = [], isLoading: isLoadingTemplate } = useQuery<TemplateAssignment[]>({
    queryKey: ["/api/template"],
    queryFn: async () => {
      const response = await fetch("/api/template");
      if (!response.ok) throw new Error("Failed to fetch template");
      return response.json();
    },
  });

  // Fetch client locations from API
  const { data: clientLocations = [] } = useQuery<ClientLocation[]>({
    queryKey: ["/api/client-locations"],
    queryFn: async () => {
      const response = await fetch("/api/client-locations");
      if (!response.ok) throw new Error("Failed to fetch client locations");
      return response.json();
    },
  });

  // Fetch schools from API
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const response = await fetch("/api/schools");
      if (!response.ok) throw new Error("Failed to fetch schools");
      return response.json();
    },
  });

  // Fetch ideal day segments for today's weekday (used by schedule engine)
  const todayWeekDay = (() => {
    const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayIndex = new Date().getDay();
    const day = dayMap[dayIndex];
    return day === "sun" || day === "sat" ? "mon" : day;
  })();
  
  const { data: idealDaySegments = [] } = useQuery<IdealDaySegment[]>({
    queryKey: ["/api/ideal-day-segments/by-weekday", todayWeekDay],
    queryFn: async () => {
      const response = await fetch(`/api/ideal-day-segments/by-weekday/${todayWeekDay}`);
      if (!response.ok) throw new Error("Failed to fetch ideal day segments");
      return response.json();
    },
  });
  
  // Fetch training sessions for today (enriched with plan data)
  const todayDateStr = new Date().toISOString().split('T')[0];
  const { data: trainingSessions = [] } = useQuery<SchedulerTrainingSession[]>({
    queryKey: ["/api/training-sessions", todayDateStr, "enriched"],
    queryFn: async () => {
      const response = await fetch(`/api/training-sessions?date=${todayDateStr}&enriched=true`);
      if (!response.ok) throw new Error("Failed to fetch training sessions");
      return response.json();
    },
  });
  
  // Track which training sessions have already been updated to avoid duplicate mutations
  const [processedTrainingSessionUpdates, setProcessedTrainingSessionUpdates] = useState<Set<string>>(new Set());
  
  // Mutation to update training session status (for disruption syncing)
  const queryClient = useQueryClient();
  const updateTrainingSessionMutation = useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: string; status: string }) => {
      const response = await fetch(`/api/training-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update training session");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-sessions"] });
    },
    onError: (error) => {
      console.error("Training session update failed:", error);
    }
  });

  // Check if data is still loading
  const isDataLoading = isLoadingStaff || isLoadingClients || isLoadingTemplate;
  
  // Check for pending sub approvals - merges with existing decisions
  // Returns true if the check ran successfully, false if data wasn't ready
  const handleCheckApprovals = (showToast = true): boolean => {
    // Only block if data is still loading - empty arrays are valid (no staff/clients/template)
    if (isDataLoading) return false;
    // But we need at least staff and clients to run the engine meaningfully
    if (staffList.length === 0 || clientList.length === 0) return false;
    
    // CRITICAL: Use the ref copy of exceptions instead of state
    // This prevents race conditions where TanStack Query refetches could overwrite
    // the local state with stale API data before we pass exceptions to the engine
    // The ref is always kept in sync with user edits via handleAddException
    const currentExceptions = exceptionsRef.current.length > 0 ? exceptionsRef.current : exceptions;
    
    const data = {
      staff: staffList,
      clients: clientList,
      templateAssignments: templateAssignments,
      idealDaySegments: idealDaySegments || [],
      clientLocations: clientLocations || [],
      schools: schools || [],
      trainingSessions: trainingSessions || []
    };
    
    // Build approvedSubs from current approvals state (includes subs, leads, all-day staffing)
    const currentApprovedSubs = approvals
      .filter(a => a.status === "approved" && 
        (a.type === "sub_staffing" || a.type === "lead_staffing" || a.type === "lead_reserve" || a.type === "all_day_staffing"))
      .map(a => ({
        clientId: a.clientId,
        block: a.block as "AM" | "PM",
        subStaffId: a.proposedSubId
      }))
      .filter((a): a is { clientId: string; block: "AM" | "PM"; subStaffId: string } => 
        a.clientId !== undefined && a.subStaffId !== undefined && 
        (a.block === "AM" || a.block === "PM"));
    
    const todayDayOfWeek = new Date().getDay();
    const result = generateDailySchedule(currentExceptions, data, currentApprovedSubs, todayDayOfWeek);
    
    // Store lunch coverage errors
    setLunchCoverageErrors(result.lunchCoverageErrors);
    
    // Process training session updates (disruptions) - sync to backend
    // Only process updates for sessions we haven't already processed
    if (result.trainingSessionUpdates && result.trainingSessionUpdates.length > 0) {
      const newUpdates = result.trainingSessionUpdates.filter(
        update => !processedTrainingSessionUpdates.has(update.sessionId)
      );
      
      if (newUpdates.length > 0) {
        // Mark these sessions as processed
        const newProcessed = new Set(processedTrainingSessionUpdates);
        newUpdates.forEach(update => {
          newProcessed.add(update.sessionId);
          updateTrainingSessionMutation.mutate({
            sessionId: update.sessionId,
            status: update.newStatus
          });
        });
        setProcessedTrainingSessionUpdates(newProcessed);
        
        if (showToast) {
          const disruptedCount = newUpdates.filter(u => u.newStatus === 'disrupted').length;
          const blockedCount = newUpdates.filter(u => u.newStatus === 'blocked').length;
          if (disruptedCount > 0 || blockedCount > 0) {
            toast({
              title: "Training Sessions Affected",
              description: `${blockedCount > 0 ? `${blockedCount} blocked` : ''}${blockedCount > 0 && disruptedCount > 0 ? ', ' : ''}${disruptedCount > 0 ? `${disruptedCount} disrupted` : ''}. Check Training Plan page for details.`,
              variant: "destructive"
            });
          }
        }
      }
    }
    
    // Merge with existing approvals - preserve approved/denied decisions
    const newApprovalIds = new Set(result.pendingSubApprovals.map(a => a.id));
    
    // Keep existing approved/denied approvals that engine no longer emits (they're satisfied)
    const retainedApprovals = approvals.filter(a => 
      a.status !== "pending" && !newApprovalIds.has(a.id)
    );
    
    // Map new approvals, preserving existing decisions if they match
    const mergedNewApprovals = result.pendingSubApprovals.map(newApproval => {
      const existing = approvals.find(a => a.id === newApproval.id);
      if (existing && existing.status !== "pending") {
        // Preserve existing decision
        return { ...newApproval, status: existing.status };
      }
      return newApproval;
    });
    
    // Combine retained + merged new approvals
    setApprovals([...retainedApprovals, ...mergedNewApprovals]);
    
    const pendingCount = mergedNewApprovals.filter(a => a.status === "pending").length;
    if (showToast && pendingCount > 0) {
      toast({
        title: "Sub Staffing Required",
        description: `${pendingCount} sub assignment(s) need approval before generating schedule.`,
      });
    }
    return true;
  };

  // Track if user has clicked "Done Entering Exceptions"
  const [exceptionsFinalized, setExceptionsFinalized] = useState(false);
  
  // Reset finalized state when exceptions change (user is still editing)
  useEffect(() => {
    setExceptionsFinalized(false);
    // Clear exception-dependent approvals but preserve all_day_staffing (template-based, not affected by exceptions)
    setApprovals(prev => prev.filter(a => a.type === "all_day_staffing"));
    setLunchCoverageErrors([]);
  }, [exceptions]);
  
  // Handle "Done Entering Exceptions" button click
  const handleFinalizeExceptions = () => {
    const success = handleCheckApprovals(true);
    if (success) {
      setExceptionsFinalized(true);
    } else {
      toast({
        title: "Please Wait",
        description: "Still loading data. Please try again in a moment.",
        variant: "destructive"
      });
    }
  };
  
  // Check if data is loaded and ready (not loading, and have staff and clients)
  // Note: template can be empty (valid state for days with no scheduled sessions)
  const dataReady = !isDataLoading && staffList.length > 0 && clientList.length > 0;

  // New Exception State
  const [activeTab, setActiveTab] = useState("clients");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [mode, setMode] = useState<"in" | "out">("out");
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("16:00");

  // Manual Override State
  const [overrideStaffId, setOverrideStaffId] = useState("");
  const [overrideBlock, setOverrideBlock] = useState<"AM" | "PM">("AM");
  const [overrideValue, setOverrideValue] = useState("");

  const needsTimeWindow = (type: "client" | "staff", mode: "in" | "out", isAllDay: boolean) => {
    if (type === "client" && mode === "in") return true;
    if (type === "staff" && mode === "in") return true;
    if (!isAllDay) return true;
    return false;
  };

  const handleAddException = () => {
    if (!selectedEntityId) return;

    // Normalize "clients" tab to "client" type for proper Exception typing
    const exceptionType = activeTab === "clients" ? "client" : "staff";
    
    const newException: Exception = {
      id: Math.random().toString(36).substr(2, 9),
      type: exceptionType,
      entityId: selectedEntityId,
      mode,
      allDay,
      timeWindow: needsTimeWindow(activeTab as any, mode, allDay) ? { start: startTime, end: endTime } : undefined
    };

    const newExceptions = [...exceptions, newException];
    setExceptions(newExceptions);
    // CRITICAL: Mark that user has made local edits and sync to ref
    // This prevents query refetches from overwriting user's unsaved changes
    hasLocalExceptionEdits.current = true;
    exceptionsRef.current = newExceptions;
    setSelectedEntityId(""); // Reset
    toast({ description: "Exception recorded." });
  };

  const handleRemoveException = (exceptionId: string) => {
    const newExceptions = exceptions.filter(e => e.id !== exceptionId);
    setExceptions(newExceptions);
    // Keep ref in sync with state
    hasLocalExceptionEdits.current = true;
    exceptionsRef.current = newExceptions;
  };

  const handleAddOverride = () => {
    if (!overrideStaffId || !overrideValue) return;
    const newOverride: ManualOverride = {
      id: Math.random().toString(36).substr(2, 9),
      staffId: overrideStaffId,
      block: overrideBlock,
      value: overrideValue
    };
    setOverrides([...overrides, newOverride]);
    setOverrideStaffId("");
    setOverrideValue("");
    toast({ description: "Manual override saved." });
  };

  const handleApprove = (id: string, decision: "approved" | "denied") => {
    const approval = approvals.find(a => a.id === id);
    setApprovals(approvals.map(a => a.id === id ? { ...a, status: decision } : a));
    
    // If this is a cancellation approval being approved, show the contact popup
    if (decision === "approved" && approval?.type === "cancellation" && approval.clientId) {
      setCancellationClientId(approval.clientId);
      setCancellationClientName(approval.clientName || "Client");
      setCancellationBlock(approval.block || "");
      setShowCancellationPopup(true);
    } else {
      toast({ 
        description: `Request ${decision}.`,
        variant: decision === "approved" ? "default" : "destructive" 
      });
    }
  };
  
  // Get contacts for the cancelled client
  const getCancellationContacts = (): ClientContact[] => {
    if (!cancellationClientId) return [];
    const client = clientList.find(c => c.id === cancellationClientId);
    if (!client) return [];
    return ((client as any).contacts as ClientContact[]) || [];
  };
  
  // Format phone for Teams call - uses HTTPS format which prompts to open Teams
  const formatTeamsCallLink = (phone: string) => {
    // Clean phone and ensure it has country code format
    let cleanPhone = phone.replace(/[^0-9+]/g, '');
    // Add + prefix if not present (assume US number if no country code)
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+1' + cleanPhone;
    }
    return `https://teams.microsoft.com/l/call/0/0?users=4:${encodeURIComponent(cleanPhone)}`;
  };

  const handleGenerate = () => {
    // Check for lunch coverage errors first
    if (lunchCoverageErrors.length > 0) {
      toast({
        title: "Cannot Generate",
        description: `${lunchCoverageErrors.length} lunch coverage error(s) must be resolved first.`,
        variant: "destructive"
      });
      return;
    }
    
    const pending = approvals.filter(a => a.status === "pending");
    if (pending.length > 0) {
      toast({
        title: "Cannot Generate",
        description: "Please resolve all pending approvals first.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Generating Schedule...",
      description: "Processing template, exceptions, and overrides.",
    });

    // Save exceptions to localStorage for the Schedule page to pick up
    localStorage.setItem("daily_exceptions", JSON.stringify(exceptions));

    // Save full approvals for Daily Run persistence and simplified approvedSubs for schedule engine
    localStorage.setItem("daily_approvals_full", JSON.stringify(approvals));
    
    const approvedSubs = approvals
      .filter(a => a.status === "approved" && 
        (a.type === "sub_staffing" || a.type === "lead_staffing" || a.type === "lead_reserve" || a.type === "all_day_staffing") &&
        (a.block === "AM" || a.block === "PM"))
      .map(a => ({
        clientId: a.clientId,
        block: a.block as "AM" | "PM",
        subStaffId: a.proposedSubId
      }));
    localStorage.setItem("daily_approved_subs", JSON.stringify(approvedSubs));

    // Navigate to schedule
    setTimeout(() => {
      setLocation("/schedule");
    }, 1500);
  };

  return (
    <Layout>
      <div className="flex flex-col min-h-[calc(100vh-140px)] lg:h-[calc(100vh-140px)] gap-4 md:gap-6">
        
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-none bg-card p-3 md:p-4 rounded-lg border shadow-sm gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
               <h1 className="text-xl md:text-2xl font-serif font-bold text-primary">Daily Run</h1>
               <Badge variant="outline" className="text-muted-foreground font-normal bg-background text-xs">
                 {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}
               </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-medium">
              <span>Changes: <span className="text-foreground">{exceptions.length + overrides.length + approvals.filter(a => a.status !== 'pending').length}</span></span>
              <span>Pending: <span className="text-foreground">{approvals.filter(a => a.status === 'pending').length}</span></span>
              <span className="hidden sm:inline">Last Run: <span className="text-foreground">08:30 AM</span></span>
            </div>
          </div>
          <Button size="default" onClick={handleGenerate} className="bg-primary text-primary-foreground shadow-md hover:bg-primary/90 w-full sm:w-auto">
            <Play className="mr-2 h-4 w-4 md:h-5 md:w-5 fill-current" />
            Generate Schedule
          </Button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 md:gap-6 overflow-visible lg:overflow-hidden">
          
          {/* LEFT: Exceptions Card */}
          <Card className="flex-1 flex flex-col min-w-0 border-border/60 shadow-sm overflow-hidden">
             <CardHeader className="py-4 border-b bg-muted/20">
               <CardTitle className="text-lg">Exceptions</CardTitle>
               <CardDescription>Record who is IN or OUT today.</CardDescription>
             </CardHeader>
             <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
               <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                 <TabsList className="w-full justify-start rounded-none border-b p-0 bg-transparent">
                   <TabsTrigger value="clients" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-6 py-3">Clients</TabsTrigger>
                   <TabsTrigger value="staff" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-6 py-3">Staff</TabsTrigger>
                 </TabsList>
                 
                 <div className="p-4 md:p-6 bg-card border-b space-y-4 md:space-y-6">
                    {/* Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Select {activeTab === "clients" ? "Client" : "Staff"}</Label>
                        <EntityCombobox
                          value={selectedEntityId}
                          onValueChange={setSelectedEntityId}
                          entities={activeTab === "clients" 
                            ? clientList.map(c => ({ id: c.id, name: c.name }))
                            : staffList.map(s => ({ id: s.id, name: s.name }))
                          }
                          placeholder={`Select ${activeTab === "clients" ? "client" : "staff"}...`}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Mode</Label>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant={mode === "in" ? "default" : "outline"} 
                            className={cn("flex-1", mode === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "")}
                            onClick={() => setMode("in")}
                          >
                            IN
                          </Button>
                          <Button 
                            variant={mode === "out" ? "default" : "outline"}
                            className={cn("flex-1", mode === "out" ? "bg-destructive hover:bg-destructive/90" : "")}
                            onClick={() => setMode("out")}
                          >
                            OUT
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-6">
                      <div className="flex items-center space-x-2 border p-3 rounded-md">
                         <Label htmlFor="all-day" className="cursor-pointer">All Day?</Label>
                         <Switch id="all-day" checked={allDay} onCheckedChange={setAllDay} />
                      </div>
                      
                      {needsTimeWindow(activeTab as any, mode, allDay) && (
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 animate-in fade-in slide-in-from-left-2">
                          <TimeInput label="Start" value={startTime} onChange={setStartTime} />
                          <span className="text-muted-foreground pt-4">to</span>
                          <TimeInput label="End" value={endTime} onChange={setEndTime} />
                        </div>
                      )}
                    </div>

                    <Button onClick={handleAddException} disabled={!selectedEntityId} className="w-full">
                      <Plus className="mr-2 h-4 w-4" /> Save Exception
                    </Button>
                 </div>

                 {/* Saved List */}
                 <ScrollArea className="flex-1 p-4 bg-secondary/5">
                   <div className="space-y-2">
                     {exceptions.filter(e => (activeTab === "clients" ? e.type === "client" : e.type === "staff")).length === 0 && (
                       <div className="text-center text-muted-foreground py-8 italic">
                         No exceptions recorded for today.
                       </div>
                     )}
                     {exceptions.filter(e => (activeTab === "clients" ? e.type === "client" : e.type === "staff")).map(ex => {
                       const name = ex.type === "client"
                         ? clientList.find(c => c.id === ex.entityId)?.name 
                         : staffList.find(s => s.id === ex.entityId)?.name;
                       
                       return (
                         <div key={ex.id} className="flex items-center justify-between p-3 bg-card border rounded-md shadow-sm">
                           <div className="flex items-center gap-3">
                             <Badge variant="outline" className={cn(
                               "uppercase font-bold w-12 justify-center",
                               ex.mode === "in" ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-destructive text-destructive bg-red-50"
                             )}>
                               {ex.mode}
                             </Badge>
                             <div className="flex flex-col">
                               <span className="font-medium">{name}</span>
                               <span className="text-xs text-muted-foreground flex items-center gap-1">
                                 {ex.allDay ? "All Day" : `${ex.timeWindow?.start} - ${ex.timeWindow?.end}`}
                                 {!ex.allDay && <Clock className="h-3 w-3" />}
                               </span>
                             </div>
                           </div>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8 text-muted-foreground hover:text-destructive"
                             onClick={() => handleRemoveException(ex.id)}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </div>
                       )
                     })}
                   </div>
                 </ScrollArea>
               </Tabs>
             </CardContent>
          </Card>
          
          {/* Done Entering Exceptions Button */}
          {!exceptionsFinalized && (
            <Button 
              onClick={handleFinalizeExceptions}
              className="w-full bg-primary hover:bg-primary/90"
              disabled={!dataReady}
              data-testid="button-done-exceptions"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {!dataReady ? "Loading..." : exceptions.length === 0 ? "Check Schedule" : "Done Entering Exceptions"}
            </Button>
          )}

          {/* RIGHT: Errors, Approvals & Overrides */}
          <div className="w-full lg:w-96 flex flex-col gap-4 md:gap-6 min-w-0">
            
            {/* Lunch Coverage Errors */}
            {lunchCoverageErrors.length > 0 && (
              <Card className="flex-shrink-0 border-destructive/50 shadow-sm bg-destructive/5">
                <CardHeader className="py-3 bg-destructive/10 border-b border-destructive/20">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <CardTitle className="text-base text-destructive">Lunch Coverage Errors</CardTitle>
                  </div>
                  <CardDescription className="text-destructive/80 text-xs mt-1">
                    Schedule cannot be generated until these errors are resolved
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {lunchCoverageErrors.map((error, idx) => (
                      <div key={idx} className="p-2 rounded border border-destructive/20 bg-white dark:bg-slate-900 text-sm">
                        <div className="font-medium text-destructive">{error.lunchSlot}: {error.clientName}</div>
                        <div className="text-xs text-muted-foreground mt-1">{error.reason}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Approvals */}
            <Card className="flex-1 flex flex-col min-h-0 border-border/60 shadow-sm">
              <CardHeader className="py-3 bg-muted/20 border-b">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <AlertCircle className="w-4 h-4 text-amber-500" />
                     <CardTitle className="text-base">Pending Approvals</CardTitle>
                   </div>
                   <Button 
                     size="sm" 
                     variant="outline" 
                     onClick={() => handleCheckApprovals(true)}
                     className="h-7 text-xs"
                     data-testid="button-check-approvals"
                   >
                     <RefreshCw className="w-3 h-3 mr-1" />
                     Refresh
                   </Button>
                 </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-3">
                    {approvals.length === 0 && (
                      <div className="text-center text-muted-foreground py-4 text-sm">
                        {exceptionsFinalized 
                          ? "No sub staffing needed."
                          : exceptions.length === 0 
                            ? "Click 'Check Schedule' to verify the day's schedule."
                            : "Click 'Done Entering Exceptions' to check for approval needs."}
                      </div>
                    )}
                    {approvals.map(app => (
                      <div key={app.id} className={cn(
                        "p-3 rounded-md border text-sm space-y-2",
                        app.status === "pending" ? "bg-card border-amber-200" : "opacity-50"
                      )}>
                         <div className="font-medium text-foreground">{app.description}</div>
                         <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">Reason: {app.reason}</div>
                         
                         {app.status === "pending" ? (
                           <div className="flex gap-2 pt-1">
                             <Button size="sm" variant="outline" className="flex-1 h-7 text-xs border-destructive text-destructive hover:bg-destructive/10" onClick={() => handleApprove(app.id, 'denied')}>
                               Deny
                             </Button>
                             <Button size="sm" className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApprove(app.id, 'approved')}>
                               Approve
                             </Button>
                           </div>
                         ) : (
                           <Badge variant="outline" className={cn("w-full justify-center", app.status === "approved" ? "text-emerald-600 border-emerald-200" : "text-destructive border-destructive")}>
                             {app.status.toUpperCase()}
                           </Badge>
                         )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Overrides */}
            <Card className="flex-shrink-0 border-border/60 shadow-sm">
              <CardHeader className="py-3 bg-muted/20 border-b">
                 <div className="flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4 text-primary" />
                   <CardTitle className="text-base">Manual Override</CardTitle>
                 </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                 <div className="space-y-2">
                   <Label className="text-xs">Staff Member</Label>
                   <Select value={overrideStaffId} onValueChange={setOverrideStaffId}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select staff..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.filter(s => s.active).sort((a, b) => a.name.localeCompare(b.name)).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1 space-y-2">
                      <Label className="text-xs">Block</Label>
                      <Select value={overrideBlock} onValueChange={(v) => setOverrideBlock(v as any)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AM">AM</SelectItem>
                          <SelectItem value="PM">PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs">Force Value</Label>
                      <Input 
                        placeholder="e.g. Admin Time" 
                        className="h-8" 
                        value={overrideValue} 
                        onChange={(e) => setOverrideValue(e.target.value)} 
                      />
                    </div>
                 </div>
                 <Button size="sm" variant="secondary" className="w-full h-8" onClick={handleAddOverride} disabled={!overrideStaffId || !overrideValue}>
                   <Save className="mr-2 h-3 w-3" /> Save Override
                 </Button>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
      
      {/* Cancellation Contact Popup */}
      <Dialog open={showCancellationPopup} onOpenChange={setShowCancellationPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Cancellation Approved
            </DialogTitle>
            <DialogDescription>
              {cancellationClientName}'s {cancellationBlock} session has been cancelled. Please notify the caregiver.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {getCancellationContacts().length === 0 ? (
              <div className="text-center text-muted-foreground py-4 text-sm">
                No emergency contacts on file for this client.
              </div>
            ) : (
              getCancellationContacts().map((contact, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-secondary/10">
                  <div className="space-y-0.5">
                    <div className="font-medium text-foreground">{contact.name}</div>
                    <div className="text-xs text-muted-foreground">{contact.relationship}</div>
                  </div>
                  <a 
                    href={formatTeamsCallLink(contact.phone)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                    data-testid={`button-call-contact-${idx}`}
                  >
                    <Phone className="w-4 h-4" />
                    {contact.phone}
                  </a>
                </div>
              ))
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCancellationPopup(false);
                toast({ description: "Cancellation approved." });
              }}
              data-testid="button-close-cancellation-popup"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

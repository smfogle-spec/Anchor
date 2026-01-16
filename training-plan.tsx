import { useState, useMemo } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, GripVertical, ChevronUp, ChevronDown, User, Calendar, BookOpen, CheckCircle2, AlertTriangle, Clock, Check, X, Ban, SkipForward, Pause } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { Staff, Client, TrainingPlan, TrainingSession } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface TrainingPlanWithSessions extends TrainingPlan {
  sessions: TrainingSession[];
}

const TRACK_LABELS: Record<string, { label: string; badge: string; color: string }> = {
  caseload_change: { label: "Caseload Changes", badge: "P1 Queue", color: "bg-orange-100 text-orange-700" },
  new_hire: { label: "New Hires", badge: "Protected", color: "bg-blue-100 text-blue-700" },
  additional: { label: "Additional Trainings", badge: "Nice-to-have", color: "bg-gray-100 text-gray-600" }
};

const STAGE_LABELS: Record<string, string> = {
  shadow: "Shadow",
  support: "Support",
  sign_off: "Sign Off",
  shadow_support: "Shadow/Support"
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planned: { label: "Planned", color: "text-muted-foreground" },
  completed: { label: "Completed", color: "text-amber-600" },
  confirmed: { label: "Confirmed", color: "text-green-600" },
  disrupted: { label: "Disrupted", color: "text-red-600" },
  blocked: { label: "Blocked", color: "text-red-600" },
  skipped: { label: "Skipped", color: "text-gray-500" }
};

function getWeekDates(weekOffset: number = 0): { date: Date; dayName: string; dateStr: string }[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + (weekOffset * 7));
  
  const days = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    days.push({
      date,
      dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
      dateStr: date.toISOString().split('T')[0]
    });
  }
  return days;
}

function TrackCard({ 
  plan, 
  staffList, 
  clientList, 
  onSelect,
  isSelected,
  onMoveUp,
  onMoveDown,
  showPriority
}: { 
  plan: TrainingPlanWithSessions;
  staffList: Staff[];
  clientList: Client[];
  onSelect: () => void;
  isSelected: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  showPriority?: number;
}) {
  const trainee = staffList.find(s => s.id === plan.traineeId);
  const client = clientList.find(c => c.id === plan.clientId);
  const currentSession = plan.sessions.find(s => s.status === 'planned' || s.status === 'blocked');
  const completedCount = plan.sessions.filter(s => s.status === 'confirmed' || s.status === 'completed').length;
  
  return (
    <div 
      className={cn(
        "p-3 border rounded-lg cursor-pointer transition-colors",
        isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
      )}
      onClick={onSelect}
      data-testid={`training-plan-${plan.id}`}
    >
      <div className="flex items-start gap-2">
        {showPriority !== undefined && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-muted-foreground">#{showPriority + 1}</span>
            {(onMoveUp || onMoveDown) && (
              <div className="flex flex-col gap-0.5">
                {onMoveUp && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5" 
                    onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                    data-testid={`button-move-up-${plan.id}`}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                )}
                {onMoveDown && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5" 
                    onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                    data-testid={`button-move-down-${plan.id}`}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">{trainee?.name || 'Unknown'}</span>
            <span className="text-muted-foreground">→</span>
            <span className="truncate">{client?.name || 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">{plan.trainingStyle}</Badge>
            <span>{completedCount}/{plan.sessions.length} stages</span>
            {currentSession && (
              <span className={cn("flex items-center gap-1", STATUS_LABELS[currentSession.status]?.color)}>
                <Clock className="h-3 w-3" />
                {STAGE_LABELS[currentSession.stageType]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineCell({ 
  session, 
  trainee, 
  client, 
  trainer 
}: { 
  session?: TrainingSession; 
  trainee?: Staff;
  client?: Client;
  trainer?: Staff;
}) {
  if (!session) {
    return <div className="h-16 border rounded bg-muted/20" />;
  }
  
  const statusColor = STATUS_LABELS[session.status]?.color || '';
  const isSignOff = session.stageType === 'sign_off';
  
  return (
    <div className={cn(
      "h-16 border rounded p-1.5 text-xs",
      session.status === 'confirmed' ? 'bg-green-50 border-green-200' :
      session.status === 'blocked' ? 'bg-red-50 border-red-200' :
      session.status === 'disrupted' ? 'bg-amber-50 border-amber-200' :
      'bg-white'
    )}>
      <div className="font-medium truncate">
        {session.stageType === 'shadow' && `(${client?.name?.split(' ').map(n => n[0]).join('')})`}
        {session.stageType === 'support' && client?.name?.split(' ').map(n => n[0]).join('')}
        {session.stageType === 'shadow_support' && `(${client?.name?.split(' ').map(n => n[0]).join('')}) / ${client?.name?.split(' ').map(n => n[0]).join('')}`}
        {session.stageType === 'sign_off' && client?.name?.split(' ').map(n => n[0]).join('')}
      </div>
      <Badge 
        variant="outline" 
        className={cn(
          "text-[10px] mt-1",
          isSignOff ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-purple-100 text-purple-700 border-purple-200"
        )}
      >
        {STAGE_LABELS[session.stageType]} {trainer ? `with ${trainer.name?.split(' ')[0]}` : ''}
      </Badge>
    </div>
  );
}

export default function TrainingPlan() {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPlan, setNewPlan] = useState({
    traineeId: '',
    clientId: '',
    trackType: 'caseload_change',
    trainingStyle: 'full'
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading: isLoadingPlans } = useQuery<TrainingPlanWithSessions[]>({
    queryKey: ["/api/training-plans"],
    queryFn: async () => {
      const response = await fetch("/api/training-plans");
      if (!response.ok) throw new Error("Failed to fetch training plans");
      const planList = await response.json();
      const plansWithSessions = await Promise.all(
        planList.map(async (plan: TrainingPlan) => {
          const sessionsRes = await fetch(`/api/training-sessions?planId=${plan.id}`);
          const sessions = sessionsRes.ok ? await sessionsRes.json() : [];
          return { ...plan, sessions };
        })
      );
      return plansWithSessions;
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

  const createPlanMutation = useMutation({
    mutationFn: async (plan: typeof newPlan) => {
      const response = await fetch("/api/training-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      if (!response.ok) throw new Error("Failed to create training plan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-plans"] });
      setAddDialogOpen(false);
      setNewPlan({ traineeId: '', clientId: '', trackType: 'caseload_change', trainingStyle: 'full' });
      toast({ description: "Training plan created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create training plan", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (planIds: string[]) => {
      const response = await fetch("/api/training-plans/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planIds }),
      });
      if (!response.ok) throw new Error("Failed to reorder");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-plans"] });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, status, trainerId, reason }: { 
      sessionId: string; 
      status: string; 
      trainerId?: string;
      reason?: string;
    }) => {
      const body: Record<string, unknown> = { status };
      if (trainerId) body.trainerId = trainerId;
      if (reason) {
        if (status === 'blocked') body.blockReason = reason;
        if (status === 'disrupted') body.disruptReason = reason;
      }
      const response = await fetch(`/api/training-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Failed to update session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-plans"] });
      toast({ description: "Session updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update session", variant: "destructive" });
    },
  });

  const caseloadPlans = useMemo(() => 
    plans.filter(p => p.trackType === 'caseload_change' && p.status === 'active')
      .sort((a, b) => a.priority - b.priority),
    [plans]
  );
  
  const newHirePlans = useMemo(() => 
    plans.filter(p => p.trackType === 'new_hire' && p.status === 'active'),
    [plans]
  );
  
  const additionalPlans = useMemo(() => 
    plans.filter(p => p.trackType === 'additional' && p.status === 'active'),
    [plans]
  );

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const week1 = getWeekDates(0);
  const week2 = getWeekDates(1);

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const ids = caseloadPlans.map(p => p.id);
    [ids[index], ids[index - 1]] = [ids[index - 1], ids[index]];
    reorderMutation.mutate(ids);
  };

  const handleMoveDown = (index: number) => {
    if (index === caseloadPlans.length - 1) return;
    const ids = caseloadPlans.map(p => p.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    reorderMutation.mutate(ids);
  };

  const activeTrainees = staffList
    .filter(s => s.active)
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const activeClients = clientList
    .filter(c => c.active)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
        
        {/* Left Panel - Track Lists */}
        <div className="w-full lg:w-96 flex flex-col gap-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-serif font-bold text-primary">Training Plan</h1>
            <Button onClick={() => setAddDialogOpen(true)} size="sm" data-testid="button-add-training">
              <Plus className="h-4 w-4 mr-1" />
              Add Training
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-6 pr-4">
              
              {/* Caseload Changes (P1 Queue) */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Caseload Changes</CardTitle>
                    <Badge className={TRACK_LABELS.caseload_change.color}>{TRACK_LABELS.caseload_change.badge}</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Attempts #1 first. If blocked today, tries #2, then #3...
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {caseloadPlans.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No caseload trainings</p>
                  ) : (
                    caseloadPlans.map((plan, idx) => (
                      <TrackCard
                        key={plan.id}
                        plan={plan}
                        staffList={staffList}
                        clientList={clientList}
                        onSelect={() => setSelectedPlanId(plan.id)}
                        isSelected={selectedPlanId === plan.id}
                        showPriority={idx}
                        onMoveUp={idx > 0 ? () => handleMoveUp(idx) : undefined}
                        onMoveDown={idx < caseloadPlans.length - 1 ? () => handleMoveDown(idx) : undefined}
                      />
                    ))
                  )}
                </CardContent>
              </Card>

              {/* New Hires (Protected) */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">New Hires</CardTitle>
                    <Badge className={TRACK_LABELS.new_hire.color}>{TRACK_LABELS.new_hire.badge}</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Near-uncancelable. Only disrupted if no other legal option.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {newHirePlans.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No new hire trainings</p>
                  ) : (
                    newHirePlans.map((plan) => (
                      <TrackCard
                        key={plan.id}
                        plan={plan}
                        staffList={staffList}
                        clientList={clientList}
                        onSelect={() => setSelectedPlanId(plan.id)}
                        isSelected={selectedPlanId === plan.id}
                      />
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Additional Trainings */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Additional Trainings</CardTitle>
                    <Badge className={TRACK_LABELS.additional.color}>{TRACK_LABELS.additional.badge}</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Lowest priority. Happens only if the day allows.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {additionalPlans.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No additional trainings</p>
                  ) : (
                    additionalPlans.map((plan) => (
                      <TrackCard
                        key={plan.id}
                        plan={plan}
                        staffList={staffList}
                        clientList={clientList}
                        onSelect={() => setSelectedPlanId(plan.id)}
                        isSelected={selectedPlanId === plan.id}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Track Details + Timeline */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedPlan ? (
            <>
              {/* Track Details */}
              <Card className="mb-4">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {staffList.find(s => s.id === selectedPlan.traineeId)?.name} → {clientList.find(c => c.id === selectedPlan.clientId)?.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={TRACK_LABELS[selectedPlan.trackType]?.color}>
                          {TRACK_LABELS[selectedPlan.trackType]?.label}
                        </Badge>
                        <Badge variant="outline">{selectedPlan.trainingStyle}</Badge>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>Stages: {selectedPlan.sessions.filter(s => s.status === 'confirmed').length}/{selectedPlan.sessions.length} complete</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {/* Session Progress Controls */}
                    <div className="flex gap-2 flex-wrap">
                      {selectedPlan.sessions.sort((a, b) => a.stageOrder - b.stageOrder).map((session) => {
                        const isActive = session.status === 'planned' || session.status === 'completed';
                        const isComplete = session.status === 'confirmed';
                        
                        return (
                          <DropdownMenu key={session.id}>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-all hover:ring-2 hover:ring-offset-1",
                                  session.status === 'confirmed' ? "bg-green-100 text-green-700 border-green-200 hover:ring-green-300" :
                                  session.status === 'completed' ? "bg-amber-100 text-amber-700 border-amber-200 hover:ring-amber-300" :
                                  session.status === 'blocked' ? "bg-red-100 text-red-700 border-red-200 hover:ring-red-300" :
                                  session.status === 'disrupted' ? "bg-orange-100 text-orange-700 border-orange-200 hover:ring-orange-300" :
                                  session.status === 'skipped' ? "bg-gray-100 text-gray-500 border-gray-200 hover:ring-gray-300 line-through" :
                                  "bg-gray-100 text-gray-600 border-gray-200 hover:ring-gray-300"
                                )}
                                data-testid={`session-status-${session.id}`}
                              >
                                {session.stageOrder}. {STAGE_LABELS[session.stageType]}
                                {session.status !== 'planned' && (
                                  <span className="ml-1">({STATUS_LABELS[session.status]?.label})</span>
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                Stage {session.stageOrder}: {STAGE_LABELS[session.stageType]}
                              </div>
                              <DropdownMenuSeparator />
                              
                              {session.status !== 'completed' && session.status !== 'confirmed' && (
                                <DropdownMenuItem 
                                  onClick={() => updateSessionMutation.mutate({ sessionId: session.id, status: 'completed' })}
                                  data-testid={`action-complete-${session.id}`}
                                >
                                  <Check className="h-4 w-4 mr-2 text-amber-600" />
                                  Mark Complete (pending sign-off)
                                </DropdownMenuItem>
                              )}
                              
                              {session.status !== 'confirmed' && (
                                <DropdownMenuItem 
                                  onClick={() => updateSessionMutation.mutate({ sessionId: session.id, status: 'confirmed' })}
                                  data-testid={`action-confirm-${session.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                                  Confirm Sign-off
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              
                              {session.status !== 'blocked' && (
                                <DropdownMenuItem 
                                  onClick={() => updateSessionMutation.mutate({ sessionId: session.id, status: 'blocked' })}
                                  data-testid={`action-block-${session.id}`}
                                >
                                  <Ban className="h-4 w-4 mr-2 text-red-600" />
                                  Mark Blocked
                                </DropdownMenuItem>
                              )}
                              
                              {session.status !== 'disrupted' && (
                                <DropdownMenuItem 
                                  onClick={() => updateSessionMutation.mutate({ sessionId: session.id, status: 'disrupted' })}
                                  data-testid={`action-disrupt-${session.id}`}
                                >
                                  <Pause className="h-4 w-4 mr-2 text-orange-600" />
                                  Mark Disrupted
                                </DropdownMenuItem>
                              )}
                              
                              {session.status !== 'skipped' && (
                                <DropdownMenuItem 
                                  onClick={() => updateSessionMutation.mutate({ sessionId: session.id, status: 'skipped' })}
                                  data-testid={`action-skip-${session.id}`}
                                >
                                  <SkipForward className="h-4 w-4 mr-2 text-gray-500" />
                                  Skip Stage
                                </DropdownMenuItem>
                              )}
                              
                              {session.status !== 'planned' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => updateSessionMutation.mutate({ sessionId: session.id, status: 'planned' })}
                                    data-testid={`action-reset-${session.id}`}
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Reset to Planned
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      })}
                    </div>
                    
                    <p className="text-xs text-muted-foreground">Click a stage to update its status</p>
                    
                    {/* Trainer Assignment */}
                    <div className="pt-3 border-t">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Trainer Assignment
                      </h4>
                      <div className="space-y-2">
                        {selectedPlan.sessions
                          .filter(s => s.status !== 'confirmed' && s.status !== 'skipped')
                          .sort((a, b) => a.stageOrder - b.stageOrder)
                          .slice(0, 3) // Show next 3 upcoming sessions
                          .map((session) => {
                            const trainers = staffList.filter(s => s.active && s.isTrainer);
                            const currentTrainer = staffList.find(s => s.id === session.trainerId);
                            
                            return (
                              <div key={session.id} className="flex items-center gap-3 text-sm">
                                <span className="w-24 text-muted-foreground truncate">
                                  {session.stageOrder}. {STAGE_LABELS[session.stageType]}
                                </span>
                                <Select 
                                  value={session.trainerId || ""} 
                                  onValueChange={(v) => updateSessionMutation.mutate({ 
                                    sessionId: session.id, 
                                    status: session.status, 
                                    trainerId: v || undefined 
                                  })}
                                >
                                  <SelectTrigger className="w-40" data-testid={`select-trainer-${session.id}`}>
                                    <SelectValue placeholder="Assign trainer..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {trainers.length === 0 ? (
                                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                        No trainers available. Mark staff as trainers in Staff Info.
                                      </div>
                                    ) : (
                                      trainers.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                                {currentTrainer && (
                                  <Badge variant="outline" className="text-xs">
                                    {currentTrainer.name}
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        {selectedPlan.sessions.filter(s => s.status !== 'confirmed' && s.status !== 'skipped').length === 0 && (
                          <p className="text-xs text-muted-foreground">All sessions completed or skipped</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Two-Week Timeline */}
              <Card className="flex-1 overflow-hidden">
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Two-Week Schedule</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100%-60px)]">
                    <div className="p-4 space-y-4">
                      {/* Week 1 */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">This Week</h4>
                        <div className="grid grid-cols-5 gap-2">
                          {week1.map(day => (
                            <div key={day.dateStr} className="text-center">
                              <div className="text-xs font-medium mb-1">{day.dayName}</div>
                              <div className="text-xs text-muted-foreground mb-2">
                                {day.date.getMonth() + 1}/{day.date.getDate()}
                              </div>
                              <TimelineCell
                                session={selectedPlan.sessions.find(s => s.scheduledDate === day.dateStr)}
                                trainee={staffList.find(s => s.id === selectedPlan.traineeId)}
                                client={clientList.find(c => c.id === selectedPlan.clientId)}
                                trainer={selectedPlan.preferredTrainerId ? staffList.find(s => s.id === selectedPlan.preferredTrainerId) : undefined}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Week 2 */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">Next Week</h4>
                        <div className="grid grid-cols-5 gap-2">
                          {week2.map(day => (
                            <div key={day.dateStr} className="text-center">
                              <div className="text-xs font-medium mb-1">{day.dayName}</div>
                              <div className="text-xs text-muted-foreground mb-2">
                                {day.date.getMonth() + 1}/{day.date.getDate()}
                              </div>
                              <TimelineCell
                                session={selectedPlan.sessions.find(s => s.scheduledDate === day.dateStr)}
                                trainee={staffList.find(s => s.id === selectedPlan.traineeId)}
                                client={clientList.find(c => c.id === selectedPlan.clientId)}
                                trainer={selectedPlan.preferredTrainerId ? staffList.find(s => s.id === selectedPlan.preferredTrainerId) : undefined}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a training plan to view details</p>
                <p className="text-sm mt-1">or create a new one to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Training Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Training Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Trainee (Staff)</Label>
              <Select value={newPlan.traineeId} onValueChange={(v) => setNewPlan({...newPlan, traineeId: v})}>
                <SelectTrigger data-testid="select-trainee">
                  <SelectValue placeholder="Select staff member..." />
                </SelectTrigger>
                <SelectContent>
                  {activeTrainees.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={newPlan.clientId} onValueChange={(v) => setNewPlan({...newPlan, clientId: v})}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {activeClients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Track Type</Label>
              <Select value={newPlan.trackType} onValueChange={(v) => setNewPlan({...newPlan, trackType: v})}>
                <SelectTrigger data-testid="select-track-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caseload_change">Caseload Change (P1 Queue)</SelectItem>
                  <SelectItem value="new_hire">New Hire (Protected)</SelectItem>
                  <SelectItem value="additional">Additional (Nice-to-have)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Training Style</Label>
              <Select value={newPlan.trainingStyle} onValueChange={(v) => setNewPlan({...newPlan, trainingStyle: v})}>
                <SelectTrigger data-testid="select-training-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="half">Half (Shadow/Support split → Sign Off)</SelectItem>
                  <SelectItem value="full">Full (Shadow → Support → Sign Off)</SelectItem>
                  <SelectItem value="double">Double (Shadow×2 → Support×2 → Sign Off)</SelectItem>
                  <SelectItem value="expedited">Expedited (Sign Off only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} data-testid="button-cancel-training">Cancel</Button>
            <Button 
              onClick={() => createPlanMutation.mutate(newPlan)}
              disabled={!newPlan.traineeId || !newPlan.clientId}
              data-testid="button-create-training"
            >
              Create Training Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

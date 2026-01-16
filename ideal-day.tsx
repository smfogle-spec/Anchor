import { useState, useMemo, useCallback, useEffect } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Save, Copy, RotateCcw, AlertTriangle, Plus, Trash2, Clock, Users, Car, Coffee, Phone, HeartPulse, ChevronDown, ChevronRight, Loader2, Check, X, Wand2 } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Staff, Client, TemplateAssignment, ClientLocation, IdealDayTemplate, IdealDaySegment, IdealDayLunchPairing, TemplateLunchPairingGroup } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { IdealDayGrid } from "@/components/ideal-day-grid";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
];

const SEGMENT_TYPES = [
  { value: "client", label: "Client", icon: Users, color: "bg-primary/10 border-primary/30 text-primary" },
  { value: "lunch", label: "Lunch", icon: Coffee, color: "bg-amber-100 border-amber-300 text-amber-700" },
  { value: "drive", label: "Drive", icon: Car, color: "bg-blue-100 border-blue-300 text-blue-700" },
  { value: "break", label: "Break", icon: HeartPulse, color: "bg-green-100 border-green-300 text-green-700" },
  { value: "on_call", label: "On Call", icon: Phone, color: "bg-purple-100 border-purple-300 text-purple-700" },
  { value: "lead_support", label: "Lead/BX Support", icon: Users, color: "bg-teal-100 border-teal-300 text-teal-700" },
  { value: "open", label: "Open", icon: Clock, color: "bg-gray-100 border-gray-300 text-gray-600" },
  { value: "out", label: "Out", icon: X, color: "bg-red-100 border-red-300 text-red-700" },
];

const TIMELINE_START = 420; // 7:00 AM in minutes
const TIMELINE_END = 1020; // 5:00 PM in minutes
const TIMELINE_DURATION = TIMELINE_END - TIMELINE_START;

const minuteToPercent = (minute: number) => {
  return ((minute - TIMELINE_START) / TIMELINE_DURATION) * 100;
};

const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, "0")} ${ampm}`;
};

const parseTimeToMinutes = (time: string): number => {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const mins = parseInt(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  return hours * 60 + mins;
};

interface SegmentDisplayProps {
  segment: IdealDaySegment;
  clients: Client[];
  onEdit: (segment: IdealDaySegment) => void;
  onDelete: (segmentId: string) => void;
}

const SegmentDisplay = ({ segment, clients, onEdit, onDelete }: SegmentDisplayProps) => {
  const segmentType = SEGMENT_TYPES.find(t => t.value === segment.segmentType) || SEGMENT_TYPES[6];
  const Icon = segmentType.icon;
  const client = segment.clientId ? clients.find(c => c.id === segment.clientId) : null;
  
  const left = minuteToPercent(segment.startMinute);
  const width = minuteToPercent(segment.endMinute) - left;
  
  const displayValue = segment.displayValue || (client ? client.name : segmentType.label);
  const duration = segment.endMinute - segment.startMinute;
  
  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 rounded border cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 flex items-center px-1 overflow-hidden group",
        segmentType.color
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
      onClick={() => onEdit(segment)}
      data-testid={`segment-${segment.id}`}
    >
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <Icon className="h-3 w-3 flex-shrink-0" />
        <span className="text-xs font-medium truncate">{displayValue}</span>
      </div>
      {duration >= 30 && (
        <span className="text-[10px] opacity-70 flex-shrink-0 ml-1">
          {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")}
        </span>
      )}
      <button
        className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onDelete(segment.id); }}
        data-testid={`delete-segment-${segment.id}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
};

interface StaffRowProps {
  staffMember: Staff;
  segments: IdealDaySegment[];
  clients: Client[];
  onEditSegment: (segment: IdealDaySegment) => void;
  onDeleteSegment: (segmentId: string) => void;
  onAddSegment: (staffId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const StaffRow = ({ staffMember, segments, clients, onEditSegment, onDeleteSegment, onAddSegment, isExpanded, onToggleExpand }: StaffRowProps) => {
  const sortedSegments = useMemo(() => 
    [...segments].sort((a, b) => a.startMinute - b.startMinute),
    [segments]
  );
  
  return (
    <div className="border-b border-border hover:bg-muted/30 transition-colors">
      <div className="flex items-center">
        <div className="w-40 flex-shrink-0 px-2 py-2 flex items-center gap-2 border-r border-border bg-muted/20">
          <button onClick={onToggleExpand} className="p-0.5 hover:bg-muted rounded">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{staffMember.name}</div>
            <div className="text-[10px] text-muted-foreground">{staffMember.role}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-50 hover:opacity-100"
            onClick={() => onAddSegment(staffMember.id)}
            data-testid={`add-segment-${staffMember.id}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="flex-1 relative h-12">
          {sortedSegments.map(segment => (
            <SegmentDisplay
              key={segment.id}
              segment={segment}
              clients={clients}
              onEdit={onEditSegment}
              onDelete={onDeleteSegment}
            />
          ))}
        </div>
      </div>
      
      {isExpanded && (
        <div className="bg-muted/10 border-t border-border/50 px-4 py-2">
          <div className="text-xs text-muted-foreground">
            {sortedSegments.length === 0 ? (
              <span>No segments defined. Click + to add segments.</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sortedSegments.map(seg => {
                  const type = SEGMENT_TYPES.find(t => t.value === seg.segmentType);
                  const client = seg.clientId ? clients.find(c => c.id === seg.clientId) : null;
                  return (
                    <Badge key={seg.id} variant="outline" className="text-[10px]">
                      {formatMinutesToTime(seg.startMinute)} - {formatMinutesToTime(seg.endMinute)}: {client?.name || type?.label || seg.segmentType}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface SegmentEditorDialogProps {
  segment: IdealDaySegment | null;
  staffId: string | null;
  templateId: string;
  clients: Client[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (segment: Partial<IdealDaySegment>) => void;
}

const SegmentEditorDialog = ({ segment, staffId, templateId, clients, isOpen, onClose, onSave }: SegmentEditorDialogProps) => {
  const [segmentType, setSegmentType] = useState(segment?.segmentType || "client");
  const [clientId, setClientId] = useState(segment?.clientId || "");
  const [startTime, setStartTime] = useState(segment ? formatMinutesToTime(segment.startMinute).replace(" ", "") : "8:30AM");
  const [endTime, setEndTime] = useState(segment ? formatMinutesToTime(segment.endMinute).replace(" ", "") : "11:30AM");
  const [displayValue, setDisplayValue] = useState(segment?.displayValue || "");
  const [reason, setReason] = useState(segment?.reason || "");
  
  const handleSave = () => {
    const startMinute = parseTimeToMinutes(startTime);
    const endMinute = parseTimeToMinutes(endTime);
    
    if (startMinute >= endMinute) {
      alert("End time must be after start time");
      return;
    }
    
    onSave({
      id: segment?.id,
      templateId,
      staffId: staffId || segment?.staffId || "",
      segmentType,
      clientId: segmentType === "client" ? clientId : null,
      startMinute,
      endMinute,
      displayValue: displayValue || null,
      reason: reason || null,
      sortOrder: segment?.sortOrder || 0,
    });
    onClose();
  };
  
  const sortedClients = useMemo(() => 
    [...clients].filter(c => c.active).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{segment ? "Edit Segment" : "Add Segment"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Segment Type</Label>
            <Select value={segmentType} onValueChange={setSegmentType}>
              <SelectTrigger data-testid="segment-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {segmentType === "client" && (
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger data-testid="client-select">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedClients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="8:30AM"
                data-testid="start-time-input"
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="11:30AM"
                data-testid="end-time-input"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Display Label (optional)</Label>
            <Input
              value={displayValue}
              onChange={(e) => setDisplayValue(e.target.value)}
              placeholder="Custom display text..."
              data-testid="display-value-input"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Additional notes..."
              data-testid="reason-input"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} data-testid="save-segment-btn">
            {segment ? "Update" : "Add"} Segment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TimelineHeader = () => {
  const timeMarkers = [
    { minute: 420, label: "7:00" },
    { minute: 510, label: "8:30" },
    { minute: 690, label: "11:30" },
    { minute: 720, label: "12:00" },
    { minute: 750, label: "12:30" },
    { minute: 780, label: "1:00" },
    { minute: 960, label: "4:00" },
    { minute: 1020, label: "5:00" },
  ];
  
  return (
    <div className="flex items-center border-b border-border bg-muted/50">
      <div className="w-40 flex-shrink-0 px-2 py-1 border-r border-border">
        <span className="text-xs font-medium text-muted-foreground">Staff</span>
      </div>
      <div className="flex-1 relative h-6">
        {timeMarkers.map(marker => (
          <div
            key={marker.minute}
            className="absolute top-0 bottom-0 border-l border-border/50"
            style={{ left: `${minuteToPercent(marker.minute)}%` }}
          >
            <span className="absolute -top-0.5 -translate-x-1/2 text-[10px] text-muted-foreground">
              {marker.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function IdealDayPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState("mon");
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
  const [editingSegment, setEditingSegment] = useState<IdealDaySegment | null>(null);
  const [addingForStaffId, setAddingForStaffId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copyTargetDay, setCopyTargetDay] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const { data: allStaff = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });
  
  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  const { data: allLocations = [] } = useQuery<ClientLocation[]>({
    queryKey: ["/api/client-locations"],
    queryFn: async () => {
      const response = await fetch("/api/client-locations");
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
  });
  
  const { data: templateAssignments = [] } = useQuery<TemplateAssignment[]>({
    queryKey: ["/api/template"],
    queryFn: async () => {
      const response = await fetch("/api/template");
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
  });
  
  const { data: baselinePairingGroups = [] } = useQuery<TemplateLunchPairingGroup[]>({
    queryKey: ["/api/template-lunch-pairing-groups"],
    queryFn: async () => {
      const response = await fetch("/api/template-lunch-pairing-groups");
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
  });
  
  const { data: templateData, isLoading: isLoadingTemplate } = useQuery<{
    template: IdealDayTemplate;
    segments: IdealDaySegment[];
    lunchPairings: IdealDayLunchPairing[];
  } | null>({
    queryKey: ["/api/ideal-day-templates", selectedDay, "full"],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/ideal-day-templates/${selectedDay}/full`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Failed to fetch");
        return response.json();
      } catch {
        return null;
      }
    },
  });
  
  const createTemplateMutation = useMutation({
    mutationFn: async (weekDay: string) => {
      const response = await apiRequest("POST", "/api/ideal-day-templates", { weekDay });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideal-day-templates"] });
    },
  });
  
  const saveSegmentMutation = useMutation({
    mutationFn: async (segment: Partial<IdealDaySegment>) => {
      if (segment.id) {
        const response = await apiRequest("PATCH", `/api/ideal-day-segments/${segment.id}`, segment);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/ideal-day-segments", segment);
        return response.json();
      }
    },
    onSuccess: async (_data, variables) => {
      // Force immediate refetch to update the grid with new segment data
      await queryClient.refetchQueries({ queryKey: ["/api/ideal-day-templates", selectedDay, "full"] });
      // Also invalidate the by-weekday query used by Daily Run page
      queryClient.invalidateQueries({ queryKey: ["/api/ideal-day-segments/by-weekday", selectedDay] });
      toast({
        title: "Saved",
        description: "Segment saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save segment",
        variant: "destructive",
      });
    },
  });
  
  const deleteSegmentMutation = useMutation({
    mutationFn: async (segmentId: string) => {
      await apiRequest("DELETE", `/api/ideal-day-segments/${segmentId}`);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/ideal-day-templates", selectedDay, "full"] });
    },
  });
  
  const generateFromTemplateMutation = useMutation({
    mutationFn: async (weekDay: string) => {
      const response = await apiRequest("POST", `/api/ideal-day-templates/${weekDay}/generate`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideal-day-templates"] });
    },
  });
  
  const activeStaff = useMemo(() => 
    allStaff
      .filter(s => s.active)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [allStaff]
  );
  
  const segmentsByStaff = useMemo(() => {
    const map = new Map<string, IdealDaySegment[]>();
    if (templateData?.segments) {
      templateData.segments.forEach(seg => {
        const existing = map.get(seg.staffId) || [];
        existing.push(seg);
        map.set(seg.staffId, existing);
      });
    }
    return map;
  }, [templateData?.segments]);
  
  // Filter baseline pairing groups to only include those where ALL clients are present on this weekday
  const availableBaselinePairings = useMemo(() => {
    // Get clients who are scheduled on this weekday
    const clientsOnDay = new Set<string>();
    templateAssignments
      .filter(a => a.weekDay === selectedDay)
      .forEach(a => {
        if (a.clientId) clientsOnDay.add(a.clientId);
      });
    
    // Filter baseline pairings to only include groups where all clients are present
    return baselinePairingGroups.filter(group => {
      const clientIds = group.clientIds as string[];
      return clientIds.every(id => clientsOnDay.has(id));
    });
  }, [baselinePairingGroups, templateAssignments, selectedDay]);
  
  // Calculate missing client coverage
  const missingCoverage = useMemo(() => {
    const missing: { am: string[]; pm: string[] } = { am: [], pm: [] };
    if (!templateData?.segments) return missing;
    
    // Get clients scheduled on this day from template assignments
    const clientsOnDay = new Map<string, { needsAm: boolean; needsPm: boolean }>();
    templateAssignments
      .filter(a => a.weekDay === selectedDay && a.clientId)
      .forEach(a => {
        const client = allClients.find(c => c.id === a.clientId);
        if (!client?.active) return;
        
        // Parse client schedule for this day
        const schedule = client.schedule as Record<string, { enabled: boolean; start: string; end: string }> | null;
        const daySchedule = schedule?.[selectedDay];
        if (!daySchedule?.enabled) return;
        
        // Determine AM/PM needs based on client schedule times
        const startHour = parseInt(daySchedule.start?.split(':')[0] || '9', 10);
        const startMin = parseInt(daySchedule.start?.split(':')[1] || '0', 10);
        const endHour = parseInt(daySchedule.end?.split(':')[0] || '16', 10);
        const endMin = parseInt(daySchedule.end?.split(':')[1] || '0', 10);
        
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        // AM: client starts before noon (720), PM: client ends at or after 1PM (780)
        const needsAm = startMinutes < 720;
        const needsPm = endMinutes >= 780;
        
        const existing = clientsOnDay.get(a.clientId!);
        clientsOnDay.set(a.clientId!, {
          needsAm: needsAm || existing?.needsAm || false,
          needsPm: needsPm || existing?.needsPm || false,
        });
      });
    
    // Check which clients have coverage in segments
    const clientSegments = templateData.segments.filter(s => s.segmentType === 'client' && s.clientId);
    
    clientsOnDay.forEach((needs, clientId) => {
      const clientSegs = clientSegments.filter(s => s.clientId === clientId);
      
      // AM coverage: segment covering morning (before noon)
      const hasAmCoverage = clientSegs.some(s => s.startMinute < 720);
      // PM coverage: segment covering afternoon (at or after 12:30)
      const hasPmCoverage = clientSegs.some(s => s.endMinute >= 750);
      
      if (needs.needsAm && !hasAmCoverage) missing.am.push(clientId);
      if (needs.needsPm && !hasPmCoverage) missing.pm.push(clientId);
    });
    
    return missing;
  }, [templateData?.segments, templateAssignments, selectedDay, allClients]);
  
  const handleCreateTemplate = async () => {
    await createTemplateMutation.mutateAsync(selectedDay);
  };
  
  const handleEditSegment = (segment: IdealDaySegment) => {
    setEditingSegment(segment);
    setAddingForStaffId(null);
    setIsEditorOpen(true);
  };
  
  const handleAddSegment = (staffId: string) => {
    if (!templateData?.template) {
      handleCreateTemplate();
      return;
    }
    setEditingSegment(null);
    setAddingForStaffId(staffId);
    setIsEditorOpen(true);
  };
  
  const handleDeleteSegment = async (segmentId: string) => {
    if (confirm("Delete this segment?")) {
      await deleteSegmentMutation.mutateAsync(segmentId);
    }
  };
  
  const handleSaveSegment = async (segment: Partial<IdealDaySegment>) => {
    await saveSegmentMutation.mutateAsync(segment);
  };
  
  const handleMoveSegment = async (segmentId: string, newStaffId: string, newStartMinute: number) => {
    const segment = templateData?.segments?.find(s => s.id === segmentId);
    if (!segment) return;
    
    const TIMELINE_START = 420; // 7am in minutes
    const TIMELINE_END = 1020; // 5pm in minutes
    const DAY_LENGTH = TIMELINE_END - TIMELINE_START; // 600 minutes
    
    const duration = segment.endMinute - segment.startMinute;
    
    // Reject if segment is longer than the day window
    if (duration > DAY_LENGTH) {
      console.warn("Segment too long to fit within day bounds");
      return;
    }
    
    // Clamp start to valid range: between 7am and (5pm - duration)
    // This guarantees the segment fits when we add duration
    const startCandidate = Math.max(TIMELINE_START, Math.min(newStartMinute, TIMELINE_END - duration));
    const endCandidate = startCandidate + duration;
    
    // Preserve all existing segment fields, only update position and staff
    await saveSegmentMutation.mutateAsync({
      ...segment,
      staffId: newStaffId,
      startMinute: startCandidate,
      endMinute: endCandidate,
    });
  };
  
  const handleCopyDay = async () => {
    if (!copyTargetDay || copyTargetDay === selectedDay) {
      alert("Please select a different day to copy to");
      return;
    }
    if (!templateData?.template) return;
    
    try {
      await apiRequest("POST", `/api/ideal-day-templates/${selectedDay}/copy-to/${copyTargetDay}`);
      
      setIsCopyDialogOpen(false);
      setCopyTargetDay("");
      queryClient.invalidateQueries({ queryKey: ["/api/ideal-day-templates"] });
      alert(`Copied ${WEEKDAYS.find(d => d.value === selectedDay)?.label} to ${WEEKDAYS.find(d => d.value === copyTargetDay)?.label}`);
    } catch (error) {
      console.error("Failed to copy day:", error);
      alert("Failed to copy day template");
    }
  };
  
  const handleResetDay = async () => {
    if (!templateData?.template) return;
    
    if (!confirm("This will delete all segments and lunch pairings for this day. Continue?")) {
      return;
    }
    
    try {
      // Delete all segments
      for (const seg of templateData.segments) {
        await apiRequest("DELETE", `/api/ideal-day-segments/${seg.id}`);
      }
      
      // Delete all pairings
      for (const pairing of templateData.lunchPairings) {
        await apiRequest("DELETE", `/api/ideal-day-lunch-pairings/${pairing.id}`);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/ideal-day-templates", selectedDay, "full"] });
    } catch (error) {
      console.error("Failed to reset day:", error);
      alert("Failed to reset day template");
    }
  };
  
  const handleGenerateFromTemplate = async () => {
    const hasManualSegments = templateData?.segments.some(s => s.origin === "manual");
    const message = hasManualSegments
      ? "This will regenerate segments from Template Assignments. Manual segments will be preserved, but existing generated segments will be replaced. Continue?"
      : "This will generate segments from Template Assignments for this day. Continue?";
    
    if (!confirm(message)) {
      return;
    }
    
    try {
      await generateFromTemplateMutation.mutateAsync(selectedDay);
      queryClient.invalidateQueries({ queryKey: ["/api/ideal-day-templates", selectedDay, "full"] });
    } catch (error) {
      console.error("Failed to generate from template:", error);
      alert("Failed to generate from template");
    }
  };
  
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Refresh data from server to confirm current state is persisted
      await queryClient.invalidateQueries({ queryKey: ["/api/ideal-day-templates", selectedDay, "full"] });
      toast({
        title: "Saved",
        description: `${WEEKDAYS.find(d => d.value === selectedDay)?.label} template saved successfully`,
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const toggleStaffExpand = (staffId: string) => {
    setExpandedStaff(prev => {
      const next = new Set(prev);
      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  };
  
  const hasTemplate = !!templateData?.template;
  
  return (
    <Layout>
      <div className="px-4 py-4 md:px-6 md:py-6 w-full">
        {/* Header: Title row */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/template">
              <Button variant="ghost" size="sm" className="h-8 px-2" data-testid="back-to-template" title="Back to Assignments">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Ideal Day Template</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Define the complete schedule for a perfect day</p>
            </div>
          </div>
          
          {/* Controls row - wraps on mobile */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Select value={selectedDay} onValueChange={setSelectedDay}>
              <SelectTrigger className="w-32 h-8 text-sm" data-testid="day-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map(day => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant="default" 
              size="sm"
              className="h-8 text-xs md:text-sm"
              onClick={handleGenerateFromTemplate}
              disabled={generateFromTemplateMutation.isPending}
              data-testid="generate-from-template-btn"
            >
              {generateFromTemplateMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3 mr-1" />
              )}
              Generate from Template
            </Button>
            
            {hasTemplate && (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs md:text-sm" onClick={() => setIsCopyDialogOpen(true)} data-testid="copy-day-btn">
                  <Copy className="h-3 w-3 mr-1" />
                  Copy Day
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs md:text-sm" onClick={handleResetDay} data-testid="reset-day-btn">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="h-8 text-xs md:text-sm bg-green-600 hover:bg-green-700"
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  data-testid="save-all-btn"
                >
                  {isSaving ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
        
        {isLoadingTemplate ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasTemplate ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Ideal Day Template for {WEEKDAYS.find(d => d.value === selectedDay)?.label}</h3>
              <p className="text-sm text-muted-foreground mb-4">Create a template to define the perfect schedule for this day.</p>
              <Button onClick={handleCreateTemplate} data-testid="create-template-btn">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="w-full">
            {/* Schedule header with status */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base md:text-lg font-semibold">
                {WEEKDAYS.find(d => d.value === selectedDay)?.label} Schedule
              </h2>
              {templateData.template.isComplete ? (
                <Badge variant="default" className="bg-green-600 text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  In Progress
                </Badge>
              )}
            </div>
            
            {/* Coverage warnings */}
            {(missingCoverage.am.length > 0 || missingCoverage.pm.length > 0) && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-amber-800 font-medium mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Missing Coverage
                </div>
                <div className="text-amber-700 text-xs space-y-1">
                  {missingCoverage.am.length > 0 && (
                    <p>
                      <span className="font-semibold">AM:</span>{" "}
                      {missingCoverage.am.map(id => allClients.find(c => c.id === id)?.name).filter(Boolean).sort((a, b) => a!.localeCompare(b!)).join(", ")}
                    </p>
                  )}
                  {missingCoverage.pm.length > 0 && (
                    <p>
                      <span className="font-semibold">PM:</span>{" "}
                      {missingCoverage.pm.map(id => allClients.find(c => c.id === id)?.name).filter(Boolean).sort((a, b) => a!.localeCompare(b!)).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <IdealDayGrid
              staff={activeStaff}
              segments={templateData.segments || []}
              clients={allClients}
              locations={allLocations}
              lunchGroups={availableBaselinePairings}
              templateId={templateData.template.id}
              onSaveSegment={handleSaveSegment}
              onDeleteSegment={handleDeleteSegment}
              onMoveSegment={handleMoveSegment}
            />
          </div>
        )}
        
        <SegmentEditorDialog
          segment={editingSegment}
          staffId={addingForStaffId}
          templateId={templateData?.template?.id || ""}
          clients={allClients}
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingSegment(null);
            setAddingForStaffId(null);
          }}
          onSave={handleSaveSegment}
        />
        
        <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Copy Day Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Copy all segments and lunch pairings from {WEEKDAYS.find(d => d.value === selectedDay)?.label} to another day.
              </p>
              <div className="space-y-2">
                <Label>Copy To</Label>
                <Select value={copyTargetDay} onValueChange={setCopyTargetDay}>
                  <SelectTrigger data-testid="copy-target-select">
                    <SelectValue placeholder="Select target day..." />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.filter(d => d.value !== selectedDay).map(day => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCopyDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCopyDay} disabled={!copyTargetDay} data-testid="confirm-copy-btn">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useScheduleWebSocket } from "@/hooks/use-schedule-websocket";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useTouchGestures, isTouchDevice } from "@/hooks/use-touch-gestures";
import { useOfflineSchedule } from "@/hooks/use-offline-schedule";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Download, AlertCircle, Users, UserCheck, FileText, RotateCcw, RefreshCw, History, ClipboardList, Copy, Check, Phone, MapPin, MessageSquare, ExternalLink, HelpCircle, ChevronDown, ChevronRight, Wrench, X, Undo2, Play, AlertTriangle, Trash2, ArrowRightLeft, Scissors, GraduationCap, XCircle, Tag, Camera, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { ScheduleGridSkeleton, ExportProgress } from "@/components/ui/skeleton-loader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateCoverageReports, formatClientReportAsText, formatStaffReportAsText, type CoverageReports } from "@/lib/coverage-reports";
import { generateScheduleExplainerReport, type ScheduleExplainerReport } from "@/lib/schedule-explainer";
import { 
  type EditorMode, 
  type EditType, 
  type EditorState, 
  type ScheduleEdit,
  type ChangeStaffEdit,
  type CancelEdit,
  type TagEdit,
  type ChangeLogEntry,
  type EditorWarning,
  createInitialEditorState,
  generateTimeOptions,
  checkHardConstraints,
  checkSoftConstraints,
  applyChangeStaffEdit,
  applyCancelEdit,
  applyTagEdit,
  generateEditDescription
} from "@/lib/schedule-editor";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ApprovalRequest } from "@/lib/daily-run-data";
import { type LunchCoverageError, type TrainingSessionUpdate } from "@/lib/schedule-engine";
import { Link } from "wouter";
import { 
  TIME_BLOCKS, 
  type ScheduleSlot, 
  type SourceTag, 
  type StaffSchedule,
  TIME_MARKERS,
  TIMELINE_START_MINUTE,
  TIMELINE_END_MINUTE,
  minuteToPercent,
  durationToPercent,
  formatMinutesToTime,
  generateGridTemplateColumns,
  calculateContentAwareColumns,
  ADAPTIVE_COLUMN_INDEXES
} from "@/lib/schedule-data";
import { generateDailySchedule } from "@/lib/schedule-engine";
import type { Staff, Client, TemplateAssignment, DailySchedule, ScheduleSnapshot, ClientLocation, School, StaffPhoneContact, IdealDaySegment } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Exception } from "@/lib/daily-run-data";
import { createStaffDisplayNameMap } from "@/lib/format-staff-name";

const doesBlockOverlapOutWindow = (block: string, outWindow: { start: string; end: string }): boolean => {
  const [blockStart, blockEnd] = block.split("-").map(t => {
    const [h, m] = t.trim().split(":").map(Number);
    return h * 60 + m;
  });
  
  const parseTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  
  const outStart = parseTime(outWindow.start);
  const outEnd = parseTime(outWindow.end);
  
  return blockStart < outEnd && blockEnd > outStart;
};

const getStatusText = (exception: Exception, entityName: string): string => {
  const { mode, allDay, timeWindow } = exception;
  
  if (mode === "cancelled") {
    if (allDay) return `${entityName} — Cancelled All Day`;
    return `${entityName} — Cancelled`;
  }
  
  if (mode === "out") {
    if (allDay) return `${entityName} — Out All Day`;
    if (timeWindow) return `${entityName} — Out Until ${timeWindow.end}`;
    return `${entityName} — Out`;
  }
  
  if (mode === "in") {
    if (timeWindow) return `${entityName} — In ${timeWindow.start} To ${timeWindow.end}`;
    return `${entityName} — In`;
  }
  
  return `${entityName} — ${mode}`;
};

const LocationBadge = ({ location, source }: { location?: string; source: SourceTag }) => {
  if (source === "UNFILLED" || source === "CANCEL") {
    const unfilledStyle = source === "UNFILLED" 
      ? "border-destructive/30 bg-destructive/5 text-destructive font-bold animate-pulse"
      : "border-muted-foreground/30 bg-muted text-muted-foreground";
    return (
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold", unfilledStyle)}>
        {source === "UNFILLED" ? "Unfilled" : "Out"}
      </span>
    );
  }
  
  if (!location) return null;
  
  const locationStyles: Record<string, string> = {
    "clinic": "border-primary/30 bg-primary/5 text-primary",
    "home": "border-blue-500/30 bg-blue-500/5 text-blue-600",
    "in-home": "border-blue-500/30 bg-blue-500/5 text-blue-600",
    "community": "border-purple-500/30 bg-purple-500/5 text-purple-600",
    "telehealth": "border-emerald-500/30 bg-emerald-500/5 text-emerald-600",
    "other": "border-muted-foreground/30 bg-muted text-muted-foreground"
  };
  
  const style = locationStyles[location.toLowerCase()] || locationStyles["other"];
  const displayLabel = location.charAt(0).toUpperCase() + location.slice(1).replace("-", " ");

  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold", style)}>
      {displayLabel}
    </span>
  );
};

interface GridTimeAxisProps {
  gridTemplate: string;
}

const GridTimeAxis = ({ gridTemplate }: GridTimeAxisProps) => {
  const columnLabels = ["7:00", "8:30", "11:30", "12:00", "12:30", "4:00"];
  
  return (
    <div className="flex h-8 bg-muted/50 border-b border-border">
      <div 
        className="grid flex-1"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columnLabels.map((label, index) => (
          <div 
            key={label}
            className="flex items-center justify-start pl-1 border-r border-border/50"
          >
            <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end pr-1 min-w-[30px]">
        <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
          5:30
        </span>
      </div>
    </div>
  );
};

interface GridScheduleCellProps {
  slot: ScheduleSlot;
  staffName: string;
  staff?: Staff;
  isBlockOut: boolean;
  isClientUnavailable: boolean;
  partialOutWindow?: { start: string; end: string };
  slotIndex: number;
  groupLeaderTag?: string;
}

// Main session blocks (8:30-11:30 and 12:30-4:00) - show ON CALL when OPEN
const MAIN_SESSION_INDEXES = [1, 4];
// Bookend blocks (7:00-8:30 and 4:00-5:30) - hide when OPEN
const BOOKEND_INDEXES = [0, 5];

const GridScheduleCell = ({ slot, staffName, staff, isBlockOut, isClientUnavailable, partialOutWindow, slotIndex, groupLeaderTag }: GridScheduleCellProps) => {
  const startMinute = slot.startMinute ?? TIMELINE_START_MINUTE;
  const endMinute = slot.endMinute ?? TIMELINE_END_MINUTE;
  
  let displayValue = slot.value;
  let displaySource = slot.source;
  let displayReason = slot.reason;
  
  if (isBlockOut) {
    displayValue = "OUT";
    displaySource = "CANCEL" as SourceTag;
    displayReason = `Staff out until ${partialOutWindow?.end}`;
  } else if (isClientUnavailable) {
    displayValue = "UNFILLED";
    displaySource = "UNFILLED" as SourceTag;
    displayReason = "Client unavailable";
  }
  
  const timeRangeStr = `${formatMinutesToTime(startMinute)}-${formatMinutesToTime(endMinute)}`;
  
  const isLunch = displayValue === "LUNCH";
  const isBreak = displayValue === "BREAK";
  const isOpen = displayValue === "OPEN";
  const isOut = displayValue === "OUT";
  const isUnfilled = displaySource === "UNFILLED";
  
  // ON CALL logic: OPEN in main session blocks shows as ON CALL
  const isMainSession = MAIN_SESSION_INDEXES.includes(slotIndex);
  const isBookend = BOOKEND_INDEXES.includes(slotIndex);
  const isOnCall = isOpen && isMainSession;
  
  // Check for Lead RBT display label
  const slotAny = slot as any;
  const leadDisplayLabel = slotAny.leadDisplayLabel as string | undefined;
  const isLeadSlot = isOpen && leadDisplayLabel;
  
  // Hide bookend blocks when OPEN (invisible cell) - but show for leads
  if (isOpen && isBookend && !isLeadSlot) {
    return <div className="m-0.5" />;
  }
  
  // Display Lead label for Lead RBT staff, otherwise ON CALL for main sessions
  if (isLeadSlot) {
    displayValue = leadDisplayLabel;
  } else if (isOnCall) {
    displayValue = "ON CALL";
  }
  
  const indicator = slot.indicator || 
    (slot.source === "REPAIR" && slot.reason?.includes("Sub") ? "Sub" : null) ||
    (slot.source === "REPAIR" && slot.reason?.includes("Covering") ? "Coverage" : null);
  
  const hasSegments = slot.segments && slot.segments.length > 0;
  
  const isDrive = displayValue === "DRIVE";
  
  const isBcbaPrep = displayValue === "BCBA Prep";
  
  const getBlockStyles = () => {
    if (isBlockOut || isOut) return "bg-slate-100 border-slate-300 text-slate-500";
    if (isBcbaPrep) return "bg-violet-50 border-violet-300 text-violet-700";
    if (isLeadSlot) return "bg-teal-50 border-teal-300 text-teal-700";
    if (isOnCall) return "bg-teal-50 border-teal-300 text-teal-700";
    if (isUnfilled) return "bg-red-50 border-red-300 text-red-700";
    if (isLunch) return "bg-amber-50 border-amber-300 text-amber-700";
    if (isBreak) return "bg-amber-50 border-amber-300 text-amber-700";
    if (isDrive) return "bg-slate-100 border-slate-300 text-slate-500";
    if (isOpen) return "bg-slate-50 border-slate-200 text-slate-400";
    return "bg-white border-primary/30 text-foreground";
  };
  
  if (hasSegments) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div
            className="h-full flex rounded border cursor-pointer hover:shadow-md transition-shadow m-0.5"
            data-testid={`block-${slot.id}`}
          >
            {slot.segments!.map((seg, idx) => {
              const segStart = seg.startMinute ?? startMinute;
              const segEnd = seg.endMinute ?? endMinute;
              const isSegLunch = seg.value === "LUNCH";
              const isSegBreak = seg.value === "BREAK";
              const isSegDrive = seg.value === "DRIVE";
              const isLastSeg = idx === slot.segments!.length - 1;
              
              return (
                <div
                  key={seg.id}
                  className={cn(
                    "flex flex-col items-center justify-center px-2 py-1 text-center flex-1",
                    isSegLunch ? "bg-amber-50 text-amber-700" :
                    isSegBreak ? "bg-amber-50 text-amber-700" : 
                    isSegDrive ? "bg-slate-100 text-slate-500" :
                    "bg-white text-foreground",
                    !isLastSeg && "border-r border-slate-200"
                  )}
                >
                  <div className="font-bold text-xs whitespace-nowrap">{seg.value}</div>
                  <div className="text-[9px] text-muted-foreground whitespace-nowrap">
                    {formatMinutesToTime(segStart)}-{formatMinutesToTime(segEnd)}
                  </div>
                  {seg.location && (
                    <div className="text-[8px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                      {seg.location}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="font-medium text-sm">{staffName}</div>
              <div className="text-xs text-muted-foreground">{slot.block}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Segments</div>
              {slot.segments!.map((seg) => (
                <div key={seg.id} className="flex justify-between items-center p-2 rounded bg-muted/30">
                  <div>
                    <div className="font-medium text-sm">{seg.value}</div>
                    <div className="text-xs text-muted-foreground">{seg.block}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{seg.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "h-full flex flex-col items-center justify-center p-1 rounded border cursor-pointer hover:shadow-md transition-shadow text-center m-0.5",
            getBlockStyles()
          )}
          data-testid={`block-${slot.id}`}
        >
          <div className={cn(
            "font-bold text-xs whitespace-nowrap",
            isUnfilled && "animate-pulse"
          )}>
            {displayValue}
          </div>
          <div className="text-[9px] text-muted-foreground whitespace-nowrap">
            {timeRangeStr}
          </div>
          {slot.location && !isLunch && !isOpen && !isOut && (
            <div className="text-[8px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              {slot.location}
            </div>
          )}
          {indicator && (
            <div className="text-[8px] font-semibold uppercase text-primary whitespace-nowrap">
              {indicator}
            </div>
          )}
          {groupLeaderTag && (
            <div className="text-[7px] font-medium px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 whitespace-nowrap mt-0.5">
              {groupLeaderTag}
            </div>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="font-medium text-sm">{staffName}</div>
            <div className="text-xs text-muted-foreground">{slot.block}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Assignment</div>
            <div className={cn(
              "text-lg font-serif font-bold",
              isBlockOut ? "text-destructive" : "text-primary"
            )}>{displayValue}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Location</div>
            <div className="flex items-center gap-2">
              <LocationBadge location={slot.location} source={displaySource} />
              <span className="text-xs text-muted-foreground">{displayReason}</span>
            </div>
          </div>
          {slot.approvalStatus === 'pending' && !isBlockOut && (
            <div className="bg-amber-50 text-amber-700 text-xs p-2 rounded border border-amber-200 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              Approval Required
            </div>
          )}
          
          {/* On-Call Contact Info */}
          {(isOnCall || isLeadSlot) && staff && (
            <div className="pt-2 border-t space-y-3">
              <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Contact to Activate</div>
              
              {/* Phone Numbers */}
              {(() => {
                const phoneContacts = (staff.phoneContacts as StaffPhoneContact[]) || [];
                const nonEmergencyContacts = phoneContacts.filter(c => c.type !== 'emergency' && c.number);
                
                if (nonEmergencyContacts.length === 0) {
                  return <p className="text-xs text-muted-foreground italic">No phone numbers on file</p>;
                }
                
                return (
                  <div className="space-y-2">
                    {nonEmergencyContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{contact.number}</span>
                          <span className="text-xs text-muted-foreground capitalize">({contact.type})</span>
                        </div>
                        <div className="flex gap-1">
                          <a
                            href={`tel:${contact.number.replace(/\D/g, '')}`}
                            className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            title="Call"
                            data-testid={`call-${contact.id}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`sms:${contact.number.replace(/\D/g, '')}`}
                            className="p-1.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors"
                            title="Text"
                            data-testid={`sms-${contact.id}`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`msteams://l/call/0/0?users=+${contact.number.replace(/\D/g, '')}`}
                            className="p-1.5 rounded bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition-colors"
                            title="Call via Teams"
                            data-testid={`teams-${contact.id}`}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.19 8.77c-.92 0-1.67-.75-1.67-1.67s.75-1.67 1.67-1.67 1.67.75 1.67 1.67-.75 1.67-1.67 1.67m-5.85 0c-1.23 0-2.22-1-2.22-2.22s1-2.22 2.22-2.22 2.22 1 2.22 2.22-1 2.22-2.22 2.22m0 1.67h3.33c.92 0 1.67.75 1.67 1.67v3.33c0 .92-.75 1.67-1.67 1.67h-.83v2.5c0 .46-.38.83-.83.83h-2.5c-.46 0-.83-.38-.83-.83v-5c0-1.84 1.49-3.34 3.33-3.34h-1.67m7.5 0h-2.5v1.67h2.5c.46 0 .83-.38.83-.83s-.38-.84-.83-.84M5.84 8.77c-.92 0-1.67-.75-1.67-1.67s.75-1.67 1.67-1.67 1.67.75 1.67 1.67-.75 1.67-1.67 1.67m0 1.67c1.84 0 3.33 1.49 3.33 3.33v5c0 .46-.38.83-.83.83H2.51c-.46 0-.83-.38-.83-.83v-2.5h-.83c-.92 0-1.67-.75-1.67-1.67v-3.33c0-.92.75-1.67 1.67-1.67h5m-4.17 0c-.46 0-.83.38-.83.83s.38.83.83.83h2.5v-1.67h-2.5"/>
                            </svg>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              
              {/* Home Address with Maps Link */}
              {staff.homeAddress && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm truncate max-w-[180px]" title={staff.homeAddress}>{staff.homeAddress}</span>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(staff.homeAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                      title="Open in Maps"
                      data-testid="open-maps"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">Drive time estimation</p>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default function Schedule() {
  const queryClient = useQueryClient();
  const todayDate = new Date().toISOString().split('T')[0];
  
  // Calculate today's weekday for ideal day segments fetch
  const todayWeekdayKey = (() => {
    const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayIndex = new Date().getDay();
    const day = dayMap[dayIndex];
    return day === "sun" || day === "sat" ? "mon" : day;
  })();
  
  const [schedule, setSchedule] = useState<StaffSchedule[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [lastGeneratedTime, setLastGeneratedTime] = useState<string | null>(null);
  const [coverageReports, setCoverageReports] = useState<CoverageReports | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [copiedSection, setCopiedSection] = useState<"client" | "staff" | null>(null);
  const [explainerReport, setExplainerReport] = useState<ScheduleExplainerReport | null>(null);
  const [explainerDialogOpen, setExplainerDialogOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [lunchCoverageErrors, setLunchCoverageErrors] = useState<LunchCoverageError[]>([]);
  const [trainingSessionUpdates, setTrainingSessionUpdates] = useState<TrainingSessionUpdate[]>([]);
  
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("whatif");
  const [selectedEditType, setSelectedEditType] = useState<EditType>("change_staff");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [simulationSchedule, setSimulationSchedule] = useState<StaffSchedule[]>([]);
  const [draftSchedule, setDraftSchedule] = useState<StaffSchedule[]>([]);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [undoStack, setUndoStack] = useState<StaffSchedule[][]>([]);
  const [editorWarnings, setEditorWarnings] = useState<EditorWarning[]>([]);
  const [editStartTime, setEditStartTime] = useState<string>("8:00");
  const [editEndTime, setEditEndTime] = useState<string>("11:30");
  const [cancelType, setCancelType] = useState<"all_day" | "cancelled_until" | "cancelled_at">("all_day");
  const [cancelTime, setCancelTime] = useState<string>("12:00");
  const [tagText, setTagText] = useState<string>("");
  const [advisorActive, setAdvisorActive] = useState(false);
  const [advisorProblem, setAdvisorProblem] = useState<string>("");
  
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState("");

  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { isConnected: wsConnected } = useScheduleWebSocket({
    enabled: true,
    onUpdate: (update) => {
      if (update.type === "schedule_changed") {
        toast({
          title: "Schedule Updated",
          description: "The schedule has been updated by another user.",
        });
      }
    },
  });

  const { isOnline, offlineData, saveForOffline } = useOfflineSchedule();

  useKeyboardShortcuts([
    {
      key: "e",
      ctrl: true,
      handler: () => setEditorOpen(true),
      description: "Open schedule editor",
    },
    {
      key: "r",
      ctrl: true,
      handler: () => setReportDialogOpen(true),
      description: "Open reports",
    },
    {
      key: "z",
      ctrl: true,
      handler: () => {
        if (undoStack.length > 0) {
          const previous = undoStack[undoStack.length - 1];
          setUndoStack(undoStack.slice(0, -1));
          setDraftSchedule(previous);
        }
      },
      description: "Undo last change",
    },
    {
      key: "Escape",
      handler: () => {
        setEditorOpen(false);
        setReportDialogOpen(false);
        setExplainerDialogOpen(false);
        setCaptureDialogOpen(false);
      },
      description: "Close dialogs",
    },
  ], !editorOpen && !reportDialogOpen && !explainerDialogOpen && !captureDialogOpen);

  const touchRef = useTouchGestures<HTMLDivElement>({
    onSwipeLeft: () => {
      if (scheduleVersions && scheduleVersions.length > 1 && currentVersion !== null) {
        const nextVersion = Math.min(currentVersion + 1, scheduleVersions.length);
        setCurrentVersion(nextVersion);
      }
    },
    onSwipeRight: () => {
      if (currentVersion !== null && currentVersion > 1) {
        setCurrentVersion(currentVersion - 1);
      }
    },
  });

  useEffect(() => {
    if (schedule.length > 0 && isOnline) {
      saveForOffline(schedule, exceptions, currentVersion);
    }
  }, [schedule, exceptions, currentVersion, isOnline, saveForOffline]);

  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const { data: staffList, isLoading: isLoadingStaff } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: async () => {
      const response = await fetch("/api/staff");
      if (!response.ok) throw new Error("Failed to fetch staff");
      return response.json();
    },
  });

  const { data: clientList, isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const { data: templateAssignments } = useQuery<TemplateAssignment[]>({
    queryKey: ["/api/template"],
    queryFn: async () => {
      const response = await fetch("/api/template");
      if (!response.ok) throw new Error("Failed to fetch template");
      return response.json();
    },
  });

  const { data: clientLocations } = useQuery<ClientLocation[]>({
    queryKey: ["/api/client-locations"],
    queryFn: async () => {
      const response = await fetch("/api/client-locations");
      if (!response.ok) throw new Error("Failed to fetch client locations");
      return response.json();
    },
  });

  const { data: schools } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const response = await fetch("/api/schools");
      if (!response.ok) throw new Error("Failed to fetch schools");
      return response.json();
    },
  });

  // Fetch ideal day segments for today's weekday (used by schedule engine)
  const { data: idealDaySegments } = useQuery<IdealDaySegment[]>({
    queryKey: ["/api/ideal-day-segments/by-weekday", todayWeekdayKey],
    queryFn: async () => {
      const response = await fetch(`/api/ideal-day-segments/by-weekday/${todayWeekdayKey}`);
      if (!response.ok) throw new Error("Failed to fetch ideal day segments");
      return response.json();
    },
  });

  const { data: latestSchedule, isLoading: isLoadingSchedule } = useQuery<DailySchedule>({
    queryKey: ["/api/schedules", todayDate, "latest"],
    queryFn: async () => {
      const response = await fetch(`/api/schedules/${todayDate}/latest`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch schedule");
      return response.json();
    },
  });

  const { data: scheduleVersions } = useQuery<DailySchedule[]>({
    queryKey: ["/api/schedules", todayDate, "versions"],
    queryFn: async () => {
      const response = await fetch(`/api/schedules/${todayDate}/versions`);
      if (!response.ok) throw new Error("Failed to fetch versions");
      return response.json();
    },
  });

  interface EnrichedTrainingSession {
    id: string;
    planId: string;
    traineeId: string | null;
    clientId: string | null;
    preferredTrainerId: string | null;
    scheduledDate: string | null;
    stageType: string;
  }

  const { data: trainingSessions } = useQuery<EnrichedTrainingSession[]>({
    queryKey: ["/api/training-sessions", todayDate, "enriched"],
    queryFn: async () => {
      const response = await fetch(`/api/training-sessions?date=${todayDate}&enriched=true`);
      if (!response.ok) throw new Error("Failed to fetch training sessions");
      return response.json();
    },
  });

  // Fetch sub history for repeat sub preference
  const { data: subHistory } = useQuery<{ clientId: string; subStaffId: string; date: string }[]>({
    queryKey: ["/api/client-sub-history"],
    queryFn: async () => {
      const response = await fetch("/api/client-sub-history");
      if (!response.ok) throw new Error("Failed to fetch sub history");
      return response.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async ({ snapshot, label, derivedFromVersion }: { snapshot: ScheduleSnapshot; label?: string; derivedFromVersion?: number }) => {
      const response = await fetch(`/api/schedules/${todayDate}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, label, derivedFromVersion })
      });
      if (!response.ok) throw new Error("Failed to generate schedule");
      return response.json() as Promise<DailySchedule>;
    },
    onSuccess: (data) => {
      setCurrentVersion(data.version);
      setLastGeneratedTime(new Date(data.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      queryClient.invalidateQueries({ queryKey: ["/api/schedules", todayDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/latest", todayDate] });
    }
  });

  const resetMutation = useMutation({
    mutationFn: async (snapshot: ScheduleSnapshot) => {
      const response = await fetch(`/api/schedules/${todayDate}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot })
      });
      if (!response.ok) throw new Error("Failed to reset schedule");
      return response.json() as Promise<DailySchedule>;
    },
    onSuccess: (data) => {
      setCurrentVersion(data.version);
      setLastGeneratedTime(new Date(data.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      queryClient.invalidateQueries({ queryKey: ["/api/schedules", todayDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/latest", todayDate] });
      localStorage.removeItem("daily_exceptions");
      localStorage.removeItem("daily_approved_subs");
      localStorage.removeItem("daily_approvals_full");
      setExceptions([]);
    }
  });

  const rewindMutation = useMutation({
    mutationFn: async (targetVersion: number) => {
      const response = await fetch(`/api/schedules/${todayDate}/rewind/${targetVersion}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error("Failed to rewind schedule");
      return response.json() as Promise<DailySchedule>;
    },
    onSuccess: (data) => {
      const snapshot = data.snapshot as ScheduleSnapshot;
      restoreFromSnapshot(snapshot);
      setCurrentVersion(data.version);
      setLastGeneratedTime(new Date(data.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      queryClient.invalidateQueries({ queryKey: ["/api/schedules", todayDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/latest", todayDate] });
    }
  });

  const buildSnapshotFromSchedule = useCallback((scheduleData: StaffSchedule[], exceptionsData: Exception[], approvalsData: { clientId: string; block: "AM" | "PM"; subStaffId: string }[]): ScheduleSnapshot => {
    return {
      staffSchedules: scheduleData.map(s => ({
        staffId: s.staffId,
        staffName: staffList?.find(st => st.id === s.staffId)?.name || s.staffId,
        slots: s.slots.map(slot => ({
          block: slot.block,
          value: slot.value,
          clientId: slot.clientId,
          status: slot.source,
          reason: slot.reason,
          source: slot.source,
          location: slot.location,
          segments: slot.segments,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute,
          indicator: slot.indicator
        }))
      })),
      exceptions: exceptionsData.map(e => ({
        id: e.id,
        type: e.type,
        entityId: e.entityId,
        mode: e.mode,
        allDay: e.allDay,
        timeWindow: e.timeWindow,
        locationOverride: e.locationOverride
      })),
      approvals: approvalsData.map((a, i) => ({
        id: `approval-${i}`,
        type: 'sub_staffing',
        relatedId: a.clientId,
        status: 'approved'
      }))
    };
  }, [staffList]);

  const restoreFromSnapshot = useCallback((snapshot: ScheduleSnapshot) => {
    if (!staffList) return;
    
    const restoredSchedule: StaffSchedule[] = snapshot.staffSchedules.map(ss => ({
      staffId: ss.staffId,
      slots: ss.slots.map((slot, index) => ({
        id: `${ss.staffId}-${index}`,
        block: slot.block,
        value: slot.value,
        source: (slot.source || slot.status) as SourceTag,
        reason: slot.reason || "",
        clientId: slot.clientId,
        approvalStatus: undefined,
        location: (slot as any).location,
        segments: (slot as any).segments,
        startMinute: (slot as any).startMinute,
        endMinute: (slot as any).endMinute,
        indicator: (slot as any).indicator
      })),
      status: "ACTIVE" as const
    }));
    
    setSchedule(restoredSchedule);
    
    const restoredExceptions: Exception[] = snapshot.exceptions.map(e => ({
      id: e.id,
      type: e.type as "client" | "staff",
      entityId: e.entityId,
      mode: e.mode as "in" | "out" | "cancelled" | "location",
      allDay: e.allDay,
      timeWindow: e.timeWindow,
      locationOverride: e.locationOverride as any
    }));
    
    setExceptions(restoredExceptions);
  }, [staffList]);

  useEffect(() => {
    if (!staffList || staffList.length === 0 || !clientList || !templateAssignments) {
      return;
    }

    // Check if there are pending exceptions from Daily Run that should trigger regeneration
    const storedExceptions = localStorage.getItem("daily_exceptions");
    const storedApprovals = localStorage.getItem("daily_approved_subs");
    const hasPendingFromDailyRun = storedExceptions || storedApprovals;

    // If we have a saved schedule AND no pending changes from Daily Run, restore it
    if (latestSchedule && latestSchedule.snapshot && !hasPendingFromDailyRun) {
      const snapshot = latestSchedule.snapshot as ScheduleSnapshot;
      restoreFromSnapshot(snapshot);
      setCurrentVersion(latestSchedule.version);
      setLastGeneratedTime(new Date(latestSchedule.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      return;
    }

    const data = {
      staff: staffList,
      clients: clientList,
      templateAssignments: templateAssignments,
      idealDaySegments: idealDaySegments || [],
      clientLocations: clientLocations || [],
      schools: schools || [],
      subHistory: subHistory || []
    };

    let loadedExceptions: Exception[] = [];
    
    if (storedExceptions) {
      try {
        const parsed = JSON.parse(storedExceptions);
        if (Array.isArray(parsed)) {
          loadedExceptions = parsed;
        }
      } catch (e) {
        console.error("Failed to load schedule exceptions", e);
      }
    }
    
    setExceptions(loadedExceptions);
    
    let approvedSubs: { clientId: string; block: "AM" | "PM"; subStaffId: string }[] = [];
    
    if (storedApprovals) {
      try {
        const parsed = JSON.parse(storedApprovals);
        if (Array.isArray(parsed)) {
          approvedSubs = parsed;
        }
      } catch (e) {
        console.error("Failed to load approved subs", e);
      }
    }
    
    const todayDayOfWeek = new Date().getDay();
    const result = generateDailySchedule(loadedExceptions, data, approvedSubs, todayDayOfWeek);
    setSchedule(result.schedule);
    setPendingApprovals(result.pendingSubApprovals || []);
    setLunchCoverageErrors(result.lunchCoverageErrors || []);
    setTrainingSessionUpdates(result.trainingSessionUpdates || []);
    setCurrentVersion(null);
    setLastGeneratedTime(null);
  }, [staffList, clientList, templateAssignments, idealDaySegments, clientLocations, schools, subHistory, latestSchedule, restoreFromSnapshot]);

  const handleGenerateSchedule = useCallback(async () => {
    if (!staffList || !clientList || !templateAssignments) return;
    
    const prevVersion = currentVersion;
    
    const data = {
      staff: staffList,
      clients: clientList,
      templateAssignments: templateAssignments,
      idealDaySegments: idealDaySegments || [],
      clientLocations: clientLocations || [],
      schools: schools || [],
      subHistory: subHistory || []
    };
    
    const storedExceptions = localStorage.getItem("daily_exceptions");
    let loadedExceptions: Exception[] = [];
    if (storedExceptions) {
      try {
        loadedExceptions = JSON.parse(storedExceptions);
      } catch (e) {}
    }
    
    const storedApprovals = localStorage.getItem("daily_approved_subs");
    let approvedSubs: { clientId: string; block: "AM" | "PM"; subStaffId: string }[] = [];
    if (storedApprovals) {
      try {
        approvedSubs = JSON.parse(storedApprovals);
      } catch (e) {}
    }
    
    const todayDayOfWeek = new Date().getDay();
    const result = generateDailySchedule(loadedExceptions, data, approvedSubs, todayDayOfWeek);
    const snapshot = buildSnapshotFromSchedule(result.schedule, loadedExceptions, approvedSubs);
    
    try {
      const genResult = await generateMutation.mutateAsync({
        snapshot,
        label: "generated",
        derivedFromVersion: prevVersion || undefined
      });
      
      setSchedule(result.schedule);
      setPendingApprovals(result.pendingSubApprovals || []);
      setLunchCoverageErrors(result.lunchCoverageErrors || []);
      setTrainingSessionUpdates(result.trainingSessionUpdates || []);
      setExceptions(loadedExceptions);
      
      const todayDateStr = new Date().toISOString().split('T')[0];
      await fetch(`/api/schedule-changes/${todayDateStr}`, { method: 'DELETE' });
      
      if (result.changes.length > 0) {
        await fetch('/api/schedule-changes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            changes: result.changes.map(c => ({
              date: c.date,
              timeBlock: c.timeBlock,
              staffId: c.staffId || null,
              clientId: c.clientId || null,
              changeType: c.changeType,
              source: c.source,
              beforeValue: c.beforeValue || null,
              afterValue: c.afterValue || null,
              locationBefore: c.locationBefore || null,
              locationAfter: c.locationAfter || null,
              reason: c.reason
            }))
          })
        });
      }
    } catch (err) {
      console.error('Failed to generate schedule', err);
    }
  }, [staffList, clientList, templateAssignments, idealDaySegments, clientLocations, schools, subHistory, buildSnapshotFromSchedule, generateMutation, currentVersion]);

  const handleHardReset = useCallback(async () => {
    if (!staffList || !clientList || !templateAssignments) return;
    
    const prevVersion = currentVersion;
    
    const data = {
      staff: staffList,
      clients: clientList,
      templateAssignments: templateAssignments,
      idealDaySegments: idealDaySegments || [],
      clientLocations: clientLocations || [],
      schools: schools || [],
      subHistory: subHistory || []
    };
    
    const todayDayOfWeek = new Date().getDay();
    const result = generateDailySchedule([], data, [], todayDayOfWeek);
    const snapshot = buildSnapshotFromSchedule(result.schedule, [], []);
    
    try {
      const resetResult = await resetMutation.mutateAsync(snapshot);
      
      setSchedule(result.schedule);
      setExceptions([]);
      
      const todayDateStr = new Date().toISOString().split('T')[0];
      await fetch(`/api/schedule-changes/${todayDateStr}`, { method: 'DELETE' });
      await fetch('/api/schedule-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          changes: [{
            date: todayDateStr,
            timeBlock: "All Day",
            staffId: null,
            clientId: null,
            changeType: "status",
            source: "manual",
            beforeValue: `Version ${prevVersion || 0}`,
            afterValue: `Reset To Template (Now V${resetResult.version})`,
            reason: "Hard reset - schedule restored to original template"
          }]
        })
      });
    } catch (err) {
      console.error('Failed to reset schedule', err);
    }
  }, [staffList, clientList, templateAssignments, idealDaySegments, clientLocations, schools, subHistory, buildSnapshotFromSchedule, resetMutation, currentVersion]);

  const handleRewind = useCallback(async (targetVersion: number) => {
    const prevVersion = currentVersion;
    
    try {
      const result = await rewindMutation.mutateAsync(targetVersion);
      
      const todayDateStr = new Date().toISOString().split('T')[0];
      await fetch('/api/schedule-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          changes: [{
            date: todayDateStr,
            timeBlock: "All Day",
            staffId: null,
            clientId: null,
            changeType: "status",
            source: "manual",
            beforeValue: `Version ${prevVersion || 0}`,
            afterValue: `Rewind To Version ${targetVersion} (Now V${result.version})`,
            reason: `Schedule rewound to version ${targetVersion}`
          }]
        })
      });
    } catch (err) {
      console.error('Failed to rewind schedule', err);
    }
  }, [rewindMutation, currentVersion]);

  const filteredSchedule = useMemo(() => {
    const staffOutAllDay = new Set(
      exceptions
        .filter(e => e.type === "staff" && e.mode === "out" && e.allDay)
        .map(e => e.entityId)
    );
    
    const nonScheduleRoles = ['Clinical Manager', 'Admin', 'Lead BCBA'];
    const staffWithTraining = new Set(
      (trainingSessions || [])
        .filter(ts => ts.preferredTrainerId)
        .map(ts => ts.preferredTrainerId!)
    );
    
    return schedule
      .filter(row => !staffOutAllDay.has(row.staffId))
      .filter(row => {
        const staffMember = staffList?.find(s => s.id === row.staffId);
        if (!staffMember) return true;
        if (nonScheduleRoles.includes(staffMember.role)) {
          return staffWithTraining.has(row.staffId);
        }
        return true;
      })
      .sort((a, b) => {
        const nameA = staffList?.find(s => s.id === a.staffId)?.name || a.staffId;
        const nameB = staffList?.find(s => s.id === b.staffId)?.name || b.staffId;
        return nameA.localeCompare(nameB);
      });
  }, [schedule, exceptions, staffList, trainingSessions]);

  const STAFF_ROW_HEIGHT = 73;
  const VIRTUALIZATION_THRESHOLD = 30;
  const shouldVirtualize = filteredSchedule.length > VIRTUALIZATION_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: filteredSchedule.length,
    getScrollElement: () => scheduleContainerRef.current,
    estimateSize: () => STAFF_ROW_HEIGHT,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  const staffPartialOut = useMemo(() => {
    const partialOuts = new Map<string, { start: string; end: string }>();
    exceptions.forEach(e => {
      if (e.type === "staff" && e.mode === "out" && !e.allDay && e.timeWindow) {
        partialOuts.set(e.entityId, e.timeWindow);
      }
    });
    return partialOuts;
  }, [exceptions]);

  const clientsUnavailable = useMemo(() => {
    return new Set(
      exceptions
        .filter(e => e.type === "client" && ((e.mode === "out" && e.allDay) || e.mode === "cancelled"))
        .map(e => e.entityId)
    );
  }, [exceptions]);

  const staffExceptions = useMemo(() => {
    return exceptions.filter(e => e.type === "staff");
  }, [exceptions]);

  const clientExceptions = useMemo(() => {
    return exceptions.filter(e => e.type === "client");
  }, [exceptions]);

  const unfilledCount = schedule.reduce((acc, s) => acc + s.slots.filter(slot => slot.source === "UNFILLED").length, 0);
  const pendingCount = 0;

  const lunchColumnWidths = useMemo(() => {
    let maxCol2Width = 60;
    let maxCol3Width = 60;
    
    filteredSchedule.forEach(row => {
      if (row.slots[2]) {
        const value = row.slots[2].value || "";
        const charWidth = value.length * 8 + 24;
        maxCol2Width = Math.max(maxCol2Width, charWidth);
      }
      if (row.slots[3]) {
        const value = row.slots[3].value || "";
        const charWidth = value.length * 8 + 24;
        maxCol3Width = Math.max(maxCol3Width, charWidth);
      }
    });
    
    return { col2: maxCol2Width, col3: maxCol3Width };
  }, [filteredSchedule]);

  const contentAwareConfig = useMemo(() => {
    return calculateContentAwareColumns(filteredSchedule, lunchColumnWidths);
  }, [filteredSchedule, lunchColumnWidths]);

  const sharedGridTemplate = contentAwareConfig.gridTemplate;

  // Precompute group leader tags for slots (only show when staff has ≤2 clients)
  const groupLeaderTags = useMemo(() => {
    if (!clientList) return new Map<string, string>();
    
    const clientMap = new Map(clientList.map(c => [c.id, c]));
    const tags = new Map<string, string>();
    
    // Lunch time constants (minutes from midnight)
    const FIRST_LUNCH_START = 690; // 11:30 AM
    const FIRST_LUNCH_END = 720; // 12:00 PM
    const SECOND_LUNCH_START = 720; // 12:00 PM
    const SECOND_LUNCH_END = 750; // 12:30 PM
    
    // For each staff row, check each slot for group leader clients
    filteredSchedule.forEach(row => {
      row.slots.forEach((slot) => {
        if (!slot.clientId) return;
        
        const client = clientMap.get(slot.clientId);
        if (!client?.isGroupLeader) return;
        
        // Determine which lunch period this slot is in based on startMinute
        // First lunch: 11:30-12:00 (startMinute 690)
        // Second lunch: 12:00-12:30 (startMinute 720)
        const slotStart = slot.startMinute ?? 0;
        const isFirstLunch = slotStart >= FIRST_LUNCH_START && slotStart < FIRST_LUNCH_END;
        const isSecondLunch = slotStart >= SECOND_LUNCH_START && slotStart < SECOND_LUNCH_END;
        
        // Get the appropriate group name for this lunch slot
        let groupName: string | null = null;
        if (isFirstLunch && client.groupLeaderNameFirstLunch) {
          groupName = client.groupLeaderNameFirstLunch;
        } else if (isSecondLunch && client.groupLeaderNameSecondLunch) {
          groupName = client.groupLeaderNameSecondLunch;
        } else if (client.groupLeaderName) {
          // Fall back to legacy groupLeaderName if lunch-specific not set
          groupName = client.groupLeaderName;
        }
        
        if (!groupName) return;
        
        // Count concurrent clients for this staff in this slot
        let clientCount = 1;
        
        // Check for lunch coverage grouping first (displayed as "LP/AA" or "LP/AA/EH")
        // This is the most reliable indicator of grouped clients during lunch
        if (slot.value && slot.value.includes('/') && !slot.value.includes(':')) {
          // Split by "/" and count unique non-empty parts
          const parts = slot.value.split('/').filter(p => p.trim().length > 0);
          clientCount = parts.length;
        }
        // For segmented slots, count distinct client assignments
        else if (slot.segments && slot.segments.length > 0) {
          const clientIds = new Set<string>();
          // Add the main slot clientId
          if (slot.clientId) clientIds.add(slot.clientId);
          // Add any segment clientIds
          slot.segments.forEach(seg => {
            const segClientId = (seg as any).clientId;
            if (segClientId) clientIds.add(segClientId);
          });
          clientCount = clientIds.size;
        }
        
        // Only show tag if ≤2 clients
        if (clientCount <= 2) {
          tags.set(slot.id, `${groupName} Leader`);
        }
      });
    });
    
    return tags;
  }, [filteredSchedule, clientList]);

  // Precompute staff display names (FirstName L. format with duplicate handling)
  const staffDisplayNames = useMemo(() => {
    if (!staffList) return new Map<string, string>();
    return createStaffDisplayNameMap(staffList);
  }, [staffList]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', year: 'numeric' });
  };

  const handleGenerateCoverageReports = useCallback(() => {
    if (!staffList || !clientList || !templateAssignments) return;
    
    const isCommitted = currentVersion !== null;
    
    const reports = generateCoverageReports({
      schedule,
      staffList,
      clientList,
      templateAssignments,
      exceptions,
      isCommitted
    });
    
    setCoverageReports(reports);
    setReportDialogOpen(true);
  }, [schedule, staffList, clientList, templateAssignments, exceptions, currentVersion]);

  const handleCopyReport = useCallback(async (section: "client" | "staff") => {
    if (!coverageReports) return;
    
    const text = section === "client" 
      ? formatClientReportAsText(coverageReports)
      : formatStaffReportAsText(coverageReports);
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
    }
  }, [coverageReports]);

  const handleGenerateExplainer = useCallback(() => {
    if (!staffList || !clientList || !templateAssignments) return;
    
    const report = generateScheduleExplainerReport({
      schedule,
      staffList,
      clientList,
      templateAssignments,
      exceptions,
      pendingApprovals,
      lunchCoverageErrors,
      trainingSessionUpdates,
      trainingSessions: trainingSessions || []
    });
    
    setExplainerReport(report);
    setExplainerDialogOpen(true);
  }, [schedule, staffList, clientList, templateAssignments, exceptions, pendingApprovals, lunchCoverageErrors, trainingSessionUpdates, trainingSessions]);

  const handleOpenEditor = useCallback(() => {
    setSimulationSchedule(JSON.parse(JSON.stringify(schedule)));
    setDraftSchedule(JSON.parse(JSON.stringify(schedule)));
    setEditorOpen(true);
    setChangeLog([]);
    setUndoStack([]);
    setEditorWarnings([]);
    setAdvisorActive(false);
    setAdvisorProblem("");
  }, [schedule]);

  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
    setSelectedStaffId(null);
    setSelectedClientId(null);
  }, []);

  const currentPreviewSchedule = editorMode === "whatif" ? simulationSchedule : draftSchedule;

  const handleApplyEdit = useCallback(() => {
    if (!staffList || !clientList) return;
    
    const currentSchedule = editorMode === "whatif" ? simulationSchedule : draftSchedule;
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(currentSchedule))]);
    
    let result: { newSchedule: StaffSchedule[]; needsAdvisor: boolean; advisorProblem?: string } = {
      newSchedule: currentSchedule,
      needsAdvisor: false
    };
    let editDescription = "";
    
    if (selectedEditType === "change_staff" && selectedStaffId && selectedClientId) {
      const edit: ChangeStaffEdit = {
        type: "change_staff",
        staffId: selectedStaffId,
        clientId: selectedClientId,
        timeWindow: { start: editStartTime, end: editEndTime }
      };
      
      const hardWarnings = checkHardConstraints(edit, staffList, clientList);
      const softWarnings = checkSoftConstraints(edit, staffList, clientList, currentSchedule);
      setEditorWarnings([...hardWarnings, ...softWarnings]);
      
      if (hardWarnings.length > 0) {
        return;
      }
      
      result = applyChangeStaffEdit(currentSchedule, edit, staffList, clientList);
      editDescription = generateEditDescription(edit, staffList, clientList);
    } else if (selectedEditType === "cancel" && selectedClientId) {
      const edit: CancelEdit = {
        type: "cancel",
        clientId: selectedClientId,
        cancelType: cancelType,
        time: cancelType !== "all_day" ? cancelTime : undefined
      };
      
      const cancelResult = applyCancelEdit(currentSchedule, edit, clientList);
      result = cancelResult;
      editDescription = generateEditDescription(edit, staffList, clientList);
    } else if (selectedEditType === "tag" && selectedStaffId && tagText.trim()) {
      const edit: TagEdit = {
        type: "tag",
        staffId: selectedStaffId,
        tagText: tagText.trim(),
        timeWindow: { start: editStartTime, end: editEndTime }
      };
      
      result = applyTagEdit(currentSchedule, edit, staffList);
      editDescription = generateEditDescription(edit, staffList, clientList);
    } else {
      return;
    }
    
    if (editorMode === "whatif") {
      setSimulationSchedule(result.newSchedule);
    } else {
      setDraftSchedule(result.newSchedule);
    }
    
    if (result.needsAdvisor) {
      setAdvisorActive(true);
      setAdvisorProblem(result.advisorProblem || "Schedule conflict detected");
    }
    
    const logEntry: ChangeLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date(),
      editType: selectedEditType,
      description: editDescription,
      entities: {
        staffId: selectedStaffId || undefined,
        staffName: selectedStaffId ? staffList.find(s => s.id === selectedStaffId)?.name : undefined,
        clientId: selectedClientId || undefined,
        clientName: selectedClientId ? clientList.find(c => c.id === selectedClientId)?.name : undefined
      },
      timeWindow: selectedEditType !== "cancel" ? { start: editStartTime, end: editEndTime } : undefined,
      triggeredAdvisor: result.needsAdvisor,
      hasWarnings: editorWarnings.length > 0,
      warningType: editorWarnings.some(w => w.type === "hard") ? "hard" : editorWarnings.length > 0 ? "soft" : undefined
    };
    
    setChangeLog(prev => [...prev, logEntry]);
  }, [staffList, clientList, editorMode, simulationSchedule, draftSchedule, selectedEditType, selectedStaffId, selectedClientId, editStartTime, editEndTime, cancelType, cancelTime, tagText, editorWarnings]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const previousSchedule = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    
    if (editorMode === "whatif") {
      setSimulationSchedule(previousSchedule);
    } else {
      setDraftSchedule(previousSchedule);
    }
    
    setChangeLog(prev => prev.slice(0, -1));
    setAdvisorActive(false);
    setEditorWarnings([]);
  }, [undoStack, editorMode]);

  const handleDiscardSimulation = useCallback(() => {
    setSimulationSchedule(JSON.parse(JSON.stringify(schedule)));
    setChangeLog([]);
    setUndoStack([]);
    setEditorWarnings([]);
    setAdvisorActive(false);
  }, [schedule]);

  const handleConvertToDraft = useCallback(() => {
    setDraftSchedule(JSON.parse(JSON.stringify(simulationSchedule)));
    setEditorMode("draft");
  }, [simulationSchedule]);

  const handleCaptureSchedule = useCallback(async () => {
    setIsCapturing(true);
    setExportProgress(10);
    setExportMessage("Preparing schedule...");
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const scheduleElement = document.getElementById("schedule-capture-target");
    if (!scheduleElement) {
      setIsCapturing(false);
      setExportProgress(0);
      return;
    }
    
    try {
      setExportProgress(20);
      setExportMessage("Loading fonts...");
      await document.fonts.ready;
      
      setExportProgress(40);
      setExportMessage("Rendering schedule...");
      
      const canvas = await html2canvas(scheduleElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
      });
      
      setExportProgress(80);
      setExportMessage("Creating image...");
      
      canvas.toBlob((blob) => {
        if (!blob) {
          setIsCapturing(false);
          setExportProgress(0);
          return;
        }
        
        setExportProgress(90);
        setExportMessage("Downloading...");
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `schedule-${todayDate}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setExportProgress(100);
        setExportMessage("Complete!");
        
        setTimeout(() => {
          setCaptureDialogOpen(false);
          setIsCapturing(false);
          setExportProgress(0);
        }, 500);
      }, "image/png");
    } catch (error) {
      console.error("Failed to capture schedule:", error);
      setIsCapturing(false);
      setExportProgress(0);
    }
  }, [todayDate]);

  const handleMakeOfficial = useCallback(async () => {
    if (!staffList || !clientList || !templateAssignments || !clientLocations || !schools) return;
    
    const currentScheduleToCommit = editorMode === "whatif" ? simulationSchedule : draftSchedule;
    
    const snapshot: ScheduleSnapshot = {
      staffSchedules: currentScheduleToCommit.map(ss => ({
        staffId: ss.staffId,
        staffName: staffList.find(s => s.id === ss.staffId)?.name || ss.staffId,
        slots: ss.slots.map(slot => ({
          block: slot.block,
          value: slot.value,
          clientId: slot.clientId,
          status: slot.source === "UNFILLED" ? "unfilled" : slot.source === "CANCEL" ? "cancelled" : "assigned",
          reason: slot.reason,
          source: slot.source,
          location: slot.location
        }))
      })),
      exceptions: exceptions.map(e => ({
        id: e.id,
        type: e.type,
        entityId: e.entityId,
        mode: e.mode,
        allDay: e.allDay,
        timeWindow: e.timeWindow
      })),
      approvals: pendingApprovals.filter(a => a.status === "approved").map(a => ({
        id: a.id,
        type: a.type,
        relatedId: a.clientId || a.id,
        status: a.status
      }))
    };
    
    try {
      await generateMutation.mutateAsync({ 
        snapshot, 
        label: "Manual editor commit",
        derivedFromVersion: currentVersion || undefined 
      });
      setEditorOpen(false);
    } catch (error) {
      console.error("Failed to make official:", error);
    }
  }, [staffList, clientList, templateAssignments, clientLocations, schools, exceptions, pendingApprovals, currentVersion, generateMutation, editorMode, simulationSchedule, draftSchedule]);

  const sortedStaffList = useMemo(() => {
    return [...(staffList || [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [staffList]);

  const sortedClientList = useMemo(() => {
    return [...(clientList || [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [clientList]);

  const displaySchedule = editorOpen ? currentPreviewSchedule : schedule;
  const filteredDisplaySchedule = useMemo(() => {
    if (!editorOpen) return filteredSchedule;
    return currentPreviewSchedule.filter(s => {
      if (!staffList) return true;
      const staff = staffList.find(st => st.id === s.staffId);
      return staff?.active !== false;
    }).sort((a, b) => {
      const staffA = staffList?.find(s => s.id === a.staffId);
      const staffB = staffList?.find(s => s.id === b.staffId);
      return (staffA?.name || "").localeCompare(staffB?.name || "");
    });
  }, [editorOpen, currentPreviewSchedule, filteredSchedule, staffList]);

  const isDataLoading = isLoadingStaff || isLoadingClients || isLoadingSchedule;

  // Day at a Glance summary statistics
  const dayAtAGlance = useMemo(() => {
    if (!schedule || schedule.length === 0) {
      return { totalHours: 0, appointments: 0, breaks: 0, lunches: 0, activeStaff: 0, staffOut: 0, unfilledSlots: 0 };
    }
    
    let totalMinutes = 0;
    let appointments = 0;
    let breaks = 0;
    let lunches = 0;
    let unfilledSlots = 0;
    
    const activeStaff = schedule.filter(s => s.status === "ACTIVE").length;
    const staffOut = schedule.filter(s => s.status === "OUT").length;
    
    for (const staffSchedule of schedule) {
      for (const slot of staffSchedule.slots) {
        const startMin = slot.startMinute ?? 0;
        const endMin = slot.endMinute ?? 0;
        const duration = endMin - startMin;
        
        if (slot.value === "LUNCH") {
          lunches++;
        } else if (slot.value === "BREAK") {
          breaks++;
        } else if (slot.source === "UNFILLED") {
          unfilledSlots++;
        } else if (slot.clientId && slot.source !== "CANCEL" && slot.source !== "OFF_SCHEDULE") {
          appointments++;
          totalMinutes += duration;
        }
        
        // Count segments if present
        if (slot.segments) {
          for (const seg of slot.segments) {
            if (seg.value === "LUNCH") lunches++;
            else if (seg.value === "BREAK") breaks++;
          }
        }
      }
    }
    
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
    
    return { totalHours, appointments, breaks, lunches, activeStaff, staffOut, unfilledSlots };
  }, [schedule]);

  return (
    <Layout>
      {isCapturing && (
        <ExportProgress progress={exportProgress} message={exportMessage} />
      )}
      
      {isDataLoading ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary">Schedule</h1>
              <div className="flex items-center gap-2 px-3 py-1 bg-muted/30 rounded-full border text-sm">
                <span className="font-semibold">{formatDate(new Date())}</span>
              </div>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <ScheduleGridSkeleton rows={15} />
            </CardContent>
          </Card>
        </div>
      ) : (
      <div className="flex flex-col min-h-[calc(100vh-140px)] gap-4 md:gap-6">
        
        <div className="flex-none space-y-3 md:space-y-4">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
             <div className="flex flex-wrap items-center gap-2 md:gap-4">
               <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary">Schedule</h1>
               <div className="flex items-center gap-2 px-2 md:px-3 py-1 bg-muted/30 rounded-full border border-border text-xs md:text-sm">
                 <span className="font-medium uppercase text-muted-foreground tracking-wider hidden sm:inline">Today:</span>
                 <span className="font-semibold text-foreground">{formatDate(new Date())}</span>
               </div>
               {currentVersion !== null && (
                 <Badge variant="outline" className="text-xs">
                   Version {currentVersion}
                 </Badge>
               )}
             </div>
             <div className="flex gap-2 flex-wrap">
               <Link href="/daily">
                 <Button variant="outline" className="gap-2 text-sm">
                   <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to</span> Daily Run
                 </Button>
               </Link>
               <Link href="/schedule/changes">
                 <Button variant="outline" className="gap-2 text-sm" data-testid="button-change-log">
                   <FileText className="w-4 h-4" /> <span className="hidden sm:inline">Change Log</span>
                 </Button>
               </Link>
               <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                 <DialogTrigger asChild>
                   <Button 
                     variant="outline" 
                     className="gap-2 text-sm"
                     onClick={handleGenerateCoverageReports}
                     data-testid="button-coverage-reports"
                   >
                     <ClipboardList className="w-4 h-4" />
                     <span className="hidden sm:inline">Coverage Reports</span>
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                   <DialogHeader>
                     <DialogTitle className="text-xl font-serif">Coverage Reports</DialogTitle>
                   </DialogHeader>
                   {coverageReports && (
                     <ScrollArea className="flex-1 pr-4">
                       <div className="space-y-8">
                         <div className="space-y-3">
                           <div className="flex items-center justify-between">
                             <h3 className="text-lg font-semibold text-primary">Client Coverage Report — Today</h3>
                             <Button 
                               variant="ghost" 
                               size="sm" 
                               onClick={() => handleCopyReport("client")}
                               className="gap-1 text-xs"
                               data-testid="button-copy-client-report"
                             >
                               {copiedSection === "client" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                               {copiedSection === "client" ? "Copied" : "Copy"}
                             </Button>
                           </div>
                           <p className="text-sm text-muted-foreground">Source: {coverageReports.sourceLabel}</p>
                           <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap select-all">
                             {coverageReports.clientReport.map(entry => (
                               <div key={entry.clientId} className="mb-4">
                                 <div className="font-bold text-foreground">{entry.clientName}</div>
                                 <div className="border-b border-border mb-1" style={{ width: `${entry.clientName.length * 8}px` }}></div>
                                 {entry.cancelledAllDay ? (
                                   <div className="text-destructive pl-2">CANCELLED ALL DAY</div>
                                 ) : (
                                   <>
                                     {entry.blocks.map(block => {
                                       const finalDisplay = block.finalStaff.length > 0 
                                         ? block.finalStaff.join(" + ") 
                                         : "UNFILLED";
                                       const displayText = block.changed && block.templateStaff
                                         ? `${block.templateStaff} → ${finalDisplay}`
                                         : block.changed && !block.templateStaff
                                         ? `Unassigned → ${finalDisplay}`
                                         : finalDisplay;
                                       return (
                                         <div key={block.block} className={cn("pl-2", block.finalStaff.length === 0 && "text-destructive")}>
                                           {block.block}: {displayText}
                                         </div>
                                       );
                                     })}
                                     {entry.cancelledAt && (
                                       <div className="pl-2 text-amber-600">Cancelled at {entry.cancelledAt}</div>
                                     )}
                                   </>
                                 )}
                               </div>
                             ))}
                           </div>
                         </div>
                         
                         <div className="space-y-3">
                           <div className="flex items-center justify-between">
                             <h3 className="text-lg font-semibold text-primary">Staff Coverage Report — Today</h3>
                             <Button 
                               variant="ghost" 
                               size="sm" 
                               onClick={() => handleCopyReport("staff")}
                               className="gap-1 text-xs"
                               data-testid="button-copy-staff-report"
                             >
                               {copiedSection === "staff" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                               {copiedSection === "staff" ? "Copied" : "Copy"}
                             </Button>
                           </div>
                           <p className="text-sm text-muted-foreground">Source: {coverageReports.sourceLabel}</p>
                           <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap select-all">
                             {coverageReports.staffReport.map(entry => (
                               <div key={entry.staffId} className="mb-4">
                                 <div className="font-bold text-foreground">{entry.staffName}</div>
                                 <div className="border-b border-border mb-1" style={{ width: `${entry.staffName.length * 8}px` }}></div>
                                 {entry.blocks.map(block => {
                                   let displayText = "";
                                   switch (block.status) {
                                     case "assigned":
                                       displayText = block.clientInitials || "";
                                       break;
                                     case "on_call":
                                       displayText = "ON CALL";
                                       break;
                                     case "out_all_day":
                                       displayText = "OUT all day";
                                       break;
                                     case "out_until":
                                       displayText = `OUT until ${block.outUntil}`;
                                       break;
                                     case "lunch":
                                       displayText = "LUNCH";
                                       break;
                                   }
                                   return (
                                     <div key={block.block} className={cn("pl-2", block.status === "on_call" && "text-muted-foreground")}>
                                       {block.block}: {displayText}
                                     </div>
                                   );
                                 })}
                               </div>
                             ))}
                           </div>
                         </div>
                       </div>
                     </ScrollArea>
                   )}
                 </DialogContent>
               </Dialog>
               <Dialog open={explainerDialogOpen} onOpenChange={setExplainerDialogOpen}>
                 <DialogTrigger asChild>
                   <Button 
                     variant="outline" 
                     className="gap-2 text-sm"
                     onClick={handleGenerateExplainer}
                     data-testid="button-schedule-explainer"
                   >
                     <HelpCircle className="w-4 h-4" />
                     <span className="hidden sm:inline">Explainer</span>
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                   <DialogHeader>
                     <DialogTitle className="text-xl font-serif flex items-center gap-2">
                       <HelpCircle className="w-5 h-5 text-primary" />
                       Schedule Explainer
                     </DialogTitle>
                     {explainerReport && (
                       <p className="text-sm text-muted-foreground">
                         {explainerReport.date} — Generated at {explainerReport.generatedAt}
                       </p>
                     )}
                   </DialogHeader>
                   {explainerReport && (
                     <ScrollArea className="flex-1 pr-4">
                       <div className="space-y-6">
                         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                           <div className="p-3 rounded-lg bg-muted/50 text-center">
                             <div className="text-2xl font-bold text-primary">{explainerReport.summary.filledSlots}</div>
                             <div className="text-xs text-muted-foreground">Filled Slots</div>
                           </div>
                           <div className="p-3 rounded-lg bg-muted/50 text-center">
                             <div className={cn("text-2xl font-bold", explainerReport.summary.unfilledSlots > 0 ? "text-destructive" : "text-emerald-600")}>
                               {explainerReport.summary.unfilledSlots}
                             </div>
                             <div className="text-xs text-muted-foreground">Unfilled Gaps</div>
                           </div>
                           <div className="p-3 rounded-lg bg-muted/50 text-center">
                             <div className="text-2xl font-bold">{explainerReport.summary.substitutionCount}</div>
                             <div className="text-xs text-muted-foreground">Substitutions</div>
                           </div>
                           <div className="p-3 rounded-lg bg-muted/50 text-center">
                             <div className={cn("text-2xl font-bold", explainerReport.summary.cancellationCount > 0 ? "text-amber-600" : "")}>
                               {explainerReport.summary.cancellationCount}
                             </div>
                             <div className="text-xs text-muted-foreground">Cancellations</div>
                           </div>
                           <div className="p-3 rounded-lg bg-muted/50 text-center">
                             <div className={cn("text-2xl font-bold", explainerReport.summary.pendingApprovalCount > 0 ? "text-amber-600" : "")}>
                               {explainerReport.summary.pendingApprovalCount}
                             </div>
                             <div className="text-xs text-muted-foreground">Pending Approvals</div>
                           </div>
                           <div className="p-3 rounded-lg bg-muted/50 text-center">
                             <div className="text-2xl font-bold">{explainerReport.majorChanges.length}</div>
                             <div className="text-xs text-muted-foreground">Major Changes</div>
                           </div>
                         </div>

                         <Accordion type="multiple" defaultValue={["substitutions", "cancellations", "approvals"]} className="space-y-2">
                           {explainerReport.substitutions.length > 0 && (
                             <AccordionItem value="substitutions" className="border rounded-lg px-4">
                               <AccordionTrigger className="hover:no-underline">
                                 <div className="flex items-center gap-2">
                                   <Users className="w-4 h-4 text-blue-600" />
                                   <span className="font-semibold">Substitutions ({explainerReport.substitutions.length})</span>
                                 </div>
                               </AccordionTrigger>
                               <AccordionContent>
                                 <div className="space-y-3 pt-2">
                                   {explainerReport.substitutions.map((sub, i) => (
                                     <div key={i} className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                                       <div className="flex items-center justify-between mb-2">
                                         <span className="font-medium">{sub.clientName}</span>
                                         <Badge variant="outline" className="text-xs">{sub.block}</Badge>
                                       </div>
                                       <div className="text-sm space-y-1">
                                         <div className="flex items-center gap-2">
                                           <span className="text-muted-foreground">Original:</span>
                                           <span className="line-through text-muted-foreground">{sub.originalStaffName || "Unassigned"}</span>
                                           <span className="text-xs text-red-600">({sub.originalStaffOutReason})</span>
                                         </div>
                                         <div className="flex items-center gap-2">
                                           <span className="text-muted-foreground">Substitute:</span>
                                           <span className="font-medium text-blue-700">{sub.substituteStaffName}</span>
                                           <Badge variant="secondary" className="text-xs">{sub.substituteType}</Badge>
                                         </div>
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               </AccordionContent>
                             </AccordionItem>
                           )}

                           {explainerReport.allDayStaffing.length > 0 && (
                             <AccordionItem value="allday" className="border rounded-lg px-4">
                               <AccordionTrigger className="hover:no-underline">
                                 <div className="flex items-center gap-2">
                                   <UserCheck className="w-4 h-4 text-purple-600" />
                                   <span className="font-semibold">All-Day Staffing ({explainerReport.allDayStaffing.length})</span>
                                 </div>
                               </AccordionTrigger>
                               <AccordionContent>
                                 <div className="space-y-3 pt-2">
                                   {explainerReport.allDayStaffing.map((entry, i) => (
                                     <div key={i} className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                                       <div className="flex items-center justify-between">
                                         <div>
                                           <span className="font-medium">{entry.staffName}</span>
                                           <span className="text-muted-foreground mx-2">→</span>
                                           <span>{entry.clientName}</span>
                                         </div>
                                         <Badge variant={entry.approvalStatus === "approved" ? "default" : "outline"} className="text-xs">
                                           {entry.approvalStatus}
                                         </Badge>
                                       </div>
                                       <p className="text-sm text-muted-foreground mt-1">{entry.reason}</p>
                                     </div>
                                   ))}
                                 </div>
                               </AccordionContent>
                             </AccordionItem>
                           )}

                           {explainerReport.cancellations.length > 0 && (
                             <AccordionItem value="cancellations" className="border rounded-lg px-4">
                               <AccordionTrigger className="hover:no-underline">
                                 <div className="flex items-center gap-2">
                                   <AlertCircle className="w-4 h-4 text-amber-600" />
                                   <span className="font-semibold">Client Cancellations ({explainerReport.cancellations.length})</span>
                                 </div>
                               </AccordionTrigger>
                               <AccordionContent>
                                 <div className="space-y-3 pt-2">
                                   {explainerReport.cancellations.map((cancel, i) => (
                                     <div key={i} className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                                       <div className="flex items-center justify-between mb-2">
                                         <span className="font-medium">{cancel.clientName}</span>
                                         <Badge variant="outline" className="text-xs capitalize">{cancel.cancelType.replace("_", " ")}</Badge>
                                       </div>
                                       <p className="text-sm text-muted-foreground">{cancel.reason}</p>
                                       {cancel.protectionStatus && (
                                         <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded inline-block">
                                           {cancel.protectionStatus}
                                         </div>
                                       )}
                                       {cancel.skipRuleApplied && (
                                         <div className="mt-2 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">
                                           Skip rule applied
                                         </div>
                                       )}
                                     </div>
                                   ))}
                                 </div>
                               </AccordionContent>
                             </AccordionItem>
                           )}

                           {explainerReport.trainingCancellations.length > 0 && (
                             <AccordionItem value="training" className="border rounded-lg px-4">
                               <AccordionTrigger className="hover:no-underline">
                                 <div className="flex items-center gap-2">
                                   <FileText className="w-4 h-4 text-red-600" />
                                   <span className="font-semibold">Training Disruptions ({explainerReport.trainingCancellations.length})</span>
                                 </div>
                               </AccordionTrigger>
                               <AccordionContent>
                                 <div className="space-y-3 pt-2">
                                   {explainerReport.trainingCancellations.map((training, i) => (
                                     <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-100">
                                       <div className="flex items-center justify-between mb-2">
                                         <span className="font-medium">Session {training.sessionId}</span>
                                         <Badge variant={training.newStatus === "blocked" ? "destructive" : "outline"} className="text-xs">
                                           {training.newStatus}
                                         </Badge>
                                       </div>
                                       <p className="text-sm text-muted-foreground">{training.reason}</p>
                                     </div>
                                   ))}
                                 </div>
                               </AccordionContent>
                             </AccordionItem>
                           )}

                           {explainerReport.pendingApprovals.length > 0 && (
                             <AccordionItem value="approvals" className="border rounded-lg px-4">
                               <AccordionTrigger className="hover:no-underline">
                                 <div className="flex items-center gap-2">
                                   <Check className="w-4 h-4 text-amber-600" />
                                   <span className="font-semibold">Pending Approvals ({explainerReport.pendingApprovals.length})</span>
                                 </div>
                               </AccordionTrigger>
                               <AccordionContent>
                                 <div className="space-y-3 pt-2">
                                   {explainerReport.pendingApprovals.map((approval, i) => (
                                     <div key={i} className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                                       <div className="flex items-center justify-between mb-2">
                                         <span className="font-medium">{approval.typeLabel}</span>
                                         <Badge variant="outline" className="text-xs">{approval.block}</Badge>
                                       </div>
                                       <div className="text-sm space-y-1">
                                         <div><span className="text-muted-foreground">Client:</span> {approval.clientName}</div>
                                         <div><span className="text-muted-foreground">Staff:</span> {approval.staffName}</div>
                                         <div><span className="text-muted-foreground">Reason:</span> {approval.reason}</div>
                                         <div className="text-primary font-medium">{approval.proposedAction}</div>
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               </AccordionContent>
                             </AccordionItem>
                           )}

                           {explainerReport.majorChanges.length > 0 && (
                             <AccordionItem value="changes" className="border rounded-lg px-4">
                               <AccordionTrigger className="hover:no-underline">
                                 <div className="flex items-center gap-2">
                                   <RefreshCw className="w-4 h-4 text-indigo-600" />
                                   <span className="font-semibold">Major Changes ({explainerReport.majorChanges.length})</span>
                                 </div>
                               </AccordionTrigger>
                               <AccordionContent>
                                 <div className="space-y-3 pt-2">
                                   {explainerReport.majorChanges.map((change, i) => (
                                     <div key={i} className="p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                                       <div className="flex items-center justify-between mb-2">
                                         <span className="font-medium">{change.clientName}</span>
                                         <Badge variant="outline" className="text-xs">{change.block}</Badge>
                                       </div>
                                       <div className="text-sm flex items-center gap-2">
                                         <span className="line-through text-muted-foreground">{change.before}</span>
                                         <ChevronRight className="w-4 h-4" />
                                         <span className="font-medium text-indigo-700">{change.after}</span>
                                       </div>
                                       <p className="text-xs text-muted-foreground mt-1">{change.reason}</p>
                                     </div>
                                   ))}
                                 </div>
                               </AccordionContent>
                             </AccordionItem>
                           )}

                           {explainerReport.lunchCoverageIssues.length > 0 && (
                             <AccordionItem value="lunch" className="border rounded-lg px-4">
                               <AccordionTrigger className="hover:no-underline">
                                 <div className="flex items-center gap-2">
                                   <AlertCircle className="w-4 h-4 text-orange-600" />
                                   <span className="font-semibold">Lunch Coverage Issues ({explainerReport.lunchCoverageIssues.length})</span>
                                 </div>
                               </AccordionTrigger>
                               <AccordionContent>
                                 <div className="space-y-3 pt-2">
                                   {explainerReport.lunchCoverageIssues.map((issue, i) => (
                                     <div key={i} className="p-3 rounded-lg bg-orange-50 border border-orange-100">
                                       <div className="flex items-center justify-between mb-1">
                                         <span className="font-medium">{issue.clientName}</span>
                                         <Badge variant="outline" className="text-xs">{issue.lunchSlot}</Badge>
                                       </div>
                                       <p className="text-sm text-muted-foreground">{issue.reason}</p>
                                     </div>
                                   ))}
                                 </div>
                               </AccordionContent>
                             </AccordionItem>
                           )}
                         </Accordion>

                         {explainerReport.slotExplanations.length > 0 && (
                           <div className="border rounded-lg p-4">
                             <h3 className="font-semibold mb-3 flex items-center gap-2">
                               <FileText className="w-4 h-4" />
                               Per-Slot Decision Details
                             </h3>
                             <ScrollArea className="h-64">
                               <div className="space-y-2">
                                 {explainerReport.slotExplanations
                                   .filter(slot => slot.assignmentChain.length > 1 || slot.source !== "TEMPLATE")
                                   .slice(0, 50)
                                   .map((slot, i) => (
                                     <div key={i} className="p-2 rounded bg-muted/30 text-sm">
                                       <div className="flex items-center gap-2 mb-1">
                                         <span className="font-medium">{slot.staffName}</span>
                                         <ChevronRight className="w-3 h-3" />
                                         <span>{slot.clientName}</span>
                                         <Badge variant="outline" className="text-[10px] ml-auto">{slot.block}</Badge>
                                       </div>
                                       <div className="text-xs text-muted-foreground">
                                         <div className="flex flex-wrap gap-1 mb-1">
                                           {slot.assignmentChain.map((step, j) => (
                                             <span key={j} className="flex items-center gap-1">
                                               {j > 0 && <ChevronRight className="w-3 h-3" />}
                                               <span className="bg-muted px-1.5 py-0.5 rounded">{step}</span>
                                             </span>
                                           ))}
                                         </div>
                                         <p className="italic">{slot.decisionReason}</p>
                                       </div>
                                     </div>
                                   ))}
                               </div>
                             </ScrollArea>
                           </div>
                         )}
                       </div>
                     </ScrollArea>
                   )}
                 </DialogContent>
               </Dialog>
               <Button 
                 variant={editorOpen ? "default" : "outline"}
                 className="gap-2 text-sm"
                 onClick={editorOpen ? handleCloseEditor : handleOpenEditor}
                 data-testid="button-schedule-editor"
               >
                 <Wrench className="w-4 h-4" />
                 <span className="hidden sm:inline">{editorOpen ? "Close Editor" : "Editor"}</span>
               </Button>
               <Button 
                 variant="outline"
                 className="gap-2 text-sm"
                 onClick={() => setCaptureDialogOpen(true)}
                 data-testid="button-capture-schedule"
               >
                 <Camera className="w-4 h-4" />
                 <span className="hidden sm:inline">Capture</span>
               </Button>
             </div>
           </div>

           {/* Day at a Glance Summary */}
           <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3 bg-card border border-border/60 rounded-md p-3 shadow-sm" data-testid="day-at-a-glance">
             <div className="flex flex-col items-center p-2 rounded bg-primary/5 border border-primary/20">
               <span className="text-2xl font-bold text-primary">{dayAtAGlance.totalHours}</span>
               <span className="text-xs text-muted-foreground text-center">Total Hours</span>
             </div>
             <div className="flex flex-col items-center p-2 rounded bg-teal-50 border border-teal-200">
               <span className="text-2xl font-bold text-teal-700">{dayAtAGlance.appointments}</span>
               <span className="text-xs text-muted-foreground text-center">Appointments</span>
             </div>
             <div className="flex flex-col items-center p-2 rounded bg-emerald-50 border border-emerald-200">
               <span className="text-2xl font-bold text-emerald-700">{dayAtAGlance.activeStaff}</span>
               <span className="text-xs text-muted-foreground text-center">Staff Active</span>
             </div>
             <div className="flex flex-col items-center p-2 rounded bg-amber-50 border border-amber-200">
               <span className="text-2xl font-bold text-amber-700">{dayAtAGlance.lunches}</span>
               <span className="text-xs text-muted-foreground text-center">Lunch Breaks</span>
             </div>
             <div className="flex flex-col items-center p-2 rounded bg-blue-50 border border-blue-200">
               <span className="text-2xl font-bold text-blue-700">{dayAtAGlance.breaks}</span>
               <span className="text-xs text-muted-foreground text-center">Breaks</span>
             </div>
             {dayAtAGlance.staffOut > 0 && (
               <div className="flex flex-col items-center p-2 rounded bg-slate-100 border border-slate-300">
                 <span className="text-2xl font-bold text-slate-600">{dayAtAGlance.staffOut}</span>
                 <span className="text-xs text-muted-foreground text-center">Staff Out</span>
               </div>
             )}
             {dayAtAGlance.unfilledSlots > 0 && (
               <div className="flex flex-col items-center p-2 rounded bg-red-50 border border-red-300">
                 <span className="text-2xl font-bold text-red-600">{dayAtAGlance.unfilledSlots}</span>
                 <span className="text-xs text-muted-foreground text-center">Unfilled</span>
               </div>
             )}
           </div>

           <Dialog open={captureDialogOpen} onOpenChange={setCaptureDialogOpen}>
             <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-0 overflow-hidden">
               <DialogHeader className="px-6 py-4 border-b bg-card flex-shrink-0">
                 <DialogTitle className="text-xl font-serif flex items-center justify-between">
                   <span className="flex items-center gap-2">
                     <Camera className="w-5 h-5 text-primary" />
                     Schedule Capture
                   </span>
                   <Button 
                     onClick={handleCaptureSchedule}
                     disabled={isCapturing}
                     className="gap-2"
                     data-testid="button-save-schedule-image"
                   >
                     {isCapturing ? (
                       <>
                         <Loader2 className="w-4 h-4 animate-spin" />
                         Capturing...
                       </>
                     ) : (
                       <>
                         <Download className="w-4 h-4" />
                         Save as Image
                       </>
                     )}
                   </Button>
                 </DialogTitle>
               </DialogHeader>
               <div className="flex-1 overflow-auto p-6 bg-white">
                 <div id="schedule-capture-target" className="bg-white p-6">
                   <div className="text-center mb-6">
                     <h1 className="text-2xl font-serif font-bold text-primary">Daily Schedule</h1>
                     <p className="text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                   </div>
                   
                   <div className="space-y-1">
                     {displaySchedule.map((staffSchedule) => {
                       const staffMember = staffList?.find(s => s.id === staffSchedule.staffId);
                       if (!staffMember) return null;
                       
                       return (
                         <div key={staffSchedule.staffId} className="flex items-stretch border-b border-gray-200 last:border-b-0">
                           <div className="w-32 flex-shrink-0 py-2 px-3 bg-gray-50 border-r border-gray-200 flex items-center">
                             <span className="font-medium text-sm truncate">{staffMember.name}</span>
                           </div>
                           <div className="flex-1 relative h-10" style={{ minWidth: '600px' }}>
                             {staffSchedule.slots.map((slot, index) => {
                               if (slot.source === "OFF_SCHEDULE") return null;
                               if (slot.startMinute === undefined || slot.endMinute === undefined) return null;
                               
                               const leftPercent = minuteToPercent(slot.startMinute);
                               const widthPercent = durationToPercent(slot.startMinute, slot.endMinute);
                               
                               const bgColor = slot.source === "UNFILLED" ? "bg-red-100 border-red-300" :
                                              slot.source === "CANCEL" ? "bg-gray-100 border-gray-300" :
                                              slot.source === "REPAIR" ? "bg-amber-100 border-amber-300" :
                                              slot.source === "TRAINING" ? "bg-purple-100 border-purple-300" :
                                              "bg-teal-100 border-teal-300";
                               
                               const client = clientList?.find(c => c.id === slot.clientId);
                               const initials = client?.name?.split(' ').map(n => n[0]).join('') || slot.value.slice(0, 2);
                               
                               return (
                                 <div 
                                   key={index}
                                   className={cn("absolute top-1 bottom-1 border rounded px-1 flex flex-col justify-center text-[10px] overflow-hidden", bgColor)}
                                   style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                                 >
                                   <span className="font-medium truncate">{initials}</span>
                                   <span className="text-[8px] text-gray-500 truncate">
                                     {formatMinutesToTime(slot.startMinute)}-{formatMinutesToTime(slot.endMinute)}
                                   </span>
                                 </div>
                               );
                             })}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                   
                   <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-500">
                     <div className="flex items-center gap-1">
                       <div className="w-3 h-3 rounded bg-teal-100 border border-teal-300"></div>
                       <span>Template</span>
                     </div>
                     <div className="flex items-center gap-1">
                       <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></div>
                       <span>Substitute</span>
                     </div>
                     <div className="flex items-center gap-1">
                       <div className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></div>
                       <span>Training</span>
                     </div>
                     <div className="flex items-center gap-1">
                       <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300"></div>
                       <span>Cancelled</span>
                     </div>
                   </div>
                 </div>
               </div>
             </DialogContent>
           </Dialog>
           
           {editorOpen && (
             <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2 flex items-center gap-3">
               <AlertTriangle className="w-5 h-5 text-amber-600" />
               <span className="font-medium text-amber-800">
                 Editor Mode: {editorMode === "whatif" ? "What-If (Simulation)" : "Draft (Commit-Eligible)"}
               </span>
               <span className="text-sm text-amber-600">
                 — Changes are previewed only. {editorMode === "draft" ? "Click 'Make Official' to commit." : "Convert to Draft to commit."}
               </span>
             </div>
           )}
           
           <div className="flex flex-wrap items-center gap-3 md:gap-6 text-xs md:text-sm py-2 px-3 md:px-4 bg-card border border-border/60 rounded-md shadow-sm">
              <span className="text-muted-foreground hidden sm:inline">
                Last Generated: <span className="text-foreground font-medium">{lastGeneratedTime || "Not Yet"}</span>
              </span>
              
              <div className="flex-1" />
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGenerateSchedule}
                  disabled={generateMutation.isPending}
                  className="gap-1"
                  data-testid="button-regenerate"
                >
                  <RefreshCw className={cn("w-3 h-3", generateMutation.isPending && "animate-spin")} />
                  <span className="hidden sm:inline">Regenerate</span>
                </Button>
                
                {scheduleVersions && scheduleVersions.length > 1 && (
                  <Select onValueChange={(v) => handleRewind(parseInt(v, 10))}>
                    <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-rewind">
                      <History className="w-3 h-3 mr-1" />
                      <SelectValue placeholder="Rewind To..." />
                    </SelectTrigger>
                    <SelectContent>
                      {scheduleVersions
                        .filter(v => v.version !== currentVersion)
                        .map(v => (
                          <SelectItem key={v.version} value={v.version.toString()}>
                            V{v.version} - {v.label || "Generated"} ({new Date(v.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1" data-testid="button-hard-reset">
                      <RotateCcw className="w-3 h-3" />
                      <span className="hidden sm:inline">Hard Reset</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hard Reset Schedule?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will clear all changes and regenerate the schedule from the original template. All exceptions and approvals for today will be removed. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleHardReset} disabled={resetMutation.isPending}>
                        {resetMutation.isPending ? "Resetting..." : "Reset To Template"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
           </div>
        </div>

        <div 
          ref={scheduleContainerRef}
          className="flex-1 min-h-0 border rounded-lg bg-card shadow-sm overflow-auto"
        >
          <div style={{ minWidth: `${contentAwareConfig.totalMinWidth + 180}px` }}>
            <div className="sticky top-0 z-10 flex bg-muted/95 border-b backdrop-blur-sm">
              <div className="w-[140px] md:w-[180px] p-2 md:p-4 font-medium text-xs md:text-sm text-muted-foreground uppercase tracking-wider flex items-center border-r border-border/40 shrink-0 sticky left-0 bg-muted/95 z-20">
                Staff
              </div>
              <div style={{ width: `${contentAwareConfig.totalMinWidth}px` }}>
                <GridTimeAxis gridTemplate={sharedGridTemplate} />
              </div>
            </div>

            {shouldVirtualize ? (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = filteredSchedule[virtualRow.index];
                  const staffRecord = staffList?.find(s => s.id === row.staffId);
                  const staffName = staffDisplayNames.get(row.staffId) || staffRecord?.name || row.staffId;
                  const partialOutWindow = staffPartialOut.get(row.staffId);
                  const hasPartialOut = !!partialOutWindow;

                  return (
                    <div
                      key={row.staffId}
                      className="flex group absolute w-full border-b border-border/40"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="w-[140px] md:w-[180px] p-3 md:p-4 flex flex-col justify-center border-r border-border/40 bg-card group-hover:bg-muted/5 transition-colors shrink-0 sticky left-0 z-10">
                        <span className="font-medium text-sm truncate">{staffName}</span>
                        {(hasPartialOut || row.status === "OUT" || row.status === "OPEN") && (
                          <div className="mt-1">
                            <Badge variant="outline" className={cn(
                              "text-[10px] py-0 h-4 border-0", 
                              hasPartialOut ? "bg-amber-50 text-amber-600" : 
                              row.status === "OUT" ? "bg-destructive/10 text-destructive" :
                              "bg-blue-50 text-blue-600"
                            )}>
                              {hasPartialOut ? `Out Until ${partialOutWindow.end}` : row.status}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div 
                        className="grid h-[72px] bg-muted/10 group-hover:bg-muted/20 transition-colors"
                        style={{ gridTemplateColumns: sharedGridTemplate, width: `${contentAwareConfig.totalMinWidth}px` }}
                      >
                        {row.slots.map((slot, slotIndex) => {
                          const isBlockOut = partialOutWindow && doesBlockOverlapOutWindow(slot.block, partialOutWindow);
                          const slotClientId = slot.clientId;
                          const isClientUnavailable = slotClientId && clientsUnavailable.has(slotClientId);
                          
                          return (
                            <GridScheduleCell
                              key={slot.id}
                              slot={slot}
                              staffName={staffName}
                              staff={staffRecord}
                              isBlockOut={!!isBlockOut}
                              isClientUnavailable={!!isClientUnavailable}
                              partialOutWindow={partialOutWindow}
                              slotIndex={slotIndex}
                              groupLeaderTag={groupLeaderTags.get(slot.id)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredSchedule.map((row) => {
                  const staffRecord = staffList?.find(s => s.id === row.staffId);
                  const staffName = staffDisplayNames.get(row.staffId) || staffRecord?.name || row.staffId;
                  const partialOutWindow = staffPartialOut.get(row.staffId);
                  const hasPartialOut = !!partialOutWindow;

                  return (
                    <div key={row.staffId} className="flex group">
                      <div className="w-[140px] md:w-[180px] p-3 md:p-4 flex flex-col justify-center border-r border-border/40 bg-card group-hover:bg-muted/5 transition-colors shrink-0 sticky left-0 z-10">
                        <span className="font-medium text-sm truncate">{staffName}</span>
                        {(hasPartialOut || row.status === "OUT" || row.status === "OPEN") && (
                          <div className="mt-1">
                            <Badge variant="outline" className={cn(
                              "text-[10px] py-0 h-4 border-0", 
                              hasPartialOut ? "bg-amber-50 text-amber-600" : 
                              row.status === "OUT" ? "bg-destructive/10 text-destructive" :
                              "bg-blue-50 text-blue-600"
                            )}>
                              {hasPartialOut ? `Out Until ${partialOutWindow.end}` : row.status}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div 
                        className="grid h-[72px] bg-muted/10 group-hover:bg-muted/20 transition-colors"
                        style={{ gridTemplateColumns: sharedGridTemplate, width: `${contentAwareConfig.totalMinWidth}px` }}
                      >
                        {row.slots.map((slot, slotIndex) => {
                          const isBlockOut = partialOutWindow && doesBlockOverlapOutWindow(slot.block, partialOutWindow);
                          const slotClientId = slot.clientId;
                          const isClientUnavailable = slotClientId && clientsUnavailable.has(slotClientId);
                          
                          return (
                            <GridScheduleCell
                              key={slot.id}
                              slot={slot}
                              staffName={staffName}
                              staff={staffRecord}
                              isBlockOut={!!isBlockOut}
                              isClientUnavailable={!!isClientUnavailable}
                              partialOutWindow={partialOutWindow}
                              slotIndex={slotIndex}
                              groupLeaderTag={groupLeaderTags.get(slot.id)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <Card className="flex-none border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-serif">In/Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Staff</span>
                </div>
                <div className="space-y-2">
                  {staffExceptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No staff changes.</p>
                  ) : (
                    staffExceptions.map((ex) => {
                      const staffName = staffList?.find(s => s.id === ex.entityId)?.name || ex.entityId;
                      return (
                        <div key={ex.id} className="text-sm text-foreground">
                          {getStatusText(ex, staffName)}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Clients</span>
                </div>
                <div className="space-y-2">
                  {clientExceptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No client changes.</p>
                  ) : (
                    clientExceptions.map((ex) => {
                      const clientName = clientList?.find(c => c.id === ex.entityId)?.name || ex.entityId;
                      return (
                        <div key={ex.id} className="text-sm text-foreground">
                          {getStatusText(ex, clientName)}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
      )}

      {editorOpen && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary shadow-lg z-50">
          <div className="max-w-7xl mx-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-serif font-bold text-primary flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Schedule Editor
                </h3>
                <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as EditorMode)} className="w-auto">
                  <TabsList className="h-8">
                    <TabsTrigger value="whatif" className="text-xs px-3">What-If (Simulation)</TabsTrigger>
                    <TabsTrigger value="draft" className="text-xs px-3">Draft (Commit-Eligible)</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-2">
                {editorWarnings.filter(w => w.type === "hard").length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    {editorWarnings.filter(w => w.type === "hard").length} Hard Constraint Violations
                  </Badge>
                )}
                {editorWarnings.filter(w => w.type === "soft").length > 0 && (
                  <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    {editorWarnings.filter(w => w.type === "soft").length} Warnings
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={handleCloseEditor}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Edit Type</Label>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { type: "change_staff" as EditType, icon: ArrowRightLeft, label: "Change" },
                      { type: "split" as EditType, icon: Scissors, label: "Split" },
                      { type: "train" as EditType, icon: GraduationCap, label: "Train" },
                      { type: "cancel" as EditType, icon: XCircle, label: "Cancel" },
                      { type: "tag" as EditType, icon: Tag, label: "Tag" },
                    ].map(({ type, icon: Icon, label }) => (
                      <Button
                        key={type}
                        variant={selectedEditType === type ? "default" : "outline"}
                        size="sm"
                        className="flex-col h-auto py-2 gap-1"
                        onClick={() => setSelectedEditType(type)}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[10px]">{label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedEditType === "change_staff" && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Staff</Label>
                      <Select value={selectedStaffId || ""} onValueChange={setSelectedStaffId}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select staff..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedStaffList.filter(s => s.active).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Client</Label>
                      <Select value={selectedClientId || ""} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select client..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedClientList.filter(c => c.active).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Start</Label>
                        <Select value={editStartTime} onValueChange={setEditStartTime}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">End</Label>
                        <Select value={editEndTime} onValueChange={setEditEndTime}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {selectedEditType === "cancel" && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Client</Label>
                      <Select value={selectedClientId || ""} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select client..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedClientList.filter(c => c.active).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Cancel Type</Label>
                      <Select value={cancelType} onValueChange={(v) => setCancelType(v as typeof cancelType)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_day">Cancelled All Day</SelectItem>
                          <SelectItem value="cancelled_until">Cancelled Until...</SelectItem>
                          <SelectItem value="cancelled_at">Cancelled At...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {cancelType !== "all_day" && (
                      <div>
                        <Label className="text-xs">Time</Label>
                        <Select value={cancelTime} onValueChange={setCancelTime}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {selectedEditType === "tag" && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Staff</Label>
                      <Select value={selectedStaffId || ""} onValueChange={setSelectedStaffId}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select staff..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedStaffList.filter(s => s.active).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Tag Text</Label>
                      <Input 
                        value={tagText} 
                        onChange={(e) => setTagText(e.target.value)} 
                        placeholder="Enter tag..."
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Start</Label>
                        <Select value={editStartTime} onValueChange={setEditStartTime}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">End</Label>
                        <Select value={editEndTime} onValueChange={setEditEndTime}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {(selectedEditType === "split" || selectedEditType === "train") && (
                  <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground text-center">
                    {selectedEditType === "split" ? "Split editing" : "Training session"} coming soon...
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleApplyEdit}
                    className="flex-1 gap-2"
                    disabled={editorWarnings.some(w => w.type === "hard")}
                  >
                    <Play className="w-4 h-4" />
                    Apply to Preview
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className="gap-1"
                  >
                    <Undo2 className="w-4 h-4" />
                    Undo
                  </Button>
                </div>

                {advisorActive && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-amber-800">Advisor</span>
                    </div>
                    <p className="text-sm text-amber-700">{advisorProblem}</p>
                    <p className="text-xs text-amber-600 mt-1">Review affected staff and reassign as needed.</p>
                  </div>
                )}

                {editorWarnings.length > 0 && (
                  <div className="space-y-2">
                    {editorWarnings.map(warning => (
                      <div 
                        key={warning.id} 
                        className={cn(
                          "p-2 rounded-md text-sm",
                          warning.type === "hard" ? "bg-red-50 border border-red-200 text-red-800" : "bg-amber-50 border border-amber-200 text-amber-800"
                        )}
                      >
                        <div className="font-medium">{warning.rule}</div>
                        <div className="text-xs opacity-80">{warning.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Change Log ({changeLog.length})</Label>
                <ScrollArea className="h-32 border rounded-md p-2">
                  {changeLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No changes yet</p>
                  ) : (
                    <div className="space-y-2">
                      {changeLog.slice().reverse().map(entry => (
                        <div key={entry.id} className="text-xs p-2 bg-muted/30 rounded">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{entry.description}</span>
                            <span className="text-muted-foreground">
                              {entry.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {entry.triggeredAdvisor && (
                            <Badge variant="outline" className="text-[10px] mt-1">Triggered Advisor</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <div className="flex gap-2">
                  {editorMode === "whatif" ? (
                    <>
                      <Button variant="outline" size="sm" onClick={handleDiscardSimulation} className="flex-1 gap-1">
                        <Trash2 className="w-3 h-3" />
                        Discard
                      </Button>
                      <Button size="sm" onClick={handleConvertToDraft} className="flex-1 gap-1">
                        <ArrowRightLeft className="w-3 h-3" />
                        Convert to Draft
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={handleMakeOfficial} 
                      className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700"
                      disabled={editorWarnings.some(w => w.type === "hard") || generateMutation.isPending}
                    >
                      <Check className="w-3 h-3" />
                      Generate (Make Official)
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
